import DateTimePicker from '@react-native-community/datetimepicker';
import { useIsFocused, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View, type ListRenderItem } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, colors, commonStyles, Label, PageHeading } from '../../components/ui';
import { formatCop } from '../../config/pricing';
import { useDriver } from '../../context/DriverContext';
import { type TripHistoryFilters } from '../../services/api';
import type { PaymentMethod, Trip } from '../../types/domain';
import { spacing } from '../../theme/tokens';
import { formatDate, formatDateInput } from '../shared/formatters';

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
  const historyFilters = useMemo(
    () => getHistoryFilters(dateFilter, paymentFilter, rangeStart, rangeEnd),
    [dateFilter, paymentFilter, rangeEnd, rangeStart],
  );
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      await refreshTripHistory(historyFilters);
      setHistoryError(null);
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : 'No se pudo cargar el historial.');
    } finally {
      setHistoryLoading(false);
    }
  }, [historyFilters, refreshTripHistory]);
  const openRangeDatePicker = (field: 'start' | 'end') => {
    const value = field === 'start' ? rangeStart : rangeEnd;
    setPendingDate(value ? new Date(`${value}T12:00:00`) : new Date());
    setDateField(field);
  };
  useEffect(() => {
    if (!isFocused) return;
    let active = true;
    void refreshTripHistory(historyFilters)
      .then(() => {
        if (active) setHistoryError(null);
      })
      .catch((error: unknown) => {
        if (active) setHistoryError(error instanceof Error ? error.message : 'No se pudo cargar el historial.');
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [historyFilters, isFocused, refreshTripHistory]);
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
          <Text style={commonStyles.emphasisValue}>{formatCop(item.driverEarnings)}</Text>
        </View>
        <Label>{item.origin.address} → {item.destination.address}</Label>
        <Label muted>{item.category} · {item.distanceKm} km · {item.paymentStatus}</Label>
        <Label muted>Tarifa {formatCop(item.fare)} · comisión {formatCop(item.commission)}</Label>
      </Card>
    </Pressable>
  );
  return (
    <View style={commonStyles.historyPage}>
    <View style={commonStyles.historyHeader}>
        <PageHeading title="Historial" subtitle="Hasta 100 viajes recientes, con filtros por fecha y pago." />
        {historyError ? (
          <Card>
            <Label>{historyError}</Label>
            <Button title="Reintentar" variant="secondary" onPress={() => void loadHistory()} />
          </Card>
        ) : null}
        {historyLoading ? <Label muted>Cargando historial…</Label> : null}
        <View style={commonStyles.chipRow}>
          {(['today', 'week', 'month', 'range', 'all'] as const).map((filter) => (
            <Pressable
              key={filter}
              onPress={() => setDateFilter(filter)}
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
                {{ today: 'Hoy', week: 'Semana', month: 'Mes', range: 'Rango', all: 'Todos' }[filter]}
              </Text>
            </Pressable>
          ))}
        </View>
        {dateFilter === 'range' ? (
          <View style={commonStyles.row}>
            <View style={{ flex: 1 }}>
              <Button
                title={rangeStart ? `Desde ${rangeStart}` : 'Fecha inicial'}
                variant="secondary"
                onPress={() => openRangeDatePicker('start')}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title={rangeEnd ? `Hasta ${rangeEnd}` : 'Fecha final'}
                variant="secondary"
                onPress={() => openRangeDatePicker('end')}
              />
            </View>
          </View>
        ) : null}
        {dateField ? (
          <Card style={commonStyles.datePickerCard}>
            <DateTimePicker
              value={pendingDate}
              mode="date"
              maximumDate={new Date()}
              onValueChange={(_, selectedDate) => {
                const field = dateField;
                setDateField(null);
                if (field === 'start') setRangeStart(formatDateInput(selectedDate));
                else setRangeEnd(formatDateInput(selectedDate));
              }}
              onDismiss={() => setDateField(null)}
            />
          </Card>
        ) : null}
        <View style={commonStyles.chipRow}>
          {(['all', 'cash', 'mercadopago', 'stripe'] as const).map((filter) => (
            <Pressable
              key={filter}
              onPress={() => setPaymentFilter(filter)}
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
                {{ all: 'Todos los pagos', cash: 'Efectivo', mercadopago: 'Mercado Pago', stripe: 'Stripe' }[filter]}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          commonStyles.historyList,
          { paddingBottom: spacing.pageBottom + insets.bottom },
        ]}
        ListEmptyComponent={
          <View style={commonStyles.emptyState}>
            <Text style={commonStyles.mutedCentered}>No hay viajes para los filtros seleccionados.</Text>
          </View>
        }
      />
    </View>
  );
}
