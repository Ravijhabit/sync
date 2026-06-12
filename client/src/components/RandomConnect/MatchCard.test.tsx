import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from '../../test/setup';
import { MatchCard } from './MatchCard';
import { renderWithProviders } from '../../test/renderWithProviders';
import { useMatchStore } from '../../stores/useMatchStore';

const partnerHints = {
  partnerId: 'user-2',
  role: 'Backend Engineer',
  company: 'Techco',
  interests: ['Go', 'Rust'],
};

const prompt = {
  id: 'prompt-1',
  text: 'What was your biggest learning this year?',
  followUp: 'What changed for you after that?',
  category: 'Growth',
  depth: 'MID' as const,
  energy: 'REFLECTIVE',
  audience: 'ANY',
  tags: ['growth'],
};

beforeEach(() => {
  useMatchStore.setState({
    matchId: null,
    partnerId: null,
    partnerHints: null,
    prompt: null,
    matchStatus: null,
  });
});

describe('MatchCard', () => {
  it('renders nothing when there is no match', () => {
    const { container } = renderWithProviders(<MatchCard />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows partner hints when a match is pending', () => {
    useMatchStore.setState({ matchId: 'match-1', partnerHints, prompt, matchStatus: 'PENDING', partnerId: 'user-2' });
    renderWithProviders(<MatchCard />);
    expect(screen.getByText('Backend Engineer')).toBeInTheDocument();
    expect(screen.getByText('Techco')).toBeInTheDocument();
    expect(screen.getByText('Go')).toBeInTheDocument();
  });

  it('emits user:found_partner and disables button when confirmed', async () => {
    const user = userEvent.setup();
    useMatchStore.setState({ matchId: 'match-1', partnerHints, prompt, matchStatus: 'PENDING', partnerId: 'user-2' });
    const { socket } = renderWithProviders(<MatchCard />);
    const emitSpy = vi.spyOn(socket, 'emit');

    await user.click(screen.getByRole('button', { name: /we found each other/i }));

    expect(emitSpy).toHaveBeenCalledWith('user:found_partner', { matchId: 'match-1' });
    expect(screen.getByRole('button', { name: /connecting/i })).toBeDisabled();
  });

  it('has no accessibility violations', async () => {
    useMatchStore.setState({ matchId: 'match-1', partnerHints, prompt, matchStatus: 'PENDING', partnerId: 'user-2' });
    const { container } = renderWithProviders(<MatchCard />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
