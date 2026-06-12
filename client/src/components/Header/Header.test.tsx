import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from '../../test/setup';
import { Header } from './Header';
import { useUserStore } from '../../stores/useUserStore';
import { useEventStore } from '../../stores/useEventStore';
import { mockUser, mockEventOngoing } from '../../mocks/fixtures';

beforeEach(() => {
  useUserStore.setState({ user: null, sessionId: null });
  useEventStore.setState({ event: null, eventStatus: null });
});

describe('Header', () => {
  it('renders Sync logo always', () => {
    render(<Header />);
    expect(screen.getByText('Sync')).toBeInTheDocument();
  });

  it('shows user name and initial when user is set', () => {
    useUserStore.setState({ user: mockUser, sessionId: 'session-1' });
    render(<Header />);
    expect(screen.getByText('Alice Dev')).toBeInTheDocument();
    expect(screen.getByLabelText('Alice Dev')).toBeInTheDocument();
  });

  it('shows event name and Live badge when ONGOING', () => {
    useUserStore.setState({ user: mockUser, sessionId: 'session-1' });
    useEventStore.setState({ event: mockEventOngoing, eventStatus: 'ONGOING' });
    render(<Header />);
    expect(screen.getByText('HackFest 2026')).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('shows Ending Soon badge when CLOSING', () => {
    useEventStore.setState({ event: mockEventOngoing, eventStatus: 'CLOSING' });
    render(<Header />);
    expect(screen.getByText('Ending Soon')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    useUserStore.setState({ user: mockUser, sessionId: 'session-1' });
    useEventStore.setState({ event: mockEventOngoing, eventStatus: 'ONGOING' });
    const { container } = render(<Header />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
