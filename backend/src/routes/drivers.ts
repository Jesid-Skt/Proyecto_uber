// AI-assisted: see docs/AI_LOG.md #3.
import { Router } from 'express';
import { GridFSBucket, ObjectId } from 'mongodb';
import multer from 'multer';
import mongoose from 'mongoose';
import { fileTypeFromBuffer } from 'file-type';
import { authenticate } from '../middleware/authenticate.js';
import { Driver } from '../models/Driver.js';
import { createDocumentStorage, type DriverDocumentKind } from '../services/driver-document-storage.js';
import { serializeDriver } from '../services/driver-serializer.js';
import { HttpError } from '../utils/http-error.js';
import {
  driverAvailabilitySchema,
  driverLocationSchema,
  profileUpdateSchema,
  pushTokenSchema,
} from '../utils/driver-validation.js';

const router = Router();
const documentKinds = new Set<DriverDocumentKind>([
  'profile',
  'vehicle',
  'license',
  'soat',
  'revision',
]);
const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => {
    callback(null, allowedImageTypes.has(file.mimetype));
  },
});

router.use(authenticate);

router.get('/me', async (request, response) => {
  const driver = await Driver.findById(request.driverId);
  if (!driver) {
    throw new HttpError(404, 'No se encontró el perfil del conductor.');
  }
  response.json({ driver: serializeDriver(driver) });
});

router.patch('/me/availability', async (request, response) => {
  const parsed = driverAvailabilitySchema.safeParse(request.body);
  if (!parsed.success) {
    throw parsed.error;
  }

  const driver = await Driver.findOneAndUpdate(
    {
      _id: request.driverId,
      ...(parsed.data.available ? { approvalStatus: 'approved' } : {}),
    },
    {
      $set: {
        available: parsed.data.available,
        ...(!parsed.data.available ? { currentLocation: null } : {}),
      },
    },
    { new: true, runValidators: true },
  );
  if (!driver) {
    const exists = await Driver.exists({ _id: request.driverId });
    if (!exists) {
      throw new HttpError(404, 'No se encontró el perfil del conductor.');
    }
    throw new HttpError(403, 'La cuenta debe estar aprobada para conectarse.');
  }

  response.json({ driver: serializeDriver(driver) });
});

router.patch('/me/location', async (request, response) => {
  const parsed = driverLocationSchema.safeParse(request.body);
  if (!parsed.success) throw parsed.error;
  const driver = await Driver.findOneAndUpdate(
    { _id: request.driverId, approvalStatus: 'approved', available: true },
    { $set: { currentLocation: { ...parsed.data, updatedAt: new Date() } } },
    { new: true, runValidators: true },
  );
  if (!driver) {
    throw new HttpError(409, 'El conductor debe estar aprobado y disponible para compartir ubicación.');
  }
  response.json({ updatedAt: driver.currentLocation?.updatedAt });
});

router.put('/me/push-token', async (request, response) => {
  const parsed = pushTokenSchema.safeParse(request.body);
  if (!parsed.success) throw parsed.error;
  await Driver.updateOne(
    { _id: request.driverId },
    { $addToSet: { pushTokens: parsed.data.token } },
  );
  response.sendStatus(204);
});

router.delete('/me/push-token', async (request, response) => {
  const parsed = pushTokenSchema.safeParse(request.body);
  if (!parsed.success) throw parsed.error;
  await Driver.updateOne(
    { _id: request.driverId },
    { $pull: { pushTokens: parsed.data.token } },
  );
  response.sendStatus(204);
});

