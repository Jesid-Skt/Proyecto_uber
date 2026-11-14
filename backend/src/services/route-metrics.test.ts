import assert from 'node:assert/strict';
import test from 'node:test';
import { getTripMetrics } from './route-metrics.js';

test('uses ORS for trip metrics', async (context) => {
  const fetchMock = context.mock.method(globalThis, 'fetch', async (input: URL | RequestInfo, init?: RequestInit) => {
    assert.equal(String(input), 'https://api.openrouteservice.org/v2/directions/driving-car/geojson');
    assert.equal(new Headers(init?.headers).get('Authorization'), 'test-openrouteservice-key');
    assert.deepEqual(JSON.parse(String(init?.body)).coordinates, [[-75.58, 6.24], [-75.57, 6.20]]);
    return new Response(JSON.stringify({
      features: [{
        geometry: { coordinates: [[-75.58, 6.24], [-75.57, 6.20]] },
        properties: { summary: { distance: 8500, duration: 1320 } },
      }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  assert.deepEqual(await getTripMetrics({
    from: { lat: 6.24, lng: -75.58 }, to: { lat: 6.20, lng: -75.57 },
  }), { distanceKm: 8.5, durationMin: 22 });
  assert.equal(fetchMock.mock.callCount(), 1);
});
