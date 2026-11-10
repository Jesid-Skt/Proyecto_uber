import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { isAllowedFrontendOrigin } from './config/frontend-origin.js';
import { authRouter } from './routes/auth.js';
import { driversRouter } from './routes/drivers.js';
import { tripRequestsRouter } from './routes/trip-requests.js';
import { tripsRouter } from './routes/trips.js';
import { paymentsRouter } from './routes/payments.js';
import { errorHandler } from './middleware/error-handler.js';

export const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || isAllowedFrontendOrigin(
      origin,
      env.frontendOrigins,
      env.NODE_ENV !== 'production',
    )) {
      callback(null, true);
      return;
    }
    callback(new Error('El origen no está permitido por la política CORS.'));
  },
  credentials: false,
}));
app.use(express.json({ limit: '32kb' }));

app.get('/api/health', (_request, response) => {
  const connected = mongoose.connection.readyState === 1;
  response.status(connected ? 200 : 503).json({
    status: connected ? 'ok' : 'database-unavailable',
  });
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera unos minutos y vuelve a intentar.' },
});
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth', authRouter);
app.use('/api/drivers', driversRouter);
app.use('/api/trip-requests', tripRequestsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/drivers/me/trips', tripsRouter);

app.use((_request, response) => {
  response.status(404).json({ error: 'La ruta solicitada no existe.' });
});
app.use(errorHandler);
