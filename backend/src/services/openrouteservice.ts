import { z } from 'zod';
import { env } from '../config/env.js';
import { HttpError } from '../utils/http-error.js';
import {
  getGoogleDrivingRoute,
  type DrivingRoute,
} from './google-maps.js';

const directionsResponseSchema = z.object({
  features: z.array(z.object({
    geometry: z.object({
      coordinates: z.array(z.array(z.number()).min(2)).min(2),
    }),
    properties: z.object({
      summary: z.object({
        distance: z.number().nonnegative(),
        duration: z.number().nonnegative(),
      }),
    }),
  })).min(1),
});

export type { DrivingRoute } from './google-maps.js';

export function parseDrivingRouteResponse(responseBody: unknown): DrivingRoute {
  const parsed = directionsResponseSchema.safeParse(responseBody);
  if (!parsed.success) {
    throw new HttpError(502, 'OpenRouteService devolvió datos de ruta incompletos.');
  }
  const feature = parsed.data.features[0];
  return {
    distanceMeters: feature.properties.summary.distance,
    durationSeconds: feature.properties.summary.duration,
    coordinates: feature.geometry.coordinates.map(([longitude, latitude]) => ({
      latitude,
      longitude,
    })),
  };
}

export async function getDrivingRoute(input: {
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
}): Promise<DrivingRoute> {
  if (env.GOOGLE_MAPS_SERVER_API_KEY) {
    return getGoogleDrivingRoute(input);
  }
  if (!env.ORS_API_KEY) {
    throw new HttpError(503, 'Configura GOOGLE_MAPS_SERVER_API_KEY o ORS_API_KEY para usar la navegación.');
  }

  let response: Response;
  try {
    response = await fetch('https://api.openrouteservice.org/v2/directions/driving-car/geojson', {
      method: 'POST',
      headers: {
        Authorization: env.ORS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        coordinates: [
          [input.from.lng, input.from.lat],
          [input.to.lng, input.to.lat],
        ],
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    console.error('No se pudo conectar con OpenRouteService.', error);
    throw new HttpError(502, 'No se pudo calcular la ruta. Intenta de nuevo.');
  }

  if (!response.ok) {
    console.error('OpenRouteService rechazó la solicitud de ruta.', { status: response.status });
    throw new HttpError(502, 'OpenRouteService no pudo calcular la ruta.');
  }

  let responseBody: unknown;
  try {
    responseBody = await response.json();
  } catch (error) {
    console.error('OpenRouteService devolvió una respuesta de ruta no válida.', error);
    throw new HttpError(502, 'OpenRouteService devolvió una respuesta no válida.');
  }
  return parseDrivingRouteResponse(responseBody);
}
