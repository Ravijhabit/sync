import type { User, Event, ConversationPrompt, PartnerHints } from '../services/types';

export type EventStatus = 'UPCOMING' | 'ONGOING' | 'CLOSING' | 'COMPLETED';
export type MatchStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | null;
export type NotificationType = 'success' | 'info' | 'warning' | 'error';

export interface AppNotification {
  id: string;
  type: NotificationType;
  message: string;
  learningId?: string | undefined;
}

export interface UserState {
  user: User | null;
  sessionId: string | null;
  setUser: (user: User, sessionId: string) => void;
  clearUser: () => void;
}

export interface EventState {
  event: Event | null;
  eventStatus: EventStatus | null;
  setEvent: (event: Event | null) => void;
  setEventStatus: (status: EventStatus) => void;
}

export interface MatchState {
  matchId: string | null;
  partnerId: string | null;
  partnerHints: PartnerHints | null;
  prompt: ConversationPrompt | null;
  matchStatus: MatchStatus;
  setMatch: (matchId: string, partnerHints: PartnerHints, prompt: ConversationPrompt) => void;
  setMatchStatus: (status: MatchStatus) => void;
  setActivePrompt: (prompt: ConversationPrompt) => void;
  clearMatch: () => void;
}

export interface NotificationState {
  notifications: AppNotification[];
  addNotification: (notification: Omit<AppNotification, 'id'>) => void;
  removeNotification: (id: string) => void;
}
