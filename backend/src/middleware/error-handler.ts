import type { ErrorRequestHandler } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { ZodError } from 'zod';
import { HttpError } from '../utils/http-error.js';

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof ZodError) {
    response.status(400).json({
      error: 'Los datos enviados no son válidos.',
      details: error.issues.map(({ path, message }) => ({ field: path.join('.'), message })),
    });
    return;
  }
  if (error instanceof HttpError) {
    response.status(error.statusCode).json({
      error: error.message,
      ...(error.details ? { details: error.details } : {}),
    });
    return;
  }
  if (error instanceof mongoose.Error.ValidationError) {
    response.status(400).json({ error: 'El perfil no cumple las validaciones.', details: error.message });
    return;
  }
  if (error instanceof mongoose.Error.CastError) {
    response.status(400).json({ error: 'El identificador enviado no es válido.' });
    return;
  }
  if (error instanceof multer.MulterError) {
    const field = error.code === 'LIMIT_FILE_SIZE' ? error.field : undefined;
    response.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({
      error: error.code === 'LIMIT_FILE_SIZE'
        ? 'Cada imagen debe pesar 5 MB o menos.'
        : 'El formulario contiene demasiados archivos o campos.',
      ...(field ? { details: { field } } : {}),
    });
    return;
  }
  if (error instanceof Error && 'code' in error && error.code === 11000) {
    const keyPattern = 'keyPattern' in error ? error.keyPattern : undefined;
    const duplicateField = keyPattern && typeof keyPattern === 'object'
      ? Object.keys(keyPattern).find((field) => ['email', 'idNumber', 'vehicle.plate'].includes(field))
      : undefined;
    const field = duplicateField === 'vehicle.plate' ? 'plate' : duplicateField;
    response.status(409).json({
      error: 'El correo, documento o placa ya está registrado.',
      ...(field ? { details: { field } } : {}),
    });
    return;
  }

  console.error('Error no controlado en el API.', error);
  response.status(500).json({ error: 'Ocurrió un error interno. Intenta de nuevo.' });
};
