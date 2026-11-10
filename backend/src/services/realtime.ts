// AI-assisted: see docs/AI_LOG.md #3.
import type { Server as HttpServer } from 'node:http';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import mongoose from 'mongoose';
import type { ChangeStream } from 'mongodb';
import { env } from '../config/env.js';
import { Driver } from '../models/Driver.js';
import { Trip } from '../models/Trip.js';

type AuthenticatedSocket = Socket<
  Record<string, never>,
  Record<string, never>,
  Record<string, never>,
  { driverId: string }
>;

let socketServer: SocketIOServer | null = null;
let driverChanges: ChangeStream | null = null;
let tripChanges: ChangeStream | null = null;

function getRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : null;
}

function driverRoom(driverId: string): string {
  return `driver:${driverId}`;
}

export function configureRealtime(server: HttpServer): void {
  socketServer = new SocketIOServer(server, {
    cors: { origin: env.frontendOrigins, credentials: false },
  });
  socketServer.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (typeof token !== 'string') {
      next(new Error('Se requiere una sesión válida.'));
      return;
    }
    try {
      const payload = jwt.verify(token, env.JWT_SECRET);
      const driverId = typeof payload === 'string' ? undefined : (payload as JwtPayload).sub;
      if (typeof driverId !== 'string') {
        next(new Error('El token de sesión no es válido.'));
        return;
      }
      (socket as AuthenticatedSocket).data.driverId = driverId;
      next();
    } catch {
      next(new Error('La sesión expiró o no es válida.'));
    }
  });
  socketServer.on('connection', (socket) => {
    const driverId = (socket as AuthenticatedSocket).data.driverId;
    void socket.join(driverRoom(driverId));
  });
}

export function watchMongoChanges(): void {
  if (!mongoose.connection.db) {
    throw new Error('No se puede iniciar la sincronización en tiempo real sin MongoDB.');
  }
  driverChanges = Driver.watch(
    [{ $match: { operationType: 'update', 'updateDescription.updatedFields.currentLocation': { $exists: true } } }],
    { fullDocument: 'updateLookup' },
  );
  driverChanges.on('change', (change) => {
    const documentKey = getRecord('documentKey' in change ? change.documentKey : null);
    const driverId = documentKey?._id ? String(documentKey._id) : null;
    const fullDocument = getRecord('fullDocument' in change ? change.fullDocument : null);
    const location = getRecord(fullDocument?.currentLocation);
    if (
      driverId &&
      typeof location?.lat === 'number' &&
      typeof location.lng === 'number' &&
      location.updatedAt instanceof Date
    ) {
      socketServer?.to(driverRoom(driverId)).emit('location:updated', {
        driverId,
        location: {
          lat: location.lat,
          lng: location.lng,
          updatedAt: location.updatedAt,
        },
      });
    }
  });
  driverChanges.on('error', (error) => {
    console.error('Falló el Change Stream de ubicación; se requiere MongoDB Replica Set.', error);
  });

  tripChanges = Trip.watch([], { fullDocument: 'updateLookup' });
  tripChanges.on('change', (change) => {
    const trip = getRecord('fullDocument' in change ? change.fullDocument : null);
    if (!trip || !trip.driverId || !trip._id || typeof trip.status !== 'string') return;
    socketServer?.to(driverRoom(String(trip.driverId))).emit('trip:changed', {
      tripId: String(trip._id),
      status: trip.status,
    });
  });
  tripChanges.on('error', (error) => {
    console.error('Falló el Change Stream de viajes; se requiere MongoDB Replica Set.', error);
  });
}

export async function closeRealtime(): Promise<void> {
  await Promise.all([
    driverChanges?.close(),
    tripChanges?.close(),
  ]);
  socketServer?.disconnectSockets(true);
  socketServer?.removeAllListeners();
  driverChanges = null;
  tripChanges = null;
  socketServer = null;
}
