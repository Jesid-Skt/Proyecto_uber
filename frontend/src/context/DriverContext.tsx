// AI-assisted: see docs/AI_LOG.md #1 and #3.
import * as SecureStore from 'expo-secure-store';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  appendImage,
  ApiError,
  driverApi,
  type DriverProfile,
  type DriverProfileUpdate,
  type DriverDocumentKind,
  type TripHistoryFilters,
} from '../services/api';
import type { Trip, TripRoute } from '../types/domain';
import { useDriverRealtime } from '../hooks/useDriverRealtime';
import { supportsNativeFirebase } from '../utils/native-firebase';
import { mapTripResponse } from '../utils/trip-response';

type ActiveRequest = Omit<Trip, 'expiresAt'> & { expiresAt: number };

type DriverContextValue = {
  profile: DriverProfile | null;
  sessionLoading: boolean;
  sessionError: string | null;
  available: boolean;
  trips: Trip[];
  activeRequest: ActiveRequest | null;
  activeTrip: Trip | null;
  login: (email: string, password: string) => Promise<void>;
  register: (form: FormData) => Promise<void>;
  logout: () => Promise<void>;
  retrySession: () => Promise<void>;
  refreshProfile: () => Promise<DriverProfile>;
  updateProfile: (update: DriverProfileUpdate) => Promise<void>;
  uploadDocument: (kind: DriverDocumentKind, uri: string) => Promise<void>;
  setAvailable: (available: boolean) => Promise<void>;
  updateLocation: (location: { lat: number; lng: number }) => Promise<void>;
  setActiveRequest: (request: ActiveRequest | null) => void;
  refreshTripRequest: () => Promise<void>;
  refreshTripHistory: (filters?: TripHistoryFilters) => Promise<void>;
  getTripDetails: (tripId: string) => Promise<Trip>;
  refreshActiveTrip: () => Promise<Trip>;
  getTripRoute: (
    tripId: string,
    input: { target: 'pickup' | 'destination' | 'history'; from: { lat: number; lng: number } },
  ) => Promise<TripRoute>;
  acceptRequest: () => Promise<Trip>;
  rejectRequest: () => Promise<void>;
  updateActiveTrip: (status: 'driver_arriving' | 'in_progress') => Promise<Trip>;
  completeActiveTrip: () => Promise<Trip>;
  confirmCashPayment: () => Promise<Trip>;
  createPaymentCheckout: () => Promise<string>;
  setLanguage: (language: DriverProfile['language']) => Promise<void>;
};

const SESSION_TOKEN_KEY = 'driver-session-token';
const DriverContext = createContext<DriverContextValue | null>(null);

