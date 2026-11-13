
// AI-assisted: see docs/AI_LOG.md #1 and #3.
const fs = require('node:fs');
const path = require('node:path');

module.exports = ({ config }) => {
  const plugins = [...(config.plugins ?? [])];

  const addPlugin = (name) => {
    if (!plugins.some((plugin) =>
      Array.isArray(plugin) ? plugin[0] === name : plugin === name
    )) {
      plugins.push(name);
    }
  };

  addPlugin('expo-secure-store');

  addPlugin('@maplibre/maplibre-react-native');

  const googleServicesJson = process.env.GOOGLE_SERVICES_JSON
    ? path.resolve(__dirname, process.env.GOOGLE_SERVICES_JSON)
    : path.join(__dirname, 'google-services.json');

  const googleServicesPlist = process.env.GOOGLE_SERVICES_PLIST
    ? path.resolve(__dirname, process.env.GOOGLE_SERVICES_PLIST)
    : path.join(__dirname, 'GoogleService-Info.plist');

  const android = { ...(config.android ?? {}) };
  const ios = { ...(config.ios ?? {}) };

  const hasAndroidFirebaseConfig = fs.existsSync(googleServicesJson);
  const hasIosFirebaseConfig = fs.existsSync(googleServicesPlist);

  // Firebase Android
  if (hasAndroidFirebaseConfig) {
    android.googleServicesFile = googleServicesJson;
  } else {
    delete android.googleServicesFile;
  }

  // Firebase iOS
  if (hasIosFirebaseConfig) {
    ios.googleServicesFile = googleServicesPlist;
  } else {
    delete ios.googleServicesFile;
  }

  // Registrar Firebase cuando exista configuración nativa.
  if (hasAndroidFirebaseConfig || hasIosFirebaseConfig) {
    addPlugin('@react-native-firebase/app');
    addPlugin('@react-native-firebase/messaging');
  }

  return {
    ...config,
    android,
    ios,
    plugins,
  };
};
