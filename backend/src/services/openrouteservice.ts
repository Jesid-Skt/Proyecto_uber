import { z } from 'zod';
import { env } from '../config/env.js';
import { HttpError } from '../utils/http-error.js';
import type { DrivingRoute } from './route-types.js';

const directionsResponseSchema = z.object({
  features: z.array(z.object({
    geometry: z.object({
      coordinates: z.array(z.tuple([z.number().finite().min(-180).max(180), z.number().finite().min(-90).max(90)]).rest(z.number())).min(2),
    }),
    properties: z.object({
      summary: z.object({
        distance: z.number().nonnegative(),
        duration: z.number().nonnegative(),
      }),
    }),
  })).min(1),
});

export type { DrivingRoute } from './route-types.js';

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

export async function getOpenRouteServiceRoute(input: {
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
}): Promise<DrivingRoute> {
  if (!env.ORS_API_KEY) {
    throw new HttpError(503, 'Configura ORS_API_KEY para usar OpenRouteService.');
  }

  const validPoint = (point: { lat: number; lng: number }) =>
    Number.isFinite(point.lat) && Number.isFinite(point.lng)
    && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;
  if (!validPoint(input.from) || !validPoint(input.to)) {
    throw new HttpError(400, 'Las coordenadas de la ruta no son válidas.');
  }
  if (input.from.lat === input.to.lat && input.from.lng === input.to.lng) {
    throw new HttpError(422, 'El origen y el destino de la ruta son iguales. Verifica el GPS del conductor.');
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
    // No registrar headers ni credenciales. Limitar el cuerpo por seguridad.
    const errorBody = (await response.text().catch(() => '')).slice(0, 1500);
    console.error('OpenRouteService rechazó la solicitud de ruta.', {
      status: response.status,
      from: input.from,
      to: input.to,
      body: errorBody,
    });
    throw new HttpError(
      502,
      response.status === 404
        ? 'OpenRouteService no encontró una ruta para estas coordenadas.'
        : 'OpenRouteService no pudo calcular la ruta.',
    );
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

export const getDrivingRoute = getOpenRouteServiceRoute;
