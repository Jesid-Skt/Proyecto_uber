import assert from 'node:assert/strict';
import test from 'node:test';
import { envSchema } from './env.js';

const validDevelopmentEnv = {
  NODE_ENV: 'development',
  PORT: '4000',
  MONGODB_URI: 'mongodb://localhost:27017/uber_clone',
  JWT_SECRET: 'j'.repeat(32),
  TRIP_REQUEST_API_KEY: '',
  ORS_API_KEY: '',
  MERCADO_PAGO_ACCESS_TOKEN: '',
  MERCADO_PAGO_WEBHOOK_SECRET: '',
  BACKEND_PUBLIC_URL: '',
};

test('production requires ORS for routing', () => {
  const production = {
    ...validDevelopmentEnv,
    NODE_ENV: 'production',
    TRIP_REQUEST_API_KEY: 'p'.repeat(32),
    FIREBASE_PROJECT_ID: 'test-project',
    ORS_API_KEY: 'test-ors-key',
  };
  assert.equal(envSchema.safeParse(production).success, true);
  assert.equal(envSchema.safeParse({ ...production, ORS_API_KEY: '' }).success, false);
});

test('allows blank optional provider variables when integrations are not enabled', () => {
  const parsed = envSchema.safeParse(validDevelopmentEnv);
  assert.equal(parsed.success, true);
});

test('requires Mercado Pago webhook credentials and a public backend URL together', () => {
  const missingWebhook = envSchema.safeParse({
    ...validDevelopmentEnv,
    MERCADO_PAGO_ACCESS_TOKEN: 'TEST-access-token',
  });
  assert.equal(missingWebhook.success, false);

  const configured = envSchema.safeParse({
    ...validDevelopmentEnv,
    MERCADO_PAGO_ACCESS_TOKEN: 'TEST-access-token',
    MERCADO_PAGO_WEBHOOK_SECRET: 'w'.repeat(32),
    BACKEND_PUBLIC_URL: 'https://api.example.test',
  });
  assert.equal(configured.success, true);
});

test('rejects Mercado Pago credentials without a recognized provider prefix', () => {
  const parsed = envSchema.safeParse({
    ...validDevelopmentEnv,
    MERCADO_PAGO_ACCESS_TOKEN: 'invalid-provider-token',
    MERCADO_PAGO_WEBHOOK_SECRET: 'w'.repeat(32),
    BACKEND_PUBLIC_URL: 'https://api.example.test',
  });
  assert.equal(parsed.success, false);
  if (!parsed.success) {
    assert.ok(parsed.error.issues.some((issue) =>
      issue.path.includes('MERCADO_PAGO_ACCESS_TOKEN'),
    ));
  }
});
