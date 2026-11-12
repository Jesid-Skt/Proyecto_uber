// AI-assisted: see docs/AI_LOG.md #8.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { env } from '../config/env.js';
import { HttpError } from '../utils/http-error.js';

const preferenceResponseSchema = z.object({
  id: z.union([z.string(), z.number()]),
  init_point: z.string().url(),
  sandbox_init_point: z.string().url().optional(),
});

const paymentResponseSchema = z.object({
  id: z.union([z.string(), z.number()]),
  external_reference: z.string().nullable(),
  status: z.string(),
  transaction_amount: z.number(),
  currency_id: z.string(),
});

const paymentSearchResponseSchema = z.object({
  results: z.array(paymentResponseSchema),
});

export type MercadoPagoPayment = z.infer<typeof paymentResponseSchema>;

export function selectVerifiedTripPayment(
  payments: MercadoPagoPayment[],
  externalReference: string,
  expectedAmount: number,
): { payment: MercadoPagoPayment | null; referenceFound: boolean } {
  const referencedPayments = payments.filter(
    (payment) => payment.external_reference === externalReference,
  );
  const validPayments = referencedPayments.filter(
    (payment) => payment.currency_id === 'COP' && payment.transaction_amount === expectedAmount,
  );
  return {
    payment: validPayments.find((payment) => payment.status === 'approved')
      ?? validPayments[0]
      ?? null,
    referenceFound: referencedPayments.length > 0,
  };
}

function getMercadoPagoConfig() {
  if (!env.MERCADO_PAGO_ACCESS_TOKEN || !env.backendPublicUrl) {
    throw new HttpError(503, 'Mercado Pago no está configurado en el servidor.');
  }
  return {
    accessToken: env.MERCADO_PAGO_ACCESS_TOKEN,
    notificationUrl: `${env.backendPublicUrl}/api/payments/mercadopago/webhook`,
  };
}

export async function createMercadoPagoCheckout(input: {
  tripId: string;
  fare: number;
  category: string;
}): Promise<{ preferenceId: string; checkoutUrl: string }> {
  const config = getMercadoPagoConfig();
  let response: Response;
  try {
    response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [{
          id: input.tripId,
          title: `Viaje ${input.category}`,
          quantity: 1,
          currency_id: 'COP',
          unit_price: input.fare,
        }],
        external_reference: input.tripId,
        notification_url: config.notificationUrl,
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    console.error('No se pudo conectar con Mercado Pago para crear el checkout.', error);
    throw new HttpError(502, 'No se pudo conectar con Mercado Pago. Intenta de nuevo.');
  }

  if (!response.ok) {
    console.error('Mercado Pago rechazó la creación del checkout.', { status: response.status });
    throw new HttpError(502, 'Mercado Pago no pudo crear el enlace de pago.');
  }

  let responseBody: unknown;
  try {
    responseBody = await response.json();
  } catch (error) {
    console.error('Mercado Pago devolvió una respuesta de checkout no válida.', error);
    throw new HttpError(502, 'Mercado Pago devolvió una respuesta no válida.');
  }
  const parsed = preferenceResponseSchema.safeParse(responseBody);
  if (!parsed.success) {
    console.error('Mercado Pago devolvió campos de checkout incompletos.');
    throw new HttpError(502, 'Mercado Pago devolvió una respuesta de checkout incompleta.');
  }

  const isTestToken = config.accessToken.startsWith('TEST-');
  return {
    preferenceId: String(parsed.data.id),
    checkoutUrl: isTestToken
      ? parsed.data.sandbox_init_point ?? parsed.data.init_point
      : parsed.data.init_point,
  };
}

