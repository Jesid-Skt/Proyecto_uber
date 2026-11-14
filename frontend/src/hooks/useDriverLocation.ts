
import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';
import type { LocationObjectCoords } from 'expo-location';

const MEDELLIN = { latitude: 6.2442, longitude: -75.5812 };

const PERMISSION_ERROR =
  'Activa el permiso de ubicación para conectarte.';
const SERVICES_ERROR =
  'Activa los servicios de ubicación del dispositivo y vuelve a intentar.';
const POSITION_ERROR =
  'No fue posible obtener una ubicación actual. Verifica el GPS y vuelve a intentar.';

type DriverCoordinates = {
  lat: number;
  lng: number;
};

export function useDriverLocation(
  trackingEnabled: boolean,
  onTrackingUnavailable: () => void,
  onLocation?: (location: DriverCoordinates) => Promise<void>,
) {
  const [coords, setCoords] = useState<LocationObjectCoords | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);

  const retry = useCallback(() => {
    setRetryVersion((version) => version + 1);
  }, []);

  useEffect(() => {
    if (!trackingEnabled) return;

    let active = true;
    let subscription: Location.LocationSubscription | null = null;

    const reportLocation = (position: Location.LocationObject) => {
      if (!active) return;

      const { latitude, longitude } = position.coords;

      console.log('[GPS REAL]', {
        latitude,
        longitude,
        accuracy: position.coords.accuracy,
        timestamp: new Date(position.timestamp).toISOString(),
        mocked: position.mocked,
      });

      setCoords(position.coords);
      setError(null);

      if (onLocation) {
        void onLocation({ lat: latitude, lng: longitude }).catch(
          (locationError) => {
            if (!active) return;

            console.error(
              '[GPS BACKEND ERROR]',
              locationError,
            );

            setError(
              locationError instanceof Error
                ? locationError.message
                : 'No se pudo compartir la ubicación con el servidor.',
            );
          },
        );
      }
    };

    const startTracking = async () => {
      try {
        setError(null);

        const servicesEnabled =
          await Location.hasServicesEnabledAsync();

        if (!servicesEnabled) {
          if (active) {
            setError(SERVICES_ERROR);
            onTrackingUnavailable();
          }
          return;
        }

        const permission =
          await Location.requestForegroundPermissionsAsync();

        if (!active) return;

        if (!permission.granted) {
          setError(PERMISSION_ERROR);
          onTrackingUnavailable();
          return;
        }

        const current =
          await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });

        reportLocation(current);

        if (!active) return;

        const watcher = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 3000,
            distanceInterval: 5,
          },
          reportLocation,
          (reason) => {
            if (!active) return;

            console.error('[GPS WATCH ERROR]', reason);
            setError(POSITION_ERROR);
          },
        );

        if (active) {
          subscription = watcher;
        } else {
          watcher.remove();
        }
      } catch (locationError) {
        if (!active) return;

        console.error('[GPS ERROR]', locationError);
        setError(POSITION_ERROR);
      }
    };

    void startTracking();

    return () => {
      active = false;
      subscription?.remove();
    };
  }, [
    trackingEnabled,
    onLocation,
    onTrackingUnavailable,
    retryVersion,
  ]);

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
