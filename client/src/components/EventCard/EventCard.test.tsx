import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from '../../test/setup';
import { EventCard } from './EventCard';
import { mockEventOngoing, mockEventUpcoming } from '../../mocks/fixtures';

describe('EventCard', () => {
  it('renders event name and venue', () => {
    render(<EventCard event={mockEventOngoing} onSelect={vi.fn()} />);
    expect(screen.getByText('HackFest 2026')).toBeInTheDocument();
    expect(screen.getByText('Main Hall')).toBeInTheDocument();
  });

  it('shows ONGOING status badge', () => {
    render(<EventCard event={mockEventOngoing} onSelect={vi.fn()} />);
    expect(screen.getByText('ONGOING')).toBeInTheDocument();
  });

  it('shows UPCOMING status badge', () => {
    render(<EventCard event={mockEventUpcoming} onSelect={vi.fn()} />);
    expect(screen.getByText('UPCOMING')).toBeInTheDocument();
  });

  it('calls onSelect with the event when clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<EventCard event={mockEventOngoing} onSelect={onSelect} />);
    await user.click(screen.getByRole('button', { name: /join event/i }));
    expect(onSelect).toHaveBeenCalledWith(mockEventOngoing);
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<EventCard event={mockEventOngoing} onSelect={vi.fn()} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
