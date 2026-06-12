import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { axe } from '../../test/setup';
import { NotificationLayer } from './NotificationLayer';
import { renderWithProviders } from '../../test/renderWithProviders';
import { useNotificationStore } from '../../stores/useNotificationStore';

beforeEach(() => {
  useNotificationStore.setState({ notifications: [] });
});

describe('NotificationLayer', () => {
  it('renders nothing when there are no notifications', () => {
    const { container } = renderWithProviders(<NotificationLayer />);
    expect(container.querySelector('.k-notification')).not.toBeInTheDocument();
  });

  it('shows a success notification from the store', async () => {
    renderWithProviders(<NotificationLayer />);
    useNotificationStore.getState().addNotification({ type: 'success', message: 'Matched!' });
    await waitFor(() => {
      expect(screen.getByText('Matched!')).toBeInTheDocument();
    });
  });

  it('shows toast when match:found socket event fires', async () => {
    const { socket } = renderWithProviders(<NotificationLayer />);
    socket.emit('match:found', {});
    await waitFor(() => {
      expect(screen.getByText(/you've been matched/i)).toBeInTheDocument();
    });
  });

  it('shows toast when match:cancelled fires', async () => {
    const { socket } = renderWithProviders(<NotificationLayer />);
    socket.emit('match:cancelled', {});
    await waitFor(() => {
      expect(screen.getByText(/partner disconnected/i)).toBeInTheDocument();
    });
  });

  it('shows toast when user:offline fires', async () => {
    const { socket } = renderWithProviders(<NotificationLayer />);
    socket.emit('user:offline', {});
    await waitFor(() => {
      expect(screen.getByText(/marked offline/i)).toBeInTheDocument();
    });
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(<NotificationLayer />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
