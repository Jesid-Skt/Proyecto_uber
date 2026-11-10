import type { Trip } from '../types/domain';
import type { TripResponse } from '../services/api';

export function mapTripResponse(response: TripResponse): Trip {
  const { createdAt, expiresAt, completedAt, ...trip } = response;
  return {
    ...trip,
    createdAt: new Date(createdAt),
    expiresAt: new Date(expiresAt),
    ...(completedAt ? { completedAt: new Date(completedAt) } : {}),
  };
}
