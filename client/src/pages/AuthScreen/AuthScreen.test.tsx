import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from '../../test/setup';
import { AuthScreen } from './AuthScreen';
import { renderWithProviders } from '../../test/renderWithProviders';
import { useUserStore } from '../../stores/useUserStore';

beforeEach(() => {
  useUserStore.setState({ user: null, sessionId: null });
});

describe('AuthScreen', () => {
  it('shows choose mode with SSO and email buttons initially', () => {
    renderWithProviders(<AuthScreen />, { route: '/auth?eventId=event-1' });
    expect(screen.getByRole('link', { name: /sign in with google/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new to sync/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /returning user/i })).toBeInTheDocument();
  });

  it('shows JoinForm when New to Sync is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AuthScreen />, { route: '/auth?eventId=event-1' });
    await user.click(screen.getByRole('button', { name: /new to sync/i }));
    expect(screen.getByRole('button', { name: /join event/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
  });

  it('shows LoginForm when Returning User is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AuthScreen />, { route: '/auth?eventId=event-1' });
    await user.click(screen.getByRole('button', { name: /returning user/i }));
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('can navigate back from join mode', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AuthScreen />, { route: '/auth?eventId=event-1' });
    await user.click(screen.getByRole('button', { name: /new to sync/i }));
    await user.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByRole('button', { name: /new to sync/i })).toBeInTheDocument();
  });

  it('redirects to dashboard after successful join', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AuthScreen />, { route: '/auth?eventId=event-1' });
    await user.click(screen.getByRole('button', { name: /new to sync/i }));
    await user.type(screen.getByLabelText(/^name/i), 'Alice');
    await user.type(screen.getByLabelText(/email/i), 'alice@example.com');
    await user.type(screen.getByLabelText(/company/i), 'Acme');
    await user.click(screen.getByRole('button', { name: /join event/i }));
    await waitFor(() => {
      expect(useUserStore.getState().user).not.toBeNull();
    });
  });

  it('has no accessibility violations in choose mode', async () => {
    const { container } = renderWithProviders(<AuthScreen />, { route: '/auth' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
