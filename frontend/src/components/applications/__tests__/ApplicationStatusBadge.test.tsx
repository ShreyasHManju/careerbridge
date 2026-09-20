import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ApplicationStatusBadge } from '../ApplicationStatusBadge';
import { ApplicationStatus } from '@/types/application';

describe('ApplicationStatusBadge Component', () => {
  const statuses: { status: ApplicationStatus; expectedLabel: string; expectedClass: string }[] = [
    { status: 'applied', expectedLabel: 'Applied', expectedClass: 'cb-app-badge-applied' },
    { status: 'reviewing', expectedLabel: 'Reviewing', expectedClass: 'cb-app-badge-reviewing' },
    { status: 'shortlisted', expectedLabel: 'Shortlisted', expectedClass: 'cb-app-badge-shortlisted' },
    { status: 'rejected', expectedLabel: 'Rejected', expectedClass: 'cb-app-badge-rejected' },
    { status: 'accepted', expectedLabel: 'Accepted', expectedClass: 'cb-app-badge-accepted' },
  ];

  statuses.forEach(({ status, expectedLabel, expectedClass }) => {
    it(`renders correct text and style class for status '${status}'`, () => {
      render(<ApplicationStatusBadge status={status} />);
      const badge = screen.getByRole('status');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent(expectedLabel);
      expect(badge).toHaveClass(expectedClass);
      expect(badge).toHaveAttribute('aria-label', `Application status: ${expectedLabel}`);
    });
  });

  it('supports size variations', () => {
    const { rerender } = render(<ApplicationStatusBadge status="applied" size="sm" />);
    expect(screen.getByRole('status')).toHaveClass('cb-app-badge-sm');

    rerender(<ApplicationStatusBadge status="applied" size="lg" />);
    expect(screen.getByRole('status')).toHaveClass('cb-app-badge-lg');
  });

  it('accepts additional custom className', () => {
    render(<ApplicationStatusBadge status="accepted" className="custom-test-class" />);
    expect(screen.getByRole('status')).toHaveClass('custom-test-class');
  });
});
