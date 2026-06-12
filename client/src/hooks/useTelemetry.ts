import { useCallback } from 'react';
import { telemetryApi } from '../services/api';
import { useUserStore } from '../stores/useUserStore';

export function useTelemetry() {
  const sessionId = useUserStore((s) => s.sessionId);

  const trackStart = useCallback(
    (service: string, method: string, payload: Record<string, unknown> = {}) => {
      const operationId = crypto.randomUUID();
      telemetryApi.track({
        sessionId: sessionId ?? '',
        type: 'service_start',
        operationId,
        service,
        method,
        timestamp: new Date().toISOString(),
        payload,
      });
      return operationId;
    },
    [sessionId]
  );

  const trackEnd = useCallback(
    (
      operationId: string,
      service: string,
      method: string,
      status: 'success' | 'error',
      durationMs: number,
      error?: { code: string; message: string } | undefined
    ) => {
      telemetryApi.track({
        sessionId: sessionId ?? '',
        type: 'service_end',
        operationId,
        service,
        method,
        status,
        durationMs,
        timestamp: new Date().toISOString(),
        ...(error !== undefined ? { error } : {}),
      });
    },
    [sessionId]
  );

  const trackError = useCallback(
    (errorMessage: string, component: string) => {
      telemetryApi.track({
        sessionId: sessionId ?? '',
        type: 'error',
        errorMessage,
        component,
        timestamp: new Date().toISOString(),
      });
    },
    [sessionId]
  );

  return { trackStart, trackEnd, trackError };
}
