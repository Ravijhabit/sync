import { z } from 'zod';

export const joinSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.string().min(1),
  company: z.string().min(1),
  bio: z.string().default(''),
  interests: z.array(z.string()).default([]),
  eventId: z.string().uuid(),
});

export const loginSchema = z.object({
  email: z.string().email(),
});

export type JoinBody = z.infer<typeof joinSchema>;
export type LoginBody = z.infer<typeof loginSchema>;
