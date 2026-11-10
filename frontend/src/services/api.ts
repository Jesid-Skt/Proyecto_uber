// AI-assisted: see docs/AI_LOG.md #1 and #3.
import { File } from 'expo-file-system';
import { Platform } from 'react-native';
import { io } from 'socket.io-client';
import type { PaymentMethod, Trip, TripRoute } from '../types/domain';

export type VehicleProfile = {
  category: 'Económico' | 'XL' | 'Premium';
  plate: string;
  make: string;
  model: string;
  year: number;
  color: string;
  capacity: number;
  photoId: string;
};

export type DriverProfile = {
  id: string;
  fullName: string;
  email: string;
  idNumber: string;
  phone: string;
  birthDate: string;
  gender: 'Femenino' | 'Masculino' | 'Otro';
  language: 'Español' | 'Inglés';
  profilePhotoId: string;
  vehicle: VehicleProfile;
  documents: {
    licenseNumber: string;
    licenseExpiry: string;
    licensePhotoId: string;
    soatExpiry: string;
    soatPhotoId: string;
    revisionExpiry: string | null;
    revisionPhotoId: string | null;
    mercadoPagoEmail: string;
    termsAcceptedAt: string;
  };
  approvalStatus: 'pending' | 'approved' | 'rejected';
  available: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DriverProfileUpdate = {
  fullName?: string;
  phone?: string;
  language?: DriverProfile['language'];
  vehicle?: Omit<VehicleProfile, 'photoId'>;
  documents?: {
    licenseNumber?: string;
    licenseExpiry?: string;
    soatExpiry?: string;
    revisionExpiry?: string | null;
    mercadoPagoEmail?: string;
  };
};

export type DriverDocumentKind = 'profile' | 'vehicle' | 'license' | 'soat' | 'revision';

export type TripResponse = Omit<Trip, 'createdAt' | 'expiresAt' | 'completedAt'> & {
  createdAt: string;
  expiresAt: string;
  completedAt?: string;
};

type AuthResponse = { token: string; driver: DriverProfile };
type ProfileResponse = { driver: DriverProfile };
type TripResult = { trip: TripResponse | null };
type TripListResponse = { trips: TripResponse[] };
export type TripHistoryFilters = {
  from?: string;
  to?: string;
  paymentMethod?: PaymentMethod;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function getApiBaseUrl(): string {
  const url = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '');
  if (!url) {
    throw new ApiError(
      'Configura EXPO_PUBLIC_API_URL en frontend/.env y reinicia Expo.',
      0,
    );
  }
  return url;
}

export function connectDriverRealtime(token: string) {
  return io(getApiBaseUrl(), {
    transports: ['websocket'],
    auth: { token },
    reconnection: true,
  });
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const url = `${getApiBaseUrl()}${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (error) {
    const reason = error instanceof Error
      ? `${error.name}: ${error.message}`
      : String(error);
    const cause = error instanceof Error && error.cause instanceof Error
      ? ` Causa: ${error.cause.message}.`
      : '';
    console.error('Falló la petición de red al backend.', { url, error });
    throw new ApiError(
      `No se pudo conectar con ${url}. ${reason}.${cause} Verifica que el dispositivo esté en la misma red y que el backend esté activo.`,
      0,
      error,
    );
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null) as
      | { error?: string; details?: unknown }
      | null;
    throw new ApiError(
      body?.error ?? `La API respondió con error ${response.status}.`,
      response.status,
      body?.details,
    );
  }
  if (response.status === 204) return undefined as T;
  return await response.json() as T;
}

export const driverApi = {
  register(form: FormData) {
    return request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: form,
    });
  },
  login(email: string, password: string) {
    return request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },
  getProfile(token: string) {
    return request<ProfileResponse>('/api/drivers/me', {}, token);
  },
  updateProfile(token: string, update: DriverProfileUpdate) {
    return request<ProfileResponse>('/api/drivers/me', {
      method: 'PATCH',
      body: JSON.stringify(update),
    }, token);
  },
  setAvailability(token: string, available: boolean) {
    return request<ProfileResponse>('/api/drivers/me/availability', {
      method: 'PATCH',
      body: JSON.stringify({ available }),
    }, token);
  },
  updateLocation(token: string, location: { lat: number; lng: number }) {
    return request<{ updatedAt: string }>('/api/drivers/me/location', {
      method: 'PATCH',
      body: JSON.stringify(location),
    }, token);
  },
  registerPushToken(token: string, pushToken: string) {
    return request<void>('/api/drivers/me/push-token', {
      method: 'PUT',
      body: JSON.stringify({ token: pushToken }),
    }, token);
  },
  removePushToken(token: string, pushToken: string) {
    return request<void>('/api/drivers/me/push-token', {
      method: 'DELETE',
      body: JSON.stringify({ token: pushToken }),
    }, token);
  },
  uploadDriverDocument(token: string, kind: DriverDocumentKind, image: FormData) {
    return request<ProfileResponse>(`/api/drivers/me/documents/${kind}`, {
      method: 'PUT',
      body: image,
    }, token);
  },
  getNextTripRequest(token: string) {
    return request<TripResult>('/api/drivers/me/trips/next-request', {}, token);
  },
  getActiveTrip(token: string) {
    return request<TripResult>('/api/drivers/me/trips/active', {}, token);
  },
  acceptTripRequest(token: string, tripId: string) {
    return request<{ trip: TripResponse }>(
      `/api/drivers/me/trips/${encodeURIComponent(tripId)}/accept`,
      { method: 'PATCH' },
      token,
    );
  },
  rejectTripRequest(token: string, tripId: string) {
    return request<{ trip: TripResponse }>(
      `/api/drivers/me/trips/${encodeURIComponent(tripId)}/reject`,
      { method: 'PATCH' },
      token,
    );
  },
  updateTripStatus(token: string, tripId: string, status: 'arriving' | 'start') {
    return request<{ trip: TripResponse }>(
      `/api/drivers/me/trips/${encodeURIComponent(tripId)}/${status}`,
      { method: 'PATCH' },
      token,
    );
  },
  completeTrip(token: string, tripId: string) {
    return request<{ trip: TripResponse }>(
      `/api/drivers/me/trips/${encodeURIComponent(tripId)}/complete`,
      { method: 'PATCH' },
      token,
    );
  },
  confirmCashPayment(token: string, tripId: string) {
    return request<{ trip: TripResponse }>(
      `/api/drivers/me/trips/${encodeURIComponent(tripId)}/cash-payment`,
      { method: 'PATCH' },
      token,
    );
  },
  getTripHistory(token: string, filters: TripHistoryFilters = {}) {
    const query = new URLSearchParams(
      Object.entries(filters).filter((entry): entry is [string, string] => Boolean(entry[1])),
    );
    const suffix = query.size ? `?${query.toString()}` : '';
    return request<TripListResponse>(`/api/drivers/me/trips/history${suffix}`, {}, token);
  },
  createMercadoPagoCheckout(token: string, tripId: string) {
    return request<{ tripId: string; preferenceId: string; checkoutUrl: string }>(
      `/api/drivers/me/trips/${encodeURIComponent(tripId)}/checkout`,
      { method: 'POST' },
      token,
    );
  },
  getTrip(token: string, tripId: string) {
    return request<{ trip: TripResponse }>(
      `/api/drivers/me/trips/${encodeURIComponent(tripId)}`,
      {},
      token,
    );
  },
  getTripRoute(
    token: string,
    tripId: string,
    input: { target: 'pickup' | 'destination' | 'history'; from: { lat: number; lng: number } },
  ) {
    return request<{ route: TripRoute }>(
      `/api/drivers/me/trips/${encodeURIComponent(tripId)}/route`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
      token,
    );
  },
};

export async function appendImage(
  form: FormData,
  field: string,
  uri: string,
): Promise<void> {
  const extension = uri.split('.').pop()?.toLowerCase();
  const mimeType = extension === 'png'
    ? 'image/png'
    : extension === 'webp'
      ? 'image/webp'
      : 'image/jpeg';
  const fileName = `${field}-${Date.now()}.${mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg'}`;
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    if (!response.ok) {
      throw new ApiError(`No se pudo leer la imagen ${field}.`, response.status);
    }
    form.append(field, await response.blob(), fileName);
    return;
  }
  form.append(field, new File(uri), fileName);
}
