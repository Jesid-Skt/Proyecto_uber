import { useLocalization } from '../../localization/useLocalization';
// AI-assisted: see docs/AI_LOG.md #7.
import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SlideToConfirmButton } from '../../components/SlideToConfirmButton';
import { tripPalette } from '../../components/trip-flow-theme';
import { Button, Card, Page } from '../../components/ui';
import { useDriver } from '../../context/DriverContext';
import { useTripRequests } from '../../hooks/useTripRequests';
import { paymentMethodLabel } from '../shared/formatters';

export function TripFlowScreen() {
  const { activeTrip } = useDriver();
  if (!activeTrip) return <Redirect href="/home" />;
  if (activeTrip.status === 'completed') return <Redirect href="/trip-payment" />;
  if (activeTrip.status === 'paid') return <Redirect href="/trip-summary" />;
  if (activeTrip.status === 'in_progress') return <Redirect href="/trip-active" />;
  return <Redirect href="/trip-pickup" />;
}

export function CurrentTripMenuScreen() {
  const { t } = useLocalization();
  const { activeTrip } = useDriver();
  const router = useRouter();
  if (!activeTrip) {
    return (
      <Page backgroundColor={tripPalette.background}>
        <View style={styles.heading}>
          <Text style={styles.title}>{t("No hay un viaje activo")}</Text>
          <Text style={styles.subtitle}>{t("Cuando aceptes una solicitud, podrás continuar aquí el flujo del viaje.")}</Text>
        </View>
        <Button
          title={t("Volver al inicio")}
          onPress={() => router.replace('/home')}
          style={styles.rejectButton}
          textStyle={styles.buttonLabel}
        />
      </Page>
    );
  }
  if (activeTrip.status === 'completed') return <Redirect href="/trip-payment" />;
  if (activeTrip.status === 'paid') return <Redirect href="/trip-summary" />;
  if (activeTrip.status === 'in_progress') return <Redirect href="/trip-active" />;
  return <Redirect href="/trip-pickup" />;
}

