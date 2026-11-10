import { useIsFocused, usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Button, Card, colors, commonStyles, Label, Page, PageHeading } from '../../components/ui';
import { useDriver } from '../../context/DriverContext';
import { useDriverLocation } from '../../hooks/useDriverLocation';
import { useTripRequests } from '../../hooks/useTripRequests';

export function HomeScreen() {
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
    void setAvailable(false).catch((error: unknown) => {
      setLocationError(error instanceof Error ? error.message : 'No se pudo desconectar.');
    });
  }, [setAvailable]);
  const reportLocation = useCallback(async (location: { lat: number; lng: number }) => {
    await updateLocation(location);
    setLocationError(null);
  }, [updateLocation]);
  const { mapRegion, error: trackingError } = useDriverLocation(
    available && isFocused,
    onPermissionDenied,
    reportLocation,
  );
  const { secondsRemaining, expirationError } = useTripRequests();
  const accountApproved = profile?.approvalStatus === 'approved';
  const approvalLabel = profile?.approvalStatus === 'approved'
    ? 'Cuenta aprobada'
    : profile?.approvalStatus === 'rejected'
      ? 'Solicitud rechazada'
      : 'Pendiente de aprobación';

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
          setLocationError(error instanceof Error ? error.message : 'No se pudieron consultar solicitudes.');
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
      setLocationError(error instanceof Error ? error.message : 'No se pudo cambiar la disponibilidad.');
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
        error instanceof Error ? error.message : 'No se pudo actualizar el estado de aprobación.',
      );
    } finally {
      setApprovalRefreshing(false);
    }
  }, [refreshProfile]);

  return (
    <Page>
      <View style={commonStyles.spread}>
        <PageHeading title="Hola, conductor" subtitle={profile?.fullName ?? ''} />
        <View style={commonStyles.centered}>
          <Text style={available ? commonStyles.statusActive : commonStyles.statusInactive}>
            {available ? 'DISPONIBLE' : 'DESCONECTADO'}
          </Text>
          <Switch
            accessibilityLabel="Disponibilidad del conductor"
            value={available}
            onValueChange={(value) => void onAvailabilityChange(value)}
            disabled={!accountApproved || availabilityLoading}
            trackColor={{ true: colors.accent }}
          />
          {availabilityLoading ? <Label muted>Actualizando…</Label> : null}
        </View>
      </View>
      <Card style={commonStyles.mapCard}>
        <MapView style={commonStyles.homeMap} region={mapRegion} showsUserLocation={available}>
          <Marker coordinate={mapRegion} title="Tu ubicación" />
          {activeRequest ? (
            <>
              <Marker
                coordinate={{ latitude: activeRequest.origin.lat, longitude: activeRequest.origin.lng }}
                title="Punto de recogida"
                pinColor={colors.accent}
              />
              <Marker
                coordinate={{ latitude: activeRequest.destination.lat, longitude: activeRequest.destination.lng }}
                title="Destino"
                pinColor={colors.navy}
              />
            </>
          ) : null}
        </MapView>
      </Card>
      <Card>
        <Text style={commonStyles.sectionTitle}>Estado de cuenta</Text>
        <Text style={profile?.approvalStatus === 'approved' ? commonStyles.statusActive : commonStyles.statusInactive}>
          {approvalLabel}
        </Text>
        <Label muted>
          {accountApproved
            ? 'La disponibilidad se guarda en el servidor.'
            : profile?.approvalStatus === 'rejected'
              ? 'La cuenta debe estar aprobada para activar la disponibilidad.'
              : 'Un administrador debe aprobar tu perfil para activar la disponibilidad.'}
        </Label>
        {!accountApproved ? (
          <Button
            title={approvalRefreshing ? 'Actualizando estado…' : 'Actualizar estado'}
            variant="secondary"
            onPress={() => void onRefreshApproval()}
            disabled={approvalRefreshing}
          />
        ) : null}
        {approvalRefreshError ? (
          <Text style={commonStyles.errorCaption}>{approvalRefreshError}</Text>
        ) : null}
      </Card>
      {trackingError || locationError || expirationError ? (
        <Card>
          <Text style={commonStyles.errorText}>{trackingError ?? locationError ?? expirationError}</Text>
        </Card>
      ) : null}
      {!activeRequest ? (
        <Card>
          <Text style={commonStyles.sectionTitle}>Solicitudes de viaje</Text>
          <Label muted>{available ? 'Esperando solicitudes asignadas a tu cuenta…' : 'Conéctate para recibir solicitudes.'}</Label>
        </Card>
      ) : (
        <Card>
          <Text style={commonStyles.sectionTitle}>Solicitud recibida</Text>
          <Label>{activeRequest.origin.address} → {activeRequest.destination.address}</Label>
          <Label>Tiempo para responder: {secondsRemaining} s</Label>
          <Button title="Ver solicitud" onPress={() => router.push('/trip-request')} />
        </Card>
      )}
      <Text style={commonStyles.mutedCentered}>
        La tarifa y el estado de cada solicitud provienen del backend.
      </Text>
    </Page>
  );
}
