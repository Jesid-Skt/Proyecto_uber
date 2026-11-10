import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Button, Card, colors, commonStyles, Label, Page, PageHeading } from '../../components/ui';
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
}: {
  trip: Trip;
  target: 'pickup' | 'destination';
  coords: { latitude: number; longitude: number } | null;
  route: TripRoute | null;
}) {
  const isPickup = target === 'pickup';
  const point = isPickup ? trip.origin : trip.destination;
  const coordinate = { latitude: point.lat, longitude: point.lng };
  const latitude = coords ? (coords.latitude + coordinate.latitude) / 2 : coordinate.latitude;
  const longitude = coords ? (coords.longitude + coordinate.longitude) / 2 : coordinate.longitude;
  const latitudeDelta = coords ? Math.max(0.025, Math.abs(coords.latitude - coordinate.latitude) * 2.2) : 0.04;
  const longitudeDelta = coords ? Math.max(0.025, Math.abs(coords.longitude - coordinate.longitude) * 2.2) : 0.04;

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
    <>
      <MapView
        style={commonStyles.tripMap}
        region={{ latitude, longitude, latitudeDelta, longitudeDelta }}
        showsUserLocation={Boolean(coords)}
      >
        <Marker
          coordinate={{ latitude: trip.origin.lat, longitude: trip.origin.lng }}
          title="Punto de recogida"
          pinColor={isPickup ? colors.accent : undefined}
        />
        <Marker
          coordinate={{ latitude: trip.destination.lat, longitude: trip.destination.lng }}
          title="Destino"
          pinColor={!isPickup ? colors.accent : undefined}
        />
        {route ? (
          <Polyline coordinates={route.coordinates} strokeWidth={5} strokeColor={colors.accent} />
        ) : null}
      </MapView>
      <Button title={`Abrir navegación a ${isPickup ? 'recogida' : 'destino'}`} variant="secondary" onPress={() => void openNavigation()} />
    </>
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
  const { activeTrip, updateActiveTrip } = useDriver();
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
  return (
    <Page>
      <PageHeading
        title={activeTrip.status === 'accepted' ? 'Camino a recoger' : 'Confirma la recogida'}
        subtitle={activeTrip.status === 'accepted'
          ? 'Navega hasta el punto indicado para recoger al pasajero.'
          : 'Cuando el pasajero esté a bordo, confirma para iniciar el viaje.'}
      />
      <TripNavigationMap trip={activeTrip} target="pickup" coords={coords} route={navigation.route} />
      <Card>
        <View style={commonStyles.spread}>
          <Text style={commonStyles.sectionTitle}>Punto de recogida</Text>
          <Text style={{ color: colors.accent, fontWeight: '800' }}>
            {activeTrip.status === 'accepted' ? 'ACEPTADO' : 'EN CAMINO'}
          </Text>
        </View>
        <Label>{activeTrip.origin.address}</Label>
        <Label muted>Destino: {activeTrip.destination.address}</Label>
        <Label muted>{navigation.route ? routeSummary(navigation.route) : `${activeTrip.distanceKm} km · ${activeTrip.durationMin} min estimados`}</Label>
        <Label muted>Categoría: {activeTrip.category}</Label>
        {navigation.routeLoading ? <Label muted>Calculando ruta por carretera…</Label> : null}
        {navigation.routeError ? <Text style={commonStyles.errorText}>{navigation.routeError} Puedes abrir la navegación externa.</Text> : null}
        {locationError || permissionError ? (
          <Text style={commonStyles.errorText}>{locationError ?? permissionError}</Text>
        ) : null}
        {error ? <Text style={commonStyles.errorText}>{error}</Text> : null}
        <Button
          title={loading
            ? 'Actualizando…'
            : activeTrip.status === 'accepted'
              ? 'Iniciar camino a recogida'
              : 'Pasajero a bordo'}
          onPress={() => void confirmPickup()}
          disabled={loading}
        />
      </Card>
    </Page>
  );
}

export function ActiveTripScreen() {
  const router = useRouter();
  const { activeTrip, completeActiveTrip } = useDriver();
  const { coords, error: locationError, permissionError } = useTripLocation();
  const navigation = useTripNavigationRoute(activeTrip?.id ?? '', 'destination', coords);
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
    <Page>
      <PageHeading title="Viaje en curso" subtitle="Sigue la navegación hasta el destino del pasajero." />
      <TripNavigationMap trip={activeTrip} target="destination" coords={coords} route={navigation.route} />
      <Card>
        <View style={commonStyles.spread}>
          <Text style={commonStyles.sectionTitle}>Destino</Text>
          <Text style={{ color: colors.accent, fontWeight: '800' }}>EN CURSO</Text>
        </View>
        <Label>{activeTrip.destination.address}</Label>
        <Label muted>Desde: {activeTrip.origin.address}</Label>
        <Label muted>{navigation.route ? routeSummary(navigation.route) : `${activeTrip.distanceKm} km · ${activeTrip.durationMin} min estimados`}</Label>
        <Label muted>Categoría: {activeTrip.category}</Label>
        {navigation.routeLoading ? <Label muted>Calculando ruta por carretera…</Label> : null}
        {navigation.routeError ? <Text style={commonStyles.errorText}>{navigation.routeError} Puedes abrir la navegación externa.</Text> : null}
        <View style={commonStyles.spread}>
          <Label>Tarifa registrada</Label>
          <Text style={{ color: colors.ink, fontWeight: '800' }}>{formatCop(activeTrip.fare)}</Text>
        </View>
        {locationError || permissionError ? (
          <Text style={commonStyles.errorText}>{locationError ?? permissionError}</Text>
        ) : null}
        {error ? <Text style={commonStyles.errorText}>{error}</Text> : null}
        <Button
          title={loading ? 'Finalizando…' : 'Finalizar viaje'}
          onPress={() => void finishTrip()}
          disabled={loading}
        />
      </Card>
    </Page>
  );
}
