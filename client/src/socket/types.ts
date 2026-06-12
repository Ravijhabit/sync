import type { ConversationPrompt, PartnerHints } from '../services/types';

export interface MatchFoundPayload {
  matchId: string;
  partnerHints: PartnerHints;
  prompt: ConversationPrompt;
}

export interface MatchActivePayload {
  matchId: string;
  prompt: ConversationPrompt;
}

export interface MatchEndedPayload {
  matchId: string;
}

export interface MatchCancelledPayload {
  matchId: string;
}

export interface MatchPartnerReadyPayload {
  matchId: string;
}

export interface UserOfflinePayload {
  userId: string;
}

export interface LearningReviewReadyPayload {
  learningId: string;
}

export interface EventClosingPayload {
  eventId: string;
  secondsRemaining: number;
}

export interface EventCompletedPayload {
  eventId: string;
}

export type ServerToClientEvents = {
  'match:found': (payload: MatchFoundPayload) => void;
  'match:partner_ready': (payload: MatchPartnerReadyPayload) => void;
  'match:active': (payload: MatchActivePayload) => void;
  'match:ended': (payload: MatchEndedPayload) => void;
  'match:cancelled': (payload: MatchCancelledPayload) => void;
  'user:offline': (payload: UserOfflinePayload) => void;
  'learning:review_ready': (payload: LearningReviewReadyPayload) => void;
  'event:closing': (payload: EventClosingPayload) => void;
  'event:completed': (payload: EventCompletedPayload) => void;
};

export type ClientToServerEvents = {
  'user:set_idle': (payload: { userId: string }) => void;
  'user:found_partner': (payload: { matchId: string }) => void;
  'user:end_conversation': (payload: { matchId: string }) => void;
};