export function verifyMercadoPagoWebhookSignature(
  signature: string | undefined,
  requestId: string | undefined,
  paymentId: string,
  secret: string | undefined,
): boolean {
  if (!signature || !requestId || !secret) return false;
  const signatureParts = new Map(
    signature.split(',').map((part) => {
      const separator = part.indexOf('=');
      return separator < 0
        ? ['', '']
        : [part.slice(0, separator).trim(), part.slice(separator + 1).trim()];
    }),
  );
  const timestamp = signatureParts.get('ts');
  const suppliedHash = signatureParts.get('v1');
  if (!timestamp || !suppliedHash || !/^[a-f\d]{64}$/i.test(suppliedHash)) return false;

  const manifest = `id:${paymentId.toLowerCase()};request-id:${requestId};ts:${timestamp};`;
  const expectedHash = createHmac('sha256', secret).update(manifest).digest();
  const receivedHash = Buffer.from(suppliedHash, 'hex');
  return receivedHash.length === expectedHash.length
    && timingSafeEqual(receivedHash, expectedHash);
}

export async function getMercadoPagoPayment(paymentId: string): Promise<MercadoPagoPayment> {
  const { accessToken } = getMercadoPagoConfig();
  let response: Response;
  try {
    response = await fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`,
      {
        headers: { Authorization: 'Bearer ' + accessToken },
        signal: AbortSignal.timeout(15_000),
      },
    );
  } catch (error) {
    console.error('No se pudo consultar el pago en Mercado Pago.', error);
    throw new HttpError(502, 'No se pudo consultar el pago en Mercado Pago.');
  }

  if (!response.ok) {
    console.error('Mercado Pago rechazó la consulta del pago.', { status: response.status });
    throw new HttpError(502, 'Mercado Pago no pudo confirmar el pago.');
  }

  let responseBody: unknown;
  try {
    responseBody = await response.json();
  } catch (error) {
    console.error('Mercado Pago devolvió una respuesta de pago no válida.', error);
    throw new HttpError(502, 'Mercado Pago devolvió una respuesta de pago no válida.');
  }
  const parsed = paymentResponseSchema.safeParse(responseBody);
  if (!parsed.success) {
    console.error('Mercado Pago devolvió campos de pago incompletos.');
    throw new HttpError(502, 'Mercado Pago devolvió una respuesta de pago incompleta.');
  }
  return parsed.data;
}

export async function searchMercadoPagoPaymentsByExternalReference(
  externalReference: string,
): Promise<MercadoPagoPayment[]> {
  const { accessToken } = getMercadoPagoConfig();
  const url = new URL('https://api.mercadopago.com/v1/payments/search');
  url.search = new URLSearchParams({
    external_reference: externalReference,
    sort: 'date_created',
    criteria: 'desc',
    limit: '100',
  }).toString();

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: 'Bearer ' + accessToken },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    console.error('No se pudo buscar el pago en Mercado Pago.', error);
    throw new HttpError(502, 'No se pudo consultar el pago en Mercado Pago.');
  }

  if (!response.ok) {
    console.error('Mercado Pago rechazó la búsqueda del pago.', { status: response.status });
    throw new HttpError(502, 'Mercado Pago no pudo consultar el estado del pago.');
  }

  let responseBody: unknown;
  try {
    responseBody = await response.json();
  } catch (error) {
    console.error('Mercado Pago devolvió una respuesta de búsqueda no válida.', error);
    throw new HttpError(502, 'Mercado Pago devolvió una respuesta de pago no válida.');
  }
  const parsed = paymentSearchResponseSchema.safeParse(responseBody);
  if (!parsed.success) {
    console.error('Mercado Pago devolvió resultados de pago incompletos.');
    throw new HttpError(502, 'Mercado Pago devolvió una respuesta de pago incompleta.');
  }
  return parsed.data.results;
}

export function mapMercadoPagoPaymentStatus(
  status: string,
): 'approved' | 'pending' | 'rejected' | 'refunded' | 'charged_back' {
  if (status === 'approved') return 'approved';
  if (status === 'refunded') return 'refunded';
  if (status === 'charged_back') return 'charged_back';
  if (['rejected', 'cancelled'].includes(status)) return 'rejected';
  return 'pending';
}
