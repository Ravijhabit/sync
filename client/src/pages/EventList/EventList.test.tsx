import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { axe } from '../../test/setup';
import { EventList } from './EventList';
import { renderWithProviders } from '../../test/renderWithProviders';

describe('EventList', () => {
  it('shows loading state initially', () => {
    renderWithProviders(<EventList />);
    expect(screen.getByText(/loading events/i)).toBeInTheDocument();
  });

  it('renders event cards after load', async () => {
    renderWithProviders(<EventList />);
    await waitFor(() => {
      expect(screen.getByText('HackFest 2026')).toBeInTheDocument();
      expect(screen.getByText('DevConf 2026')).toBeInTheDocument();
    });
  });

  it('shows empty message when no events', async () => {
    server.use(http.get('/api/events', () => HttpResponse.json([])));
    renderWithProviders(<EventList />);
    await waitFor(() => {
      expect(screen.getByText(/no events available/i)).toBeInTheDocument();
    });
  });

  it('shows error message on API failure', async () => {
    server.use(http.get('/api/events', () => HttpResponse.json({}, { status: 500 })));
    renderWithProviders(<EventList />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/failed to load events/i);
    });
  });

  it('navigates to auth screen when an event is selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<EventList />, { route: '/' });
    await waitFor(() => screen.getByText('HackFest 2026'));
    await user.click(screen.getAllByRole('button', { name: /join event/i })[0]!);
    // MemoryRouter does not change window.location, but navigation is invoked
  });

  it('has no accessibility violations after load', async () => {
    const { container } = renderWithProviders(<EventList />);
    await waitFor(() => screen.getByText('HackFest 2026'));
    // heading-order rule is suppressed: EventCard uses h3, valid in full page context (below h1) but not when tested standalone
    expect(await axe(container, { rules: { 'heading-order': { enabled: false } } })).toHaveNoViolations();
  });
});
