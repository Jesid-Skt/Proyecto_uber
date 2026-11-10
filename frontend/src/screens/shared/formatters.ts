import type { PaymentMethod } from '../../types/domain';

export function formatDate(date: Date, withTime = false): string {
  const dateLabel = date.toLocaleDateString('es-CO');
  return withTime
    ? `${dateLabel} ${date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`
    : dateLabel;
}

export function formatDateInput(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function paymentMethodLabel(method: PaymentMethod): string {
  return {
    cash: 'Efectivo',
    mercadopago: 'Mercado Pago',
    stripe: 'Stripe',
  }[method];
}
