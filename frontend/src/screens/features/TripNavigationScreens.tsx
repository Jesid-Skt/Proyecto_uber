import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline } from 'react-native-maps';
import Animated, { FadeInDown, SlideInUp } from 'react-native-reanimated';
import { SlideToConfirmButton } from '../../components/SlideToConfirmButton';
import { tripPalette } from '../../components/trip-flow-theme';
import { Button, Card, Page } from '../../components/ui';
import { formatCop } from '../../config/pricing';
import { useDriver } from '../../context/DriverContext';
import { useDriverLocation } from '../../hooks/useDriverLocation';
import type { Trip, TripRoute } from '../../types/domain';

function useTripLocation() {
  const { available, setAvailable, updateLocation } = useDriver();
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const onPermissionDenied = useCallback(() => {
    void setAvailable(false).catch((error: unknown) => {
      setPermissionError(error instanceof Error ? error.message : 'No se pudo desconectar.');
    });
  }, [setAvailable]);
  const reportLocation = useCallback(
    (coords: { lat: number; lng: number }) => updateLocation(coords),
    [updateLocation],
  );
  const location = useDriverLocation(available, onPermissionDenied, reportLocation);
  return { ...location, permissionError };
}

function TripNavigationMap({
  trip,
  target,
  coords,
  route,
  style,
}: {
  trip: Trip;
  target: 'pickup' | 'destination';
  coords: { latitude: number; longitude: number } | null;
  route: TripRoute | null;
  style: StyleProp<ViewStyle>;
}) {
  const isPickup = target === 'pickup';
  const point = isPickup ? trip.origin : trip.destination;
  const coordinate = { latitude: point.lat, longitude: point.lng };
  const latitude = coords ? (coords.latitude + coordinate.latitude) / 2 : coordinate.latitude;
  const longitude = coords ? (coords.longitude + coordinate.longitude) / 2 : coordinate.longitude;
  const latitudeDelta = coords ? Math.max(0.025, Math.abs(coords.latitude - coordinate.latitude) * 2.2) : 0.04;
  const longitudeDelta = coords ? Math.max(0.025, Math.abs(coords.longitude - coordinate.longitude) * 2.2) : 0.04;

  return (
    <MapView
      style={style}
      region={{ latitude, longitude, latitudeDelta, longitudeDelta }}
      showsUserLocation={Boolean(coords)}
    >
      <Marker
        coordinate={{ latitude: trip.origin.lat, longitude: trip.origin.lng }}
        title="Punto de recogida"
        pinColor={isPickup ? tripPalette.accent : undefined}
      />
      <Marker
        coordinate={{ latitude: trip.destination.lat, longitude: trip.destination.lng }}
        title="Destino"
        pinColor={!isPickup ? tripPalette.accent : undefined}
      />
      {route ? (
        <Polyline coordinates={route.coordinates} strokeWidth={5} strokeColor={tripPalette.accent} />
      ) : null}
    </MapView>
  );
}

function NavigationButton({
  trip,
  target,
  coords,
}: {
  trip: Trip;
  target: 'pickup' | 'destination';
  coords: { latitude: number; longitude: number } | null;
}) {
  const point = target === 'pickup' ? trip.origin : trip.destination;

  const openNavigation = async () => {
    const origin = coords ? `&origin=${coords.latitude},${coords.longitude}` : '';
    const url = `https://www.google.com/maps/dir/?api=1${origin}&destination=${point.lat},${point.lng}&travelmode=driving`;
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.error('No se pudo abrir la aplicación de navegación.', error);
      Alert.alert('No se pudo abrir la navegación', 'Puedes consultar el destino directamente en el mapa.');
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => void openNavigation()}
      style={styles.navigationButton}
    >
      <Text style={styles.navigationButtonText}>
        Abrir navegación a {target === 'pickup' ? 'recogida' : 'destino'}
      </Text>
    </Pressable>
  );
}

function useTripNavigationRoute(
  tripId: string,
  target: 'pickup' | 'destination',
  coords: { latitude: number; longitude: number } | null,
) {
  const { getTripRoute } = useDriver();
  const [route, setRoute] = useState<TripRoute | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const lastRequest = useRef<string | null>(null);
  const latitude = coords?.latitude;
  const longitude = coords?.longitude;

  useEffect(() => {
    if (latitude === undefined || longitude === undefined || !tripId) return;
    const requestKey = `${tripId}:${target}`;
    if (lastRequest.current === requestKey) return;
    lastRequest.current = requestKey;
    let active = true;
    setRoute(null);
    setRouteLoading(true);
    setRouteError(null);
    void getTripRoute(tripId, {
      target,
      from: { lat: latitude, lng: longitude },
    })
      .then((result) => {
        if (active) setRoute(result);
      })
      .catch((error: unknown) => {
        if (active) {
          setRouteError(error instanceof Error ? error.message : 'No se pudo calcular la ruta.');
        }
      })
      .finally(() => {
        if (active) setRouteLoading(false);
      });

    return () => {
      active = false;
    };
  }, [getTripRoute, latitude, longitude, target, tripId]);

  return { route, routeLoading, routeError };
}

