import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import {
  connectDriverRealtime,
  driverApi,
  type DriverProfile,
} from '../services/api';
import type { Trip } from '../types/domain';
import { supportsNativeFirebase } from '../utils/native-firebase';
import { mapTripResponse } from '../utils/trip-response';

const SESSION_TOKEN_KEY = 'driver-session-token';

export function useDriverRealtime(
  profile: DriverProfile | null,
  activeTripId: string | null,
  refreshTripRequest: () => Promise<void>,
  setActiveTrip: React.Dispatch<React.SetStateAction<Trip | null>>,
): void {
  const currentTripId = useRef<string | null>(null);

  useEffect(() => {
    currentTripId.current = activeTripId;
  }, [activeTripId]);

  useEffect(() => {
    if (!profile) return;
    let active = true;
    let socket: ReturnType<typeof connectDriverRealtime> | null = null;
    let unsubscribeMessage: (() => void) | null = null;
    let unsubscribeToken: (() => void) | null = null;
    let unsubscribeOpened: (() => void) | null = null;

    const handleTripChange = async (token: string) => {
      try {
        await refreshTripRequest();
        const tripId = currentTripId.current;
        if (tripId) {
          const response = await driverApi.getTrip(token, tripId);
          if (active) setActiveTrip(mapTripResponse(response.trip));
        }
      } catch (error) {
        console.error('No se pudo sincronizar el viaje en tiempo real.', error);
      }
    };

    void SecureStore.getItemAsync(SESSION_TOKEN_KEY).then(async (token) => {
      if (!token || !active) return;
      socket = connectDriverRealtime(token);
      socket.on('trip:changed', () => void handleTripChange(token));
      socket.on('connect_error', (error) => {
        console.error('No se pudo conectar al canal de viajes en tiempo real.', error);
      });

      if (!supportsNativeFirebase()) return;
      try {
        const messaging = await import('@react-native-firebase/messaging');
        const push = messaging.getMessaging();
        const permission = await messaging.requestPermission(push);
        const authorized = permission === messaging.AuthorizationStatus.AUTHORIZED
          || permission === messaging.AuthorizationStatus.PROVISIONAL;
        if (!authorized || !active) return;
        const pushToken = await messaging.getToken(push);
        await driverApi.registerPushToken(token, pushToken);
        unsubscribeToken = messaging.onTokenRefresh(push, (newToken) => {
          void driverApi.registerPushToken(token, newToken).catch((error: unknown) => {
            console.error('No se pudo actualizar el token de notificaciones.', error);
          });
        });
        unsubscribeMessage = messaging.onMessage(push, async (message) => {
          if (message.data?.type !== 'trip_request') return;
          try {
            await refreshTripRequest();
          } catch (error) {
            console.error('No se pudo cargar la solicitud recibida por FCM.', error);
          }
          Alert.alert(
            message.notification?.title ?? 'Nueva solicitud de viaje',
            message.notification?.body ?? 'Abre la aplicación para responder.',
          );
        });
        const handleOpenedNotification = () => {
          void handleTripChange(token);
        };
        unsubscribeOpened = messaging.onNotificationOpenedApp(push, handleOpenedNotification);
        const initialNotification = await messaging.getInitialNotification(push);
        if (active && initialNotification?.data?.type === 'trip_request') handleOpenedNotification();
      } catch (error) {
        console.error('No se pudo registrar la mensajería FCM. Verifica la configuración nativa de Firebase.', error);
      }
    }).catch((error: unknown) => {
      console.error('No se pudo preparar la sesión de tiempo real.', error);
    });

    return () => {
      active = false;
      socket?.disconnect();
      unsubscribeMessage?.();
      unsubscribeToken?.();
      unsubscribeOpened?.();
    };
  }, [profile, refreshTripRequest, setActiveTrip]);
}
