import mongoose from 'mongoose';
import { env } from './env.js';
import { Driver } from '../models/Driver.js';

export async function connectDatabase(): Promise<void> {
  console.info('Paso 1/2: conectando con MongoDB...');

  await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10_000,
    autoIndex: env.NODE_ENV !== 'production',
  });

  console.info('Paso 1/2 completado: conexión establecida.');
  console.info('Paso 2/2: creando índices del modelo Driver...');

  await Driver.createIndexes();

  console.info('Paso 2/2 completado: índices creados.');
}