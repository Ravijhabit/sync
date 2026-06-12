import { create } from 'zustand';
import type { UserState } from './types';

export const useUserStore = create<UserState>((set) => ({
  user: null,
  sessionId: null,
  setUser: (user, sessionId) => set({ user, sessionId }),
  clearUser: () => set({ user: null, sessionId: null }),
}));
