import { Router } from 'express';
import type { Request } from 'express';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Trip } from '../models/Trip.js';
import {
  getMercadoPagoPayment,
  mapMercadoPagoPaymentStatus,
  verifyMercadoPagoWebhookSignature,
} from '../services/mercado-pago.js';
import { HttpError } from '../utils/http-error.js';
import { tripIdSchema } from '../utils/trip-validation.js';

const router = Router();

function getPaymentId(request: Request): string | null {
  const queryId = request.query['data.id'];
  if (typeof queryId === 'string') return queryId;
  const body = request.body as { data?: { id?: unknown } } | undefined;
  const bodyId = body?.data?.id;
  if (typeof bodyId === 'string' || typeof bodyId === 'number') return String(bodyId);
  return null;
}

function isPaymentNotification(request: Request): boolean {
  const queryType = request.query.type;
  const queryTopic = request.query.topic;
  const body = request.body as { type?: unknown; action?: unknown } | undefined;
  return queryType === 'payment'
    || queryTopic === 'payment'
    || body?.type === 'payment'
    || (typeof body?.action === 'string' && body.action.startsWith('payment.'));
}

router.post('/mercadopago/webhook', async (request, response) => {
  if (!isPaymentNotification(request)) {
    response.sendStatus(200);
    return;
  }
  if (!env.MERCADO_PAGO_WEBHOOK_SECRET) {
    throw new HttpError(503, 'La recepción de pagos no está configurada en el servidor.');
  }

  const paymentId = getPaymentId(request);
  if (!paymentId || !/^\d+$/.test(paymentId)) {
    throw new HttpError(400, 'La notificación no contiene un identificador de pago válido.');
  }
  if (!verifyMercadoPagoWebhookSignature(
    request.header('x-signature'),
    request.header('x-request-id'),
    paymentId,
    env.MERCADO_PAGO_WEBHOOK_SECRET,
  )) {
    throw new HttpError(401, 'La firma de la notificación de pago no es válida.');
  }

  const payment = await getMercadoPagoPayment(paymentId);
  const parsedTripId = tripIdSchema.safeParse(payment.external_reference);
  if (!parsedTripId.success) {
    throw new HttpError(400, 'El pago no tiene un viaje asociado válido.');
  }
  const trip = await Trip.findOne({
    _id: new mongoose.Types.ObjectId(parsedTripId.data),
    paymentMethod: 'mercadopago',
  });
  if (!trip) {
    throw new HttpError(404, 'No se encontró el viaje asociado al pago.');
  }
  if (payment.currency_id !== 'COP' || payment.transaction_amount !== trip.fare) {
    console.error('El monto o la moneda del pago no coincide con el viaje.', {
      tripId: trip.id,
      paymentId,
      currency: payment.currency_id,
      amount: payment.transaction_amount,
    });
    throw new HttpError(409, 'El monto o la moneda del pago no coincide con el viaje.');
  }

  let updatedTrip = await Trip.findOneAndUpdate(
    { _id: trip._id, paymentMethod: 'mercadopago' },
    {
      $set: {
        mercadoPagoPaymentId: String(payment.id),
        paymentStatus: mapMercadoPagoPaymentStatus(payment.status),
      },
    },
    { new: true, runValidators: true },
  );
  if (!updatedTrip) {
    throw new HttpError(404, 'No se pudo actualizar el estado del viaje.');
  }
  if (payment.status === 'approved' && updatedTrip.status === 'completed') {
    updatedTrip = await Trip.findOneAndUpdate(
      { _id: updatedTrip._id, status: 'completed', paymentStatus: 'approved' },
      { $set: { status: 'paid' } },
      { new: true, runValidators: true },
    ) ?? updatedTrip;
  }

  response.sendStatus(200);
});

export { router as paymentsRouter };
