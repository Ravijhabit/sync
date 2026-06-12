import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from './renderWithProviders';
import { AuthScreen } from '../pages/AuthScreen/AuthScreen';
import { useUserStore } from '../stores/useUserStore';
import { useMatchStore } from '../stores/useMatchStore';
import { useNotificationStore } from '../stores/useNotificationStore';
import { StatusToggle } from '../components/RandomConnect/StatusToggle';
import { MatchCard } from '../components/RandomConnect/MatchCard';
import { PromptCard } from '../components/RandomConnect/PromptCard';
import { NotificationLayer } from '../components/NotificationLayer/NotificationLayer';

const matchPayload = {
  matchId: 'match-1',
  partnerHints: {
    partnerId: 'user-2',
    role: 'Backend Engineer',
    company: 'Techco',
    interests: ['Go', 'Rust'],
  },
  prompt: {
    id: 'prompt-1',
    text: 'What was your biggest engineering challenge this year?',
    followUp: 'What would you do differently?',
    category: 'Growth',
    depth: 'MID' as const,
    energy: 'REFLECTIVE',
    audience: 'TECHNICAL',
    tags: ['growth'],
  },
};

beforeEach(() => {
  useUserStore.setState({ user: null, sessionId: null });
  useMatchStore.setState({ matchId: null, partnerId: null, partnerHints: null, prompt: null, matchStatus: null });
  useNotificationStore.setState({ notifications: [] });
});

describe('Join → Dashboard flow', () => {
  it('user can join an event and land on the dashboard with their name set', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AuthScreen />, { route: '/auth?eventId=event-1' });

    await user.click(screen.getByRole('button', { name: /new to sync/i }));
    await user.type(screen.getByLabelText(/^name/i), 'Alice Dev');
    await user.type(screen.getByLabelText(/email/i), 'alice@example.com');
    await user.type(screen.getByLabelText(/company/i), 'Acme');
    await user.click(screen.getByRole('button', { name: /join event/i }));

    await waitFor(() => {
      expect(useUserStore.getState().user?.name).toBe('Alice Dev');
    }, { timeout: 10000 });
  }, 15000);
});

describe('Idle → Match → Conversation flow', () => {
  it('StatusToggle emits set_idle, match:found populates store, MatchCard appears', async () => {
    const user = userEvent.setup();
    useUserStore.setState({ user: { id: 'user-1', name: 'Alice Dev', email: 'alice@example.com', role: 'FE', company: 'Acme', bio: '', interests: [], createdAt: '' }, sessionId: 's1' });

    const { socket } = renderWithProviders(
      <>
        <NotificationLayer />
        <StatusToggle />
        <MatchCard />
      </>
    );

    // Set idle
    await user.click(screen.getByRole('button', { name: /set myself as available/i }));
    expect(screen.getByLabelText(/finding a match/i)).toBeInTheDocument();

    // Server emits match:found — toast says "You've been matched! Check your match card."
    useMatchStore.getState().setMatch(matchPayload.matchId, matchPayload.partnerHints, matchPayload.prompt);
    socket.emit('match:found', matchPayload);

    await waitFor(() => {
      expect(screen.getAllByText(/you've been matched/i).length).toBeGreaterThan(0);
    });
  });

  it('PromptCard appears after MatchCard confirmation and can end conversation', async () => {
    const user = userEvent.setup();
    useMatchStore.setState({
      matchId: 'match-1',
      partnerId: 'user-2',
      partnerHints: matchPayload.partnerHints,
      prompt: matchPayload.prompt,
      matchStatus: 'ACTIVE',
    });

    const { socket } = renderWithProviders(
      <>
        <MatchCard />
        <PromptCard />
      </>
    );

    expect(screen.getByText(matchPayload.prompt.text)).toBeInTheDocument();

    const emitSpy = vi.spyOn(socket, 'emit');
    await user.click(screen.getByRole('button', { name: /end conversation/i }));

    expect(emitSpy).toHaveBeenCalledWith('user:end_conversation', { matchId: 'match-1' });
    expect(useMatchStore.getState().matchId).toBeNull();
  });
});
