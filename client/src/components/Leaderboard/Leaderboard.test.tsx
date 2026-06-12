import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from '../../test/setup';
import { Leaderboard } from './Leaderboard';
import { renderWithProviders } from '../../test/renderWithProviders';

describe('Leaderboard', () => {
  it('renders ranked entries from the API', async () => {
    renderWithProviders(<Leaderboard eventId="event-1" />);
    await waitFor(() => {
      expect(screen.getByText('Bob Backend')).toBeInTheDocument();
      expect(screen.getByText('Alice Dev')).toBeInTheDocument();
    });
  });

  it('shows user stats dialog on row click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Leaderboard eventId="event-1" />);
    await waitFor(() => screen.getByText('Bob Backend'));
    await user.click(screen.getByText('Bob Backend'));
    await waitFor(() => {
      expect(screen.getByText(/meaningful/i)).toBeInTheDocument();
    });
  });

  it('has no accessibility violations after data loads', async () => {
    const { container } = renderWithProviders(<Leaderboard eventId="event-1" />);
    await waitFor(() => screen.getByText('Bob Backend'));
    expect(await axe(container)).toHaveNoViolations();
  });
});
