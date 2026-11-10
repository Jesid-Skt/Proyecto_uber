// AI-assisted: see docs/AI_LOG.md #3.
import { z } from 'zod';

const emailSchema = z.email().max(254);
const futureDate = z.iso.date().refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return date > today;
}, 'La fecha de vencimiento debe ser futura.');

const birthDate = z.iso.date().refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  const cutoff = new Date();
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 18);
  cutoff.setUTCHours(0, 0, 0, 0);
  return date <= cutoff;
}, 'El conductor debe tener al menos 18 años.');

export const driverRegistrationSchema = z.object({
  fullName: z.string().trim().min(1).max(50).regex(/^[\p{L}\s]+$/u),
  email: emailSchema,
  password: z.string().min(10).max(72).regex(/[A-Za-z]/).regex(/\d/),
  idNumber: z.string().regex(/^\d{6,10}$/),
  phone: z.string().regex(/^\d{10}$/),
  birthDate,
  gender: z.enum(['Femenino', 'Masculino', 'Otro']),
  language: z.enum(['Español', 'Inglés']),
  category: z.enum(['Económico', 'XL', 'Premium']),
  plate: z.string().trim().toUpperCase().regex(/^[A-Z]{3}\d{3}$/),
  make: z.string().trim().min(1).max(30),
  vehicleModel: z.string().trim().min(1).max(30),
  year: z.coerce.number().int().min(1950).max(new Date().getFullYear()),
  color: z.string().trim().min(1).max(30),
  capacity: z.coerce.number().int().min(1).max(20),
  licenseNumber: z.string().trim().min(1).max(40),
  licenseExpiry: futureDate,
  soatExpiry: futureDate,
  revisionExpiry: futureDate.optional().or(z.literal('')),
  mercadoPagoEmail: emailSchema,
  termsAccepted: z.preprocess(
    (value) => value === 'true' ? true : value,
    z.literal(true),
  ),
}).superRefine((data, context) => {
  if (data.category === 'XL' && data.capacity < 6) {
    context.addIssue({
      code: 'custom',
      path: ['capacity'],
      message: 'La categoría XL requiere capacidad mínima de 6 pasajeros.',
    });
  }
  const revisionRequired = data.year <= new Date().getFullYear() - 6;
  if (revisionRequired && !data.revisionExpiry) {
    context.addIssue({
      code: 'custom',
      path: ['revisionExpiry'],
      message: 'La revisión técnico-mecánica es obligatoria para este vehículo.',
    });
  }
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(72),
}).strict();

export const profileUpdateSchema = z.object({
  fullName: z.string().trim().min(1).max(50).regex(/^[\p{L}\s]+$/u).optional(),
  phone: z.string().regex(/^\d{10}$/).optional(),
  language: z.enum(['Español', 'Inglés']).optional(),
  vehicle: z.object({
    category: z.enum(['Económico', 'XL', 'Premium']),
    plate: z.string().trim().toUpperCase().regex(/^[A-Z]{3}\d{3}$/),
    make: z.string().trim().min(1).max(30),
    model: z.string().trim().min(1).max(30),
    year: z.number().int().min(1950).max(new Date().getFullYear()),
    color: z.string().trim().min(1).max(30),
    capacity: z.number().int().min(1).max(20),
  }).optional(),
  documents: z.object({
    licenseNumber: z.string().trim().min(1).max(40).optional(),
    licenseExpiry: futureDate.optional(),
    soatExpiry: futureDate.optional(),
    revisionExpiry: futureDate.nullable().optional(),
    mercadoPagoEmail: emailSchema.optional(),
  }).optional(),
}).strict().superRefine((data, context) => {
  if (data.vehicle?.category === 'XL' && data.vehicle.capacity < 6) {
    context.addIssue({
      code: 'custom',
      path: ['vehicle', 'capacity'],
      message: 'La categoría XL requiere capacidad mínima de 6 pasajeros.',
    });
  }
  if (
    data.vehicle &&
    data.vehicle.year <= new Date().getFullYear() - 6 &&
    !data.documents?.revisionExpiry
  ) {
    context.addIssue({
      code: 'custom',
      path: ['documents', 'revisionExpiry'],
      message: 'La revisión técnico-mecánica es obligatoria para este vehículo.',
    });
  }
});

export const driverAvailabilitySchema = z.object({
  available: z.boolean(),
}).strict();

export const driverLocationSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
}).strict();

export const pushTokenSchema = z.object({
  token: z.string().trim().min(20).max(4096),
}).strict();

export type DriverRegistrationInput = z.infer<typeof driverRegistrationSchema>;
