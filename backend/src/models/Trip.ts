// AI-assisted: see docs/AI_LOG.md #3.
import { Schema, model, type InferSchemaType } from 'mongoose';

const pointSchema = new Schema(
  {
    lat: { type: Number, required: true, min: -90, max: 90 },
    lng: { type: Number, required: true, min: -180, max: 180 },
    address: { type: String, required: true, trim: true, maxlength: 300 },
  },
  { _id: false },
);

const tripSchema = new Schema(
  {
    driverId: { type: Schema.Types.ObjectId, ref: 'Driver', required: true, index: true },
    origin: { type: pointSchema, required: true },
    destination: { type: pointSchema, required: true },
    distanceKm: { type: Number, required: true, min: 0 },
    durationMin: { type: Number, required: true, min: 0 },
    category: { type: String, enum: ['economy', 'xl', 'premium'], required: true },
    paymentMethod: { type: String, enum: ['mercadopago', 'stripe', 'cash'], required: true },
    fare: { type: Number, required: true, min: 0 },
    commission: { type: Number, required: true, min: 0 },
    tip: { type: Number, default: 0, min: 0 },
    driverEarnings: { type: Number, required: true, min: 0 },
    commissionRate: { type: Number, required: true },
    rating: { type: Number, min: 1, max: 5 },
    paymentStatus: {
      type: String,
      enum: ['approved', 'pending', 'rejected', 'refunded', 'charged_back', 'cash'],
      default: 'pending',
    },
    mercadoPagoPreferenceId: { type: String },
    mercadoPagoCheckoutUrl: { type: String },
    mercadoPagoPaymentId: { type: String },
    status: {
      type: String,
      enum: ['requested', 'accepted', 'driver_arriving', 'in_progress', 'completed', 'paid', 'cancelled', 'rejected', 'expired'],
      default: 'requested',
      index: true,
    },
    expiresAt: { type: Date, required: true, index: true },
    completedAt: { type: Date },
  },
  { timestamps: true, versionKey: false },
);

tripSchema.index({ driverId: 1, status: 1, createdAt: -1 });

export type TripRecord = InferSchemaType<typeof tripSchema>;
export const Trip = model('Trip', tripSchema);
