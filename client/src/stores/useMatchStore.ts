import { create } from 'zustand';
import type { MatchState } from './types';

export const useMatchStore = create<MatchState>((set) => ({
  matchId: null,
  partnerId: null,
  partnerHints: null,
  prompt: null,
  matchStatus: null,
  setMatch: (matchId, partnerHints, prompt) =>
    set({
      matchId,
      partnerId: partnerHints.partnerId,
      partnerHints,
      prompt,
      matchStatus: 'PENDING',
    }),
  setMatchStatus: (matchStatus) => set({ matchStatus }),
  setActivePrompt: (prompt) => set({ prompt }),
  clearMatch: () =>
    set({
      matchId: null,
      partnerId: null,
      partnerHints: null,
      prompt: null,
      matchStatus: null,
    }),
}));
