export interface ServerToClientEvents {
  'match:found': (payload: { matchId: string; partnerHints: PartnerHints; prompt: PromptPayload }) => void;
  'match:partner_ready': (payload: { matchId: string }) => void;
  'match:active': (payload: { matchId: string; prompt: PromptPayload }) => void;
  'match:ended': (payload: { matchId: string }) => void;
  'match:cancelled': (payload: { matchId: string }) => void;
  'user:offline': (payload: { userId: string }) => void;
  'learning:review_ready': (payload: { learningId: string }) => void;
  'event:closing': (payload: { eventId: string; secondsRemaining: number }) => void;
  'event:completed': (payload: { eventId: string }) => void;
}

export interface ClientToServerEvents {
  'user:set_idle': (payload: { userId: string }) => void;
  'user:found_partner': (payload: { matchId: string }) => void;
  'user:end_conversation': (payload: { matchId: string }) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  userId: string;
  sessionId: string;
  eventId: string;
}

export interface PartnerHints {
  partnerId: string;
  role: string;
  company: string;
  interests: string[];
}

export interface PromptPayload {
  id: string;
  text: string;
  followUp: string;
  category: string;
  depth: string;
  energy: string;
}
