import { useLocalization } from '../../localization/useLocalization';
// AI-assisted: see docs/AI_LOG.md #1, #3, #7, and #10.
import { Redirect } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import React from 'react';
import { Platform } from 'react-native';
import { FloatingMenuButton } from '../../components/FloatingMenuButton';
import { tripPalette } from '../../components/trip-flow-theme';
import { useDriver } from '../../context/DriverContext';

export default function DrawerLayout() {
  const { t } = useLocalization();
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
      <Drawer.Screen name="home" options={{ title: t("Conducir"), drawerLabel: t("Inicio") }} />
      <Drawer.Screen name="history" options={{ title: t("Historial"), drawerLabel: t("Historial") }} />
      <Drawer.Screen name="earnings" options={{ title: t("Ganancias"), drawerLabel: t("Ganancias") }} />
      <Drawer.Screen
        name="current-trip"
        options={{ title: t("Viaje activo"), drawerLabel: t("Viaje activo") }}
      />
      <Drawer.Screen name="profile" options={{ title: t("Perfil y ajustes"), drawerLabel: t("Perfil") }} />
      <Drawer.Screen name="settings" options={{ title: t("Configuración"), drawerLabel: t("Configuración") }} />
    </Drawer>
  );
}
