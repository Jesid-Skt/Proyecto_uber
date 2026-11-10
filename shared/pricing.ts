// AI-assisted: see docs/AI_LOG.md #3.
export const PRICING = {
  baseFare: 3500,
  perKilometer: 1200,
  perMinute: 250,
  minimumFare: 6000,
  commissionRate: 0.2,
  categoryMultipliers: {
    economy: 1,
    xl: 1.4,
    premium: 1.8,
  },
} as const;

export type ServiceCategory = keyof typeof PRICING.categoryMultipliers;

export type FareInput = {
  distanceKm: number;
  durationMin: number;
  category: ServiceCategory;
  tip?: number;
};

export type FareBreakdown = {
  fare: number;
  commission: number;
  driverEarnings: number;
};

export function calculateFare({
  distanceKm,
  durationMin,
  category,
  tip = 0,
}: FareInput): FareBreakdown {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
    throw new RangeError('La distancia debe ser un número no negativo.');
  }
  if (!Number.isFinite(durationMin) || durationMin < 0) {
    throw new RangeError('La duración debe ser un número no negativo.');
  }
  if (!Number.isFinite(tip) || tip < 0) {
    throw new RangeError('La propina debe ser un número no negativo.');
  }

  const multiplier = PRICING.categoryMultipliers[category];
  if (multiplier === undefined) {
    throw new RangeError('La categoría del servicio no es válida.');
  }

  const subtotal =
    PRICING.baseFare +
    distanceKm * PRICING.perKilometer +
    durationMin * PRICING.perMinute;
  const fare = Math.round(
    Math.max(PRICING.minimumFare, subtotal * multiplier) / 100,
  ) * 100;
  const commission = Math.round(fare * PRICING.commissionRate);

  return {
    fare,
    commission,
    driverEarnings: fare - commission + tip,
  };
}
