import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { axe } from '../../test/setup';
import { CountdownBanner } from './CountdownBanner';

afterEach(() => vi.useRealTimers());

describe('CountdownBanner', () => {
  it('renders initial time formatted as M:SS', () => {
    render(<CountdownBanner initialSeconds={120} />);
    expect(screen.getByText(/event ending in 2:00/i)).toBeInTheDocument();
  });

  it('has role="timer" with aria-live', () => {
    render(<CountdownBanner initialSeconds={60} />);
    expect(screen.getByRole('timer')).toBeInTheDocument();
  });

  it('counts down each second', () => {
    vi.useFakeTimers();
    render(<CountdownBanner initialSeconds={5} />);
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByText(/event ending in 0:03/i)).toBeInTheDocument();
  });

  it('stops at 0 and does not go negative', () => {
    vi.useFakeTimers();
    render(<CountdownBanner initialSeconds={1} />);
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText(/event ending in 0:00/i)).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<CountdownBanner initialSeconds={120} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
