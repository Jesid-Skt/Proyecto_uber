// AI-assisted: see docs/AI_LOG.md #3.
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging, type MulticastMessage } from 'firebase-admin/messaging';
import { env } from '../config/env.js';
import { Driver } from '../models/Driver.js';

let messagingConfigured = false;

export function configurePushNotifications(): void {
  if (!env.FIREBASE_PROJECT_ID) {
    console.warn('FCM está desactivado; configura FIREBASE_PROJECT_ID y credenciales de Google Cloud.');
    return;
  }
  if (!getApps().length) {
    initializeApp({
      credential: applicationDefault(),
      projectId: env.FIREBASE_PROJECT_ID,
    });
  }
  messagingConfigured = true;
}

export async function sendTripRequestNotification(input: {
  driverId: string;
  tripId: string;
  origin: string;
  destination: string;
}): Promise<void> {
  if (!messagingConfigured) return;
  const driver = await Driver.findById(input.driverId).select('pushTokens');
  const tokens = driver?.pushTokens ?? [];
  if (!tokens.length) return;

  const message: MulticastMessage = {
    tokens,
    notification: {
      title: 'Nueva solicitud de viaje',
      body: `${input.origin} → ${input.destination}`,
    },
    data: { tripId: input.tripId, type: 'trip_request' },
    android: { priority: 'high' },
    apns: { payload: { aps: { sound: 'default' } } },
  };
  const result = await getMessaging().sendEachForMulticast(message);
  const invalidTokens = result.responses.flatMap((response, index) => {
    const code = response.error?.code;
    return code === 'messaging/invalid-registration-token'
      || code === 'messaging/registration-token-not-registered'
      ? [tokens[index]]
      : [];
  });
  if (invalidTokens.length) {
    await Driver.updateOne(
      { _id: input.driverId },
      { $pull: { pushTokens: { $in: invalidTokens } } },
    );
  }
  if (result.failureCount) {
    console.error('FCM no pudo entregar todas las notificaciones de solicitud.', {
      driverId: input.driverId,
      successCount: result.successCount,
      failureCount: result.failureCount,
      errorCodes: result.responses.flatMap((response) =>
        response.error ? [response.error.code] : []),
    });
  }
}
