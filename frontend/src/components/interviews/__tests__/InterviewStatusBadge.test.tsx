import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { InterviewStatusBadge } from '../InterviewStatusBadge';
import { InterviewStatus } from '@/types/interview';

describe('InterviewStatusBadge Component', () => {
  const statuses: { status: InterviewStatus; expectedText: string }[] = [
    { status: 'scheduled', expectedText: 'Scheduled' },
    { status: 'rescheduled', expectedText: 'Rescheduled' },
    { status: 'completed', expectedText: 'Completed' },
    { status: 'cancelled', expectedText: 'Cancelled' },
  ];

  statuses.forEach(({ status, expectedText }) => {
    it(`renders correct label and aria attributes for status '${status}'`, () => {
      render(<InterviewStatusBadge status={status} />);
      const badge = screen.getByRole('status');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent(expectedText);
      expect(badge).toHaveAttribute('aria-label', `Interview status: ${expectedText}`);
    });
  });

  it('applies custom size class and additional className when provided', () => {
    render(<InterviewStatusBadge status="scheduled" size="sm" className="custom-test-class" />);
    const badge = screen.getByRole('status');
    expect(badge.className).toContain('cb-interview-badge-sm');
    expect(badge.className).toContain('custom-test-class');
  });

  it('renders large size variant correctly', () => {
    render(<InterviewStatusBadge status="completed" size="lg" />);
    const badge = screen.getByRole('status');
    expect(badge.className).toContain('cb-interview-badge-lg');
  });
});
