// AI-assisted: see docs/AI_LOG.md #1, #3, and #5.
import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';
import type { LocationObjectCoords } from 'expo-location';

const MEDELLIN = { latitude: 6.2442, longitude: -75.5812 };
const PERMISSION_ERROR = 'Activa el permiso de ubicación para conectarte.';
const SERVICES_ERROR = 'Activa los servicios de ubicación del dispositivo y vuelve a intentar.';
const POSITION_ERROR = 'No fue posible obtener una ubicación actual. Verifica el GPS y vuelve a intentar.';

export function useDriverLocation(
  trackingEnabled: boolean,
  onTrackingUnavailable: () => void,
  onLocation?: (location: { lat: number; lng: number }) => Promise<void>,
) {
  const [coords, setCoords] = useState<LocationObjectCoords | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);
  const retry = useCallback(() => setRetryVersion((version) => version + 1), []);

  useEffect(() => {
    if (!trackingEnabled) {
      return;
    }

    let active = true;
    let failureReported = false;
    let subscription: Location.LocationSubscription | null = null;
    const reportTrackingFailure = async (reason: unknown) => {
      if (failureReported) return;
      failureReported = true;
      let servicesEnabled = true;
      try {
        servicesEnabled = await Location.hasServicesEnabledAsync();
      } catch (serviceError) {
        console.error('No se pudo comprobar el estado de los servicios de ubicación.', serviceError);
      }
      if (!active) return;
      setError(servicesEnabled ? POSITION_ERROR : SERVICES_ERROR);
      if (!servicesEnabled) onTrackingUnavailable();
      console.error('Falló el seguimiento de ubicación.', reason);
    };
    const reportLocation = async (position: LocationObjectCoords) => {
      if (!active) return;
      setCoords(position);
      setError(null);
      try {
        await onLocation?.({ lat: position.latitude, lng: position.longitude });
      } catch (locationError) {
        if (active) {
          setError(locationError instanceof Error
            ? locationError.message
            : 'No se pudo compartir la ubicación con el servidor.');
          console.error('Falló la sincronización de ubicación del conductor.', locationError);
        }
      }
    };
    const startTracking = async () => {
      try {
        setError(null);
        if (!(await Location.hasServicesEnabledAsync())) {
          if (active) {
            setError(SERVICES_ERROR);
            onTrackingUnavailable();
          }
          return;
        }

        const permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) {
          if (active) {
            setError(PERMISSION_ERROR);
            onTrackingUnavailable();
          }
          return;
        }

        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        await reportLocation(current.coords);
        if (!active || !onLocation) return;
        const watcher = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 5000,
            distanceInterval: 15,
          },
          (position) => {
            void reportLocation(position.coords);
          },
          (reason) => {
            void reportTrackingFailure(reason);
          },
        );
        if (active) {
          subscription = watcher;
        } else {
          watcher.remove();
        }
      } catch (locationError) {
        await reportTrackingFailure(locationError);
      }
    };

    void startTracking();
    return () => {
      active = false;
      subscription?.remove();
    };
  }, [trackingEnabled, onLocation, onTrackingUnavailable, retryVersion]);

  return {
    coords,
    error,
    retry,
    mapRegion: {
      latitude: coords?.latitude ?? MEDELLIN.latitude,
      longitude: coords?.longitude ?? MEDELLIN.longitude,
      latitudeDelta: 0.045,
      longitudeDelta: 0.045,
    },
  };
}
