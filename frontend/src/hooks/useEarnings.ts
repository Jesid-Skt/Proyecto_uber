// AI-assisted: see docs/AI_LOG.md #1.
import { useEffect, useMemo, useState } from 'react';
import type { EarningsPeriod, EarningsSummary } from '../services/api';
import type { Trip } from '../types/domain';

export type { EarningsPeriod };

function isSameDay(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate();
}

function isSameWeek(date: Date, now: Date): boolean {
  const startOfWeek = new Date(now);
  const weekday = (startOfWeek.getDay() + 6) % 7;
  startOfWeek.setDate(startOfWeek.getDate() - weekday);
  startOfWeek.setHours(0, 0, 0, 0);
  return date >= startOfWeek;
}

export function useEarnings(trips: Trip[], completeSummary?: EarningsSummary | null) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timerId = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timerId);
  }, []);

  return useMemo(() => {
    const paidTrips = trips.filter(
      (trip) => trip.status === 'paid'
        && (trip.paymentStatus === 'approved' || trip.paymentStatus === 'cash'),
    );
    const summarize = (items: Trip[]): EarningsPeriod => {
      const fare = items.reduce((sum, trip) => sum + trip.fare, 0);
      const commission = items.reduce((sum, trip) => sum + trip.commission, 0);
      const tips = items.reduce((sum, trip) => sum + trip.tip, 0);
      const net = items.reduce((sum, trip) => sum + trip.driverEarnings, 0);
      return {
        trips: items.length,
        fare,
        commission,
        tips,
        net,
        average: items.length ? Math.round(net / items.length) : 0,
      };
    };

    const localSummary: EarningsSummary = {
      today: summarize(
        paidTrips.filter((trip) => isSameDay(trip.completedAt ?? trip.createdAt, now)),
      ),
      week: summarize(
        paidTrips.filter((trip) => isSameWeek(trip.completedAt ?? trip.createdAt, now)),
      ),
      month: summarize(
        paidTrips.filter((trip) => {
          const date = trip.completedAt ?? trip.createdAt;
          return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
        }),
      ),
      balance: paidTrips.reduce(
        (sum, trip) =>
          sum +
          (trip.paymentMethod === 'cash'
            ? -trip.commission
            : trip.driverEarnings),
        0,
      ),
    };
    return completeSummary ?? localSummary;
  }, [completeSummary, trips, now]);
}
