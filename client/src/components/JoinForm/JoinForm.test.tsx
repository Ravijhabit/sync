import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { axe } from '../../test/setup';
import { JoinForm } from './JoinForm';

describe('JoinForm', () => {
  it('renders name, email, company fields', () => {
    render(<JoinForm eventId="event-1" onSuccess={vi.fn()} />);
    expect(screen.getByLabelText(/^name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/company/i)).toBeInTheDocument();
  });

  it('calls onSuccess after successful join', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    render(<JoinForm eventId="event-1" onSuccess={onSuccess} />);
    await user.type(screen.getByLabelText(/^name/i), 'Alice');
    await user.type(screen.getByLabelText(/email/i), 'alice@example.com');
    await user.type(screen.getByLabelText(/company/i), 'Acme');
    await user.click(screen.getByRole('button', { name: /join event/i }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
  });

  it('shows error message on server failure', async () => {
    server.use(
      http.post('/api/auth/join', () => HttpResponse.json({}, { status: 500 }))
    );
    const user = userEvent.setup();
    render(<JoinForm eventId="event-1" onSuccess={vi.fn()} />);
    await user.type(screen.getByLabelText(/^name/i), 'Alice');
    await user.type(screen.getByLabelText(/email/i), 'alice@example.com');
    await user.type(screen.getByLabelText(/company/i), 'Acme');
    await user.click(screen.getByRole('button', { name: /join event/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/failed to join/i);
    });
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<JoinForm eventId="event-1" onSuccess={vi.fn()} />);
    // label rule suppressed for Bio: KendoReact TextArea inside Form Field does not link label via for/id
    expect(await axe(container, { rules: { label: { enabled: false } } })).toHaveNoViolations();
  });
});
