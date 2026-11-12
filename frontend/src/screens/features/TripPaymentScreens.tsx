// AI-assisted: see docs/AI_LOG.md #8.
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Button, Card, colors, commonStyles, Label, Page, PageHeading } from '../../components/ui';
import { tripPalette } from '../../components/trip-flow-theme';
import { formatCop } from '../../config/pricing';
import { useDriver } from '../../context/DriverContext';
import type { Trip, TripRoute } from '../../types/domain';
import { formatDate, paymentMethodLabel } from '../shared/formatters';

export function TripPaymentScreen() {
  const router = useRouter();
  const {
    activeTrip,
    confirmCashPayment,
    createPaymentCheckout,
    refreshActiveTrip,
    syncMercadoPagoPayment,
  } = useDriver();
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
  const syncPayment = async () => {
    setLoading(true);
    setError(null);
    try {
      await syncMercadoPagoPayment();
    } catch (paymentError) {
      setError(paymentError instanceof Error
        ? paymentError.message
        : 'No se pudo consultar el estado del pago en Mercado Pago.');
    } finally {
      setLoading(false);
    }
  };
  return (
    <Page backgroundColor={tripPalette.background}>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>RESUMEN DE PAGO</Text>
        <Text style={styles.title}>Cobro del viaje</Text>
        <Text style={styles.subtitle}>Confirma el pago según el método acordado.</Text>
      </View>
      <Animated.View entering={FadeInDown.duration(350)}>
        <Card style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.secondary}>Valor registrado</Text>
            <Text style={styles.amount}>{formatCop(activeTrip.fare)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.secondary}>Comisión</Text>
            <Text style={styles.body}>{formatCop(activeTrip.commission)}</Text>
          </View>
          <View style={styles.earnings}>
            <View>
              <Text style={styles.earningsLabel}>GANANCIA NETA</Text>
              <Text style={styles.earningsValue}>{formatCop(activeTrip.driverEarnings)}</Text>
            </View>
            <Text style={styles.currencyMark}>$</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.secondary}>Método de pago</Text>
            <Text style={styles.body}>{paymentMethodLabel(activeTrip.paymentMethod)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.secondary}>Estado del pago</Text>
            <Text style={styles.body}>
              {{
                pending: 'Pendiente',
                approved: 'Aprobado por Mercado Pago',
                rejected: 'Rechazado',
                refunded: 'Reembolsado',
                charged_back: 'Contracargo',
                cash: 'Efectivo recibido',
              }[activeTrip.paymentStatus]}
            </Text>
          </View>
          {activeTrip.tip > 0 ? (
            <View style={styles.detailRow}>
              <Text style={styles.secondary}>Propina</Text>
              <Text style={styles.body}>{formatCop(activeTrip.tip)}</Text>
            </View>
          ) : null}
        </Card>
      </Animated.View>
      {error ? (
        <Card style={styles.card}>
          <Text style={styles.error}>{error}</Text>
        </Card>
      ) : null}
      {activeTrip.paymentMethod === 'cash' ? (
        <Button
          title={loading ? 'Confirmando…' : 'Confirmar efectivo recibido'}
          onPress={() => void confirmCash()}
          disabled={loading}
          style={styles.actionButton}
          textStyle={styles.actionButtonText}
        />
      ) : (
        <Animated.View entering={FadeInDown.delay(100).duration(350)}>
        <Card style={styles.card}>
          <Text style={styles.body}>
            Completa el checkout de prueba de Mercado Pago en el navegador. El backend confirmará el pago mediante una notificación firmada.
          </Text>
          <Button
            title={loading ? 'Abriendo checkout…' : 'Abrir checkout de Mercado Pago'}
            onPress={() => void openMercadoPagoCheckout()}
            disabled={loading || activeTrip.paymentStatus === 'approved'}
            style={styles.actionButton}
            textStyle={styles.actionButtonText}
          />
          <Text style={styles.secondary}>
            {refreshing ? 'Consultando el estado del pago…' : 'La pantalla se actualizará automáticamente cuando el pago sea confirmado.'}
          </Text>
          {activeTrip.paymentStatus === 'rejected' ? (
            <Text style={styles.secondary}>El pago fue rechazado. El pasajero debe intentar nuevamente desde su flujo de pago.</Text>
          ) : null}
          {refreshing ? null : (
            <Button
              title={loading ? 'Consultando Mercado Pago…' : 'Consultar estado del pago'}
              variant="secondary"
              onPress={() => void syncPayment()}
              disabled={loading}
              style={styles.secondaryButton}
              textStyle={styles.actionButtonText}
            />
          )}
        </Card>
        </Animated.View>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  heading: { gap: 7, marginBottom: 4 },
  eyebrow: { color: tripPalette.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: tripPalette.text, fontSize: 28, fontWeight: '800' },
  subtitle: { color: tripPalette.muted, fontSize: 14, lineHeight: 21 },
  card: {
    gap: 16,
    borderRadius: 24,
    backgroundColor: tripPalette.surface,
    borderColor: tripPalette.border,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  amount: { color: tripPalette.text, fontSize: 20, fontWeight: '800' },
  body: { color: tripPalette.text, fontSize: 14, lineHeight: 21 },
  secondary: { color: tripPalette.muted, fontSize: 13, lineHeight: 19 },
  earnings: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 18,
    backgroundColor: tripPalette.elevated,
    borderWidth: 1,
    borderColor: tripPalette.border,
  },
  earningsLabel: { color: tripPalette.accent, fontSize: 10, fontWeight: '800', letterSpacing: 0.9 },
  earningsValue: { marginTop: 4, color: tripPalette.text, fontSize: 25, fontWeight: '800' },
  currencyMark: { color: tripPalette.accent, fontSize: 28, fontWeight: '800' },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: tripPalette.border,
  },
  error: { color: tripPalette.error, fontSize: 14, lineHeight: 20 },
  actionButton: { backgroundColor: tripPalette.accent, borderRadius: 16 },
  actionButtonText: { color: tripPalette.background },
  secondaryButton: {
    backgroundColor: tripPalette.elevated,
    borderWidth: 1,
    borderColor: tripPalette.border,
  },
});

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
  if (
    activeTrip.status !== 'paid'
    || !['approved', 'cash'].includes(activeTrip.paymentStatus)
  ) {
    return (
      <Page>
        <PageHeading
          title={activeTrip.paymentStatus === 'refunded' || activeTrip.paymentStatus === 'charged_back'
            ? 'El pago fue reembolsado o disputado.'
            : 'El pago aún no está confirmado.'}
          subtitle="El resumen solo se considera pagado cuando el backend confirma el pago."
        />
        {activeTrip.paymentStatus === 'pending' || activeTrip.paymentStatus === 'rejected' ? (
          <Button title="Volver al cobro" onPress={() => router.replace('/trip-payment')} />
        ) : null}
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
