// AI-assisted: see docs/AI_LOG.md #1.
import type { ServiceCategory } from '../config/pricing';
export type { DriverProfile } from '../services/api';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export type PaymentMethod = 'mercadopago' | 'stripe' | 'cash';
export type PaymentStatus =
  | 'approved'
  | 'pending'
  | 'rejected'
  | 'refunded'
  | 'charged_back'
  | 'cash';
export type TripStatus =
  | 'requested'
  | 'accepted'
  | 'driver_arriving'
  | 'in_progress'
  | 'completed'
  | 'paid'
  | 'cancelled'
  | 'rejected';

export type Trip = {
  id: string;
  origin: { lat: number; lng: number; address: string };
  destination: { lat: number; lng: number; address: string };
  distanceKm: number;
  durationMin: number;
  category: ServiceCategory;
  fare: number;
  commission: number;
  tip: number;
  driverEarnings: number;
  commissionRate: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: TripStatus;
  rating?: number;
  createdAt: Date;
  expiresAt?: Date;
  completedAt?: Date;
};

export type TripRoute = {
  distanceMeters: number;
  durationSeconds: number;
  coordinates: { latitude: number; longitude: number }[];
};
