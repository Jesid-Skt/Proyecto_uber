// AI-assisted: see docs/AI_LOG.md #1.
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { FloatingMenuButton } from '../components/FloatingMenuButton';
import { tripPalette } from '../components/trip-flow-theme';
import { DriverProvider } from '../context/DriverContext';
import { colors } from '../components/ui';

export default function RootLayout() {
  const router = useRouter();
  const flowMenu = () => (
    <FloatingMenuButton label="Volver al inicio" onPress={() => router.replace('/home')} />
  );
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <DriverProvider>
          <StatusBar style="light" />
          <Stack screenOptions={{
            contentStyle: { backgroundColor: colors.background },
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.ink,
            headerTitleStyle: { color: colors.ink },
          }}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
            <Stack.Screen name="trip-flow" options={{ title: 'Viaje en curso' }} />
            <Stack.Screen
              name="trip-pickup"
              options={{
                title: 'Camino a recoger',
                headerLeft: flowMenu,
                headerBackTitle: '',
                headerStyle: { backgroundColor: tripPalette.background },
                headerTintColor: tripPalette.text,
                headerTitleStyle: { color: tripPalette.text },
                statusBarStyle: 'light',
              }}
            />
            <Stack.Screen
              name="trip-active"
              options={{
                title: 'Viaje en curso',
                headerTransparent: true,
                headerStyle: { backgroundColor: 'transparent' },
                headerTintColor: tripPalette.text,
                headerTitleStyle: { color: tripPalette.text },
                statusBarStyle: 'light',
                headerLeft: flowMenu,
                headerBackTitle: '',
              }}
            />
            <Stack.Screen
              name="trip-payment"
              options={{
                title: 'Cobro del viaje',
                headerLeft: flowMenu,
                headerBackTitle: '',
                headerStyle: { backgroundColor: tripPalette.background },
                headerTintColor: tripPalette.text,
                headerTitleStyle: { color: tripPalette.text },
                statusBarStyle: 'light',
              }}
            />
            <Stack.Screen
              name="trip-request"
              options={{
                title: 'Solicitud de viaje',
                presentation: 'modal',
                headerLeft: flowMenu,
                headerBackTitle: '',
                headerStyle: { backgroundColor: tripPalette.background },
                headerTintColor: tripPalette.text,
                headerTitleStyle: { color: tripPalette.text },
                statusBarStyle: 'light',
              }}
            />
            <Stack.Screen name="trip-summary" options={{ title: 'Resumen del viaje' }} />
            <Stack.Screen name="trip-detail" options={{ title: 'Detalle del viaje' }} />
          </Stack>
        </DriverProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
