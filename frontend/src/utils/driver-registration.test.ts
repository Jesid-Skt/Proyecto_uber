import assert from 'node:assert/strict';
import test from 'node:test';
import { getRegistrationStepErrors } from './driver-registration.ts';

const now = new Date(2026, 10, 10);
const validRegistration = {
  profilePhoto: 'profile.jpg',
  fullName: 'Ana Conductora',
  idNumber: '12345678',
  phone: '3001234567',
  birthDate: '1990-01-01',
  gender: 'Femenino',
  email: 'ana@example.com',
  password: 'securepassword123',
  language: 'Español',
  category: 'Económico',
  plate: 'ABC123',
  make: 'Marca',
  model: 'Modelo',
  year: '2026',
  color: 'Blanco',
  capacity: '4',
  vehiclePhoto: 'vehicle.jpg',
  licenseNumber: 'LIC123456',
  licensePhoto: 'license.jpg',
  licenseExpiry: '2035-01-01',
  soatPhoto: 'soat.jpg',
  soatExpiry: '2035-01-01',
  revisionPhoto: '',
  revisionExpiry: '',
  mercadoPagoEmail: 'pagos@example.com',
};

test('accepts a complete registration across all three tabs', () => {
  for (const step of [0, 1, 2]) {
    assert.deepEqual(getRegistrationStepErrors(validRegistration, step, true, now), {});
  }
});

test('validates personal details, email, password, and adult age', () => {
  const errors = getRegistrationStepErrors({
    ...validRegistration,
    fullName: 'Ana123',
    idNumber: '123',
    phone: '123',
    birthDate: '2010-01-01',
    email: 'invalid',
    password: 'short',
  }, 0, true, now);
  assert.ok(errors.fullName);
  assert.ok(errors.idNumber);
  assert.ok(errors.phone);
  assert.ok(errors.birthDate);
  assert.ok(errors.email);
  assert.ok(errors.password);
});

test('normalizes plate case and enforces XL capacity and vehicle limits', () => {
  assert.deepEqual(
    getRegistrationStepErrors({ ...validRegistration, plate: 'abc123' }, 1, true, now),
    {},
  );
  const errors = getRegistrationStepErrors({
    ...validRegistration,
    category: 'XL',
    plate: 'AB123',
    capacity: '5',
    make: 'M'.repeat(31),
  }, 1, true, now);
  assert.ok(errors.plate);
  assert.ok(errors.capacity);
  assert.ok(errors.make);
});

test('requires current document images, future expiries, and terms acceptance', () => {
  const errors = getRegistrationStepErrors({
    ...validRegistration,
    licensePhoto: '',
    licenseExpiry: '2020-01-01',
    soatExpiry: '2026-11-10',
    mercadoPagoEmail: 'not-an-email',
    year: '2019',
  }, 2, false, now);
  assert.ok(errors.licensePhoto);
  assert.ok(errors.licenseExpiry);
  assert.ok(errors.soatExpiry);
  assert.ok(errors.revisionPhoto);
  assert.ok(errors.revisionExpiry);
  assert.ok(errors.mercadoPagoEmail);
  assert.ok(errors.termsAccepted);
});
