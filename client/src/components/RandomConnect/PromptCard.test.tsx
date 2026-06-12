import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from '../../test/setup';
import { PromptCard } from './PromptCard';
import { renderWithProviders } from '../../test/renderWithProviders';
import { useMatchStore } from '../../stores/useMatchStore';

const prompt = {
  id: 'prompt-1',
  text: 'What has surprised you most about your current role?',
  followUp: 'How did that change your perspective?',
  category: 'Career',
  depth: 'MID' as const,
  energy: 'CURIOUS',
  audience: 'ANY',
  tags: ['career'],
};

beforeEach(() => {
  useMatchStore.setState({ matchId: null, partnerId: null, partnerHints: null, prompt: null, matchStatus: null });
});

describe('PromptCard', () => {
  it('renders nothing when there is no prompt', () => {
    const { container } = renderWithProviders(<PromptCard />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows prompt text and category when active', () => {
    useMatchStore.setState({ matchId: 'match-1', prompt, matchStatus: 'ACTIVE', partnerId: 'user-2', partnerHints: null });
    renderWithProviders(<PromptCard />);
    expect(screen.getByText(prompt.text)).toBeInTheDocument();
    expect(screen.getByText(/career/i)).toBeInTheDocument();
  });

  it('shows follow-up nudge when toggled', async () => {
    const user = userEvent.setup();
    useMatchStore.setState({ matchId: 'match-1', prompt, matchStatus: 'ACTIVE', partnerId: 'user-2', partnerHints: null });
    renderWithProviders(<PromptCard />);
    await user.click(screen.getByRole('button', { name: /show follow-up nudge/i }));
    expect(screen.getByText(prompt.followUp)).toBeInTheDocument();
  });

  it('emits user:end_conversation and clears store when ending', async () => {
    const user = userEvent.setup();
    useMatchStore.setState({ matchId: 'match-1', prompt, matchStatus: 'ACTIVE', partnerId: 'user-2', partnerHints: null });
    const { socket } = renderWithProviders(<PromptCard />);
    const emitSpy = vi.spyOn(socket, 'emit');

    await user.click(screen.getByRole('button', { name: /end conversation/i }));

    expect(emitSpy).toHaveBeenCalledWith('user:end_conversation', { matchId: 'match-1' });
    expect(useMatchStore.getState().matchId).toBeNull();
  });

  it('has no accessibility violations', async () => {
    useMatchStore.setState({ matchId: 'match-1', prompt, matchStatus: 'ACTIVE', partnerId: 'user-2', partnerHints: null });
    const { container } = renderWithProviders(<PromptCard />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
