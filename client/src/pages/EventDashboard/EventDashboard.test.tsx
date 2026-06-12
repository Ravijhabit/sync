import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { axe } from '../../test/setup';
import { EventDashboard } from './EventDashboard';
import { renderWithProviders } from '../../test/renderWithProviders';
import { useUserStore } from '../../stores/useUserStore';
import { useEventStore } from '../../stores/useEventStore';
import { mockUser, mockEventClosing } from '../../mocks/fixtures';

beforeEach(() => {
  useUserStore.setState({ user: mockUser, sessionId: 'session-1' });
  useEventStore.setState({ event: null, eventStatus: null });
});

describe('EventDashboard', () => {
  const renderDashboard = (overrides = {}) =>
    renderWithProviders(<EventDashboard />, {
      route: '/dashboard/event-1',
      routePattern: '/dashboard/:eventId',
      ...overrides,
    });

  it('shows loading state initially', () => {
    renderDashboard();
    expect(screen.getByText(/loading event/i)).toBeInTheDocument();
  });

  it('shows attendee count and RandomConnect when ONGOING', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/42 attendees/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /set myself as available/i })).toBeInTheDocument();
    });
  });

  it('shows offline banner when socket is disconnected', async () => {
    renderDashboard({ socketOverrides: { connected: false } });
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/reconnecting/i);
    });
  });

  it('shows closing message when event is CLOSING', async () => {
    server.use(http.get('/api/events/:id', () => HttpResponse.json(mockEventClosing)));
    server.use(http.get('/api/events/:id/attendees', () => HttpResponse.json({ total: 10, attendees: [] })));
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/no new matches/i)).toBeInTheDocument();
    });
  });

  it('has no accessibility violations after load', async () => {
    const { container } = renderDashboard();
    await waitFor(() => screen.getByText(/42 attendees/i));
    expect(await axe(container)).toHaveNoViolations();
  });
});
