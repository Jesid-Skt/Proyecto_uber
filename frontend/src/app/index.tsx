// AI-assisted: see docs/AI_LOG.md #1.
import { Redirect } from 'expo-router';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { colors } from '../components/ui';
import { useDriver } from '../context/DriverContext';

export default function IndexRoute() {
  const { profile, activeTrip, sessionLoading, sessionError } = useDriver();
  if (sessionLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (profile && activeTrip?.status === 'completed') return <Redirect href="/trip-payment" />;
  if (profile && activeTrip?.status === 'paid') return <Redirect href="/trip-summary" />;
  if (profile && activeTrip?.status === 'in_progress') return <Redirect href="/trip-active" />;
  if (profile && activeTrip) return <Redirect href="/trip-pickup" />;
  if (profile) return <Redirect href="/home" />;
  if (sessionError) return <Redirect href="/login" />;
  return <Redirect href="/login" />;
}
