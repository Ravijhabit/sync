import { z } from 'zod';

export const telemetrySchema = z.object({
  sessionId: z.string().uuid(),
  type: z.enum(['service_start', 'service_end', 'error', 'performance']),
  operationId: z.string().uuid().optional(),
  service: z.string().optional(),
  method: z.string().optional(),
  status: z.enum(['success', 'error']).optional(),
  durationMs: z.number().optional(),
  timestamp: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  error: z
    .object({ code: z.string(), message: z.string() })
    .optional(),
  errorMessage: z.string().optional(),
  component: z.string().optional(),
  metric: z.string().optional(),
});

export type TelemetryBody = z.infer<typeof telemetrySchema>;
