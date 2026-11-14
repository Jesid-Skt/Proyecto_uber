// AI-assisted: see docs/AI_LOG.md #3, #6, and #8.
import { Router } from 'express';
import mongoose from 'mongoose';
import { authenticate } from '../middleware/authenticate.js';
import { Driver } from '../models/Driver.js';
import { Trip } from '../models/Trip.js';
import { serializeTrip } from '../services/trip-serializer.js';
import { getDrivingRoute } from '../services/openrouteservice.js';
import { getTripMetrics } from '../services/route-metrics.js';
import { calculateTripFare } from '../utils/trip-validation.js';
import {
  createMercadoPagoCheckout,
  mapMercadoPagoPaymentStatus,
  selectVerifiedTripPayment,
  searchMercadoPagoPaymentsByExternalReference,
} from '../services/mercado-pago.js';
import { z } from 'zod';
import type { PipelineStage } from 'mongoose';
import { HttpError } from '../utils/http-error.js';
import { tripIdSchema, tripRouteSchema } from '../utils/trip-validation.js';

const router = Router();
const historyQuerySchema = z.object({
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  paymentMethod: z.enum(['cash', 'mercadopago', 'stripe']).optional(),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict().superRefine((query, context) => {
  if (query.from && query.to && new Date(query.from) > new Date(query.to)) {
    context.addIssue({
      code: 'custom',
      path: ['from'],
      message: 'La fecha inicial debe ser anterior a la fecha final.',
    });
  }
});
router.use(authenticate);

router.get('/next-request', async (request, response) => {
  const driver = await Driver.findById(request.driverId);
  if (!driver) {
    throw new HttpError(404, 'No se encontró el perfil del conductor.');
  }
  if (driver.approvalStatus !== 'approved' || !driver.available) {
    response.json({ trip: null });
    return;
  }
  const activeTrip = await Trip.exists({
    driverId: driver._id,
    status: { $in: ['accepted', 'driver_arriving', 'in_progress', 'completed'] },
  });
  if (activeTrip) {
    response.json({ trip: null });
    return;
  }
  const trip = await Trip.findOne({
    driverId: driver._id,
    status: 'requested',
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: 1 });
  response.json({ trip: trip ? serializeTrip(trip) : null });
});

router.get('/active', async (request, response) => {
  const trip = await Trip.findOne({
    driverId: request.driverId,
    status: { $in: ['accepted', 'driver_arriving', 'in_progress', 'completed'] },
  }).sort({ createdAt: -1 });
  response.json({ trip: trip ? serializeTrip(trip) : null });
});

router.get('/history', async (request, response) => {
  const parsedQuery = historyQuerySchema.safeParse(request.query);
  if (!parsedQuery.success) throw parsedQuery.error;
  const completedAt: { $gte?: Date; $lte?: Date } = {};
  if (parsedQuery.data.from) completedAt.$gte = new Date(parsedQuery.data.from);
  if (parsedQuery.data.to) completedAt.$lte = new Date(parsedQuery.data.to);
  const trips = await Trip.find({
    driverId: request.driverId,
    status: { $in: ['completed', 'paid'] },
    ...(Object.keys(completedAt).length ? { completedAt } : {}),
    ...(parsedQuery.data.paymentMethod
      ? { paymentMethod: parsedQuery.data.paymentMethod }
      : {}),
  })
    .sort({ createdAt: -1 })
    .skip(parsedQuery.data.offset)
    .limit(parsedQuery.data.limit + 1);
  const hasMore = trips.length > parsedQuery.data.limit;
  const page = hasMore ? trips.slice(0, parsedQuery.data.limit) : trips;
  response.json({
    trips: page.map(serializeTrip),
    hasMore,
    nextOffset: parsedQuery.data.offset + page.length,
  });
});

router.get('/earnings', async (request, response) => {
  const now = new Date();
  const summaryStages = (): PipelineStage.FacetPipelineStage[] => [
    {
      $group: {
        _id: null,
        trips: { $sum: 1 },
        fare: { $sum: '$fare' },
        commission: { $sum: '$commission' },
        tips: { $sum: '$tip' },
        net: { $sum: '$driverEarnings' },
        balance: {
          $sum: {
            $cond: [
              { $eq: ['$paymentMethod', 'cash'] },
              { $multiply: ['$commission', -1] },
              '$driverEarnings',
            ],
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        trips: 1,
        fare: 1,
        commission: 1,
        tips: 1,
        net: 1,
        balance: 1,
        average: {
          $cond: [
            { $gt: ['$trips', 0] },
            { $round: [{ $divide: ['$net', '$trips'] }, 0] },
            0,
          ],
        },
      },
    },
  ];
  const emptyPeriod = { trips: 0, fare: 0, commission: 0, tips: 0, net: 0, average: 0 };
  const [result] = await Trip.aggregate<{
    today: (typeof emptyPeriod & { balance: number })[];
    week: (typeof emptyPeriod & { balance: number })[];
    month: (typeof emptyPeriod & { balance: number })[];
    allTime: (typeof emptyPeriod & { balance: number })[];
  }>([
    {
      $match: {
        driverId: new mongoose.Types.ObjectId(request.driverId),
        status: 'paid',
        paymentStatus: { $in: ['approved', 'cash'] },
      },
    },
    { $addFields: { earningDate: { $ifNull: ['$completedAt', '$createdAt'] } } },
    {
      $facet: {
        today: [
          {
            $match: {
              $expr: {
                $eq: [
                  { $dateTrunc: { date: '$earningDate', unit: 'day', timezone: 'America/Bogota' } },
                  { $dateTrunc: { date: now, unit: 'day', timezone: 'America/Bogota' } },
                ],
              },
            },
          },
          ...summaryStages(),
        ],
        week: [
          {
            $match: {
              $expr: {
                $eq: [
                  {
                    $dateTrunc: {
                      date: '$earningDate',
                      unit: 'week',
                      startOfWeek: 'monday',
                      timezone: 'America/Bogota',
                    },
                  },
                  {
                    $dateTrunc: {
                      date: now,
                      unit: 'week',
                      startOfWeek: 'monday',
                      timezone: 'America/Bogota',
                    },
                  },
                ],
              },
            },
          },
          ...summaryStages(),
        ],
        month: [
          {
            $match: {
              $expr: {
                $eq: [
                  { $dateTrunc: { date: '$earningDate', unit: 'month', timezone: 'America/Bogota' } },
                  { $dateTrunc: { date: now, unit: 'month', timezone: 'America/Bogota' } },
                ],
              },
            },
          },
          ...summaryStages(),
        ],
        allTime: summaryStages(),
      },
    },
  ]);
  response.json({
    today: result?.today[0] ?? emptyPeriod,
    week: result?.week[0] ?? emptyPeriod,
    month: result?.month[0] ?? emptyPeriod,
    balance: result?.allTime[0]?.balance ?? 0,
  });
});

router.post('/:tripId/route', async (request, response) => {
  const id = tripIdSchema.safeParse(request.params.tripId);
  if (!id.success) {
    throw new HttpError(400, 'El identificador del viaje no es válido.');
  }
  const parsedRoute = tripRouteSchema.safeParse(request.body);
  if (!parsedRoute.success) {
    throw parsedRoute.error;
  }

  const trip = await Trip.findOne({
    _id: new mongoose.Types.ObjectId(id.data),
    driverId: request.driverId,
  });
  if (!trip) {
    throw new HttpError(404, 'No se encontró el viaje.');
  }

  const { target, from } = parsedRoute.data;
  if (target === 'pickup' && !['accepted', 'driver_arriving'].includes(trip.status)) {
    throw new HttpError(409, 'La ruta a recogida solo está disponible antes de iniciar el viaje.');
  }
  if (target === 'destination' && trip.status !== 'in_progress') {
    throw new HttpError(409, 'La ruta al destino solo está disponible durante el viaje.');
  }

  const destination = target === 'pickup' ? trip.origin : trip.destination;
  const routeOrigin = target === 'history' ? trip.origin : from;
  if (target === 'history' && !['completed', 'paid'].includes(trip.status)) {
    throw new HttpError(409, 'El detalle de ruta solo está disponible para viajes finalizados.');
  }
  const routeInput = {
    from: { lat: routeOrigin.lat, lng: routeOrigin.lng },
    to: { lat: destination.lat, lng: destination.lng },
  };
  const route = await getDrivingRoute(routeInput);
  response.json({ route });
});

router.get('/:tripId', async (request, response) => {
  const id = tripIdSchema.safeParse(request.params.tripId);
  if (!id.success) {
    throw new HttpError(400, 'El identificador del viaje no es válido.');
  }
  const trip = await Trip.findOne({
    _id: new mongoose.Types.ObjectId(id.data),
    driverId: request.driverId,
  });
  if (!trip) {
    throw new HttpError(404, 'No se encontró el viaje.');
  }
  response.json({ trip: serializeTrip(trip) });
});

router.post('/:tripId/checkout', async (request, response) => {
  const id = tripIdSchema.safeParse(request.params.tripId);
  if (!id.success) {
    throw new HttpError(400, 'El identificador del viaje no es válido.');
  }
  const trip = await Trip.findOne({
    _id: new mongoose.Types.ObjectId(id.data),
    driverId: request.driverId,
  });
  if (!trip) {
    throw new HttpError(404, 'No se encontró el viaje.');
  }
  if (trip.paymentMethod !== 'mercadopago' || trip.status !== 'completed') {
    throw new HttpError(409, 'El checkout de Mercado Pago solo está disponible al finalizar un viaje digital.');
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

router.post('/:tripId/payment/sync', async (request, response) => {
  const id = tripIdSchema.safeParse(request.params.tripId);
  if (!id.success) {
    throw new HttpError(400, 'El identificador del viaje no es válido.');
  }
  const trip = await Trip.findOne({
    _id: new mongoose.Types.ObjectId(id.data),
    driverId: request.driverId,
    paymentMethod: 'mercadopago',
  });
  if (!trip) {
    throw new HttpError(404, 'No se encontró un viaje de Mercado Pago para esta cuenta.');
  }
  if (!['completed', 'paid'].includes(trip.status)) {
    throw new HttpError(409, 'El pago solo se puede sincronizar después de finalizar el viaje.');
  }
  if (trip.status === 'paid' && trip.paymentStatus === 'approved') {
    response.json({ trip: serializeTrip(trip) });
    return;
  }

  const payments = await searchMercadoPagoPaymentsByExternalReference(trip.id);
  const { payment, referenceFound } = selectVerifiedTripPayment(payments, trip.id, trip.fare);
  if (!payment) {
    if (referenceFound) {
      console.error('El pago encontrado no coincide con el monto o la moneda del viaje.', {
        tripId: trip.id,
        fare: trip.fare,
      });
      throw new HttpError(409, 'El pago encontrado no coincide con el monto o la moneda del viaje.');
    }
    throw new HttpError(404, 'Mercado Pago todavía no registra un pago para este viaje.');
  }

  const paymentStatus = mapMercadoPagoPaymentStatus(payment.status);
  trip.mercadoPagoPaymentId = String(payment.id);
  trip.paymentStatus = paymentStatus;
  if (paymentStatus === 'approved') {
    trip.status = 'paid';
  }
  await trip.save();
  response.json({ trip: serializeTrip(trip) });
});

router.patch('/:tripId/accept', async (request, response) => {
  const id = tripIdSchema.safeParse(request.params.tripId);
  if (!id.success) {
    throw new HttpError(400, 'El identificador de la solicitud no es válido.');
  }
  const driver = await Driver.findOne({
    _id: request.driverId,
    approvalStatus: 'approved',
    available: true,
  });
  if (!driver) {
    throw new HttpError(403, 'Debes estar aprobado y disponible para aceptar solicitudes.');
  }
  const pendingTrip = await Trip.findOne({
    _id: new mongoose.Types.ObjectId(id.data),
    driverId: request.driverId,
    status: 'requested',
    expiresAt: { $gt: new Date() },
  });
  if (!pendingTrip) {
    throw new HttpError(409, 'La solicitud venció o ya fue respondida.');
  }
  const metrics = await getTripMetrics({
    from: pendingTrip.origin,
    to: pendingTrip.destination,
  });
  const estimate = calculateTripFare({ ...metrics, category: pendingTrip.category });
  const trip = await Trip.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(id.data),
      driverId: request.driverId,
      status: 'requested',
      expiresAt: { $gt: new Date() },
    },
    { $set: { status: 'accepted', ...metrics, ...estimate } },
    { new: true, runValidators: true },
  );
  if (!trip) {
    throw new HttpError(409, 'La solicitud venció o ya fue respondida.');
  }
  response.json({ trip: serializeTrip(trip) });
});

router.patch('/:tripId/arriving', async (request, response) => {
  const id = tripIdSchema.safeParse(request.params.tripId);
  if (!id.success) {
    throw new HttpError(400, 'El identificador del viaje no es válido.');
  }
  const trip = await Trip.findOneAndUpdate(
    { _id: new mongoose.Types.ObjectId(id.data), driverId: request.driverId, status: 'accepted' },
    { $set: { status: 'driver_arriving' } },
    { new: true, runValidators: true },
  );
  if (!trip) {
    throw new HttpError(409, 'El viaje ya cambió de estado o no está disponible.');
  }
  response.json({ trip: serializeTrip(trip) });
});

router.patch('/:tripId/start', async (request, response) => {
  const id = tripIdSchema.safeParse(request.params.tripId);
  if (!id.success) {
    throw new HttpError(400, 'El identificador del viaje no es válido.');
  }
  const trip = await Trip.findOneAndUpdate(
    { _id: new mongoose.Types.ObjectId(id.data), driverId: request.driverId, status: 'driver_arriving' },
    { $set: { status: 'in_progress' } },
    { new: true, runValidators: true },
  );
  if (!trip) {
    throw new HttpError(409, 'El viaje ya cambió de estado o no está disponible.');
  }
  response.json({ trip: serializeTrip(trip) });
});

router.patch('/:tripId/complete', async (request, response) => {
  const id = tripIdSchema.safeParse(request.params.tripId);
  if (!id.success) {
    throw new HttpError(400, 'El identificador del viaje no es válido.');
  }
  let trip = await Trip.findOneAndUpdate(
    { _id: new mongoose.Types.ObjectId(id.data), driverId: request.driverId, status: 'in_progress' },
    { $set: { status: 'completed', completedAt: new Date() } },
    { new: true, runValidators: true },
  );
  if (!trip) {
    throw new HttpError(409, 'El viaje ya cambió de estado o no está disponible.');
  }
  if (trip.paymentMethod === 'mercadopago' && trip.paymentStatus === 'approved') {
    trip = await Trip.findOneAndUpdate(
      { _id: trip._id, status: 'completed', paymentStatus: 'approved' },
      { $set: { status: 'paid' } },
      { new: true, runValidators: true },
    ) ?? trip;
  }
  response.json({ trip: serializeTrip(trip) });
});

router.patch('/:tripId/cancel', async (request, response) => {
  const id = tripIdSchema.safeParse(request.params.tripId);
  if (!id.success) {
    throw new HttpError(400, 'El identificador del viaje no es válido.');
  }
  const trip = await Trip.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(id.data),
      driverId: request.driverId,
      status: { $in: ['accepted', 'driver_arriving'] },
      paymentStatus: { $ne: 'approved' },
      mercadoPagoPreferenceId: { $exists: false },
    },
    { $set: { status: 'cancelled' } },
    { new: true, runValidators: true },
  );
  if (!trip) {
    throw new HttpError(
      409,
      'El viaje no se puede cancelar: ya inició, tiene un pago aprobado o un checkout activo.',
    );
  }
  response.json({ trip: serializeTrip(trip) });
});

router.patch('/:tripId/cash-payment', async (request, response) => {
  const id = tripIdSchema.safeParse(request.params.tripId);
  if (!id.success) {
    throw new HttpError(400, 'El identificador del viaje no es válido.');
  }
  const trip = await Trip.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(id.data),
      driverId: request.driverId,
      status: 'completed',
      paymentMethod: 'cash',
      paymentStatus: 'pending',
    },
    { $set: { status: 'paid', paymentStatus: 'cash' } },
    { new: true, runValidators: true },
  );
  if (!trip) {
    throw new HttpError(409, 'El pago no se pudo confirmar; verifica el método y estado del viaje.');
  }
  response.json({ trip: serializeTrip(trip) });
});

router.patch('/:tripId/reject', async (request, response) => {
  const id = tripIdSchema.safeParse(request.params.tripId);
  if (!id.success) {
    throw new HttpError(400, 'El identificador de la solicitud no es válido.');
  }
  const trip = await Trip.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(id.data),
      driverId: request.driverId,
      status: 'requested',
    },
    { $set: { status: 'rejected' } },
    { new: true, runValidators: true },
  );
  if (!trip) {
    const alreadyRejected = await Trip.findOne({
      _id: new mongoose.Types.ObjectId(id.data),
      driverId: request.driverId,
      status: 'rejected',
    });
    if (alreadyRejected) {
      response.json({ trip: serializeTrip(alreadyRejected) });
      return;
    }
    throw new HttpError(409, 'La solicitud venció o ya fue respondida.');
  }
  response.json({ trip: serializeTrip(trip) });
});

export { router as tripsRouter };
