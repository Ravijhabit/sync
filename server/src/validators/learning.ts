import { z } from 'zod';

export const createLearningSchema = z.object({
  matchId: z.string().uuid(),
  targetId: z.string().uuid(),
  content: z.string().min(1),
  justification: z.string().min(1),
});

export const reviewLearningSchema = z.object({
  rating: z.number().int().min(1).max(10),
  feedback: z.string().min(1),
  isCorrect: z.boolean(),
});

export const meaningfulSchema = z.object({
  meaningful: z.boolean(),
});

export type CreateLearningBody = z.infer<typeof createLearningSchema>;
export type ReviewLearningBody = z.infer<typeof reviewLearningSchema>;
export type MeaningfulBody = z.infer<typeof meaningfulSchema>;
