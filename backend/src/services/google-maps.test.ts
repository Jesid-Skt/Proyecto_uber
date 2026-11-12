// AI-assisted: see docs/AI_LOG.md #3 and #6.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  decodeGooglePolyline,
  parseDirectionsResponse,
  parseDistanceMatrixResponse,
  getTripMetrics,
} from './google-maps.js';

test('parses Google Distance Matrix values into COP fare inputs', () => {
  assert.deepEqual(parseDistanceMatrixResponse({
    status: 'OK',
    rows: [{
      elements: [{
        status: 'OK',
        distance: { value: 8500 },
        duration: { value: 1320 },
      }],
    }],
  }), {
    distanceKm: 8.5,
    durationMin: 22,
  });
});

test('rejects unavailable Google routes with a useful validation error', () => {
  assert.throws(() => parseDistanceMatrixResponse({
    status: 'OK',
    rows: [{ elements: [{ status: 'ZERO_RESULTS' }] }],
  }), /no encontró una ruta válida/i);
});

test('uses OpenRouteService metrics when Google Maps is not configured', async (context) => {
  const fetch = context.mock.method(
    globalThis,
    'fetch',
    async (input: URL | RequestInfo, init?: RequestInit) => {
      assert.equal(String(input), 'https://api.openrouteservice.org/v2/directions/driving-car/geojson');
      assert.equal(new Headers(init?.headers).get('Authorization'), 'test-openrouteservice-key');
      return new Response(JSON.stringify({
        features: [{
          geometry: {
            coordinates: [[-75.58, 6.24], [-75.57, 6.20]],
          },
          properties: { summary: { distance: 8500, duration: 1320 } },
        }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    },
  );

  const metrics = await getTripMetrics({
    from: { lat: 6.24, lng: -75.58 },
    to: { lat: 6.20, lng: -75.57 },
  });

  assert.deepEqual(metrics, { distanceKm: 8.5, durationMin: 22 });
  assert.equal(fetch.mock.callCount(), 1);
});

test('decodes the Google encoded polyline into route coordinates', () => {
  assert.deepEqual(decodeGooglePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@'), [
    { latitude: 38.5, longitude: -120.2 },
    { latitude: 40.7, longitude: -120.95 },
    { latitude: 43.252, longitude: -126.453 },
  ]);
});

test('parses Google Directions routes and rejects malformed polylines', () => {
  assert.deepEqual(parseDirectionsResponse({
    status: 'OK',
    routes: [{
      overview_polyline: { points: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' },
      legs: [{
        distance: { value: 8500 },
        duration: { value: 1320 },
      }],
    }],
  }), {
    distanceMeters: 8500,
    durationSeconds: 1320,
    coordinates: [
      { latitude: 38.5, longitude: -120.2 },
      { latitude: 40.7, longitude: -120.95 },
      { latitude: 43.252, longitude: -126.453 },
    ],
  });
  assert.throws(() => decodeGooglePolyline('a'), /ruta codificada inválida/i);
});
