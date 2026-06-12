import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { axe } from '../../test/setup';
import { EventSummary } from './EventSummary';
import { renderWithProviders } from '../../test/renderWithProviders';
import { useUserStore } from '../../stores/useUserStore';
import { useEventStore } from '../../stores/useEventStore';
import { mockUser, mockEventCompleted } from '../../mocks/fixtures';

beforeEach(() => {
  useUserStore.setState({ user: mockUser, sessionId: 'session-1' });
  useEventStore.setState({ event: mockEventCompleted, eventStatus: 'COMPLETED' });
});

describe('EventSummary', () => {
  it('shows loading message when event or user is missing', () => {
    useEventStore.setState({ event: null, eventStatus: null });
    renderWithProviders(<EventSummary />);
    expect(screen.getByText(/loading summary/i)).toBeInTheDocument();
  });

  it('renders event name as page heading and ratings section', async () => {
    renderWithProviders(<EventSummary />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'HackFest 2026', level: 1 })).toBeInTheDocument();
      expect(screen.getByText(/what others learned about you/i)).toBeInTheDocument();
    });
  });

  it('shows received rating cards', async () => {
    renderWithProviders(<EventSummary />);
    await waitFor(() => {
      expect(screen.getByText(/bob backend/i)).toBeInTheDocument();
      expect(screen.getByText('10/10')).toBeInTheDocument();
    });
  });

  it('shows Final Rankings section with leaderboard', async () => {
    renderWithProviders(<EventSummary />);
    await waitFor(() => {
      expect(screen.getByText(/final rankings/i)).toBeInTheDocument();
    });
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(<EventSummary />);
    await waitFor(() => screen.getByRole('heading', { name: 'HackFest 2026', level: 1 }));
    expect(await axe(container)).toHaveNoViolations();
  });
});
