// AI-assisted: see docs/AI_LOG.md #3.
import { createServer } from 'node:http';
import { app } from './app.js';
import { connectDatabase } from './config/database.js';
import { env } from './config/env.js';
import mongoose from 'mongoose';
import { closeRealtime, configureRealtime, watchMongoChanges } from './services/realtime.js';
import { configurePushNotifications } from './services/push-notifications.js';
import { Trip } from './models/Trip.js';

async function start(): Promise<void> {
  await connectDatabase();
  configurePushNotifications();
  const server = createServer(app);
  configureRealtime(server);
  watchMongoChanges();
  const expireRequests = setInterval(() => {
    void Trip.updateMany(
      { status: 'requested', expiresAt: { $lte: new Date() } },
      { $set: { status: 'rejected' } },
    ).catch((error: unknown) => {
      console.error('No se pudieron rechazar las solicitudes vencidas.', error);
    });
  }, 1000);
  server.listen(env.PORT, '0.0.0.0', () => {
    console.info(`API disponible en el puerto ${env.PORT}.`);
  });

  const shutdown = async (signal: string) => {
    console.info(`Recibida señal ${signal}; cerrando API.`);
    clearInterval(expireRequests);
    try {
      await closeRealtime();
    } catch (error) {
      console.error('No se pudo cerrar el canal de tiempo real.', error);
    }
    server.close(async (error) => {
      if (error) {
        console.error('Error al cerrar el servidor HTTP.', error);
        process.exitCode = 1;
      }
      await mongoose.disconnect();
    });
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

start().catch((error: unknown) => {
  const err =
    error instanceof Error
      ? error
      : new Error(String(error));

  const safeMessage = (message: string) =>
    message.replace(
      /mongodb(?:\+srv)?:\/\/[^\s"'`]+/gi,
      'mongodb+srv://[REDACTED]',
    );

  console.error('No se pudo iniciar el backend:', {
    name: err.name,
    message: safeMessage(err.message),
    cause:
      err.cause instanceof Error
        ? {
            name: err.cause.name,
            message: safeMessage(err.cause.message),
          }
        : undefined,
  });

  process.exitCode = 1;
});