function routeSummary(route: TripRoute): string {
  const distance = route.distanceMeters >= 1000
    ? `${(route.distanceMeters / 1000).toFixed(1)} km`
    : `${Math.round(route.distanceMeters)} m`;
  const durationMinutes = Math.max(1, Math.round(route.durationSeconds / 60));
  return `${distance} · ${durationMinutes} min por carretera`;
}

export function PickupNavigationScreen() {
  const router = useRouter();
  const { activeTrip, updateActiveTrip, cancelActiveTrip } = useDriver();
  const { coords, error: locationError, permissionError } = useTripLocation();
  const navigation = useTripNavigationRoute(activeTrip?.id ?? '', 'pickup', coords);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!activeTrip) return <Redirect href="/home" />;
  if (activeTrip.status === 'in_progress') return <Redirect href="/trip-active" />;
  if (activeTrip.status === 'completed') return <Redirect href="/trip-payment" />;
  if (activeTrip.status === 'paid') return <Redirect href="/trip-summary" />;
  if (activeTrip.status !== 'accepted' && activeTrip.status !== 'driver_arriving') {
    return <Redirect href="/home" />;
  }
  const confirmPickup = async () => {
    setLoading(true);
    setError(null);
    try {
      const trip = await updateActiveTrip(
        activeTrip.status === 'accepted' ? 'driver_arriving' : 'in_progress',
      );
      if (trip.status === 'in_progress') router.replace('/trip-active');
    } catch (tripError) {
      setError(tripError instanceof Error ? tripError.message : 'No se pudo confirmar la recogida.');
    } finally {
      setLoading(false);
    }
  };
  const cancel = () => {
    Alert.alert(
      'Cancelar viaje',
      '¿Confirmas que no puedes completar este viaje?',
      [
        { text: 'Seguir con el viaje', style: 'cancel' },
        {
          text: 'Cancelar viaje',
          style: 'destructive',
          onPress: () => {
            setLoading(true);
            setError(null);
            void cancelActiveTrip()
              .then(() => router.replace('/home'))
              .catch((cancelError: unknown) => {
                setError(cancelError instanceof Error
                  ? cancelError.message
                  : 'No se pudo cancelar el viaje.');
              })
              .finally(() => setLoading(false));
          },
        },
      ],
    );
  };
  return (
    <Page backgroundColor={tripPalette.background}>
      <View style={styles.heading}>
        <Text style={styles.title}>
          {activeTrip.status === 'accepted' ? 'Camino a recoger' : 'Confirma la recogida'}
        </Text>
        <Text style={styles.subtitle}>
          {activeTrip.status === 'accepted'
            ? 'Navega hasta el punto indicado para recoger al pasajero.'
            : 'Cuando el pasajero esté a bordo, confirma para iniciar el viaje.'}
        </Text>
      </View>
      <TripNavigationMap
        trip={activeTrip}
        target="pickup"
        coords={coords}
        route={navigation.route}
        style={styles.pickupMap}
      />
      <Animated.View entering={FadeInDown.duration(350)}>
        <Card style={styles.card}>
          <View style={styles.spread}>
            <Text style={styles.sectionTitle}>Punto de recogida</Text>
            <Text style={styles.status}>
            {activeTrip.status === 'accepted' ? 'ACEPTADO' : 'EN CAMINO'}
            </Text>
          </View>
          <Text style={styles.address}>{activeTrip.origin.address}</Text>
          <Text style={styles.secondary}>Destino: {activeTrip.destination.address}</Text>
          <Text style={styles.secondary}>
            {navigation.route
              ? routeSummary(navigation.route)
              : `${activeTrip.distanceKm} km · ${activeTrip.durationMin} min estimados`}
          </Text>
          <Text style={styles.secondary}>Categoría: {activeTrip.category}</Text>
          {navigation.routeLoading ? (
            <Text style={styles.secondary}>Calculando ruta por carretera…</Text>
          ) : null}
          {navigation.routeError ? (
            <Text style={styles.error}>
              {navigation.routeError} Puedes abrir la navegación externa.
            </Text>
          ) : null}
        {locationError || permissionError ? (
            <Text style={styles.error}>{locationError ?? permissionError}</Text>
        ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <NavigationButton trip={activeTrip} target="pickup" coords={coords} />
          <SlideToConfirmButton
            title={loading
              ? 'Actualizando…'
              : activeTrip.status === 'accepted'
                ? 'Iniciar camino a recogida'
                : 'Pasajero a bordo'}
            onConfirm={() => void confirmPickup()}
            disabled={loading}
          />
          <Button
            title={loading ? 'Procesando…' : 'Cancelar viaje'}
            variant="secondary"
            onPress={cancel}
            disabled={loading}
          />
        </Card>
      </Animated.View>
    </Page>
  );
}

export function ActiveTripScreen() {
  const router = useRouter();
  const { activeTrip, completeActiveTrip } = useDriver();
  const { coords, error: locationError, permissionError } = useTripLocation();
  const navigation = useTripNavigationRoute(activeTrip?.id ?? '', 'destination', coords);
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!activeTrip) return <Redirect href="/home" />;
  if (activeTrip.status === 'completed') return <Redirect href="/trip-payment" />;
  if (activeTrip.status === 'paid') return <Redirect href="/trip-summary" />;
  if (activeTrip.status !== 'in_progress') return <Redirect href="/trip-pickup" />;
  const finishTrip = async () => {
    setLoading(true);
    setError(null);
    try {
      await completeActiveTrip();
      router.replace('/trip-payment');
    } catch (tripError) {
      setError(tripError instanceof Error ? tripError.message : 'No se pudo finalizar el viaje.');
    } finally {
      setLoading(false);
    }
  };
  return (
    <View style={styles.activeScreen}>
      <TripNavigationMap
        trip={activeTrip}
        target="destination"
        coords={coords}
        route={navigation.route}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View
        entering={SlideInUp.duration(400)}
        style={[styles.bottomSheet, { paddingBottom: Math.max(insets.bottom, 14) + 10 }]}
      >
        <View style={styles.sheetHandle} />
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.sheetContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.spread}>
            <Text style={styles.sectionTitle}>Destino</Text>
            <Text style={styles.status}>EN CURSO</Text>
          </View>
          <Text style={styles.destination}>{activeTrip.destination.address}</Text>
          <Text style={styles.secondary}>Desde: {activeTrip.origin.address}</Text>
          <View style={styles.metrics}>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>
                {navigation.route
                  ? routeSummary(navigation.route).split(' · ')[0]
                  : `${activeTrip.distanceKm} km`}
              </Text>
              <Text style={styles.metricLabel}>DISTANCIA</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>
                {navigation.route
                  ? routeSummary(navigation.route).split(' · ')[1]?.split(' por')[0]
                  : `${activeTrip.durationMin} min`}
              </Text>
              <Text style={styles.metricLabel}>TIEMPO</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{formatCop(activeTrip.fare)}</Text>
              <Text style={styles.metricLabel}>TARIFA</Text>
            </View>
          </View>
          {navigation.routeLoading ? (
            <Text style={styles.secondary}>Calculando ruta por carretera…</Text>
          ) : null}
          {navigation.routeError ? (
            <Text style={styles.error}>
              {navigation.routeError} Puedes abrir la navegación externa.
            </Text>
          ) : null}
          {locationError || permissionError ? (
            <Text style={styles.error}>{locationError ?? permissionError}</Text>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <NavigationButton trip={activeTrip} target="destination" coords={coords} />
          <SlideToConfirmButton
            title={loading ? 'Finalizando…' : 'Finalizar viaje'}
            onConfirm={() => void finishTrip()}
            disabled={loading}
          />
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  activeScreen: { flex: 1, backgroundColor: tripPalette.background },
  pickupMap: { height: 280, borderRadius: 24 },
  heading: { gap: 7 },
  title: { color: tripPalette.text, fontSize: 26, fontWeight: '800' },
  subtitle: { color: tripPalette.muted, fontSize: 14, lineHeight: 21 },
  card: {
    gap: 14,
    borderRadius: 24,
    backgroundColor: tripPalette.surface,
    borderColor: tripPalette.border,
  },
  spread: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  sectionTitle: { color: tripPalette.text, fontSize: 18, fontWeight: '800' },
  status: { color: tripPalette.accent, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  address: { color: tripPalette.text, fontSize: 16, fontWeight: '700', lineHeight: 22 },
  secondary: { color: tripPalette.muted, fontSize: 13, lineHeight: 19 },
  error: { color: tripPalette.error, fontSize: 13, lineHeight: 19 },
  navigationButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: tripPalette.elevated,
    borderWidth: 1,
    borderColor: tripPalette.border,
    paddingHorizontal: 14,
  },
  navigationButtonText: { color: tripPalette.text, fontSize: 14, fontWeight: '700' },
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '76%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 20,
    backgroundColor: tripPalette.surface,
    borderWidth: 1,
    borderColor: tripPalette.border,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 18,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    alignSelf: 'center',
    marginBottom: 15,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  sheetContent: { gap: 14, paddingBottom: 4 },
  destination: { color: tripPalette.text, fontSize: 20, fontWeight: '800', lineHeight: 26 },
  metrics: {
    flexDirection: 'row',
    gap: 8,
  },
  metric: {
    flex: 1,
    gap: 5,
    padding: 11,
    borderRadius: 15,
    backgroundColor: tripPalette.elevated,
    borderWidth: 1,
    borderColor: tripPalette.border,
  },
  metricValue: { color: tripPalette.text, fontSize: 14, fontWeight: '800' },
  metricLabel: { color: tripPalette.muted, fontSize: 9, fontWeight: '700', letterSpacing: 0.6 },
});
