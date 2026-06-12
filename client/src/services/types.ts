export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  company: string;
  bio: string;
  interests: string[];
  avatarUrl?: string | undefined;
  createdAt: string;
}

export interface Event {
  id: string;
  name: string;
  venue: string;
  description: string;
  startTime: string;
  endTime: string;
  status: 'UPCOMING' | 'ONGOING' | 'CLOSING' | 'COMPLETED';
}

export interface PartnerHints {
  partnerId: string;
  role: string;
  company: string;
  interests: string[];
}

export interface ConversationPrompt {
  id: string;
  text: string;
  followUp: string;
  category: string;
  depth: 'SURFACE' | 'MID' | 'DEEP';
  energy: string;
  audience: string;
  tags: string[];
}

export interface Match {
  id: string;
  eventId: string;
  user1Id: string;
  user2Id: string;
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  promptId: string;
  user1Meaningful?: boolean | undefined;
  user2Meaningful?: boolean | undefined;
  createdAt: string;
  startedAt?: string | undefined;
  completedAt?: string | undefined;
}

export interface Learning {
  id: string;
  matchId: string;
  learnerId: string;
  targetId: string;
  content: string;
  justification: string;
  rating?: number | undefined;
  feedback?: string | undefined;
  isCorrect?: boolean | undefined;
  submittedAt: string;
  reviewedAt?: string | undefined;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  role: string;
  company: string;
  avatarUrl?: string | undefined;
  bayesianScore: number;
  avgRating: number;
  totalReviews: number;
  totalConversations: number;
}

export interface UserStats {
  totalConversations: number;
  avgRating: number;
  meaningfulCount: number;
  casualCount: number;
}

export interface ReceivedRating {
  learningId: string;
  content: string;
  justification: string;
  rating: number;
  feedback?: string | undefined;
  isCorrect?: boolean | undefined;
  reviewerName: string;
  reviewerRole: string;
  reviewerCompany: string;
  matchDate: string;
}

export interface JoinBody {
  name: string;
  email: string;
  role: string;
  company: string;
  bio: string;
  interests: string[];
  eventId: string;
}

export interface LoginBody {
  email: string;
  eventId?: string;
}

export interface SubmitLearningBody {
  matchId: string;
  targetId: string;
  content: string;
  justification: string;
}

export interface ReviewLearningBody {
  rating: number;
  feedback: string;
  isCorrect: boolean;
}

export interface TelemetryEvent {
  sessionId: string;
  type: 'service_start' | 'service_end' | 'error' | 'performance';
  operationId?: string | undefined;
  service?: string | undefined;
  method?: string | undefined;
  timestamp: string;
  payload?: Record<string, unknown> | undefined;
  status?: 'success' | 'error' | undefined;
  durationMs?: number | undefined;
  error?: { code: string; message: string } | undefined;
  errorMessage?: string | undefined;
  component?: string | undefined;
  metric?: string | undefined;
}
