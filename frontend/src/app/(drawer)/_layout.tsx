// AI-assisted: see docs/AI_LOG.md #1 and #3.
import { Redirect } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import React from 'react';
import { colors } from '../../components/ui';
import { useDriver } from '../../context/DriverContext';

export default function DrawerLayout() {
  const { profile, sessionLoading } = useDriver();
  if (sessionLoading) return null;
  if (!profile) return <Redirect href="/login" />;
  return (
    <Drawer screenOptions={{
      headerStyle: { backgroundColor: colors.surface },
      headerTintColor: colors.ink,
      headerTitleStyle: { color: colors.ink },
      drawerStyle: { backgroundColor: colors.background },
      drawerContentStyle: { backgroundColor: colors.background },
      drawerActiveTintColor: colors.onAccent,
      drawerActiveBackgroundColor: colors.accent,
      drawerInactiveTintColor: colors.muted,
      drawerLabelStyle: { fontWeight: '600' },
    }}>
      <Drawer.Screen name="home" options={{ title: 'Conducir', drawerLabel: 'Inicio' }} />
      <Drawer.Screen name="history" options={{ title: 'Historial', drawerLabel: 'Historial' }} />
      <Drawer.Screen name="earnings" options={{ title: 'Ganancias', drawerLabel: 'Ganancias' }} />
      <Drawer.Screen
        name="trip-request"
        options={{ title: 'Solicitud de viaje', drawerLabel: 'Solicitud de viaje' }}
      />
      <Drawer.Screen
        name="current-trip"
        options={{ title: 'Viaje activo', drawerLabel: 'Viaje activo' }}
      />
      <Drawer.Screen name="profile" options={{ title: 'Perfil y ajustes', drawerLabel: 'Perfil' }} />
      <Drawer.Screen name="settings" options={{ title: 'Configuración', drawerLabel: 'Configuración' }} />
    </Drawer>
  );
}
