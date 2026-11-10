// AI-assisted: see docs/AI_LOG.md #1 and #3.
import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateFare } from './pricing.ts';

test('matches the specification fare example for economy and XL', () => {
  assert.deepEqual(
    calculateFare({ distanceKm: 8.5, durationMin: 22, category: 'economy' }),
    { fare: 19200, commission: 3840, driverEarnings: 15360 },
  );
  assert.deepEqual(
    calculateFare({ distanceKm: 8.5, durationMin: 22, category: 'xl' }),
    { fare: 26900, commission: 5380, driverEarnings: 21520 },
  );
});

test('applies the minimum fare and adds the full tip to driver earnings', () => {
  assert.deepEqual(
    calculateFare({
      distanceKm: 0,
      durationMin: 0,
      category: 'economy',
      tip: 1000,
    }),
    { fare: 6000, commission: 1200, driverEarnings: 5800 },
  );
});

test('rejects invalid fare inputs', () => {
  assert.throws(
    () =>
      calculateFare({
        distanceKm: -1,
        durationMin: 2,
        category: 'economy',
      }),
    RangeError,
  );
  assert.throws(
    () =>
      calculateFare({
        distanceKm: 1,
        durationMin: 2,
        category: 'economy',
        tip: Number.NaN,
      }),
    RangeError,
  );
});
