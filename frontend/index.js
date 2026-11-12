
import { supportsNativeFirebase } from './src/utils/native-firebase';

if (supportsNativeFirebase()) {
  const messaging = require('@react-native-firebase/messaging');
  messaging.setBackgroundMessageHandler(
    messaging.getMessaging(),
    async (remoteMessage) => {
      console.log('[FCM] Mensaje recibido en segundo plano:', remoteMessage.messageId);
    },
  );
}

require('expo-router/entry');
