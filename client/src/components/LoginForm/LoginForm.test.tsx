import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { axe } from '../../test/setup';
import { LoginForm } from './LoginForm';

describe('LoginForm', () => {
  it('renders email field and sign in button', () => {
    render(<LoginForm onSuccess={vi.fn()} />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('calls onSuccess after successful login', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    render(<LoginForm onSuccess={onSuccess} />);
    await user.type(screen.getByLabelText(/email/i), 'alice@example.com');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
  });

  it('shows 404 error message when email is not found', async () => {
    server.use(
      http.post('/api/auth/login', () => HttpResponse.json({}, { status: 404 }))
    );
    const user = userEvent.setup();
    render(<LoginForm onSuccess={vi.fn()} />);
    await user.type(screen.getByLabelText(/email/i), 'unknown@example.com');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/no account found/i);
    });
  });

  it('shows generic error on server failure', async () => {
    server.use(
      http.post('/api/auth/login', () => HttpResponse.json({}, { status: 500 }))
    );
    const user = userEvent.setup();
    render(<LoginForm onSuccess={vi.fn()} />);
    await user.type(screen.getByLabelText(/email/i), 'alice@example.com');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/login failed/i);
    });
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<LoginForm onSuccess={vi.fn()} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
