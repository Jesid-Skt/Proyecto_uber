import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Card, commonStyles, Label, Page, PageHeading } from '../../components/ui';
import { formatCop } from '../../config/pricing';
import { useDriver } from '../../context/DriverContext';
import { useEarnings } from '../../hooks/useEarnings';

function MetricCard({ title, value, caption }: { title: string; value: string; caption: string }) {
  return (
    <Card style={{ flex: 1 }}>
      <Label muted>{title}</Label>
      <Text style={commonStyles.statValue}>{value}</Text>
      <Label muted>{caption}</Label>
    </Card>
  );
}

export function EarningsScreen() {
  const { trips, earningsSummary, refreshEarningsSummary } = useDriver();
  const isFocused = useIsFocused();
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { today, week, month, balance } = useEarnings(trips, earningsSummary);
  useEffect(() => {
    if (!isFocused) return;
    let active = true;
    void refreshEarningsSummary()
      .then(() => {
        if (active) setHistoryError(null);
      })
      .catch((error: unknown) => {
        if (active) {
          setHistoryError(error instanceof Error ? error.message : 'No se pudieron cargar las ganancias.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isFocused, refreshEarningsSummary]);
  return (
    <Page>
      <PageHeading title="Ganancias" subtitle="Resumen basado en tus viajes pagados." />
      {loading ? <Label muted>Cargando historial de pagos…</Label> : null}
      {historyError ? (
        <Card>
          <Label>{historyError}</Label>
          <Button
            title="Reintentar"
            variant="secondary"
            onPress={() => void refreshEarningsSummary().catch((error: unknown) => {
              setHistoryError(error instanceof Error ? error.message : 'No se pudieron cargar las ganancias.');
            })}
          />
        </Card>
      ) : null}
      <Card style={commonStyles.balanceCard}>
        <Text style={commonStyles.balanceCaption}>Saldo del conductor</Text>
        <Text style={commonStyles.balanceValue}>{formatCop(balance)}</Text>
        <Text style={commonStyles.balanceCaption}>Pagos digitales netos menos comisión de viajes en efectivo.</Text>
      </Card>
      {[
        ['Hoy', today],
        ['Esta semana', week],
        ['Este mes', month],
      ].map(([label, stats]) => {
        const period = stats as typeof today;
        return (
          <View key={label as string} style={{ gap: 8 }}>
            <Text style={commonStyles.sectionTitle}>{label as string}</Text>
            <View style={commonStyles.row}>
              <MetricCard title="Viajes" value={String(period.trips)} caption="pagados" />
              <MetricCard title="Ganancia neta" value={formatCop(period.net)} caption={`Promedio ${formatCop(period.average)}`} />
            </View>
            <Card>
              <View style={commonStyles.spread}><Label>Total facturado</Label><Label>{formatCop(period.fare)}</Label></View>
              <View style={commonStyles.spread}><Label>Comisiones</Label><Label>{formatCop(period.commission)}</Label></View>
              <View style={commonStyles.spread}><Label>Propinas</Label><Label>{formatCop(period.tips)}</Label></View>
            </Card>
          </View>
        );
      })}
    </Page>
  );
}