export function TripRequestScreen() {
  const { t, translateText, formatCurrency, formatNumber } = useLocalization();
  const router = useRouter();
  const { activeRequest, acceptRequest, rejectRequest } = useDriver();
  const { secondsRemaining, expirationError } = useTripRequests();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const progress = useSharedValue(1);
  const progressTrackWidth = useSharedValue(0);
  const requestDuration = activeRequest
    ? Math.max(1, (activeRequest.expiresAt - activeRequest.createdAt.getTime()) / 1000)
    : 1;
  const progressStyle = useAnimatedStyle(() => ({
    width: progressTrackWidth.value * progress.value,
  }));

  useEffect(() => {
    // Reanimated shared values are intentionally updated outside render.
    // eslint-disable-next-line react-hooks/immutability
    progress.value = withTiming(Math.max(0, Math.min(1, secondsRemaining / requestDuration)), {
      duration: 300,
    });
  }, [progress, requestDuration, secondsRemaining]);

  const accept = async () => {
    setLoading(true);
    setError(null);
    try {
      await acceptRequest();
      router.replace('/trip-pickup');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo aceptar la solicitud.");
    } finally {
      setLoading(false);
    }
  };
  const reject = async () => {
    setLoading(true);
    setError(null);
    try {
      await rejectRequest();
      router.replace('/home');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo rechazar la solicitud.");
    } finally {
      setLoading(false);
    }
  };

  if (!activeRequest) {
    return (
      <Page backgroundColor={tripPalette.background}>
        <View style={styles.heading}>
          <Text style={styles.title}>{t("Solicitud no disponible")}</Text>
          <Text style={styles.subtitle}>{t("Pudo vencer o ya fue respondida.")}</Text>
        </View>
        {expirationError ? (
          <Card style={styles.card}>
            <Text style={styles.error}>{translateText(expirationError)}</Text>
          </Card>
        ) : null}
        <Button title={t("Volver al inicio")} onPress={() => router.replace('/home')} />
      </Page>
    );
  }

  return (
    <Page backgroundColor={tripPalette.background}>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>{t("NUEVO VIAJE")}</Text>
        <Text style={styles.title}>{t("Nueva solicitud")}</Text>
        <Text style={styles.subtitle}>{t("Revisa los detalles y responde antes de que termine el tiempo.")}</Text>
      </View>
      <Animated.View entering={FadeInDown.duration(350)}>
        <Card style={styles.card}>
          <View style={styles.countdownHeader}>
            <View>
              <Text style={styles.meta}>{t("TIEMPO PARA RESPONDER")}</Text>
              <Text style={styles.countdown}>00:{String(secondsRemaining).padStart(2, '0')}</Text>
            </View>
            <Ionicons
              name="time-outline"
              size={24}
              color={secondsRemaining <= 5 ? tripPalette.error : tripPalette.accent}
            />
          </View>
          <View
            style={styles.progressTrack}
            onLayout={(event) => {
              // eslint-disable-next-line react-hooks/immutability
              progressTrackWidth.value = event.nativeEvent.layout.width;
            }}
          >
            <Animated.View
              style={[
                styles.progressFill,
                secondsRemaining <= 5 && styles.progressCritical,
                progressStyle,
              ]}
            />
          </View>

          <View style={styles.route}>
            <View style={styles.routeMarkers}>
              <View style={styles.originDot} />
              <View style={styles.routeDashes} />
              <Ionicons name="location" size={20} color={tripPalette.accent} />
            </View>
            <View style={styles.routeAddresses}>
              <View style={styles.addressBlock}>
                <Text style={styles.meta}>{t("RECOGIDA")}</Text>
                <Text style={styles.address}>{activeRequest.origin.address}</Text>
              </View>
              <View style={styles.addressBlock}>
                <Text style={styles.meta}>{t("DESTINO")}</Text>
                <Text style={styles.address}>{activeRequest.destination.address}</Text>
              </View>
            </View>
          </View>

          <View style={styles.tripMeta}>
            <Text style={styles.metaValue}>
              {formatNumber(activeRequest.distanceKm)} km · {formatNumber(activeRequest.durationMin)} min
            </Text>
            <Text style={styles.metaValue}>{translateText(activeRequest.category)}</Text>
            <Text style={styles.metaValue}>{translateText(paymentMethodLabel(activeRequest.paymentMethod))}</Text>
          </View>
          <View style={styles.fareRow}>
            <Text style={styles.body}>{t("Tarifa estimada")}</Text>
            <Text style={styles.body}>{formatCurrency(activeRequest.fare)}</Text>
          </View>
          <View style={styles.earningsBadge}>
            <View>
              <Text style={styles.earningsLabel}>{t("GANANCIA NETA ESTIMADA")}</Text>
              <Text style={styles.earningsValue}>{formatCurrency(activeRequest.driverEarnings)}</Text>
            </View>
            <Ionicons name="wallet-outline" size={24} color={tripPalette.accent} />
          </View>
        </Card>
      </Animated.View>
      {error ? (
        <Card style={styles.card}>
          <Text style={styles.error}>{translateText(error)}</Text>
        </Card>
      ) : null}
      <View style={styles.actions}>
        <Button
          title={loading ? t("Procesando…") : t("Rechazar")}
          variant="secondary"
          onPress={() => void reject()}
          disabled={loading}
          style={styles.rejectButton}
        />
        <View style={styles.acceptButton}>
          <SlideToConfirmButton
            title={loading ? t("Procesando…") : t("Desliza para aceptar")}
            onConfirm={() => void accept()}
            disabled={loading || secondsRemaining === 0}
          />
        </View>
      </View>
      <Text style={styles.footnote}>{t("La solicitud se confirma con el servidor antes de cambiar de pantalla.")}</Text>
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
  countdownHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meta: { color: tripPalette.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  countdown: { marginTop: 4, color: tripPalette.text, fontSize: 25, fontWeight: '800' },
  progressTrack: {
    height: 5,
    overflow: 'hidden',
    borderRadius: 3,
    backgroundColor: tripPalette.elevated,
  },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: tripPalette.accent },
  progressCritical: { backgroundColor: tripPalette.error },
  route: { flexDirection: 'row', gap: 14, paddingVertical: 5 },
  routeMarkers: { width: 20, alignItems: 'center', paddingTop: 5, paddingBottom: 6 },
  originDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: tripPalette.accent,
  },
  routeDashes: {
    flex: 1,
    minHeight: 27,
    marginVertical: 4,
    borderLeftWidth: 1,
    borderStyle: 'dashed',
    borderColor: tripPalette.muted,
  },
  routeAddresses: { flex: 1, justifyContent: 'space-between', gap: 16 },
  addressBlock: { gap: 4 },
  address: { color: tripPalette.text, fontSize: 15, fontWeight: '600', lineHeight: 21 },
  tripMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metaValue: {
    overflow: 'hidden',
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: tripPalette.elevated,
    color: tripPalette.text,
    fontSize: 12,
    fontWeight: '600',
  },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: tripPalette.border,
  },
  body: { color: tripPalette.muted, fontSize: 14, fontWeight: '600' },
  earningsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 16,
    backgroundColor: tripPalette.elevated,
    borderWidth: 1,
    borderColor: tripPalette.border,
  },
  earningsLabel: { color: tripPalette.accent, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  earningsValue: { marginTop: 4, color: tripPalette.text, fontSize: 22, fontWeight: '800' },
  actions: { gap: 12 },
  rejectButton: {
    backgroundColor: tripPalette.surface,
    borderWidth: 1,
    borderColor: tripPalette.border,
  },
  buttonLabel: { color: tripPalette.text, fontSize: 15, fontWeight: '700' },
  acceptButton: { width: '100%' },
  footnote: { color: tripPalette.muted, fontSize: 12, textAlign: 'center' },
  error: { color: tripPalette.error, fontSize: 14, lineHeight: 20 },
});
