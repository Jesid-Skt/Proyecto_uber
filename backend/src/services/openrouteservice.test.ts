import assert from 'node:assert/strict';
import test from 'node:test';
import { getOpenRouteServiceRoute, parseDrivingRouteResponse } from './openrouteservice.js';

test('converts an OpenRouteService GeoJSON route into map coordinates', () => {
  assert.deepEqual(parseDrivingRouteResponse({
    features: [{
      geometry: {
        coordinates: [
          [-74.08, 4.65],
          [-74.07, 4.64],
          [-74.06, 4.63, 2500],
        ],
      },
      properties: { summary: { distance: 4200, duration: 720 } },
    }],
  }), {
    distanceMeters: 4200,
    durationSeconds: 720,
    coordinates: [
      { latitude: 4.65, longitude: -74.08 },
      { latitude: 4.64, longitude: -74.07 },
      { latitude: 4.63, longitude: -74.06 },
    ],
  });
});


test('rejects identical coordinates before calling ORS', async (context) => {
  const fetchMock = context.mock.method(globalThis, 'fetch', async () => {
    throw new Error('Should not call ORS');
  });
  await assert.rejects(
    getOpenRouteServiceRoute({
      from: { lat: 6.2442, lng: -75.5712 },
      to: { lat: 6.2442, lng: -75.5712 },
    }),
    /origen y el destino.*iguales/i,
  );
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('reports ORS 404 as unavailable route', async (context) => {
  context.mock.method(globalThis, 'fetch', async () =>
    new Response(JSON.stringify({ error: { code: 2010, message: 'No route found' } }), { status: 404 }),
  );
  const log = context.mock.method(console, 'error', () => {});
  await assert.rejects(
    getOpenRouteServiceRoute({
      from: { lat: 6.2088, lng: -75.5670 },
      to: { lat: 6.2442, lng: -75.5712 },
    }),
    /no encontró una ruta/i,
  );
  assert.equal(log.mock.callCount(), 1);
});
