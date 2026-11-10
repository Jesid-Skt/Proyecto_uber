// AI-assisted: see docs/AI_LOG.md #3.
import { z } from 'zod';
import { calculateFare, PRICING, type ServiceCategory } from '../../../shared/pricing.js';

const pointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string().trim().min(1).max(300),
}).strict();

export const tripRequestSchema = z.object({
  driverId: z.string().regex(/^[a-f\d]{24}$/i),
  origin: pointSchema,
  destination: pointSchema,
  category: z.enum(['economy', 'xl', 'premium']),
  paymentMethod: z.enum(['cash', 'mercadopago']),
}).strict();

export const tripIdSchema = z.string().regex(/^[a-f\d]{24}$/i);

export const tripRouteSchema = z.object({
  target: z.enum(['pickup', 'destination', 'history']),
  from: z.object({
    lat: z.number().finite().min(-90).max(90),
    lng: z.number().finite().min(-180).max(180),
  }).strict(),
}).strict();

export function calculateTripFare(input: {
  distanceKm: number;
  durationMin: number;
  category: ServiceCategory;
}) {
  return {
    ...calculateFare(input),
    commissionRate: PRICING.commissionRate,
  };
}
