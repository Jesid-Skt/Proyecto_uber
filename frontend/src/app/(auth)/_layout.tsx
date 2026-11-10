// AI-assisted: see docs/AI_LOG.md #1.
import { Stack, Redirect } from 'expo-router';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { colors } from '../../components/ui';
import { useDriver } from '../../context/DriverContext';

export default function AuthLayout() {
  const { profile, sessionLoading } = useDriver();
  if (sessionLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (profile) return <Redirect href="/home" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
