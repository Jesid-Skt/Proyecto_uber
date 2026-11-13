import { es, type TranslationKey } from './es.ts';
import { en } from './en.ts';

export type Language = 'Español' | 'Inglés';
export type TranslationParams = Record<string, string | number>;
export type { TranslationKey } from './es';

export function createLocalization(language: string | null | undefined) {
  const locale = language === 'Inglés' ? 'en-US' : 'es-CO';
  const messages = language === 'Inglés' ? en : es;
  const t = (key: TranslationKey, params: TranslationParams = {}): string =>
    messages[key].replace(/\{(\w+)\}/g, (match, name: string) => String(params[name] ?? match));
  // Use only for existing display values/errors; unknown server text is preserved.
  const translateText = (text: string): string => {
    if (Object.prototype.hasOwnProperty.call(es, text)) return t(text as TranslationKey);
    // Legacy validation produces a year-dependent message; retain its value.
    const yearError = /^Ingresa un año entre 1950 y (\d{4})\.$/.exec(text);
    return yearError ? t('Ingresa un año entre 1950 y {year}.', { year: yearError[1] }) : text;
  };
  const paymentStatusLabel = (status: string): string => {
    const labels: Record<string, TranslationKey> = {
      pending: 'Pendiente', approved: 'Aprobado', rejected: 'Rechazado',
      refunded: 'Reembolsado', charged_back: 'Contracargo', cash: 'Efectivo recibido',
    };
    return Object.prototype.hasOwnProperty.call(labels, status) ? t(labels[status]) : status;
  };
  return {
    locale,
    t,
    translateText,
    paymentStatusLabel,
    formatCurrency: (value: number) => new Intl.NumberFormat(locale, {
      style: 'currency', currency: 'COP', maximumFractionDigits: 0,
    }).format(value),
    formatNumber: (value: number) => new Intl.NumberFormat(locale).format(value),
    formatDate: (value: Date, withTime = false) => withTime
      ? value.toLocaleString(locale, { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : value.toLocaleDateString(locale),
  };
}

