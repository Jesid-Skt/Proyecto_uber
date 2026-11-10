// AI-assisted: see docs/AI_LOG.md #3.
import type { TripRecord } from '../models/Trip.js';

export function serializeTrip(trip: TripRecord & {
  id?: string;
  _id: { toString(): string };
}) {
  return {
    id: trip.id ?? trip._id.toString(),
    origin: trip.origin,
    destination: trip.destination,
    distanceKm: trip.distanceKm,
    durationMin: trip.durationMin,
    category: trip.category,
    fare: trip.fare,
    commission: trip.commission,
    tip: trip.tip,
    driverEarnings: trip.driverEarnings,
    commissionRate: trip.commissionRate,
    ...(trip.rating === undefined ? {} : { rating: trip.rating }),
    paymentMethod: trip.paymentMethod,
    paymentStatus: trip.paymentStatus,
    status: trip.status,
    createdAt: trip.createdAt.toISOString(),
    expiresAt: trip.expiresAt.toISOString(),
    ...(trip.completedAt ? { completedAt: trip.completedAt.toISOString() } : {}),
  };
}
