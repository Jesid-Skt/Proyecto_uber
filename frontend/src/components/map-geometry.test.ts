import assert from 'node:assert/strict';
import test from 'node:test';
import { getMapBounds } from './map-geometry.ts';

test('bounds include all valid route coordinates in MapLibre order', () => {
  assert.deepEqual(getMapBounds([
    { latitude: 6.2, longitude: -75.7 },
    { latitude: 6.3, longitude: -75.5 },
    { latitude: 6.25, longitude: -75.6 },
  ]), [-75.7, 6.2, -75.5, 6.3]);
});

test('bounds ignore invalid points and expand a single-location route', () => {
  const bounds = getMapBounds([
    { latitude: 6.2, longitude: -75.7 },
    { latitude: Number.NaN, longitude: -75 },
    { latitude: 6.2, longitude: -75.7 },
  ]);
  assert.ok(bounds);
  const expected = [-75.7025, 6.1975, -75.6975, 6.2025];
  bounds.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) < 1e-10));
  assert.equal(getMapBounds([{ latitude: 6.2, longitude: -75.7 }]), null);
});
