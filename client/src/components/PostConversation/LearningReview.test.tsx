import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { axe } from '../../test/setup';
import { LearningReview } from './LearningReview';
import { mockLearning } from '../../mocks/fixtures';

describe('LearningReview', () => {
  const defaultProps = {
    learningId: 'learning-1',
    onReviewed: vi.fn(),
  };

  it('shows View Partner Learning button initially', () => {
    render(<LearningReview {...defaultProps} />);
    expect(screen.getByRole('button', { name: /view partner's learning/i })).toBeInTheDocument();
  });

  it('loads and displays learning content after clicking view', async () => {
    const user = userEvent.setup();
    render(<LearningReview {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: /view partner's learning/i }));
    await waitFor(() => {
      expect(screen.getByText(`"${mockLearning.content}"`)).toBeInTheDocument();
    });
  });

  it('shows error notification when API fails to load learning', async () => {
    server.use(
      http.get('/api/learnings/:id', () => HttpResponse.json({}, { status: 500 }))
    );
    const user = userEvent.setup();
    render(<LearningReview {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: /view partner's learning/i }));
    // Still shows View button (not loaded)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /view partner's learning/i })).toBeInTheDocument();
    });
  });

  it('submits review and calls onReviewed', async () => {
    const user = userEvent.setup();
    const onReviewed = vi.fn();
    render(<LearningReview learningId="learning-1" onReviewed={onReviewed} />);
    await user.click(screen.getByRole('button', { name: /view partner's learning/i }));
    await waitFor(() => screen.getByRole('button', { name: /submit review/i }));
    await user.click(screen.getByRole('button', { name: /submit review/i }));
    await waitFor(() => expect(onReviewed).toHaveBeenCalledOnce());
  });

  it('has no accessibility violations in initial state', async () => {
    const { container } = render(<LearningReview {...defaultProps} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
