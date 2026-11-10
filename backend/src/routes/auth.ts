import { Router, type Request } from 'express';
import multer from 'multer';
import { Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { fileTypeFromBuffer } from 'file-type';
import { env } from '../config/env.js';
import { authenticate } from '../middleware/authenticate.js';
import { Driver } from '../models/Driver.js';
import { createDocumentStorage, type DriverDocumentKind } from '../services/driver-document-storage.js';
import { serializeDriver } from '../services/driver-serializer.js';
import { HttpError } from '../utils/http-error.js';
import { driverRegistrationSchema, loginSchema } from '../utils/driver-validation.js';
import mongoose from 'mongoose';

const router = Router();
const maxImageBytes = 5 * 1024 * 1024;
const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxImageBytes, files: 5, fields: 30, parts: 40 },
  fileFilter: (_request, file, callback) => {
    callback(null, allowedImageTypes.has(file.mimetype));
  },
});
const registerImages = upload.fields([
  { name: 'profilePhoto', maxCount: 1 },
  { name: 'vehiclePhoto', maxCount: 1 },
  { name: 'licensePhoto', maxCount: 1 },
  { name: 'soatPhoto', maxCount: 1 },
  { name: 'revisionPhoto', maxCount: 1 },
]);

type RegistrationFiles = Record<string, Express.Multer.File[]>;

function getRegistrationFiles(request: Request): RegistrationFiles {
  return (request.files ?? {}) as RegistrationFiles;
}

function signToken(driverId: string): string {
  return jwt.sign({}, env.JWT_SECRET, { subject: driverId, expiresIn: '7d' });
}

router.post('/register', registerImages, async (request, response) => {
  const parsed = driverRegistrationSchema.safeParse(request.body);
  if (!parsed.success) {
    throw parsed.error;
  }

  const files = getRegistrationFiles(request);
  const photoFields = [
    ['profilePhoto', 'profile'],
    ['vehiclePhoto', 'vehicle'],
    ['licensePhoto', 'license'],
    ['soatPhoto', 'soat'],
  ] as const satisfies readonly (readonly [string, DriverDocumentKind])[];
  const revisionRequired = parsed.data.year <= new Date().getFullYear() - 6;

  for (const [field] of photoFields) {
    if (!files[field]?.[0]) {
      throw new HttpError(400, `La foto ${field} es obligatoria.`, { field });
    }
  }
  if (revisionRequired && !files.revisionPhoto?.[0]) {
    throw new HttpError(400, 'La foto de revisión técnico-mecánica es obligatoria.', {
      field: 'revisionPhoto',
    });
  }

  const images: Array<{ field: string; kind: DriverDocumentKind; file: Express.Multer.File; mime: string }> = [];
  for (const [field, kind] of photoFields) {
    const file = files[field][0];
    const detected = await fileTypeFromBuffer(file.buffer);
    if (!detected || !allowedImageTypes.has(detected.mime) || detected.mime !== file.mimetype) {
      throw new HttpError(400, `El archivo ${field} no es una imagen JPEG, PNG o WebP válida.`, {
        field,
      });
    }
    images.push({ field, kind, file, mime: detected.mime });
  }
  if (files.revisionPhoto?.[0]) {
    const file = files.revisionPhoto[0];
    const detected = await fileTypeFromBuffer(file.buffer);
    if (!detected || !allowedImageTypes.has(detected.mime) || detected.mime !== file.mimetype) {
      throw new HttpError(400, 'La foto de revisión no es una imagen válida.', {
        field: 'revisionPhoto',
      });
    }
    images.push({ field: 'revisionPhoto', kind: 'revision', file, mime: detected.mime });
  }

  const database = mongoose.connection.db;
  if (!database) {
    throw new HttpError(503, 'La base de datos no está disponible.');
  }

  const ownerId = new Types.ObjectId();
  const storage = createDocumentStorage(database);
  const uploadedIds: Types.ObjectId[] = [];
  let createdDriverId: Types.ObjectId | null = null;
  try {
    const documentIds: Partial<Record<string, Types.ObjectId>> = {};
    for (const image of images) {
      const stored = await storage.save(ownerId, image.kind, image.file.buffer, image.mime);
      uploadedIds.push(stored.id);
      documentIds[image.field] = stored.id;
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const driver = await Driver.create({
      _id: ownerId,
      fullName: parsed.data.fullName,
      email: parsed.data.email.toLowerCase(),
      passwordHash,
      idNumber: parsed.data.idNumber,
      phone: parsed.data.phone,
      birthDate: new Date(`${parsed.data.birthDate}T00:00:00.000Z`),
      gender: parsed.data.gender,
      language: parsed.data.language,
      profilePhotoId: documentIds.profilePhoto,
      vehicle: {
        category: parsed.data.category,
        plate: parsed.data.plate,
        make: parsed.data.make,
        model: parsed.data.vehicleModel,
        year: parsed.data.year,
        color: parsed.data.color,
        capacity: parsed.data.capacity,
        photoId: documentIds.vehiclePhoto,
      },
      documents: {
        licenseNumber: parsed.data.licenseNumber,
        licenseExpiry: new Date(`${parsed.data.licenseExpiry}T00:00:00.000Z`),
        licensePhotoId: documentIds.licensePhoto,
        soatExpiry: new Date(`${parsed.data.soatExpiry}T00:00:00.000Z`),
        soatPhotoId: documentIds.soatPhoto,
        ...(parsed.data.revisionExpiry
          ? {
              revisionExpiry: new Date(`${parsed.data.revisionExpiry}T00:00:00.000Z`),
              revisionPhotoId: documentIds.revisionPhoto,
            }
          : {}),
        mercadoPagoEmail: parsed.data.mercadoPagoEmail.toLowerCase(),
        termsAcceptedAt: new Date(),
      },
      approvalStatus: 'pending',
      available: false,
    });
    createdDriverId = driver._id;
    response.status(201).json({
      token: signToken(driver.id),
      driver: serializeDriver(driver),
    });
  } catch (error) {
    const cleanup: Promise<unknown>[] = [storage.delete(uploadedIds)];
    if (createdDriverId) cleanup.push(Driver.findByIdAndDelete(createdDriverId));
    const cleanupResults = await Promise.allSettled(cleanup);
    const cleanupErrors = cleanupResults.filter((result) => result.status === 'rejected');
    if (cleanupErrors.length) {
      console.error('Falló la limpieza de un registro incompleto.', cleanupErrors);
    }
    throw error;
  }
});

router.post('/login', async (request, response) => {
  const parsed = loginSchema.safeParse(request.body);
  if (!parsed.success) {
    throw parsed.error;
  }
  const driver = await Driver.findOne({ email: parsed.data.email.toLowerCase() })
    .select('+passwordHash');
  if (!driver || !(await bcrypt.compare(parsed.data.password, driver.passwordHash))) {
    throw new HttpError(401, 'Correo o contraseña incorrectos.');
  }
  response.json({
    token: signToken(driver.id),
    driver: serializeDriver(driver),
  });
});

router.get('/me', authenticate, async (request, response) => {
  const driver = await Driver.findById(request.driverId);
  if (!driver) {
    throw new HttpError(404, 'No se encontró el perfil del conductor.');
  }
  response.json({ driver: serializeDriver(driver) });
});

router.post('/logout', authenticate, (_request, response) => {
  response.status(204).end();
});

export { router as authRouter };
