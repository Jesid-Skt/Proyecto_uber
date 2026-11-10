import type { NextFunction, Request, Response } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { env } from '../config/env.js';
import { HttpError } from '../utils/http-error.js';

declare global {
  namespace Express {
    interface Request {
      driverId?: string;
    }
  }
}

export function authenticate(request: Request, _response: Response, next: NextFunction): void {
  const authorization = request.header('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    next(new HttpError(401, 'Se requiere una sesión válida.'));
    return;
  }

  try {
    const payload = jwt.verify(authorization.slice(7), env.JWT_SECRET);
    if (typeof payload === 'string' || typeof (payload as JwtPayload).sub !== 'string') {
      next(new HttpError(401, 'El token de sesión no es válido.'));
      return;
    }
    request.driverId = (payload as JwtPayload).sub;
    next();
  } catch {
    next(new HttpError(401, 'La sesión expiró o no es válida.'));
  }
}
