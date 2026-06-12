import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from '../../test/setup';
import { LearningSubmit } from './LearningSubmit';

describe('LearningSubmit', () => {
  const defaultProps = {
    matchId: 'match-1',
    targetId: 'user-2',
    onSubmitted: vi.fn(),
  };

  it('renders content and justification fields', () => {
    render(<LearningSubmit {...defaultProps} />);
    expect(screen.getByLabelText(/what i learned about my partner/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/why it stood out/i)).toBeInTheDocument();
  });

  it('submit button is disabled when fields are empty', () => {
    render(<LearningSubmit {...defaultProps} />);
    expect(screen.getByRole('button', { name: /submit learning/i })).toBeDisabled();
  });

  it('submit button enables when both fields have content', async () => {
    const user = userEvent.setup();
    render(<LearningSubmit {...defaultProps} />);
    await user.type(screen.getByLabelText(/what i learned about my partner/i), 'He prefers async');
    await user.type(screen.getByLabelText(/why it stood out/i), 'Very genuine');
    expect(screen.getByRole('button', { name: /submit learning/i })).not.toBeDisabled();
  });

  it('calls onSubmitted and shows confirmation on success', async () => {
    const user = userEvent.setup();
    const onSubmitted = vi.fn();
    render(<LearningSubmit {...defaultProps} onSubmitted={onSubmitted} />);
    await user.type(screen.getByLabelText(/what i learned about my partner/i), 'He prefers async');
    await user.type(screen.getByLabelText(/why it stood out/i), 'Very genuine');
    await user.click(screen.getByRole('button', { name: /submit learning/i }));
    await waitFor(() => {
      expect(onSubmitted).toHaveBeenCalledOnce();
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<LearningSubmit {...defaultProps} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
