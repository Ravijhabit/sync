import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from '../../test/setup';
import { MeaningfulFlag } from './MeaningfulFlag';

describe('MeaningfulFlag', () => {
  it('shows Meaningful and Casual buttons', () => {
    render(<MeaningfulFlag matchId="match-1" />);
    expect(screen.getByRole('button', { name: /meaningful/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /casual/i })).toBeInTheDocument();
  });

  it('shows saved confirmation after selecting Meaningful', async () => {
    const user = userEvent.setup();
    render(<MeaningfulFlag matchId="match-1" />);
    await user.click(screen.getByRole('button', { name: /meaningful/i }));
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/marked as meaningful/i);
    });
  });

  it('shows saved confirmation after selecting Casual', async () => {
    const user = userEvent.setup();
    render(<MeaningfulFlag matchId="match-1" />);
    await user.click(screen.getByRole('button', { name: /casual/i }));
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/marked as casual/i);
    });
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<MeaningfulFlag matchId="match-1" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
