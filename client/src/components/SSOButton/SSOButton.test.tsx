import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from '../../test/setup';
import { SSOButton } from './SSOButton';

describe('SSOButton', () => {
  it('renders a link to Google OAuth', () => {
    render(<SSOButton />);
    const link = screen.getByRole('link', { name: /sign in with google/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/api/auth/google');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<SSOButton />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
