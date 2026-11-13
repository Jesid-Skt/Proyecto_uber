import { useLocalization } from '../../localization/useLocalization';
import { Redirect, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline } from '../../components/DriverMap';
import Animated, { FadeInDown, SlideInUp } from 'react-native-reanimated';
import { SlideToConfirmButton } from '../../components/SlideToConfirmButton';
import { tripPalette } from '../../components/trip-flow-theme';
import { Button, Card, Page } from '../../components/ui';
import { useDriver } from '../../context/DriverContext';
import type { Trip, TripRoute } from '../../types/domain';

function useTripLocation() {
  const { activeTrip } = useDriver();
  const activeTripId = activeTrip?.id;
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const locateOnce = async () => {
      if (!activeTripId) return;
      setPermissionError(null);
      try {
        let permission = await Location.getForegroundPermissionsAsync();
        if (!permission.granted) permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) {
          if (active) setPermissionError('Activa el permiso de ubicación para conectarte.');
          return;
        }
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (active) {
          setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
          setError(null);
        }
      } catch (locationError) {
        if (active) {
          setError(locationError instanceof Error
            ? locationError.message
            : 'No fue posible obtener la ubicación. Revisa los permisos y vuelve a intentar.');
        }
      }
    };
    void locateOnce();
    return () => {
      active = false;
    };
  }, [activeTripId]);

  return { coords, error, permissionError };
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
  const { t } = useLocalization();
  const isPickup = target === 'pickup';
  const point = isPickup ? trip.origin : trip.destination;
  const coordinate = { latitude: point.lat, longitude: point.lng };
  const latitude = coords ? (coords.latitude + coordinate.latitude) / 2 : coordinate.latitude;
  const longitude = coords ? (coords.longitude + coordinate.longitude) / 2 : coordinate.longitude;
  const latitudeDelta = coords ? Math.max(0.025, Math.abs(coords.latitude - coordinate.latitude) * 2.2) : 0.04;
  const longitudeDelta = coords ? Math.max(0.025, Math.abs(coords.longitude - coordinate.longitude) * 2.2) : 0.04;
  const fitCoordinates = useMemo(() => route?.coordinates ?? [
    ...(coords ? [coords] : []),
    { latitude: trip.origin.lat, longitude: trip.origin.lng },
    { latitude: trip.destination.lat, longitude: trip.destination.lng },
  ], [coords, route?.coordinates, trip.destination.lat, trip.destination.lng, trip.origin.lat, trip.origin.lng]);
  const mapFitCoordinates = useMemo(() => [
    ...fitCoordinates,
    { latitude: trip.origin.lat, longitude: trip.origin.lng },
    { latitude: trip.destination.lat, longitude: trip.destination.lng },
  ], [fitCoordinates, trip.destination.lat, trip.destination.lng, trip.origin.lat, trip.origin.lng]);

  return (
    <MapView
      style={style}
      region={{ latitude, longitude, latitudeDelta, longitudeDelta }}
      showsUserLocation={Boolean(coords)}
      fitCoordinates={mapFitCoordinates}
    >
      <Marker
        coordinate={{ latitude: trip.origin.lat, longitude: trip.origin.lng }}
        title={t("Punto de recogida")}
        pinColor={isPickup ? tripPalette.accent : undefined}
      />
      <Marker
        coordinate={{ latitude: trip.destination.lat, longitude: trip.destination.lng }}
        title={t("Destino")}
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
  const { t } = useLocalization();
  const point = target === 'pickup' ? trip.origin : trip.destination;

  const openNavigation = async () => {
    const origin = coords ? `&origin=${coords.latitude},${coords.longitude}` : '';
    const url = `https://www.google.com/maps/dir/?api=1${origin}&destination=${point.lat},${point.lng}&travelmode=driving`;
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.error('No se pudo abrir la aplicación de navegación.', error);
      Alert.alert(t('No se pudo abrir la navegación'), t("Puedes consultar el destino directamente en el mapa."));
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => void openNavigation()}
      style={styles.navigationButton}
    >
      <Text style={styles.navigationButtonText}>
        {target === 'pickup' ? t('Abrir navegación a recogida') : t('Abrir navegación a destino')}
      </Text>
    </Pressable>
  );
}

