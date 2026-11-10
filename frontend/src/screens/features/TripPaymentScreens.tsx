import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Button, Card, colors, commonStyles, Label, Page, PageHeading } from '../../components/ui';
import { formatCop } from '../../config/pricing';
import { useDriver } from '../../context/DriverContext';
import type { Trip, TripRoute } from '../../types/domain';
import { formatDate, paymentMethodLabel } from '../shared/formatters';

export function TripPaymentScreen() {
  const router = useRouter();
  const { activeTrip, confirmCashPayment, createPaymentCheckout, refreshActiveTrip } = useDriver();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const tripId = activeTrip?.id;
  const shouldPollMercadoPago = activeTrip?.paymentMethod === 'mercadopago'
    && activeTrip.status === 'completed';

  useEffect(() => {
    if (!tripId || !shouldPollMercadoPago) return;
    let active = true;
    let requestInProgress = false;
    const refreshPaymentStatus = async () => {
      if (requestInProgress) return;
      requestInProgress = true;
      setRefreshing(true);
      try {
        await refreshActiveTrip();
        if (active) setError(null);
      } catch (paymentError) {
        if (active) {
          setError(paymentError instanceof Error
            ? paymentError.message
            : 'No se pudo consultar el estado del pago.');
        }
      } finally {
        requestInProgress = false;
        if (active) setRefreshing(false);
      }
    };
    void refreshPaymentStatus();
    const intervalId = setInterval(() => void refreshPaymentStatus(), 5000);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [refreshActiveTrip, shouldPollMercadoPago, tripId]);

  if (!activeTrip) return <Redirect href="/home" />;
  if (activeTrip.status === 'paid') return <Redirect href="/trip-summary" />;
  if (activeTrip.status !== 'completed') return <Redirect href="/home" />;
  const confirmCash = async () => {
    setLoading(true);
    setError(null);
    try {
      await confirmCashPayment();
      router.replace('/trip-summary');
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : 'No se pudo confirmar el efectivo.');
    } finally {
      setLoading(false);
    }
  };
  const openMercadoPagoCheckout = async () => {
    setLoading(true);
    setError(null);
    try {
      const checkoutUrl = await createPaymentCheckout();
      await Linking.openURL(checkoutUrl);
    } catch (paymentError) {
      setError(paymentError instanceof Error
        ? paymentError.message
        : 'No se pudo abrir el checkout de Mercado Pago.');
    } finally {
      setLoading(false);
    }
  };
  return (
    <Page>
      <PageHeading title="Cobro del viaje" subtitle="Confirma el pago según el método acordado." />
      <Card>
        <View style={commonStyles.spread}><Label>Valor registrado</Label><Text style={commonStyles.statValue}>{formatCop(activeTrip.fare)}</Text></View>
        <View style={commonStyles.spread}><Label>Comisión</Label><Label>{formatCop(activeTrip.commission)}</Label></View>
        <View style={commonStyles.spread}><Label>Ganancia neta</Label><Text style={commonStyles.emphasisValue}>{formatCop(activeTrip.driverEarnings)}</Text></View>
        <Label>Método de pago: {paymentMethodLabel(activeTrip.paymentMethod)}</Label>
        <Label>
          Estado del pago: {{
            pending: 'Pendiente',
            approved: 'Aprobado por Mercado Pago',
            rejected: 'Rechazado',
            cash: 'Efectivo recibido',
          }[activeTrip.paymentStatus]}
        </Label>
        {activeTrip.tip > 0 ? (
          <View style={commonStyles.spread}><Label>Propina</Label><Label>{formatCop(activeTrip.tip)}</Label></View>
        ) : null}
      </Card>
      {error ? <Card><Text style={commonStyles.errorText}>{error}</Text></Card> : null}
      {activeTrip.paymentMethod === 'cash' ? (
        <Button
          title={loading ? 'Confirmando…' : 'Confirmar efectivo recibido'}
          onPress={() => void confirmCash()}
          disabled={loading}
        />
      ) : (
        <Card>
          <Label>
            Completa el checkout de prueba de Mercado Pago en el navegador. El backend confirmará el pago mediante una notificación firmada.
          </Label>
          <Button
            title={loading ? 'Abriendo checkout…' : 'Abrir checkout de Mercado Pago'}
            onPress={() => void openMercadoPagoCheckout()}
            disabled={loading || activeTrip.paymentStatus === 'approved'}
          />
          <Label muted>
            {refreshing ? 'Consultando el estado del pago…' : 'La pantalla se actualizará automáticamente cuando el pago sea confirmado.'}
          </Label>
          {activeTrip.paymentStatus === 'rejected' ? (
            <Label muted>El pago fue rechazado. El pasajero debe intentar nuevamente desde su flujo de pago.</Label>
          ) : null}
          {refreshing ? null : (
            <Button
              title="Consultar estado del pago"
              variant="secondary"
              onPress={() => void refreshActiveTrip().catch((paymentError: unknown) => {
                setError(paymentError instanceof Error
                  ? paymentError.message
                  : 'No se pudo consultar el estado del pago.');
              })}
            />
          )}
        </Card>
      )}
    </Page>
  );
}

