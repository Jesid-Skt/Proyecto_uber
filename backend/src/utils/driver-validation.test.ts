// AI-assisted: see docs/AI_LOG.md #3.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  driverAvailabilitySchema,
  driverLocationSchema,
  driverRegistrationSchema,
  loginSchema,
  profileUpdateSchema,
  pushTokenSchema,
} from './driver-validation.js';

const validRegistration = {
  fullName: 'Ana Conductora',
  email: 'ana@example.com',
  password: 'securepassword123',
  idNumber: '12345678',
  phone: '3001234567',
  birthDate: '1990-01-01',
  gender: 'Femenino',
  language: 'Español',
  category: 'Económico',
  plate: 'abc123',
  make: 'Marca',
  vehicleModel: 'Modelo',
  year: new Date().getFullYear(),
  color: 'Blanco',
  capacity: 4,
  licenseNumber: 'LIC123456',
  licenseExpiry: '2035-01-01',
  soatExpiry: '2035-01-01',
  revisionExpiry: '',
  mercadoPagoEmail: 'pagos@example.com',
  termsAccepted: true,
} as const;

test('accepts a valid registration and normalizes its license plate', () => {
  const parsed = driverRegistrationSchema.parse({
    ...validRegistration,
    termsAccepted: 'true',
  });
  assert.equal(parsed.plate, 'ABC123');
});

test('rejects underage drivers and expired required documents', () => {
  const underage = driverRegistrationSchema.safeParse({
    ...validRegistration,
    birthDate: '2015-01-01',
  });
  assert.equal(underage.success, false);

  const expiredDocument = driverRegistrationSchema.safeParse({
    ...validRegistration,
    licenseExpiry: '2020-01-01',
  });
  assert.equal(expiredDocument.success, false);
});

test('requires six passenger seats for XL vehicles', () => {
  const parsed = driverRegistrationSchema.safeParse({
    ...validRegistration,
    category: 'XL',
    capacity: 5,
  });
  assert.equal(parsed.success, false);
});

test('requires a current technical inspection for older vehicles', () => {
  const oldVehicleWithoutInspection = driverRegistrationSchema.safeParse({
    ...validRegistration,
    year: new Date().getFullYear() - 6,
  });
  assert.equal(oldVehicleWithoutInspection.success, false);

  const newVehicleWithoutInspection = driverRegistrationSchema.safeParse({
    ...validRegistration,
    year: new Date().getFullYear(),
  });
  assert.equal(newVehicleWithoutInspection.success, true);
});

test('requires a valid Mercado Pago email and explicit terms acceptance', () => {
  assert.equal(driverRegistrationSchema.safeParse({
    ...validRegistration,
    mercadoPagoEmail: 'not-an-email',
  }).success, false);
  assert.equal(driverRegistrationSchema.safeParse({
    ...validRegistration,
    termsAccepted: false,
  }).success, false);
});

test('login and profile update reject unexpected fields', () => {
  assert.equal(loginSchema.safeParse({
    email: 'ana@example.com',
    password: 'securepassword123',
    approvalStatus: 'approved',
  }).success, false);
  assert.equal(profileUpdateSchema.safeParse({ approvalStatus: 'approved' }).success, false);
});

test('availability updates accept only a boolean value', () => {
  assert.equal(driverAvailabilitySchema.safeParse({ available: true }).success, true);
  assert.equal(driverAvailabilitySchema.safeParse({ available: false }).success, true);
  assert.equal(driverAvailabilitySchema.safeParse({ available: 'true' }).success, false);
  assert.equal(driverAvailabilitySchema.safeParse({ available: true, approvalStatus: 'approved' }).success, false);
});

test('validates location coordinates and push tokens', () => {
  assert.equal(driverLocationSchema.safeParse({ lat: 4.65, lng: -74.08 }).success, true);
  assert.equal(driverLocationSchema.safeParse({ lat: 91, lng: -74.08 }).success, false);
  assert.equal(pushTokenSchema.safeParse({ token: 'fcm-registration-token-1234567890' }).success, true);
  assert.equal(pushTokenSchema.safeParse({ token: 'short' }).success, false);
});

test('validates editable vehicle and document fields', () => {
  assert.equal(profileUpdateSchema.safeParse({
    vehicle: {
      category: 'XL',
      plate: 'ABC123',
      make: 'Marca',
      model: 'Modelo',
      year: 2020,
      color: 'Blanco',
      capacity: 6,
    },
    documents: {
      licenseExpiry: '2035-01-01',
      soatExpiry: '2035-01-01',
      revisionExpiry: '2035-01-01',
    },
  }).success, true);
  assert.equal(profileUpdateSchema.safeParse({
    documents: { licenseExpiry: '2020-01-01' },
  }).success, false);
});