function useTripNavigationRoute(
  tripId: string,
  target: 'pickup' | 'destination',
  coords: { latitude: number; longitude: number } | null,
  fallback: { lat: number; lng: number },
) {
  const { getTripRoute } = useDriver();
  const [route, setRoute] = useState<TripRoute | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const lastRequest = useRef<string | null>(null);
  const latitude = coords?.latitude;
  const longitude = coords?.longitude;
  const latestCoordinates = useRef({ latitude, longitude });
  useEffect(() => {
    latestCoordinates.current = { latitude, longitude };
  }, [latitude, longitude]);
  const hasCoordinates = latitude !== undefined && longitude !== undefined;

  useEffect(() => {
    const { latitude, longitude } = latestCoordinates.current;
    if (!tripId) return;
    const requestKey = `${tripId}:${target}`;
    if (lastRequest.current === requestKey) return;
    lastRequest.current = requestKey;
    let active = true;
    setRoute(null);
    setRouteLoading(true);
    setRouteError(null);
    void getTripRoute(tripId, {
      target,
      from: latitude === undefined || longitude === undefined
        ? fallback
        : { lat: latitude, lng: longitude },
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
      lastRequest.current = null;
    };
  }, [fallback, getTripRoute, hasCoordinates, target, tripId]);

  return { route, routeLoading, routeError };
}

function routeDistance(route: TripRoute, formatNumber: (value: number) => string): string {
  return route.distanceMeters >= 1000
    ? `${formatNumber(Math.round(route.distanceMeters / 100) / 10)} km`
    : `${formatNumber(Math.round(route.distanceMeters))} m`;
}

export function PickupNavigationScreen() {
  const { t, translateText, formatNumber } = useLocalization();
  const router = useRouter();
  const { activeTrip, updateActiveTrip, cancelActiveTrip } = useDriver();
  const { coords, error: locationError, permissionError } = useTripLocation();
  const navigation = useTripNavigationRoute(
    activeTrip?.id ?? '',
    'pickup',
    coords,
    activeTrip?.origin ?? { lat: 0, lng: 0 },
  );
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
      t("Cancelar viaje"),
      t("¿Confirmas que no puedes completar este viaje?"),
      [
        { text: t("Seguir con el viaje"), style: 'cancel' },
        {
          text: t("Cancelar viaje"),
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
          {activeTrip.status === 'accepted' ? t("Camino a recoger") : t("Confirma la recogida")}
        </Text>
        <Text style={styles.subtitle}>
          {activeTrip.status === 'accepted'
            ? t("Navega hasta el punto indicado para recoger al pasajero.")
            : t("Cuando el pasajero esté a bordo, confirma para iniciar el viaje.")}
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
            <Text style={styles.sectionTitle}>{t("Punto de recogida")}</Text>
            <Text style={styles.status}>
            {activeTrip.status === 'accepted' ? t("ACEPTADO") : t("EN CAMINO")}
            </Text>
          </View>
          <Text style={styles.address}>{activeTrip.origin.address}</Text>
          <Text style={styles.secondary}>{t('Destino: {address}', { address: activeTrip.destination.address })}</Text>
          <Text style={styles.secondary}>
            {navigation.route
              ? t('{distance} · {minutes} min por carretera', { distance: routeDistance(navigation.route, formatNumber), minutes: formatNumber(Math.max(1, Math.round(navigation.route.durationSeconds / 60))) })
              : t('{distance} km · {minutes} min estimados', { distance: formatNumber(activeTrip.distanceKm), minutes: formatNumber(activeTrip.durationMin) })}
          </Text>
          <Text style={styles.secondary}>{t('Categoría: {category}', { category: translateText(activeTrip.category) })}</Text>
          {navigation.routeLoading ? (
            <Text style={styles.secondary}>{t("Calculando ruta por carretera…")}</Text>
          ) : null}
          {navigation.routeError ? (
            <Text style={styles.error}>
              {translateText(navigation.routeError)} {t('Puedes abrir la navegación externa.')}
            </Text>
          ) : null}
        {locationError || permissionError ? (
            <Text style={styles.error}>{translateText(locationError ?? permissionError ?? '')}</Text>
        ) : null}
          {error ? <Text style={styles.error}>{translateText(error)}</Text> : null}
          <NavigationButton trip={activeTrip} target="pickup" coords={coords} />
          <SlideToConfirmButton
            title={loading
              ? t("Actualizando…")
              : activeTrip.status === 'accepted'
                ? t("Iniciar camino a recogida")
                : t("Pasajero a bordo")}
            onConfirm={() => void confirmPickup()}
            disabled={loading}
          />
          <Button
            title={loading ? t("Procesando…") : t("Cancelar viaje")}
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
  const { t, translateText, formatCurrency, formatNumber } = useLocalization();
  const router = useRouter();
  const { activeTrip, completeActiveTrip } = useDriver();
  const { coords, error: locationError, permissionError } = useTripLocation();
  const navigation = useTripNavigationRoute(
    activeTrip?.id ?? '',
    'destination',
    coords,
    activeTrip?.origin ?? { lat: 0, lng: 0 },
  );
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
            <Text style={styles.sectionTitle}>{t("Destino")}</Text>
            <Text style={styles.status}>{t("EN CURSO")}</Text>
          </View>
          <Text style={styles.destination}>{activeTrip.destination.address}</Text>
          <Text style={styles.secondary}>{t('Desde: {address}', { address: activeTrip.origin.address })}</Text>
          <View style={styles.metrics}>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>
                {navigation.route
                  ? routeDistance(navigation.route, formatNumber)
                  : `${formatNumber(activeTrip.distanceKm)} km`}
              </Text>
              <Text style={styles.metricLabel}>{t("DISTANCIA")}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>
                {navigation.route
                  ? `${formatNumber(Math.max(1, Math.round(navigation.route.durationSeconds / 60)))} min`
                  : `${formatNumber(activeTrip.durationMin)} min`}
              </Text>
              <Text style={styles.metricLabel}>{t("TIEMPO")}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{formatCurrency(activeTrip.fare)}</Text>
              <Text style={styles.metricLabel}>{t("TARIFA")}</Text>
            </View>
          </View>
          {navigation.routeLoading ? (
            <Text style={styles.secondary}>{t("Calculando ruta por carretera…")}</Text>
          ) : null}
          {navigation.routeError ? (
            <Text style={styles.error}>
              {translateText(navigation.routeError)} {t('Puedes abrir la navegación externa.')}
            </Text>
          ) : null}
          {locationError || permissionError ? (
            <Text style={styles.error}>{translateText(locationError ?? permissionError ?? '')}</Text>
          ) : null}
          {error ? <Text style={styles.error}>{translateText(error)}</Text> : null}
          <NavigationButton trip={activeTrip} target="destination" coords={coords} />
          <SlideToConfirmButton
            title={loading ? t("Finalizando…") : t("Finalizar viaje")}
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