export function DriverProvider({ children }: React.PropsWithChildren) {
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionVersion, setSessionVersion] = useState(0);
  const [available, setAvailableState] = useState(false);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeRequest, setActiveRequest] = useState<ActiveRequest | null>(null);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);

  useEffect(() => {
    let active = true;
    const restoreSession = async () => {
      try {
        const token = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
        if (!active) return;
        if (!token) {
          setProfile(null);
          setSessionError(null);
          return;
        }
        const response = await driverApi.getProfile(token);
        if (!active) return;
        setProfile(response.driver);
        setAvailableState(
          response.driver.approvalStatus === 'approved' && response.driver.available,
        );
        const tripResponse = await driverApi.getActiveTrip(token);
        if (!active) return;
        setActiveTrip(tripResponse.trip ? mapTripResponse(tripResponse.trip) : null);
        setSessionError(null);
      } catch (error) {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) {
          await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
          if (!active) return;
          setProfile(null);
          setAvailableState(false);
        } else {
          setSessionError(error instanceof Error ? error.message : 'No se pudo restaurar la sesión.');
        }
      } finally {
        if (active) setSessionLoading(false);
      }
    };
    void Promise.resolve().then(restoreSession);
    return () => {
      active = false;
    };
  }, [sessionVersion]);

  const saveAuthResponse = useCallback(async (response: {
    token: string;
    driver: DriverProfile;
  }) => {
    await SecureStore.setItemAsync(SESSION_TOKEN_KEY, response.token);
    setProfile(response.driver);
    setAvailableState(
      response.driver.approvalStatus === 'approved' && response.driver.available,
    );
    setSessionError(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await driverApi.login(email, password);
    await saveAuthResponse(response);
  }, [saveAuthResponse]);

  const register = useCallback(async (form: FormData) => {
    const response = await driverApi.register(form);
    await saveAuthResponse(response);
  }, [saveAuthResponse]);

  const logout = useCallback(async () => {
    const token = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
    if (token && supportsNativeFirebase()) {
      try {
        const messaging = await import('@react-native-firebase/messaging');
        const pushToken = await messaging.getToken(messaging.getMessaging());
        await driverApi.removePushToken(token, pushToken);
      } catch (error) {
        console.error('No se pudo retirar el token de notificaciones al cerrar sesión.', error);
      }
    }
    if (token && available) {
      await driverApi.setAvailability(token, false);
    }
    await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
    setProfile(null);
    setAvailableState(false);
    setActiveTrip(null);
    setActiveRequest(null);
    setTrips([]);
  }, [available]);

  const retrySession = useCallback(async () => {
    setSessionLoading(true);
    setSessionVersion((current) => current + 1);
  }, []);

  const refreshProfile = useCallback(async () => {
    const token = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
    if (!token) {
      throw new ApiError('Inicia sesión para actualizar el estado de la cuenta.', 401);
    }
    const response = await driverApi.getProfile(token);
    setProfile(response.driver);
    setAvailableState(
      response.driver.approvalStatus === 'approved' && response.driver.available,
    );
    return response.driver;
  }, []);

  const updateProfile = useCallback(async (update: DriverProfileUpdate) => {
    const token = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
    if (!token) {
      throw new ApiError('Inicia sesión para editar el perfil.', 401);
    }
    const response = await driverApi.updateProfile(token, update);
    setProfile(response.driver);
    if (response.driver.approvalStatus !== 'approved') {
      setAvailableState(false);
    }
  }, []);

  const uploadDocument = useCallback(async (kind: DriverDocumentKind, uri: string) => {
    const token = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
    if (!token) {
      throw new ApiError('Inicia sesión para actualizar los documentos.', 401);
    }
    const form = new FormData();
    await appendImage(form, 'document', uri);
    const response = await driverApi.uploadDriverDocument(token, kind, form);
    setProfile(response.driver);
  }, []);

  const setAvailable = useCallback(async (value: boolean) => {
    if (!profile || (value && profile.approvalStatus !== 'approved')) {
      throw new Error('La cuenta debe estar aprobada para conectarse.');
    }
    const token = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
    if (!token) {
      throw new ApiError('Inicia sesión para cambiar la disponibilidad.', 401);
    }
    const response = await driverApi.setAvailability(token, value);
    setProfile(response.driver);
    setAvailableState(response.driver.available);
  }, [profile]);

  const updateLocation = useCallback(async (location: { lat: number; lng: number }) => {
    const token = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
    if (!token) {
      throw new ApiError('Inicia sesión para compartir la ubicación.', 401);
    }
    await driverApi.updateLocation(token, location);
  }, []);

  const refreshTripRequest = useCallback(async () => {
    const token = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
    if (!token) {
      throw new ApiError('Inicia sesión para consultar solicitudes.', 401);
    }
    const response = await driverApi.getNextTripRequest(token);
    setActiveRequest(response.trip ? {
      ...mapTripResponse(response.trip),
      expiresAt: new Date(response.trip.expiresAt).getTime(),
    } : null);
  }, []);

  const refreshTripHistory = useCallback(async (filters?: TripHistoryFilters) => {
    const token = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
    if (!token) {
      throw new ApiError('Inicia sesión para consultar el historial.', 401);
    }
    const response = await driverApi.getTripHistory(token, filters);
    setTrips(response.trips.map(mapTripResponse));
  }, []);

  const getTripDetails = useCallback(async (tripId: string) => {
    const token = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
    if (!token) {
      throw new ApiError('Inicia sesión para consultar el detalle del viaje.', 401);
    }
    const response = await driverApi.getTrip(token, tripId);
    return mapTripResponse(response.trip);
  }, []);

  const refreshActiveTrip = useCallback(async () => {
    const tripId = activeTrip?.id;
    if (!tripId) {
      throw new Error('No hay un viaje activo para actualizar.');
    }
    const token = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
    if (!token) {
      throw new ApiError('Inicia sesión para consultar el estado del viaje.', 401);
    }
    const response = await driverApi.getTrip(token, tripId);
    const trip = mapTripResponse(response.trip);
    setActiveTrip(trip);
    setTrips((current) => [trip, ...current.filter((item) => item.id !== trip.id)]);
    return trip;
  }, [activeTrip?.id]);

  const getTripRoute = useCallback(async (
    tripId: string,
    input: { target: 'pickup' | 'destination' | 'history'; from: { lat: number; lng: number } },
  ): Promise<TripRoute> => {
    const token = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
    if (!token) {
      throw new ApiError('Inicia sesión para consultar la ruta.', 401);
    }
    const response = await driverApi.getTripRoute(token, tripId, input);
    return response.route;
  }, []);

  const acceptRequest = useCallback(async () => {
    if (!activeRequest) {
      throw new Error('No hay una solicitud activa para aceptar.');
    }
    const token = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
    if (!token) {
      throw new ApiError('Inicia sesión para aceptar la solicitud.', 401);
    }
    const response = await driverApi.acceptTripRequest(token, activeRequest.id);
    const trip = mapTripResponse(response.trip);
    setActiveTrip(trip);
    setActiveRequest(null);
    return trip;
  }, [activeRequest]);

  const rejectRequest = useCallback(async () => {
    if (!activeRequest) {
      throw new Error('No hay una solicitud activa para rechazar.');
    }
    const token = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
    if (!token) {
      throw new ApiError('Inicia sesión para rechazar la solicitud.', 401);
    }
    await driverApi.rejectTripRequest(token, activeRequest.id);
    setActiveRequest(null);
  }, [activeRequest]);

  const updateActiveTrip = useCallback(async (status: 'driver_arriving' | 'in_progress') => {
    if (!activeTrip) {
      throw new Error('No hay un viaje activo para actualizar.');
    }
    const token = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
    if (!token) {
      throw new ApiError('Inicia sesión para actualizar el viaje.', 401);
    }
    const apiStatus = status === 'driver_arriving' ? 'arriving' : 'start';
    const response = await driverApi.updateTripStatus(token, activeTrip.id, apiStatus);
    const trip = mapTripResponse(response.trip);
    setActiveTrip(trip);
    return trip;
  }, [activeTrip]);

  const completeActiveTrip = useCallback(async () => {
    if (!activeTrip) {
      throw new Error('No hay un viaje activo para finalizar.');
    }
    const token = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
    if (!token) {
      throw new ApiError('Inicia sesión para finalizar el viaje.', 401);
    }
    const response = await driverApi.completeTrip(token, activeTrip.id);
    const trip = mapTripResponse(response.trip);
    setActiveTrip(trip);
    return trip;
  }, [activeTrip]);

  const confirmCashPayment = useCallback(async () => {
    if (!activeTrip) {
      throw new Error('No hay un viaje pendiente de pago.');
    }
    const token = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
    if (!token) {
      throw new ApiError('Inicia sesión para confirmar el pago.', 401);
    }
    const response = await driverApi.confirmCashPayment(token, activeTrip.id);
    const trip = mapTripResponse(response.trip);
    setActiveTrip(trip);
    setTrips((current) => [trip, ...current.filter((item) => item.id !== trip.id)]);
    return trip;
  }, [activeTrip]);

  const createPaymentCheckout = useCallback(async () => {
    if (!activeTrip || activeTrip.paymentMethod !== 'mercadopago') {
      throw new Error('No hay un viaje de Mercado Pago pendiente de cobro.');
    }
    const token = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
    if (!token) {
      throw new ApiError('Inicia sesión para crear el checkout.', 401);
    }
    const response = await driverApi.createMercadoPagoCheckout(token, activeTrip.id);
    return response.checkoutUrl;
  }, [activeTrip]);

  const setLanguage = useCallback(async (value: DriverProfile['language']) => {
    await updateProfile({ language: value });
  }, [updateProfile]);

  useDriverRealtime(profile, activeTrip?.id ?? null, refreshTripRequest, setActiveTrip);

  const value = useMemo(
    () => ({
      profile,
      sessionLoading,
      sessionError,
      available,
      trips,
      activeRequest,
      activeTrip,
      login,
      register,
      logout,
      retrySession,
      refreshProfile,
      updateProfile,
      uploadDocument,
      setAvailable,
      updateLocation,
      setActiveRequest,
      refreshTripRequest,
      refreshTripHistory,
      getTripDetails,
      refreshActiveTrip,
      getTripRoute,
      acceptRequest,
      rejectRequest,
      updateActiveTrip,
      completeActiveTrip,
      confirmCashPayment,
      createPaymentCheckout,
      setLanguage,
    }),
    [
      profile,
      sessionLoading,
      sessionError,
      available,
      trips,
      activeRequest,
      activeTrip,
      login,
      register,
      logout,
      retrySession,
      refreshProfile,
      updateProfile,
      uploadDocument,
      setAvailable,
      updateLocation,
      refreshTripRequest,
      refreshTripHistory,
      getTripDetails,
      refreshActiveTrip,
      getTripRoute,
      acceptRequest,
      rejectRequest,
      updateActiveTrip,
      completeActiveTrip,
      confirmCashPayment,
      createPaymentCheckout,
      setLanguage,
    ],
  );
  return <DriverContext.Provider value={value}>{children}</DriverContext.Provider>;
}

export function useDriver(): DriverContextValue {
  const value = useContext(DriverContext);
  if (!value) {
    throw new Error('useDriver debe usarse dentro de DriverProvider.');
  }
  return value;
}
