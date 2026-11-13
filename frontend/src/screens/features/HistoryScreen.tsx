import { useLocalization } from '../../localization/useLocalization';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useIsFocused, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View, type ListRenderItem } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, colors, commonStyles, Label, PageHeading } from '../../components/ui';
import { useDriver } from '../../context/DriverContext';
import { type TripHistoryFilters } from '../../services/api';
import type { PaymentMethod, Trip } from '../../types/domain';
import { spacing } from '../../theme/tokens';
import { formatDateInput } from '../shared/formatters';

type DateFilter = 'today' | 'week' | 'month' | 'range' | 'all';

type PaymentFilter = PaymentMethod | 'all';

function passesDateFilter(
  trip: Trip,
  filter: DateFilter,
  rangeStart: string,
  rangeEnd: string,
): boolean {
  if (filter === 'all') return true;
  const date = trip.completedAt ?? trip.createdAt;
  if (filter === 'range') {
    const start = rangeStart ? new Date(`${rangeStart}T00:00:00`) : null;
    const end = rangeEnd ? new Date(`${rangeEnd}T23:59:59.999`) : null;
    return (!start || date >= start) && (!end || date <= end);
  }
  const now = new Date();
  if (filter === 'today') {
    return date.toDateString() === now.toDateString();
  }
  if (filter === 'month') {
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  weekStart.setHours(0, 0, 0, 0);
  return date >= weekStart;
}

function getHistoryFilters(
  filter: DateFilter,
  paymentFilter: PaymentFilter,
  rangeStart: string,
  rangeEnd: string,
): TripHistoryFilters {
  const filters: TripHistoryFilters = {};
  if (paymentFilter !== 'all') filters.paymentMethod = paymentFilter;
  const now = new Date();
  let start: Date | null = null;
  let end: Date | null = null;
  if (filter === 'today') {
    start = new Date(now);
    start.setHours(0, 0, 0, 0);
    end = new Date(now);
    end.setHours(23, 59, 59, 999);
  } else if (filter === 'week') {
    start = new Date(now);
    start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    start.setHours(0, 0, 0, 0);
    end = new Date(now);
  } else if (filter === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now);
  } else if (filter === 'range') {
    start = rangeStart ? new Date(`${rangeStart}T00:00:00`) : null;
    end = rangeEnd ? new Date(`${rangeEnd}T23:59:59.999`) : null;
  }
  if (start) filters.from = start.toISOString();
  if (end) filters.to = end.toISOString();
  return filters;
}

