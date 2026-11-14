// AI-assisted: see docs/AI_LOG.md #3.
import { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Driver } from '../models/Driver.js';
import { Trip } from '../models/Trip.js';
import { HttpError } from '../utils/http-error.js';
import { calculateTripFare, tripIdSchema, tripRequestSchema } from '../utils/trip-validation.js';
import { serializeTrip } from '../services/trip-serializer.js';
import { createMercadoPagoCheckout } from '../services/mercado-pago.js';
import { getTripMetrics } from '../services/route-metrics.js';
import { sendTripRequestNotification } from '../services/push-notifications.js';

const router = Router();

function isValidApiKey(candidate: string, expected: string): boolean {
  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);
  return candidateBuffer.length === expectedBuffer.length
    && timingSafeEqual(candidateBuffer, expectedBuffer);
}

function authenticatePublisher(authorization: string | undefined): void {
  const configuredKey = env.TRIP_REQUEST_API_KEY;
  if (!configuredKey) {
    throw new HttpError(503, 'La publicación de solicitudes no está configurada en el servidor.');
  }
  const suppliedKey = authorization?.startsWith('Bearer ')
    ? authorization.slice(7)
    : '';
  if (!isValidApiKey(suppliedKey, configuredKey)) {
    throw new HttpError(401, 'Se requiere una clave de publicación válida.');
  }
}

router.post('/', async (request, response) => {
  authenticatePublisher(request.header('authorization'));

  const parsed = tripRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    throw parsed.error;
  }
  const driver = await Driver.findOne({
    _id: new mongoose.Types.ObjectId(parsed.data.driverId),
    approvalStatus: 'approved',
    available: true,
  });
  if (!driver) {
    throw new HttpError(409, 'El conductor no existe, no está aprobado o no está disponible.');
  }

  const categoryByVehicle = {
    'Económico': 'economy',
    XL: 'xl',
    Premium: 'premium',
  } as const;
  if (categoryByVehicle[driver.vehicle.category] !== parsed.data.category) {
    throw new HttpError(409, 'La categoría de la solicitud no coincide con el vehículo del conductor.');
  }
  const hasOpenTrip = await Trip.exists({
    driverId: driver._id,
    $or: [
      { status: 'requested', expiresAt: { $gt: new Date() } },
      { status: { $in: ['accepted', 'driver_arriving', 'in_progress', 'completed'] } },
    ],
  });
  if (hasOpenTrip) {
    throw new HttpError(409, 'El conductor ya tiene una solicitud o viaje pendiente.');
  }

  const metrics = await getTripMetrics({
    from: parsed.data.origin,
    to: parsed.data.destination,
  });
  const estimate = calculateTripFare({ ...metrics, category: parsed.data.category });
  const trip = await Trip.create({
    ...parsed.data,
    ...metrics,
    driverId: driver._id,
    ...estimate,
    tip: 0,
    paymentStatus: 'pending',
    status: 'requested',
    expiresAt: new Date(Date.now() + 15_000),
  });
  void sendTripRequestNotification({
    driverId: driver.id,
    tripId: trip.id,
    origin: trip.origin.address,
    destination: trip.destination.address,
  }).catch((error: unknown) => {
    console.error('No se pudo enviar la notificación de nueva solicitud.', error);
  });
  response.status(201).json({ trip: serializeTrip(trip) });
});

router.post('/:tripId/checkout', async (request, response) => {
  authenticatePublisher(request.header('authorization'));
  const parsedId = tripIdSchema.safeParse(request.params.tripId);
  if (!parsedId.success) {
    throw new HttpError(400, 'El identificador del viaje no es válido.');
  }

  const trip = await Trip.findById(parsedId.data);
  if (!trip) {
    throw new HttpError(404, 'No se encontró el viaje.');
  }
  if (trip.paymentMethod !== 'mercadopago') {
    throw new HttpError(409, 'El viaje no está configurado para Mercado Pago.');
  }
  if (!['accepted', 'driver_arriving', 'in_progress', 'completed'].includes(trip.status)) {
    throw new HttpError(409, 'El viaje debe ser aceptado antes de crear el checkout.');
  }
  if (trip.paymentStatus === 'approved') {
    throw new HttpError(409, 'El pago ya fue confirmado.');
  }
  if (trip.mercadoPagoPreferenceId && trip.mercadoPagoCheckoutUrl) {
    response.json({
      tripId: trip.id,
      preferenceId: trip.mercadoPagoPreferenceId,
      checkoutUrl: trip.mercadoPagoCheckoutUrl,
    });
    return;
  }

  const checkout = await createMercadoPagoCheckout({
    tripId: trip.id,
    fare: trip.fare,
    category: trip.category,
  });
  trip.mercadoPagoPreferenceId = checkout.preferenceId;
  trip.mercadoPagoCheckoutUrl = checkout.checkoutUrl;
  await trip.save();
  response.status(201).json({
    tripId: trip.id,
    preferenceId: checkout.preferenceId,
    checkoutUrl: checkout.checkoutUrl,
  });
});

router.get('/:tripId/payment', async (request, response) => {
  authenticatePublisher(request.header('authorization'));
  const parsedId = tripIdSchema.safeParse(request.params.tripId);
  if (!parsedId.success) {
    throw new HttpError(400, 'El identificador del viaje no es válido.');
  }

  const trip = await Trip.findById(parsedId.data).select('status paymentMethod paymentStatus fare');
  if (!trip) {
    throw new HttpError(404, 'No se encontró el viaje.');
  }
  response.json({
    tripId: trip.id,
    status: trip.status,
    paymentMethod: trip.paymentMethod,
    paymentStatus: trip.paymentStatus,
    amount: trip.fare,
    currency: 'COP',
  });
});

export { router as tripRequestsRouter };
