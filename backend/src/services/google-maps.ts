// AI-assisted: see docs/AI_LOG.md #3 and #6.
import { z } from 'zod';
import { env } from '../config/env.js';
import { HttpError } from '../utils/http-error.js';
import { getOpenRouteServiceRoute } from './openrouteservice.js';

const distanceMatrixSchema = z.object({
  status: z.string(),
  rows: z.array(z.object({
    elements: z.array(z.object({
      status: z.string(),
      distance: z.object({ value: z.number().positive() }).optional(),
      duration: z.object({ value: z.number().positive() }).optional(),
    })),
  })),
});

const directionsSchema = z.object({
  status: z.string(),
  routes: z.array(z.object({
    overview_polyline: z.object({ points: z.string() }),
    legs: z.array(z.object({
      distance: z.object({ value: z.number().nonnegative() }),
      duration: z.object({ value: z.number().nonnegative() }),
    })).min(1),
  })),
});

export type TripMetrics = { distanceKm: number; durationMin: number };
export type DrivingRoute = {
  distanceMeters: number;
  durationSeconds: number;
  coordinates: { latitude: number; longitude: number }[];
};

function getApiKey(): string {
  if (!env.GOOGLE_MAPS_SERVER_API_KEY) {
    throw new HttpError(503, 'Configura GOOGLE_MAPS_SERVER_API_KEY para usar los servicios de rutas.');
  }
  return env.GOOGLE_MAPS_SERVER_API_KEY;
}

async function getGoogleJson(url: URL, service: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  } catch (error) {
    console.error(`No se pudo conectar con Google Maps (${service}).`, error);
    throw new HttpError(502, `No se pudo conectar con Google Maps (${service}).`);
  }
  if (!response.ok) {
    console.error(`Google Maps rechazó la solicitud (${service}).`, { status: response.status });
    throw new HttpError(502, `Google Maps no pudo completar la solicitud (${service}).`);
  }
  try {
    return await response.json() as unknown;
  } catch (error) {
    console.error(`Google Maps devolvió una respuesta inválida (${service}).`, error);
    throw new HttpError(502, `Google Maps devolvió una respuesta inválida (${service}).`);
  }
}

export function parseDistanceMatrixResponse(body: unknown): TripMetrics {
  const parsed = distanceMatrixSchema.safeParse(body);
  const element = parsed.success ? parsed.data.rows[0]?.elements[0] : undefined;
  if (
    !parsed.success ||
    parsed.data.status !== 'OK' ||
    element?.status !== 'OK' ||
    !element.distance ||
    !element.duration
  ) {
    throw new HttpError(422, 'Google Maps no encontró una ruta válida entre los puntos.');
  }
  return {
    distanceKm: Math.round((element.distance.value / 1000) * 100) / 100,
    durationMin: Math.max(1, Math.ceil(element.duration.value / 60)),
  };
}

export async function getTripMetrics(input: {
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
}): Promise<TripMetrics> {
  if (!env.GOOGLE_MAPS_SERVER_API_KEY) {
    if (!env.ORS_API_KEY) {
      throw new HttpError(
        503,
        'Configura GOOGLE_MAPS_SERVER_API_KEY o ORS_API_KEY para calcular distancia y duración.',
      );
    }
    const route = await getOpenRouteServiceRoute(input);
    return {
      distanceKm: Math.round((route.distanceMeters / 1000) * 100) / 100,
      durationMin: Math.max(1, Math.ceil(route.durationSeconds / 60)),
    };
  }

  const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
  url.search = new URLSearchParams({
    origins: `${input.from.lat},${input.from.lng}`,
    destinations: `${input.to.lat},${input.to.lng}`,
    mode: 'driving',
    language: 'es',
    key: getApiKey(),
  }).toString();
  return parseDistanceMatrixResponse(await getGoogleJson(url, 'Distance Matrix'));
}

export function decodeGooglePolyline(encoded: string): { latitude: number; longitude: number }[] {
  const coordinates: { latitude: number; longitude: number }[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  const readDelta = (): number => {
    let result = 0;
    let shift = 0;
    let chunk: number;
    do {
      if (index >= encoded.length || shift > 30) {
        throw new HttpError(502, 'Google Maps devolvió una ruta codificada inválida.');
      }
      chunk = encoded.charCodeAt(index++) - 63;
      if (chunk < 0 || chunk > 63) {
        throw new HttpError(502, 'Google Maps devolvió una ruta codificada inválida.');
      }
      result |= (chunk & 0x1f) << shift;
      shift += 5;
    } while (chunk >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };

  while (index < encoded.length) {
    latitude += readDelta();
    longitude += readDelta();
    coordinates.push({
      latitude: latitude / 1e5,
      longitude: longitude / 1e5,
    });
  }
  if (coordinates.length < 2) {
    throw new HttpError(502, 'Google Maps devolvió una ruta incompleta.');
  }
  return coordinates;
}

export function parseDirectionsResponse(body: unknown): DrivingRoute {
  const parsed = directionsSchema.safeParse(body);
  const route = parsed.success ? parsed.data.routes[0] : undefined;
  const leg = route?.legs[0];
  if (!parsed.success || parsed.data.status !== 'OK' || !route || !leg) {
    throw new HttpError(422, 'Google Maps no encontró una ruta de conducción válida.');
  }
  return {
    distanceMeters: leg.distance.value,
    durationSeconds: leg.duration.value,
    coordinates: decodeGooglePolyline(route.overview_polyline.points),
  };
}

export async function getGoogleDrivingRoute(input: {
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
}): Promise<DrivingRoute> {
  const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
  url.search = new URLSearchParams({
    origin: `${input.from.lat},${input.from.lng}`,
    destination: `${input.to.lat},${input.to.lng}`,
    mode: 'driving',
    language: 'es',
    key: getApiKey(),
  }).toString();
  return parseDirectionsResponse(await getGoogleJson(url, 'Directions'));
}