export function HistoryScreen() {
  const { t, translateText, formatCurrency, formatNumber, formatDate, paymentStatusLabel, locale } = useLocalization();
  const insets = useSafeAreaInsets();
  const { trips, refreshTripHistory } = useDriver();
  const router = useRouter();
  const isFocused = useIsFocused();
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [dateField, setDateField] = useState<'start' | 'end' | null>(null);
  const [pendingDate, setPendingDate] = useState(new Date());
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const nextOffset = useRef(0);
  const hasMore = useRef(true);
  const loadingMoreRequest = useRef(false);
  const loadingMoreRequestId = useRef(0);
  const requestGeneration = useRef(0);
  const historyFilters = useMemo(
    () => getHistoryFilters(dateFilter, paymentFilter, rangeStart, rangeEnd),
    [dateFilter, paymentFilter, rangeEnd, rangeStart],
  );
  const historyFilterKey = JSON.stringify(historyFilters);
  const latestFilterKey = useRef(historyFilterKey);
  const changeHistoryFilters = (change: () => void) => {
    requestGeneration.current += 1;
    latestFilterKey.current = '';
    loadingMoreRequestId.current += 1;
    loadingMoreRequest.current = false;
    setLoadingMore(false);
    setHistoryLoading(true);
    setHistoryError(null);
    change();
  };
  const loadHistory = useCallback(async () => {
    const generation = ++requestGeneration.current;
    const filterKey = historyFilterKey;
    nextOffset.current = 0;
    hasMore.current = true;
    setHistoryLoading(true);
    try {
      const page = await refreshTripHistory({ ...historyFilters, offset: 0, limit: 20 });
      if (generation !== requestGeneration.current || filterKey !== latestFilterKey.current) return;
      nextOffset.current = page.nextOffset;
      hasMore.current = page.hasMore;
      setHistoryError(null);
    } catch (error) {
      if (generation === requestGeneration.current && filterKey === latestFilterKey.current) {
        setHistoryError(error instanceof Error ? error.message : 'No se pudo cargar el historial.');
      }
    } finally {
      if (generation === requestGeneration.current) setHistoryLoading(false);
    }
  }, [historyFilterKey, historyFilters, refreshTripHistory]);
  const loadMoreHistory = useCallback(async () => {
    const generation = requestGeneration.current;
    const filterKey = historyFilterKey;
    if (
      !hasMore.current
      || loadingMoreRequest.current
      || !isFocused
      || filterKey !== latestFilterKey.current
    ) return;
    const requestId = ++loadingMoreRequestId.current;
    loadingMoreRequest.current = true;
    setLoadingMore(true);
    try {
      const page = await refreshTripHistory({
        ...historyFilters,
        offset: nextOffset.current,
        limit: 20,
      });
      if (generation !== requestGeneration.current || filterKey !== latestFilterKey.current) return;
      nextOffset.current = page.nextOffset;
      hasMore.current = page.hasMore;
      setHistoryError(null);
    } catch (error) {
      if (generation === requestGeneration.current && filterKey === latestFilterKey.current) {
        setHistoryError(error instanceof Error ? error.message : 'No se pudo cargar más historial.');
      }
    } finally {
      if (requestId === loadingMoreRequestId.current) {
        loadingMoreRequest.current = false;
        setLoadingMore(false);
      }
    }
  }, [historyFilterKey, historyFilters, isFocused, refreshTripHistory]);
  const openRangeDatePicker = (field: 'start' | 'end') => {
    const value = field === 'start' ? rangeStart : rangeEnd;
    setPendingDate(value ? new Date(`${value}T12:00:00`) : new Date());
    setDateField(field);
  };
  useEffect(() => {
    if (!isFocused) return;
    const generation = ++requestGeneration.current;
    const filterKey = historyFilterKey;
    latestFilterKey.current = filterKey;
    let active = true;
    nextOffset.current = 0;
    hasMore.current = true;
    void refreshTripHistory({ ...historyFilters, offset: 0, limit: 20 })
      .then((page) => {
        if (!active || generation !== requestGeneration.current || filterKey !== latestFilterKey.current) return;
        nextOffset.current = page.nextOffset;
        hasMore.current = page.hasMore;
        setHistoryError(null);
      })
      .catch((error: unknown) => {
        if (active && generation === requestGeneration.current && filterKey === latestFilterKey.current) {
          setHistoryError(error instanceof Error ? error.message : 'No se pudo cargar el historial.');
        }
      })
      .finally(() => {
        if (active && generation === requestGeneration.current) setHistoryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [historyFilterKey, historyFilters, isFocused, refreshTripHistory]);
  const filtered = useMemo(
    () =>
      [...trips]
        .filter((trip) => passesDateFilter(trip, dateFilter, rangeStart, rangeEnd))
        .filter((trip) => paymentFilter === 'all' || trip.paymentMethod === paymentFilter)
        .sort((left, right) => (right.completedAt ?? right.createdAt).getTime() - (left.completedAt ?? left.createdAt).getTime()),
    [dateFilter, paymentFilter, rangeEnd, rangeStart, trips],
  );
  const renderItem: ListRenderItem<Trip> = ({ item }) => (
    <Pressable onPress={() => router.push({ pathname: '/trip-detail', params: { tripId: item.id } })}>
      <Card>
        <View style={commonStyles.spread}>
          <Text style={{ color: colors.ink, fontWeight: '700' }}>{formatDate(item.createdAt, true)}</Text>
          <Text style={commonStyles.emphasisValue}>{formatCurrency(item.driverEarnings)}</Text>
        </View>
        <Label>{item.origin.address} → {item.destination.address}</Label>
        <Label muted>{translateText(item.category)} · {formatNumber(item.distanceKm)} km · {paymentStatusLabel(item.paymentStatus)}</Label>
        <Label muted>{t('Tarifa {fare} · comisión {commission}', { fare: formatCurrency(item.fare), commission: formatCurrency(item.commission) })}</Label>
      </Card>
    </Pressable>
  );
  return (
    <View style={commonStyles.historyPage}>
    <View style={commonStyles.historyHeader}>
        <PageHeading title={t("Historial")} subtitle={t("Hasta 100 viajes recientes, con filtros por fecha y pago.")} />
        {historyError ? (
          <Card>
            <Label>{translateText(historyError)}</Label>
            <Button title={t("Reintentar")} variant="secondary" onPress={() => void loadHistory()} />
          </Card>
        ) : null}
        {historyLoading ? <Label muted>{t("Cargando historial…")}</Label> : null}
        <View style={commonStyles.chipRow}>
          {(['today', 'week', 'month', 'range', 'all'] as const).map((filter) => (
            <Pressable
              key={filter}
              onPress={() => changeHistoryFilters(() => setDateFilter(filter))}
              style={[
                commonStyles.chip,
                commonStyles.historyChip,
                dateFilter === filter ? commonStyles.chipSelected : null,
              ]}
            >
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                style={[
                  commonStyles.chipText,
                  dateFilter === filter ? commonStyles.chipTextSelected : null,
                ]}
              >
                {{ today: t("Hoy"), week: t("Semana"), month: t("Mes"), range: t("Rango"), all: t("Todos") }[filter]}
              </Text>
            </Pressable>
          ))}
        </View>
        {dateFilter === 'range' ? (
          <View style={commonStyles.row}>
            <View style={{ flex: 1 }}>
              <Button
                title={rangeStart ? t('Desde {date}', { date: formatDate(new Date(`${rangeStart}T12:00:00`)) }) : t("Fecha inicial")}
                variant="secondary"
                onPress={() => openRangeDatePicker('start')}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title={rangeEnd ? t('Hasta {date}', { date: formatDate(new Date(`${rangeEnd}T12:00:00`)) }) : t("Fecha final")}
                variant="secondary"
                onPress={() => openRangeDatePicker('end')}
              />
            </View>
          </View>
        ) : null}
        {dateField ? (
          <Card style={commonStyles.datePickerCard}>
            <DateTimePicker
              locale={locale}
              value={pendingDate}
              mode="date"
              maximumDate={new Date()}
              onValueChange={(_, selectedDate) => {
                const field = dateField;
                setDateField(null);
                changeHistoryFilters(() => {
                  if (field === 'start') setRangeStart(formatDateInput(selectedDate));
                  else setRangeEnd(formatDateInput(selectedDate));
                });
              }}
              onDismiss={() => setDateField(null)}
            />
          </Card>
        ) : null}
        <View style={commonStyles.chipRow}>
          {(['all', 'cash', 'mercadopago', 'stripe'] as const).map((filter) => (
            <Pressable
              key={filter}
              onPress={() => changeHistoryFilters(() => setPaymentFilter(filter))}
              style={[
                commonStyles.chip,
                commonStyles.paymentChip,
                commonStyles.historyChip,
                paymentFilter === filter ? commonStyles.paymentChipSelected : null,
              ]}
            >
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                style={[
                  commonStyles.chipText,
                  paymentFilter === filter ? commonStyles.paymentChipTextSelected : null,
                ]}
              >
                {{ all: t("Todos los pagos"), cash: t("Efectivo"), mercadopago: t("Mercado Pago"), stripe: t("Stripe") }[filter]}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        onEndReached={() => void loadMoreHistory()}
        onEndReachedThreshold={0.4}
        contentContainerStyle={[
          commonStyles.historyList,
          { paddingBottom: spacing.pageBottom + insets.bottom },
        ]}
        ListEmptyComponent={
          <View style={commonStyles.emptyState}>
            <Text style={commonStyles.mutedCentered}>{t("No hay viajes para los filtros seleccionados.")}</Text>
          </View>
        }
        ListFooterComponent={loadingMore ? <Label muted>{t("Cargando más viajes…")}</Label> : undefined}
      />
    </View>
  );
}
