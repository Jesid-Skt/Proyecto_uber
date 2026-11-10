// AI-assisted: see docs/AI_LOG.md #1 and #3.
import { useIsFocused } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useDriver } from '../context/DriverContext';

const REQUEST_SECONDS = 15;

export function useTripRequests() {
  const { activeRequest, setActiveRequest, rejectRequest } = useDriver();
  const isFocused = useIsFocused();
  const [now, setNow] = useState(() => Date.now());
  const [expirationError, setExpirationError] = useState<string | null>(null);
  const expiredRequestId = useRef<string | null>(null);

  useEffect(() => {
    if (!activeRequest || !isFocused) return;
    const intervalId = setInterval(() => {
      const currentTime = Date.now();
      setNow(currentTime);
      if (activeRequest.expiresAt > currentTime || expiredRequestId.current === activeRequest.id) return;
      expiredRequestId.current = activeRequest.id;
      setExpirationError(null);
      void rejectRequest()
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : 'No se pudo rechazar la solicitud vencida.';
          setExpirationError(message);
          console.error('Falló el rechazo automático de la solicitud vencida.', error);
        })
        .finally(() => setActiveRequest(null));
    }, 250);
    return () => clearInterval(intervalId);
  }, [activeRequest, isFocused, rejectRequest, setActiveRequest]);

  const secondsRemaining = activeRequest
    ? Math.max(0, Math.ceil((activeRequest.expiresAt - now) / 1000))
    : REQUEST_SECONDS;

  return { secondsRemaining, expirationError };
}
