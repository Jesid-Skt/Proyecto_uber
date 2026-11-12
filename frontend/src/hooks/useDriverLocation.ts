// AI-assisted: see docs/AI_LOG.md #1, #3, and #5.
import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import type { LocationObjectCoords } from 'expo-location';

const MEDELLIN = { latitude: 6.2442, longitude: -75.5812 };

export function useDriverLocation(
  trackingEnabled: boolean,
  onPermissionDenied: () => void,
  onLocation?: (location: { lat: number; lng: number }) => Promise<void>,
) {
  const [coords, setCoords] = useState<LocationObjectCoords | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!trackingEnabled) {
      return;
    }

    let active = true;
    let subscription: Location.LocationSubscription | null = null;
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
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) {
          if (active) {
            setError('Activa el permiso de ubicación para conectarte.');
            onPermissionDenied();
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
        );
        if (active) {
          subscription = watcher;
        } else {
          watcher.remove();
        }
      } catch (locationError) {
        if (active) {
          setError('No fue posible obtener la ubicación. Revisa los permisos y vuelve a intentar.');
          console.error('Falló el seguimiento de ubicación.', locationError);
          onPermissionDenied();
        }
      }
    };

    void startTracking();
    return () => {
      active = false;
      subscription?.remove();
    };
  }, [trackingEnabled, onLocation, onPermissionDenied]);

  return {
    coords,
    error,
    mapRegion: {
      latitude: coords?.latitude ?? MEDELLIN.latitude,
      longitude: coords?.longitude ?? MEDELLIN.longitude,
      latitudeDelta: 0.045,
      longitudeDelta: 0.045,
    },
  };
}
