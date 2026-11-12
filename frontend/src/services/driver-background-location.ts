// AI-assisted: see docs/AI_LOG.md #13.
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { driverApi } from './api';
import { DRIVER_SESSION_TOKEN_KEY } from './driver-session';

const DRIVER_LOCATION_TASK = 'driver-background-location';

type LocationTaskData = { locations: Location.LocationObject[] };

TaskManager.defineTask<LocationTaskData>(DRIVER_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Falló la tarea de ubicación en segundo plano.', error);
    return;
  }
  const location = data.locations[data.locations.length - 1];
  if (!location) return;

  try {
    const token = await SecureStore.getItemAsync(DRIVER_SESSION_TOKEN_KEY);
    if (!token) return;
    await driverApi.updateLocation(token, {
      lat: location.coords.latitude,
      lng: location.coords.longitude,
    });
  } catch (locationError) {
    console.error('No se pudo enviar la ubicación desde segundo plano.', locationError);
  }
});

export async function requestDriverBackgroundLocationPermissions(): Promise<void> {
  let foreground = await Location.getForegroundPermissionsAsync();
  if (!foreground.granted) foreground = await Location.requestForegroundPermissionsAsync();
  if (!foreground.granted) {
    throw new Error('Permite el acceso a la ubicación mientras usas la app para conectarte.');
  }

  let background = await Location.getBackgroundPermissionsAsync();
  if (!background.granted) background = await Location.requestBackgroundPermissionsAsync();
  if (!background.granted) {
    throw new Error('Permite el acceso a la ubicación Siempre para compartirla cuando la app esté minimizada.');
  }
}

export async function startDriverBackgroundLocationUpdates(): Promise<void> {
  if (!(await TaskManager.isAvailableAsync())) {
    throw new Error('Este dispositivo no permite tareas de ubicación en segundo plano.');
  }
  if (!(await Location.hasServicesEnabledAsync())) {
    throw new Error('Activa los servicios de ubicación del dispositivo.');
  }
  if (await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK)) return;

  await Location.startLocationUpdatesAsync(DRIVER_LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 10_000,
    distanceInterval: 25,
    activityType: Location.ActivityType.AutomotiveNavigation,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    ...(Platform.OS === 'android'
      ? {
          foregroundService: {
            notificationTitle: 'UberClone está compartiendo tu ubicación',
            notificationBody: 'El seguimiento continúa mientras estés disponible.',
          },
        }
      : {}),
  });
}

export async function stopDriverBackgroundLocationUpdates(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(DRIVER_LOCATION_TASK);
  }
}
