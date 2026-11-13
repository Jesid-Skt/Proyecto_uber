// AI-assisted: see docs/AI_LOG.md #3 and #4.
import 'dotenv/config';
import { z } from 'zod';

const optionalValue = z.preprocess(
  (value) => typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().trim().min(1).optional(),
);

const optionalSecret = z.preprocess(
  (value) => typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().trim().min(32).optional(),
);

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI es obligatorio.'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres.'),
  TRIP_REQUEST_API_KEY: optionalSecret,
  GOOGLE_MAPS_SERVER_API_KEY: optionalValue,
  ORS_API_KEY: optionalValue,
  FIREBASE_PROJECT_ID: optionalValue,
  GOOGLE_APPLICATION_CREDENTIALS: optionalValue,
  MERCADO_PAGO_ACCESS_TOKEN: optionalValue,
  MERCADO_PAGO_WEBHOOK_SECRET: optionalSecret,
  BACKEND_PUBLIC_URL: z.preprocess(
    (value) => typeof value === 'string' && value.trim() === '' ? undefined : value,
    z.string().url().optional(),
  ),
  FRONTEND_ORIGINS: z.string().default('http://localhost:8081,http://localhost:19006'),
}).superRefine((value, context) => {
  if (value.NODE_ENV === 'production' && !value.TRIP_REQUEST_API_KEY) {
    context.addIssue({
      code: 'custom',
      path: ['TRIP_REQUEST_API_KEY'],
      message: 'TRIP_REQUEST_API_KEY es obligatorio en producción.',
    });
  }
  if (value.NODE_ENV === 'production' && !value.FIREBASE_PROJECT_ID) {
    context.addIssue({
      code: 'custom',
      path: ['FIREBASE_PROJECT_ID'],
      message: 'FIREBASE_PROJECT_ID es obligatorio en producción para las notificaciones FCM.',
    });
  }
  if (value.NODE_ENV === 'production' && !value.GOOGLE_MAPS_SERVER_API_KEY && !value.ORS_API_KEY) {
    context.addIssue({
      code: 'custom',
      path: ['GOOGLE_MAPS_SERVER_API_KEY'],
      message: 'Configura GOOGLE_MAPS_SERVER_API_KEY u ORS_API_KEY para tarifas y navegación.',
    });
  }
  const mercadoPagoConfigured = Boolean(value.MERCADO_PAGO_ACCESS_TOKEN);
  const hasValidMpPrefix =
    value.MERCADO_PAGO_ACCESS_TOKEN?.startsWith('APP_USR-') ||
    value.MERCADO_PAGO_ACCESS_TOKEN?.startsWith('TEST-');

  if (mercadoPagoConfigured && !hasValidMpPrefix) {
    context.addIssue({
      code: 'custom',
      path: ['MERCADO_PAGO_ACCESS_TOKEN'],
      message: 'Usa únicamente un access token válido de Mercado Pago (prefijo APP_USR- o TEST-).',
    });
  }

  if (mercadoPagoConfigured && !value.MERCADO_PAGO_WEBHOOK_SECRET) {
    context.addIssue({
      code: 'custom',
      path: ['MERCADO_PAGO_WEBHOOK_SECRET'],
      message: 'MERCADO_PAGO_WEBHOOK_SECRET es obligatorio al configurar Mercado Pago.',
    });
  }
  if (mercadoPagoConfigured && !value.BACKEND_PUBLIC_URL) {
    context.addIssue({
      code: 'custom',
      path: ['BACKEND_PUBLIC_URL'],
      message: 'BACKEND_PUBLIC_URL es obligatorio al configurar Mercado Pago.',
    });
  }
  if (value.MERCADO_PAGO_WEBHOOK_SECRET && !mercadoPagoConfigured) {
    context.addIssue({
      code: 'custom',
      path: ['MERCADO_PAGO_ACCESS_TOKEN'],
      message: 'MERCADO_PAGO_ACCESS_TOKEN es obligatorio al configurar el webhook.',
    });
  }
  if (
    value.NODE_ENV === 'production' &&
    value.BACKEND_PUBLIC_URL &&
    !value.BACKEND_PUBLIC_URL.startsWith('https://')
  ) {
    context.addIssue({
      code: 'custom',
      path: ['BACKEND_PUBLIC_URL'],
      message: 'BACKEND_PUBLIC_URL debe usar HTTPS en producción.',
    });
  }
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
  throw new Error(`Configuración de backend inválida:\n${issues.join('\n')}`);
}

export const env = {
  ...parsed.data,
  backendPublicUrl: parsed.data.BACKEND_PUBLIC_URL?.replace(/\/+$/, ''),
  frontendOrigins: parsed.data.FRONTEND_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),
};
