// AI-assisted: see docs/AI_LOG.md #1 and #3.
import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import type { LocationObjectCoords } from 'expo-location';

const BOGOTA = { latitude: 4.6533, longitude: -74.0837 };

export function useDriverLocation(
  available: boolean,
  onPermissionDenied: () => void,
  onLocation?: (location: { lat: number; lng: number }) => Promise<void>,
) {
  const [coords, setCoords] = useState<LocationObjectCoords | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!available) {
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
  }, [available, onLocation, onPermissionDenied]);

  return {
    coords,
    error,
    mapRegion: {
      latitude: coords?.latitude ?? BOGOTA.latitude,
      longitude: coords?.longitude ?? BOGOTA.longitude,
      latitudeDelta: 0.045,
      longitudeDelta: 0.045,
    },
  };
}
