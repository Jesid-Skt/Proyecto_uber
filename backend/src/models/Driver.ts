// AI-assisted: see docs/AI_LOG.md #3.
import { Schema, model, type InferSchemaType } from 'mongoose';

const vehicleSchema = new Schema(
  {
    category: { type: String, enum: ['Económico', 'XL', 'Premium'], required: true },
    plate: { type: String, required: true, uppercase: true, trim: true, maxlength: 6 },
    make: { type: String, required: true, trim: true, maxlength: 30 },
    model: { type: String, required: true, trim: true, maxlength: 30 },
    year: { type: Number, required: true, min: 1950, max: new Date().getFullYear() },
    color: { type: String, required: true, trim: true },
    capacity: { type: Number, required: true, min: 1, max: 20 },
    photoId: { type: Schema.Types.ObjectId, ref: 'DriverDocument' },
  },
  { _id: false },
);

const driverSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 50 },
    email: { type: String, required: true, lowercase: true, trim: true, unique: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    idNumber: { type: String, required: true, unique: true, index: true },
    phone: { type: String, required: true },
    birthDate: { type: Date, required: true },
    gender: { type: String, required: true, enum: ['Femenino', 'Masculino', 'Otro'] },
    language: { type: String, required: true, enum: ['Español', 'Inglés'], default: 'Español' },
    profilePhotoId: { type: Schema.Types.ObjectId, ref: 'DriverDocument', required: true },
    vehicle: { type: vehicleSchema, required: true },
    documents: {
      licenseNumber: { type: String, required: true },
      licenseExpiry: { type: Date, required: true },
      licensePhotoId: { type: Schema.Types.ObjectId, ref: 'DriverDocument', required: true },
      soatExpiry: { type: Date, required: true },
      soatPhotoId: { type: Schema.Types.ObjectId, ref: 'DriverDocument', required: true },
      revisionExpiry: { type: Date },
      revisionPhotoId: { type: Schema.Types.ObjectId, ref: 'DriverDocument' },
      mercadoPagoEmail: { type: String, required: true, lowercase: true, trim: true },
      termsAcceptedAt: { type: Date, required: true },
    },
    approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    available: { type: Boolean, default: false },
    currentLocation: {
      lat: { type: Number, min: -90, max: 90 },
      lng: { type: Number, min: -180, max: 180 },
      updatedAt: { type: Date },
    },
    pushTokens: { type: [String], default: [] },
    schemaVersion: { type: Number, default: 1 },
  },
  { timestamps: true, versionKey: false },
);

vehicleSchema.index({ plate: 1 }, { unique: true });

export type DriverRecord = InferSchemaType<typeof driverSchema>;
export const Driver = model('Driver', driverSchema);
export type DriverDocumentRecord = ReturnType<typeof Driver.hydrate>;
