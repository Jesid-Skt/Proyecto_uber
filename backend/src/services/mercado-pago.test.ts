// AI-assisted: see docs/AI_LOG.md #8.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import {
  mapMercadoPagoPaymentStatus,
  searchMercadoPagoPaymentsByExternalReference,
  selectVerifiedTripPayment,
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

test('searches Mercado Pago by trip reference and validates the returned payment shape', async (context) => {
  const fetch = context.mock.method(
    globalThis,
    'fetch',
    async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = new URL(String(input));
      assert.equal(url.origin + url.pathname, 'https://api.mercadopago.com/v1/payments/search');
      assert.equal(url.searchParams.get('external_reference'), 'trip-123');
      assert.equal(url.searchParams.get('sort'), 'date_created');
      assert.equal(url.searchParams.get('criteria'), 'desc');
      assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer TEST-unit-test-token');
      return new Response(JSON.stringify({
        results: [{
          id: 987654,
          external_reference: 'trip-123',
          status: 'approved',
          transaction_amount: 12900,
          currency_id: 'COP',
        }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    },
  );

  assert.deepEqual(await searchMercadoPagoPaymentsByExternalReference('trip-123'), [{
    id: 987654,
    external_reference: 'trip-123',
    status: 'approved',
    transaction_amount: 12900,
    currency_id: 'COP',
  }]);
  assert.equal(fetch.mock.callCount(), 1);
});

test('selects only a matching COP payment and prefers an approved attempt', () => {
  const payment = (id: number, status: string, amount: number, reference = 'trip-123') => ({
    id,
    external_reference: reference,
    status,
    transaction_amount: amount,
    currency_id: 'COP',
  });
  const pending = payment(1, 'pending', 12900);
  const approved = payment(2, 'approved', 12900);

  assert.deepEqual(
    selectVerifiedTripPayment([
      payment(3, 'approved', 1),
      payment(4, 'approved', 12900, 'another-trip'),
      pending,
      approved,
    ], 'trip-123', 12900),
    { payment: approved, referenceFound: true },
  );
  assert.deepEqual(
    selectVerifiedTripPayment([payment(5, 'approved', 12900, 'another-trip')], 'trip-123', 12900),
    { payment: null, referenceFound: false },
  );
  assert.deepEqual(
    selectVerifiedTripPayment([payment(6, 'approved', 5000)], 'trip-123', 12900),
    { payment: null, referenceFound: true },
  );
});
