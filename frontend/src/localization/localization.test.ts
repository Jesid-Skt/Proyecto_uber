import assert from 'node:assert/strict';
import test from 'node:test';
import { createLocalization } from './index.ts';
import { es } from './es.ts';
import { en } from './en.ts';

test('both catalogs cover the same messages and interpolation parameters', () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(es).sort());
  for (const key of Object.keys(es) as (keyof typeof es)[]) {
    assert.ok(en[key].trim());
    assert.deepEqual(en[key].match(/\{\w+\}/g)?.sort(), es[key].match(/\{\w+\}/g)?.sort());
  }
});

test('profile language selects translations with a Spanish fallback', () => {
  assert.equal(createLocalization('Inglés').t('Ganancias'), 'Earnings');
  for (const language of ['Español', undefined, null, 'unknown']) {
    assert.equal(createLocalization(language).t('Ganancias'), 'Ganancias');
  }
});

test('interpolation preserves zero and inserts values literally', () => {
  const { t } = createLocalization('Inglés');
  assert.equal(t('Tiempo para responder: {seconds} s', { seconds: 0 }), 'Time to respond: 0 s');
  assert.equal(t('Promedio {amount}', { amount: '$&' }), 'Average $&');
});

test('known errors and domain labels translate while unknown data stays intact', () => {
  const { translateText } = createLocalization('Inglés');
  assert.equal(translateText('Económico'), 'Economy');
  assert.equal(translateText('Activa el permiso de ubicación para conectarte.'), 'Enable location permission to go online.');
  assert.equal(
    translateText('Activa los servicios de ubicación del dispositivo y vuelve a intentar.'),
    "Turn on your device's location services and try again.",
  );
  assert.equal(translateText('Reintentar ubicación'), 'Retry location');
  assert.equal(translateText('Custom server detail 123'), 'Custom server detail 123');
  assert.equal(translateText('constructor'), 'constructor');
});

test('formatting changes locale without converting COP amounts', () => {
  for (const [language, locale] of [['Español', 'es-CO'], ['Inglés', 'en-US']]) {
    const localization = createLocalization(language);
    assert.equal(localization.formatCurrency(12345), new Intl.NumberFormat(locale, {
      style: 'currency', currency: 'COP', maximumFractionDigits: 0,
    }).format(12345));
    assert.equal(localization.formatNumber(1234.5), new Intl.NumberFormat(locale).format(1234.5));
    const date = new Date(2026, 10, 13, 14, 30);
    assert.equal(localization.formatDate(date), date.toLocaleDateString(locale));
  }
});
