import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from '../../test/setup';
import { StatusToggle } from './StatusToggle';
import { renderWithProviders } from '../../test/renderWithProviders';
import { useUserStore } from '../../stores/useUserStore';
import { mockUser } from '../../mocks/fixtures';

beforeEach(() => {
  useUserStore.setState({ user: mockUser, sessionId: 'session-1' });
});

describe('StatusToggle', () => {
  it('shows available button initially', () => {
    renderWithProviders(<StatusToggle />);
    expect(screen.getByRole('button', { name: /set myself as available/i })).toBeInTheDocument();
  });

  it('emits user:set_idle and shows spinner when clicked', async () => {
    const user = userEvent.setup();
    const { socket } = renderWithProviders(<StatusToggle />);
    const emitSpy = vi.spyOn(socket, 'emit');

    await user.click(screen.getByRole('button', { name: /set myself as available/i }));

    expect(emitSpy).toHaveBeenCalledWith('user:set_idle', { userId: mockUser.id });
    expect(screen.getByLabelText(/finding a match/i)).toBeInTheDocument();
  });

  it('can cancel while waiting and return to available state', async () => {
    const user = userEvent.setup();
    renderWithProviders(<StatusToggle />);
    await user.click(screen.getByRole('button', { name: /set myself as available/i }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.getByRole('button', { name: /set myself as available/i })).toBeInTheDocument();
  });

  it('does not emit when socket is null', async () => {
    const user = userEvent.setup();
    renderWithProviders(<StatusToggle />, { socketOverrides: { socket: null, connected: false } });
    await user.click(screen.getByRole('button', { name: /set myself as available/i }));
    // No spinner — handleSetIdle returned early
    expect(screen.queryByLabelText(/finding a match/i)).not.toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(<StatusToggle />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