router.patch('/me', async (request, response) => {
  const parsed = profileUpdateSchema.safeParse(request.body);
  if (!parsed.success) {
    throw parsed.error;
  }
  if (!Object.keys(parsed.data).length) {
    throw new HttpError(400, 'Indica al menos un campo permitido para actualizar.');
  }

  const driver = await Driver.findById(request.driverId);
  if (!driver) {
    throw new HttpError(404, 'No se encontró el perfil del conductor.');
  }
  if (parsed.data.fullName !== undefined) driver.fullName = parsed.data.fullName;
  if (parsed.data.phone !== undefined) driver.phone = parsed.data.phone;
  if (parsed.data.language !== undefined) driver.language = parsed.data.language;
  if (parsed.data.vehicle !== undefined) {
    driver.set('vehicle', { ...driver.vehicle, ...parsed.data.vehicle });
  }
  if (parsed.data.documents !== undefined) {
    driver.set('documents', { ...driver.documents, ...parsed.data.documents });
  }
  await driver.save();
  response.json({ driver: serializeDriver(driver) });
});

router.get('/me/documents/:documentId', async (request, response, next) => {
  const { documentId } = request.params;
  if (!ObjectId.isValid(documentId)) {
    next(new HttpError(400, 'El identificador del documento no es válido.'));
    return;
  }
  const database = mongoose.connection.db;
  if (!database) {
    next(new HttpError(503, 'La base de datos no está disponible.'));
    return;
  }
  const id = new ObjectId(documentId);
  const file = await database
    .collection('driverDocuments.files')
    .findOne({ _id: id, 'metadata.ownerId': new ObjectId(request.driverId) });
  if (!file) {
    next(new HttpError(404, 'No se encontró el documento.'));
    return;
  }
  const contentType = (file.metadata as { contentType?: string } | undefined)?.contentType;
  response.setHeader('Content-Type', contentType ?? 'application/octet-stream');
  response.setHeader('Cache-Control', 'private, no-store');
  const bucket = new GridFSBucket(database, { bucketName: 'driverDocuments' });
  const stream = bucket.openDownloadStream(id);
  stream.on('error', (error) => {
    if (!response.headersSent) {
      next(error);
    } else {
      response.destroy(error);
    }
  });
  stream.pipe(response);
});

router.put('/me/documents/:kind', upload.single('document'), async (request, response) => {
  const kind = request.params.kind as DriverDocumentKind;
  if (!documentKinds.has(kind)) {
    throw new HttpError(400, 'El tipo de documento no está permitido.');
  }
  if (!request.file) {
    throw new HttpError(400, 'Adjunta una imagen JPEG, PNG o WebP.');
  }
  const detected = await fileTypeFromBuffer(request.file.buffer);
  if (!detected || detected.mime !== request.file.mimetype || !allowedImageTypes.has(detected.mime)) {
    throw new HttpError(400, 'El archivo no es una imagen válida.');
  }

  const database = mongoose.connection.db;
  if (!database) {
    throw new HttpError(503, 'La base de datos no está disponible.');
  }
  const driver = await Driver.findById(request.driverId);
  if (!driver) {
    throw new HttpError(404, 'No se encontró el perfil del conductor.');
  }
  const storage = createDocumentStorage(database);
  const oldId = kind === 'profile'
    ? driver.profilePhotoId
    : kind === 'vehicle'
      ? driver.vehicle.photoId
      : driver.get(`documents.${kind}PhotoId`) as ObjectId | undefined;
  const stored = await storage.save(
    driver._id,
    kind,
    request.file.buffer,
    detected.mime,
  );
  try {
    if (kind === 'profile') {
      driver.profilePhotoId = stored.id;
    } else if (kind === 'vehicle') {
      driver.set('vehicle.photoId', stored.id);
    } else {
      driver.set(`documents.${kind}PhotoId`, stored.id);
    }
    await driver.save();
  } catch (error) {
    await storage.delete([stored.id]).catch((cleanupError: unknown) => {
      console.error('No se pudo limpiar el documento nuevo tras el fallo.', cleanupError);
    });
    throw error;
  }

  if (oldId) {
    await storage.delete([oldId]);
  }
  response.json({ driver: serializeDriver(driver) });
});

export { router as driversRouter };
