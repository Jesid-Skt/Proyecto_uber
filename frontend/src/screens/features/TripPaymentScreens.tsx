import { useLocalization } from '../../localization/useLocalization';
// AI-assisted: see docs/AI_LOG.md #8.
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from '../../components/DriverMap';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Button, Card, colors, commonStyles, Label, Page, PageHeading } from '../../components/ui';
import { tripPalette } from '../../components/trip-flow-theme';
import { useDriver } from '../../context/DriverContext';
import type { Trip, TripRoute } from '../../types/domain';
import { paymentMethodLabel } from '../shared/formatters';

export function TripPaymentScreen() {
  const { t, translateText, formatCurrency, paymentStatusLabel } = useLocalization();
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
        <Text style={styles.eyebrow}>{t("RESUMEN DE PAGO")}</Text>
        <Text style={styles.title}>{t("Cobro del viaje")}</Text>
        <Text style={styles.subtitle}>{t("Confirma el pago según el método acordado.")}</Text>
      </View>
      <Animated.View entering={FadeInDown.duration(350)}>
        <Card style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.secondary}>{t("Valor registrado")}</Text>
            <Text style={styles.amount}>{formatCurrency(activeTrip.fare)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.secondary}>{t("Comisión")}</Text>
            <Text style={styles.body}>{formatCurrency(activeTrip.commission)}</Text>
          </View>
          <View style={styles.earnings}>
            <View>
              <Text style={styles.earningsLabel}>{t("GANANCIA NETA")}</Text>
              <Text style={styles.earningsValue}>{formatCurrency(activeTrip.driverEarnings)}</Text>
            </View>
            <Text style={styles.currencyMark}>$</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.secondary}>{t("Método de pago")}</Text>
            <Text style={styles.body}>{translateText(paymentMethodLabel(activeTrip.paymentMethod))}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.secondary}>{t("Estado del pago")}</Text>
            <Text style={styles.body}>
              {paymentStatusLabel(activeTrip.paymentStatus)}
            </Text>
          </View>
          {activeTrip.tip > 0 ? (
            <View style={styles.detailRow}>
              <Text style={styles.secondary}>{t("Propina")}</Text>
              <Text style={styles.body}>{formatCurrency(activeTrip.tip)}</Text>
            </View>
          ) : null}
        </Card>
      </Animated.View>
      {error ? (
        <Card style={styles.card}>
          <Text style={styles.error}>{translateText(error)}</Text>
        </Card>
      ) : null}
      {activeTrip.paymentMethod === 'cash' ? (
        <Button
          title={loading ? t("Confirmando…") : t("Confirmar efectivo recibido")}
          onPress={() => void confirmCash()}
          disabled={loading}
          style={styles.actionButton}
          textStyle={styles.actionButtonText}
        />
      ) : (
        <Animated.View entering={FadeInDown.delay(100).duration(350)}>
        <Card style={styles.card}>
          <Text style={styles.body}>
            {t("Completa el checkout de prueba de Mercado Pago en el navegador. El backend confirmará el pago mediante una notificación firmada.")}
          </Text>
          <Button
            title={loading ? t("Abriendo checkout…") : t("Abrir checkout de Mercado Pago")}
            onPress={() => void openMercadoPagoCheckout()}
            disabled={loading || activeTrip.paymentStatus === 'approved'}
            style={styles.actionButton}
            textStyle={styles.actionButtonText}
          />
          <Text style={styles.secondary}>
            {refreshing ? t("Consultando el estado del pago…") : t("La pantalla se actualizará automáticamente cuando el pago sea confirmado.")}
          </Text>
          {activeTrip.paymentStatus === 'rejected' ? (
            <Text style={styles.secondary}>{t("El pago fue rechazado. El pasajero debe intentar nuevamente desde su flujo de pago.")}</Text>
          ) : null}
          {refreshing ? null : (
            <Button
              title={loading ? t("Consultando Mercado Pago…") : t("Consultar estado del pago")}
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
  const { t, translateText, formatCurrency, formatNumber, paymentStatusLabel } = useLocalization();
  const router = useRouter();
  const { activeTrip } = useDriver();
  if (!activeTrip) {
    return (
      <Page>
        <PageHeading title={t("No hay un resumen disponible.")} subtitle={t("Consulta el historial para ver viajes anteriores.")} />
        <Button title={t("Ver historial")} onPress={() => router.replace('/history')} />
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
            ? t("El pago fue reembolsado o disputado.")
            : t("El pago aún no está confirmado.")}
          subtitle={t("El resumen solo se considera pagado cuando el backend confirma el pago.")}
        />
        {activeTrip.paymentStatus === 'pending' || activeTrip.paymentStatus === 'rejected' ? (
          <Button title={t("Volver al cobro")} onPress={() => router.replace('/trip-payment')} />
        ) : null}
      </Page>
    );
  }
  return (
    <Page>
      <PageHeading title={t("Viaje finalizado")} subtitle={t("El pago y el viaje quedaron confirmados por el servidor.")} />
      <Card>
        <Label>{t('Origen: {address}', { address: activeTrip.origin.address })}</Label>
        <Label>{t('Destino: {address}', { address: activeTrip.destination.address })}</Label>
        <Label>{formatNumber(activeTrip.distanceKm)} km · {formatNumber(activeTrip.durationMin)} min · {translateText(activeTrip.category)}</Label>
        <View style={commonStyles.spread}><Label>{t("Tarifa")}</Label><Text style={commonStyles.statValue}>{formatCurrency(activeTrip.fare)}</Text></View>
        <View style={commonStyles.spread}><Label>{t("Comisión")}</Label><Label>{formatCurrency(activeTrip.commission)}</Label></View>
        <View style={commonStyles.spread}><Label>{t("Propina")}</Label><Label>{formatCurrency(activeTrip.tip)}</Label></View>
        <View style={commonStyles.spread}><Label>{t("Ganancia neta")}</Label><Text style={commonStyles.emphasisValue}>{formatCurrency(activeTrip.driverEarnings)}</Text></View>
        <Label>{t('Método de pago: {method}', { method: translateText(paymentMethodLabel(activeTrip.paymentMethod)) })}</Label>
        <Label>{t('Estado del pago: {status}', { status: paymentStatusLabel(activeTrip.paymentStatus) })}</Label>
      </Card>
      <Button title={t("Volver al inicio")} onPress={() => router.replace('/home')} />
      <Button title={t("Ver historial")} variant="secondary" onPress={() => router.replace('/history')} />
    </Page>
  );
}

export function TripDetailScreen() {
  const { t, translateText, formatCurrency, formatNumber, formatDate } = useLocalization();
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
  const originLatitude = trip?.origin.lat;
  const originLongitude = trip?.origin.lng;
  const destinationLatitude = trip?.destination.lat;
  const destinationLongitude = trip?.destination.lng;
  const endpoints = useMemo(() => {
    if (
      originLatitude === undefined
      || originLongitude === undefined
      || destinationLatitude === undefined
      || destinationLongitude === undefined
    ) return [];
    return [
      { latitude: originLatitude, longitude: originLongitude },
      { latitude: destinationLatitude, longitude: destinationLongitude },
    ];
  }, [
    destinationLatitude,
    destinationLongitude,
    originLatitude,
    originLongitude,
  ]);
  const coordinates = route?.coordinates.length ? route.coordinates : endpoints;
  const mapFitCoordinates = useMemo(
    () => [...coordinates, ...endpoints.slice(1)],
    [coordinates, endpoints],
  );
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
        <PageHeading title={error && error.id === tripId ? 'No se pudo abrir el viaje.' : t("Cargando viaje…")} />
        {error && error.id === tripId ? <Card><Label>{translateText(error.message)}</Label></Card> : null}
      </Page>
    );
  }
  return (
    <Page>
      <PageHeading title={`${trip.origin.address} → ${trip.destination.address}`} subtitle={formatDate(trip.createdAt, true)} />
      <MapView
        style={commonStyles.detailMap}
        initialRegion={{ ...coordinates[0], latitudeDelta: 0.06, longitudeDelta: 0.06 }}
        fitCoordinates={mapFitCoordinates}
      >
        <Polyline coordinates={coordinates} strokeWidth={5} strokeColor={colors.accent} />
        <Marker coordinate={coordinates[0]} title={t("Origen")} />
        <Marker coordinate={endpoints[1]} title={t("Destino")} />
      </MapView>
      <Card>
        {routeError ? <Label muted>{translateText(routeError)}</Label> : null}
        {!route && !routeError ? <Label muted>{t("Calculando ruta del viaje…")}</Label> : null}
        <Label>{t('Distancia: {distance} km · Duración: {minutes} min', { distance: formatNumber(trip.distanceKm), minutes: formatNumber(trip.durationMin) })}</Label>
        <Label>{t('Categoría: {category} · Pago: {method}', { category: translateText(trip.category), method: translateText(paymentMethodLabel(trip.paymentMethod)) })}</Label>
        <Label>{t('Tarifa: {fare} · Comisión: {commission}', { fare: formatCurrency(trip.fare), commission: formatCurrency(trip.commission) })}</Label>
        <Label>{t('Propina: {tip} · Ganancia: {earnings}', { tip: formatCurrency(trip.tip), earnings: formatCurrency(trip.driverEarnings) })}</Label>
        <Label>{t('Calificación: {rating}', { rating: trip.rating ? `${formatNumber(trip.rating)}/5` : t('Sin calificación') })}</Label>
      </Card>
    </Page>
  );
}
