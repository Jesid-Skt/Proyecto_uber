import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import {
  mapMercadoPagoPaymentStatus,
  verifyMercadoPagoWebhookSignature,
} from './mercado-pago.js';

test('verifies Mercado Pago webhook signatures using the signed manifest', () => {
  const paymentId = '123456789';
  const requestId = 'request-abc';
  const timestamp = '1719876543';
  const secret = 'test-webhook-secret';
  const manifest = `id:${paymentId};request-id:${requestId};ts:${timestamp};`;
  const hash = createHmac('sha256', secret).update(manifest).digest('hex');

  assert.equal(
    verifyMercadoPagoWebhookSignature(
      `ts=${timestamp},v1=${hash}`,
      requestId,
      paymentId,
      secret,
    ),
    true,
  );
  assert.equal(
    verifyMercadoPagoWebhookSignature(
      `ts=${timestamp},v1=${hash}`,
      'different-request',
      paymentId,
      secret,
    ),
    false,
  );
  assert.equal(
    verifyMercadoPagoWebhookSignature(`ts=${timestamp},v1=${hash}`, requestId, paymentId, undefined),
    false,
  );
});

test('maps Mercado Pago payment statuses without treating pending as paid', () => {
  assert.equal(mapMercadoPagoPaymentStatus('approved'), 'approved');
  assert.equal(mapMercadoPagoPaymentStatus('in_process'), 'pending');
  assert.equal(mapMercadoPagoPaymentStatus('rejected'), 'rejected');
});
