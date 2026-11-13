import { useLocalization } from '../../localization/useLocalization';
import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Card, commonStyles, Label, Page, PageHeading } from '../../components/ui';
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
  const { t, translateText, formatCurrency, formatNumber } = useLocalization();
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
          setHistoryError(error instanceof Error ? error.message : "No se pudieron cargar las ganancias.");
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
      <PageHeading title={t("Ganancias")} subtitle={t("Resumen basado en tus viajes pagados.")} />
      {loading ? <Label muted>{t("Cargando historial de pagos…")}</Label> : null}
      {historyError ? (
        <Card>
          <Label>{translateText(historyError)}</Label>
          <Button
            title={t("Reintentar")}
            variant="secondary"
            onPress={() => void refreshEarningsSummary().catch((error: unknown) => {
              setHistoryError(error instanceof Error ? error.message : "No se pudieron cargar las ganancias.");
            })}
          />
        </Card>
      ) : null}
      <Card style={commonStyles.balanceCard}>
        <Text style={commonStyles.balanceCaption}>{t("Saldo del conductor")}</Text>
        <Text style={commonStyles.balanceValue}>{formatCurrency(balance)}</Text>
        <Text style={commonStyles.balanceCaption}>{t("Pagos digitales netos menos comisión de viajes en efectivo.")}</Text>
      </Card>
      {[
        [t("Hoy"), today],
        [t("Esta semana"), week],
        [t("Este mes"), month],
      ].map(([label, stats]) => {
        const period = stats as typeof today;
        return (
          <View key={label as string} style={{ gap: 8 }}>
            <Text style={commonStyles.sectionTitle}>{label as string}</Text>
            <View style={commonStyles.row}>
              <MetricCard title={t("Viajes")} value={formatNumber(period.trips)} caption={t("pagados")} />
              <MetricCard title={t("Ganancia neta")} value={formatCurrency(period.net)} caption={t('Promedio {amount}', { amount: formatCurrency(period.average) })} />
            </View>
            <Card>
              <View style={commonStyles.spread}><Label>{t("Total facturado")}</Label><Label>{formatCurrency(period.fare)}</Label></View>
              <View style={commonStyles.spread}><Label>{t("Comisiones")}</Label><Label>{formatCurrency(period.commission)}</Label></View>
              <View style={commonStyles.spread}><Label>{t("Propinas")}</Label><Label>{formatCurrency(period.tips)}</Label></View>
            </Card>
          </View>
        );
      })}
    </Page>
  );
}
