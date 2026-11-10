import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Card, commonStyles, Label, Page, PageHeading } from '../../components/ui';
import { formatCop } from '../../config/pricing';
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
  const { activeTrip } = useDriver();
  const router = useRouter();
  if (!activeTrip) {
    return (
      <Page>
        <PageHeading title="No hay un viaje activo" subtitle="Cuando aceptes una solicitud, podrás continuar aquí el flujo del viaje." />
        <Button title="Volver al inicio" onPress={() => router.replace('/home')} />
      </Page>
    );
  }
  if (activeTrip.status === 'completed') return <Redirect href="/trip-payment" />;
  if (activeTrip.status === 'paid') return <Redirect href="/trip-summary" />;
  if (activeTrip.status === 'in_progress') return <Redirect href="/trip-active" />;
  return <Redirect href="/trip-pickup" />;
}

export function TripRequestMenuScreen() {
  const { activeRequest } = useDriver();
  const router = useRouter();
  if (!activeRequest) {
    return (
      <Page>
        <PageHeading title="No hay solicitudes pendientes" subtitle="Las nuevas solicitudes aparecerán aquí cuando estés disponible." />
        <Button title="Volver al inicio" onPress={() => router.replace('/home')} />
      </Page>
    );
  }
  return <Redirect href="/trip-request" />;
}

export function TripRequestScreen() {
  const router = useRouter();
  const { activeRequest, acceptRequest, rejectRequest } = useDriver();
  const { secondsRemaining, expirationError } = useTripRequests();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    setLoading(true);
    setError(null);
    try {
      await acceptRequest();
      router.replace('/trip-pickup');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo aceptar la solicitud.');
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
      setError(requestError instanceof Error ? requestError.message : 'No se pudo rechazar la solicitud.');
    } finally {
      setLoading(false);
    }
  };

  if (!activeRequest) {
    return (
      <Page>
        <PageHeading title="Solicitud no disponible" subtitle="Pudo vencer o ya fue respondida." />
        {expirationError ? <Card><Text style={commonStyles.errorText}>{expirationError}</Text></Card> : null}
        <Button title="Volver al inicio" onPress={() => router.replace('/home')} />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeading title="Nueva solicitud" subtitle="Responde antes de que termine el tiempo." />
      <Card>
        <View style={commonStyles.spread}>
          <Text style={commonStyles.sectionTitle}>Tiempo restante</Text>
          <Text style={[
            commonStyles.countdown,
            secondsRemaining <= 5 ? commonStyles.countdownCritical : null,
          ]}>
            00:{String(secondsRemaining).padStart(2, '0')}
          </Text>
        </View>
        <Label>Origen: {activeRequest.origin.address}</Label>
        <Label>Destino: {activeRequest.destination.address}</Label>
        <Label>{activeRequest.distanceKm} km · {activeRequest.durationMin} min</Label>
        <Label>Categoría: {activeRequest.category}</Label>
        <Label>Pago: {paymentMethodLabel(activeRequest.paymentMethod)}</Label>
        <View style={commonStyles.spread}>
          <Label>Tarifa estimada</Label>
          <Label>{formatCop(activeRequest.fare)}</Label>
        </View>
        <View style={commonStyles.spread}>
          <Label>Ganancia estimada</Label>
          <Text style={commonStyles.emphasisValue}>{formatCop(activeRequest.driverEarnings)}</Text>
        </View>
      </Card>
      {error ? <Card><Text style={commonStyles.errorText}>{error}</Text></Card> : null}
      <View style={commonStyles.row}>
        <View style={{ flex: 1 }}>
          <Button title={loading ? 'Procesando…' : 'Rechazar'} variant="secondary" onPress={() => void reject()} disabled={loading} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title={loading ? 'Procesando…' : 'Aceptar'} onPress={() => void accept()} disabled={loading || secondsRemaining === 0} />
        </View>
      </View>
      <Label muted>La respuesta se confirma con el backend antes de cambiar de pantalla.</Label>
    </Page>
  );
}
