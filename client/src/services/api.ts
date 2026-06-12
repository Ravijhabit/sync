import axios from 'axios';
import type {
  User,
  Event,
  Match,
  Learning,
  LeaderboardEntry,
  UserStats,
  ReceivedRating,
  JoinBody,
  LoginBody,
  SubmitLearningBody,
  ReviewLearningBody,
} from './types';
import { useUserStore } from '../stores/useUserStore';
import { useEventStore } from '../stores/useEventStore';
import { useMatchStore } from '../stores/useMatchStore';

const http = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

http.interceptors.response.use(
  (res) => res,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      useUserStore.getState().clearUser();
      useEventStore.getState().setEvent(null);
      useMatchStore.getState().clearMatch();
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  join: (body: JoinBody) => http.post<{ user: User; sessionId: string }>('/auth/join', body),
  login: (body: LoginBody) => http.post<{ user: User; sessionId: string }>('/auth/login', body),
  me: () => http.get<{ user: User; sessionId: string }>('/users/me'),
};

export const eventsApi = {
  list: () => http.get<Event[]>('/events'),
  get: (id: string) => http.get<Event>(`/events/${id}`),
  attendees: (id: string, page = 1, limit = 20) =>
    http.get<{ attendees: User[]; total: number }>(`/events/${id}/attendees`, {
      params: { page, limit },
    }),
  leaderboard: (eventId: string, page = 1, limit = 20) =>
    http.get<{ entries: LeaderboardEntry[]; total: number }>(
      `/events/${eventId}/leaderboard`,
      { params: { page, limit } }
    ),
  userStats: (eventId: string, userId: string) =>
    http.get<UserStats>(`/events/${eventId}/users/${userId}/stats`),
  receivedRatings: (eventId: string, userId: string) =>
    http.get<ReceivedRating[]>(`/events/${eventId}/users/${userId}/ratings/received`),
};

export const matchesApi = {
  get: (id: string) => http.get<Match>(`/matches/${id}`),
  markMeaningful: (id: string, meaningful: boolean) =>
    http.patch(`/matches/${id}/meaningful`, { meaningful }),
};

export const learningsApi = {
  submit: (body: SubmitLearningBody) => http.post<Learning>('/learnings', body),
  get: (id: string) => http.get<Learning>(`/learnings/${id}`),
  review: (id: string, body: ReviewLearningBody) =>
    http.patch<Learning>(`/learnings/${id}/review`, body),
};

export const telemetryApi = {
  track: (event: Record<string, unknown>) =>
    http.post('/telemetry', event).catch(() => undefined),
};
