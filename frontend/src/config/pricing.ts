// AI-assisted: see docs/AI_LOG.md #3.
export {
  calculateFare,
  PRICING,
  type FareBreakdown,
  type FareInput,
  type ServiceCategory,
} from '../../../shared/pricing.ts';

export function formatCop(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}
