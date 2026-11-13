import { useLocalization } from '../localization/useLocalization';
// AI-assisted: see docs/AI_LOG.md #1 and #10.
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { FloatingMenuButton } from '../components/FloatingMenuButton';
import { tripPalette } from '../components/trip-flow-theme';
import { DriverProvider } from '../context/DriverContext';
import { colors } from '../components/ui';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <DriverProvider>
          <RootNavigator />
        </DriverProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const { t } = useLocalization();
  const router = useRouter();
  const flowMenu = () => (
    <FloatingMenuButton label={t("Volver al inicio")} onPress={() => router.replace('/home')} />
  );
  return (
    <>
      {Platform.OS === 'ios' ? null : <StatusBar style="light" />}
      <Stack screenOptions={{
        contentStyle: { backgroundColor: colors.background },
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.ink,
        headerTitleStyle: { color: colors.ink },
        ...(Platform.OS === 'ios' ? {} : { statusBarStyle: 'light' as const }),
      }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
        <Stack.Screen name="trip-flow" options={{ title: t("Viaje en curso") }} />
        <Stack.Screen
          name="trip-pickup"
          options={{
            title: t("Camino a recoger"),
            headerLeft: flowMenu,
            headerBackTitle: '',
            headerStyle: { backgroundColor: tripPalette.background },
            headerTintColor: tripPalette.text,
            headerTitleStyle: { color: tripPalette.text },
          }}
        />
        <Stack.Screen
          name="trip-active"
          options={{
            title: t("Viaje en curso"),
            headerTransparent: true,
            headerStyle: { backgroundColor: 'transparent' },
            headerTintColor: tripPalette.text,
            headerTitleStyle: { color: tripPalette.text },
            headerLeft: flowMenu,
            headerBackTitle: '',
          }}
        />
        <Stack.Screen
          name="trip-payment"
          options={{
            title: t("Cobro del viaje"),
            headerLeft: flowMenu,
            headerBackTitle: '',
            headerStyle: { backgroundColor: tripPalette.background },
            headerTintColor: tripPalette.text,
            headerTitleStyle: { color: tripPalette.text },
          }}
        />
        <Stack.Screen
          name="trip-request"
          options={{
            title: t("Solicitud de viaje"),
            presentation: 'modal',
            headerLeft: flowMenu,
            headerBackTitle: '',
            headerStyle: { backgroundColor: tripPalette.background },
            headerTintColor: tripPalette.text,
            headerTitleStyle: { color: tripPalette.text },
          }}
        />
        <Stack.Screen name="trip-summary" options={{ title: t("Resumen del viaje") }} />
        <Stack.Screen name="trip-detail" options={{ title: t("Detalle del viaje") }} />
      </Stack>
    </>
  );
}
