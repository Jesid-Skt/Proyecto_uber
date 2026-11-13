import { useLocalization } from '../../localization/useLocalization';
// AI-assisted: see docs/AI_LOG.md #5.
import { useIsFocused, usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import MapView, { Marker } from '../../components/DriverMap';
import { Button, Card, colors, commonStyles, Label, Page, PageHeading } from '../../components/ui';
import { useDriver } from '../../context/DriverContext';
import { useDriverLocation } from '../../hooks/useDriverLocation';
import { useTripRequests } from '../../hooks/useTripRequests';

export function HomeScreen() {
  const { t, translateText } = useLocalization();
  const {
    available,
    profile,
    setAvailable,
    updateLocation,
    activeRequest,
    refreshTripRequest,
    refreshProfile,
  } = useDriver();
  const router = useRouter();
  const pathname = usePathname();
  const isFocused = useIsFocused();
  const [locationError, setLocationError] = useState<string | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [approvalRefreshing, setApprovalRefreshing] = useState(false);
  const [approvalRefreshError, setApprovalRefreshError] = useState<string | null>(null);
  const requestCheckRunning = useRef(false);
  const onPermissionDenied = useCallback(() => {
    if (!available) return;
    void setAvailable(false).catch((error: unknown) => {
      setLocationError(error instanceof Error ? error.message : "No se pudo desconectar.");
    });
  }, [available, setAvailable]);
  const reportLocation = useCallback(async (location: { lat: number; lng: number }) => {
    await updateLocation(location);
    setLocationError(null);
  }, [updateLocation]);
  const {
    coords,
    mapRegion,
    error: trackingError,
    retry: retryLocation,
  } = useDriverLocation(
    isFocused && available,
    onPermissionDenied,
    available ? reportLocation : undefined,
  );
  const { secondsRemaining, expirationError } = useTripRequests();
  const accountApproved = profile?.approvalStatus === 'approved';
  const requestBounds = useMemo(() => activeRequest ? [
    ...(coords ? [{ latitude: coords.latitude, longitude: coords.longitude }] : []),
    { latitude: activeRequest.origin.lat, longitude: activeRequest.origin.lng },
    { latitude: activeRequest.destination.lat, longitude: activeRequest.destination.lng },
  ] : undefined, [activeRequest, coords]);
  const approvalLabel = profile?.approvalStatus === 'approved'
    ? t("Cuenta aprobada")
    : profile?.approvalStatus === 'rejected'
      ? t("Solicitud rechazada")
      : t("Pendiente de aprobación");

  useEffect(() => {
    if (!available || !isFocused) return;
    let active = true;
    const checkRequest = async () => {
      if (requestCheckRunning.current) return;
      requestCheckRunning.current = true;
      try {
        await refreshTripRequest();
        if (active) setLocationError(null);
      } catch (error) {
        if (active) {
          setLocationError(error instanceof Error ? error.message : "No se pudieron consultar solicitudes.");
        }
      } finally {
        requestCheckRunning.current = false;
      }
    };
    void checkRequest();
    const intervalId = setInterval(() => void checkRequest(), 3000);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [available, isFocused, refreshTripRequest]);

  useEffect(() => {
    if (activeRequest && pathname !== '/trip-request') {
      router.push('/trip-request');
    }
  }, [activeRequest, pathname, router]);

  const onAvailabilityChange = useCallback(async (value: boolean) => {
    setAvailabilityLoading(true);
    try {
      setLocationError(null);
      await setAvailable(value);
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : "No se pudo cambiar la disponibilidad.");
    } finally {
      setAvailabilityLoading(false);
    }
  }, [setAvailable]);

  const onRefreshApproval = useCallback(async () => {
    setApprovalRefreshing(true);
    setApprovalRefreshError(null);
    try {
      await refreshProfile();
    } catch (error) {
      setApprovalRefreshError(
        error instanceof Error ? error.message : "No se pudo actualizar el estado de aprobación.",
      );
    } finally {
      setApprovalRefreshing(false);
    }
  }, [refreshProfile]);

  return (
    <Page>
      <View style={commonStyles.spread}>
        <PageHeading title={t("Hola, conductor")} subtitle={profile?.fullName ?? ''} />
        <View style={commonStyles.centered}>
          <Text style={available ? commonStyles.statusActive : commonStyles.statusInactive}>
            {available ? t("DISPONIBLE") : t("DESCONECTADO")}
          </Text>
          <Switch
            accessibilityLabel={t("Disponibilidad del conductor")}
            value={available}
            onValueChange={(value) => void onAvailabilityChange(value)}
            disabled={!accountApproved || availabilityLoading}
            trackColor={{ true: colors.accent }}
          />
          {availabilityLoading ? <Label muted>{t("Actualizando…")}</Label> : null}
        </View>
      </View>
      <Card style={commonStyles.mapCard}>
        <MapView
          style={commonStyles.homeMap}
          region={mapRegion}
          showsUserLocation={Boolean(coords)}
          fitCoordinates={requestBounds}
        >
          {coords ? <Marker coordinate={mapRegion} title={t("Tu ubicación")} /> : null}
          {activeRequest ? (
            <>
              <Marker
                coordinate={{ latitude: activeRequest.origin.lat, longitude: activeRequest.origin.lng }}
                title={t("Punto de recogida")}
                pinColor={colors.accent}
              />
              <Marker
                coordinate={{ latitude: activeRequest.destination.lat, longitude: activeRequest.destination.lng }}
                title={t("Destino")}
                pinColor={colors.navy}
              />
            </>
          ) : null}
        </MapView>
      </Card>
      <Label muted>
        {!available
          ? t("Conéctate para compartir tu ubicación.")
          : coords
            ? t("Mostrando la ubicación de este dispositivo.")
            : t("Buscando la ubicación del dispositivo…")}
      </Label>
      <Card>
        <Text style={commonStyles.sectionTitle}>{t("Estado de cuenta")}</Text>
        <Text style={profile?.approvalStatus === 'approved' ? commonStyles.statusActive : commonStyles.statusInactive}>
          {approvalLabel}
        </Text>
        <Label muted>
          {accountApproved
            ? t("La disponibilidad se guarda en el servidor.")
            : profile?.approvalStatus === 'rejected'
              ? t("La cuenta debe estar aprobada para activar la disponibilidad.")
              : t("Un administrador debe aprobar tu perfil para activar la disponibilidad.")}
        </Label>
        {!accountApproved ? (
          <Button
            title={approvalRefreshing ? t("Actualizando estado…") : t("Actualizar estado")}
            variant="secondary"
            onPress={() => void onRefreshApproval()}
            disabled={approvalRefreshing}
          />
        ) : null}
        {approvalRefreshError ? (
          <Text style={commonStyles.errorCaption}>{translateText(approvalRefreshError)}</Text>
        ) : null}
      </Card>
      {trackingError || locationError || expirationError ? (
        <Card>
          <Text style={commonStyles.errorText}>{translateText(trackingError ?? locationError ?? expirationError ?? '')}</Text>
          {trackingError || locationError ? (
            <Button
              title={t("Reintentar ubicación")}
              variant="secondary"
              onPress={() => {
                if (available) retryLocation();
                else void onAvailabilityChange(true);
              }}
            />
          ) : null}
        </Card>
      ) : null}
      {!activeRequest ? (
        <Card>
          <Text style={commonStyles.sectionTitle}>{t("Solicitudes de viaje")}</Text>
          <Label muted>{available ? t("Esperando solicitudes asignadas a tu cuenta…") : t("Conéctate para recibir solicitudes.")}</Label>
        </Card>
      ) : (
        <Card>
          <Text style={commonStyles.sectionTitle}>{t("Solicitud recibida")}</Text>
          <Label>{activeRequest.origin.address} → {activeRequest.destination.address}</Label>
          <Label>{t('Tiempo para responder: {seconds} s', { seconds: secondsRemaining })}</Label>
          <Button title={t("Ver solicitud")} onPress={() => router.push('/trip-request')} />
        </Card>
      )}
      <Text style={commonStyles.mutedCentered}>
        {t("La tarifa y el estado de cada solicitud provienen del backend.")}
      </Text>
    </Page>
  );
}
