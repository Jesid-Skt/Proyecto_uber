// AI-assisted: see docs/AI_LOG.md #3.
import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateTripFare, tripRequestSchema, tripRouteSchema } from './trip-validation.js';

const validRequest = {
  driverId: '0123456789abcdef01234567',
  origin: { lat: 4.65, lng: -74.08, address: 'Origen' },
  destination: { lat: 4.61, lng: -74.08, address: 'Destino' },
  category: 'economy',
  paymentMethod: 'cash',
} as const;

test('validates targeted trip requests and rejects invalid coordinates or fields', () => {
  assert.equal(tripRequestSchema.safeParse(validRequest).success, true);
  assert.equal(tripRequestSchema.safeParse({
    ...validRequest,
    paymentMethod: 'mercadopago',
  }).success, true);
  assert.equal(tripRequestSchema.safeParse({
    ...validRequest,
    origin: { ...validRequest.origin, lat: 95 },
  }).success, false);
  assert.equal(tripRequestSchema.safeParse({
    ...validRequest,
    unexpected: true,
  }).success, false);
  assert.equal(tripRequestSchema.safeParse({
    ...validRequest,
    paymentMethod: 'stripe',
  }).success, false);
  assert.equal(tripRequestSchema.safeParse({
    ...validRequest,
    distanceKm: 1,
  }).success, false);
});

test('calculates the server-side COP fare using the documented reference example', () => {
  assert.deepEqual(calculateTripFare({
    distanceKm: 8.5,
    durationMin: 22,
    category: validRequest.category,
  }), {
    fare: 19_200,
    commission: 3_840,
    driverEarnings: 15_360,
    commissionRate: 0.2,
  });
});

test('validates route targets and current driver coordinates', () => {
  assert.equal(tripRouteSchema.safeParse({
    target: 'pickup',
    from: { lat: 4.65, lng: -74.08 },
  }).success, true);
  assert.equal(tripRouteSchema.safeParse({
    target: 'destination',
    from: { lat: 91, lng: -74.08 },
  }).success, false);
  assert.equal(tripRouteSchema.safeParse({
    target: 'unknown',
    from: { lat: 4.65, lng: -74.08 },
  }).success, false);
});
