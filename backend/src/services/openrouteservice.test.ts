import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDrivingRouteResponse } from './openrouteservice.js';

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
