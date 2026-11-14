import { getOpenRouteServiceRoute } from './openrouteservice.js';
import type { TripMetrics } from './route-types.js';

export async function getTripMetrics(input: {
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
}): Promise<TripMetrics> {
  const route = await getOpenRouteServiceRoute(input);
  return {
    distanceKm: Math.round((route.distanceMeters / 1000) * 100) / 100,
    durationMin: Math.max(1, Math.ceil(route.durationSeconds / 60)),
  };
}