export function TripSummaryScreen() {
  const router = useRouter();
  const { activeTrip } = useDriver();
  if (!activeTrip) {
    return (
      <Page>
        <PageHeading title="No hay un resumen disponible." subtitle="Consulta el historial para ver viajes anteriores." />
        <Button title="Ver historial" onPress={() => router.replace('/history')} />
      </Page>
    );
  }
  if (activeTrip.status !== 'paid') {
    return (
      <Page>
        <PageHeading title="El pago aún no está confirmado." subtitle="El resumen aparecerá cuando el backend confirme el pago." />
        <Button title="Volver al cobro" onPress={() => router.replace('/trip-payment')} />
      </Page>
    );
  }
  return (
    <Page>
      <PageHeading title="Viaje finalizado" subtitle="El pago y el viaje quedaron confirmados por el servidor." />
      <Card>
        <Label>Origen: {activeTrip.origin.address}</Label>
        <Label>Destino: {activeTrip.destination.address}</Label>
        <Label>{activeTrip.distanceKm} km · {activeTrip.durationMin} min · {activeTrip.category}</Label>
        <View style={commonStyles.spread}><Label>Tarifa</Label><Text style={commonStyles.statValue}>{formatCop(activeTrip.fare)}</Text></View>
        <View style={commonStyles.spread}><Label>Comisión</Label><Label>{formatCop(activeTrip.commission)}</Label></View>
        <View style={commonStyles.spread}><Label>Propina</Label><Label>{formatCop(activeTrip.tip)}</Label></View>
        <View style={commonStyles.spread}><Label>Ganancia neta</Label><Text style={commonStyles.emphasisValue}>{formatCop(activeTrip.driverEarnings)}</Text></View>
        <Label>Método de pago: {paymentMethodLabel(activeTrip.paymentMethod)}</Label>
        <Label>Estado del pago: {activeTrip.paymentStatus === 'cash' ? 'Efectivo recibido' : activeTrip.paymentStatus}</Label>
      </Card>
      <Button title="Volver al inicio" onPress={() => router.replace('/home')} />
      <Button title="Ver historial" variant="secondary" onPress={() => router.replace('/history')} />
    </Page>
  );
}

export function TripDetailScreen() {
  const { trips, activeTrip, getTripDetails, getTripRoute } = useDriver();
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();
  const [loadedTrip, setLoadedTrip] = useState<{ id: string; trip: Trip } | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);
  useEffect(() => {
    if (!tripId) return;
    let active = true;
    void getTripDetails(tripId)
      .then((result) => {
        if (active) setLoadedTrip({ id: tripId, trip: result });
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError({
            id: tripId,
            message: loadError instanceof Error ? loadError.message : 'No se pudo cargar el viaje.',
          });
        }
      });
    return () => {
      active = false;
    };
  }, [getTripDetails, tripId]);
  const trip = (loadedTrip && loadedTrip.id === tripId ? loadedTrip.trip : null)
    ?? trips.find((item) => item.id === tripId)
    ?? (activeTrip?.id === tripId ? activeTrip : null);
  const [route, setRoute] = useState<TripRoute | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  useEffect(() => {
    if (!trip || !['completed', 'paid'].includes(trip.status)) return;
    let active = true;
    void getTripRoute(trip.id, {
      target: 'history',
      from: { lat: trip.origin.lat, lng: trip.origin.lng },
    }).then((result) => {
      if (active) {
        setRoute(result);
        setRouteError(null);
      }
    }).catch((routeLoadError: unknown) => {
      if (active) {
        setRouteError(routeLoadError instanceof Error
          ? routeLoadError.message
          : 'No se pudo cargar la ruta del viaje.');
      }
    });
    return () => {
      active = false;
    };
  }, [getTripRoute, trip]);
  if (!trip) {
    return (
      <Page>
        <PageHeading title={error && error.id === tripId ? 'No se pudo abrir el viaje.' : 'Cargando viaje…'} />
        {error && error.id === tripId ? <Card><Label>{error.message}</Label></Card> : null}
      </Page>
    );
  }
  const endpoints = [
    { latitude: trip.origin.lat, longitude: trip.origin.lng },
    { latitude: trip.destination.lat, longitude: trip.destination.lng },
  ];
  const coordinates = route?.coordinates ?? endpoints;
  return (
    <Page>
      <PageHeading title={`${trip.origin.address} → ${trip.destination.address}`} subtitle={formatDate(trip.createdAt, true)} />
      <MapView
        style={commonStyles.detailMap}
        initialRegion={{ ...coordinates[0], latitudeDelta: 0.06, longitudeDelta: 0.06 }}
      >
        <Polyline coordinates={coordinates} strokeWidth={5} strokeColor={colors.accent} />
        <Marker coordinate={coordinates[0]} title="Origen" />
        <Marker coordinate={coordinates[1]} title="Destino" />
      </MapView>
      <Card>
        {routeError ? <Label muted>{routeError}</Label> : null}
        {!route && !routeError ? <Label muted>Calculando ruta del viaje…</Label> : null}
        <Label>Distancia: {trip.distanceKm} km · Duración: {trip.durationMin} min</Label>
        <Label>Categoría: {trip.category} · Pago: {paymentMethodLabel(trip.paymentMethod)}</Label>
        <Label>Tarifa: {formatCop(trip.fare)} · Comisión: {formatCop(trip.commission)}</Label>
        <Label>Propina: {formatCop(trip.tip)} · Ganancia: {formatCop(trip.driverEarnings)}</Label>
        <Label>Calificación: {trip.rating ? `${trip.rating}/5` : 'Sin calificación'}</Label>
      </Card>
    </Page>
  );
}
