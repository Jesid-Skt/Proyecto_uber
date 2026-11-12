// AI-assisted: see docs/AI_LOG.md #1, #3, #7, and #10.
import { Redirect } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import React from 'react';
import { Platform } from 'react-native';
import { FloatingMenuButton } from '../../components/FloatingMenuButton';
import { tripPalette } from '../../components/trip-flow-theme';
import { useDriver } from '../../context/DriverContext';

export default function DrawerLayout() {
  const { profile, sessionLoading } = useDriver();
  if (sessionLoading) return null;
  if (!profile) return <Redirect href="/login" />;
  return (
    <Drawer screenOptions={({ navigation }) => ({
      headerStyle: { backgroundColor: tripPalette.background },
      headerTintColor: tripPalette.text,
      headerTitleStyle: { color: tripPalette.text, fontWeight: '700' },
      ...(Platform.OS === 'ios' ? {} : { statusBarStyle: 'light' as const }),
      headerLeft: () => (
        <FloatingMenuButton onPress={() => navigation.toggleDrawer()} />
      ),
      headerLeftContainerStyle: { paddingLeft: 12 },
      drawerStyle: { backgroundColor: tripPalette.background },
      drawerContentStyle: { backgroundColor: tripPalette.background },
      drawerActiveTintColor: tripPalette.accent,
      drawerActiveBackgroundColor: 'rgba(16,185,129,0.14)',
      drawerInactiveTintColor: tripPalette.muted,
      drawerLabelStyle: { fontWeight: '600' },
      sceneStyle: { backgroundColor: tripPalette.background },
    })}>
      <Drawer.Screen name="home" options={{ title: 'Conducir', drawerLabel: 'Inicio' }} />
      <Drawer.Screen name="history" options={{ title: 'Historial', drawerLabel: 'Historial' }} />
      <Drawer.Screen name="earnings" options={{ title: 'Ganancias', drawerLabel: 'Ganancias' }} />
      <Drawer.Screen
        name="current-trip"
        options={{ title: 'Viaje activo', drawerLabel: 'Viaje activo' }}
      />
      <Drawer.Screen name="profile" options={{ title: 'Perfil y ajustes', drawerLabel: 'Perfil' }} />
      <Drawer.Screen name="settings" options={{ title: 'Configuración', drawerLabel: 'Configuración' }} />
    </Drawer>
  );
}
