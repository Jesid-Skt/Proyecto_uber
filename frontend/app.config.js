// AI-assisted: see docs/AI_LOG.md #1 and #3.
const fs = require('node:fs');
const path = require('node:path');

module.exports = ({ config }) => {
  const plugins = [...(config.plugins ?? [])];
  if (!plugins.includes('expo-secure-store')) {
    plugins.push('expo-secure-store');
  }
  const mapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
  const googleServicesJson = process.env.GOOGLE_SERVICES_JSON
    ? path.resolve(__dirname, process.env.GOOGLE_SERVICES_JSON)
    : path.join(__dirname, 'google-services.json');
  const googleServicesPlist = process.env.GOOGLE_SERVICES_PLIST
    ? path.resolve(__dirname, process.env.GOOGLE_SERVICES_PLIST)
    : path.join(__dirname, 'GoogleService-Info.plist');

  if (mapsApiKey) {
    plugins.push([
      'react-native-maps',
      {
        androidGoogleMapsApiKey: mapsApiKey,
        iosGoogleMapsApiKey: mapsApiKey,
      },
    ]);
  }

  const appConfig = { ...config, plugins };
  const android = { ...(config.android ?? {}) };
  const ios = { ...(config.ios ?? {}) };
  const hasAndroidFirebaseConfig = fs.existsSync(googleServicesJson);
  const hasIosFirebaseConfig = fs.existsSync(googleServicesPlist);
  if (hasAndroidFirebaseConfig !== hasIosFirebaseConfig) {
    throw new Error('Para activar FCM, configura tanto google-services.json como GoogleService-Info.plist.');
  }
  if (hasAndroidFirebaseConfig && hasIosFirebaseConfig) {
    android.googleServicesFile = googleServicesJson;
    ios.googleServicesFile = googleServicesPlist;
    for (const plugin of ['@react-native-firebase/app', '@react-native-firebase/messaging']) {
      if (!plugins.includes(plugin)) {
        plugins.push(plugin);
      }
    }
  }
  return { ...appConfig, android, ios, plugins };
};
