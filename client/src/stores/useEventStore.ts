import { create } from 'zustand';
import type { EventState, EventStatus } from './types';

export const useEventStore = create<EventState>((set) => ({
  event: null,
  eventStatus: null,
  setEvent: (event) => set({ event, eventStatus: event ? event.status : null }),
  setEventStatus: (status) =>
    set((state) => ({
      eventStatus: status,
      event: state.event ? { ...state.event, status } : null,
    })),
}));
