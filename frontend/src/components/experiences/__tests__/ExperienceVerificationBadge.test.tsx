import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ExperienceVerificationBadge } from '../ExperienceVerificationBadge';
import { VerificationStatus } from '@/types/experience';

describe('ExperienceVerificationBadge Component', () => {
  const statuses: { status: VerificationStatus; expectedLabel: string; expectedTestId: string }[] = [
    { status: 'draft', expectedLabel: 'Draft', expectedTestId: 'experience-status-draft' },
    { status: 'claimed', expectedLabel: 'Claimed', expectedTestId: 'experience-status-claimed' },
    {
      status: 'pending_verification',
      expectedLabel: 'Pending Verification',
      expectedTestId: 'experience-status-pending_verification',
    },
    { status: 'verified', expectedLabel: 'Verified', expectedTestId: 'experience-status-verified' },
    { status: 'rejected', expectedLabel: 'Rejected', expectedTestId: 'experience-status-rejected' },
  ];

  statuses.forEach(({ status, expectedLabel, expectedTestId }) => {
    it(`renders correct label and accessible attributes for status "${status}"`, () => {
      render(<ExperienceVerificationBadge status={status} />);

      const badge = screen.getByTestId(expectedTestId);
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute('role', 'status');
      expect(badge).toHaveAttribute('aria-label', `Verification status: ${expectedLabel}`);
      expect(screen.getByText(expectedLabel)).toBeInTheDocument();
    });
  });

  it('renders with small size modifier class', () => {
    render(<ExperienceVerificationBadge status="verified" size="sm" />);
    const badge = screen.getByTestId('experience-status-verified');
    expect(badge).toHaveClass('cb-exp-badge-sm');
  });

  it('renders with large size modifier class', () => {
    render(<ExperienceVerificationBadge status="verified" size="lg" />);
    const badge = screen.getByTestId('experience-status-verified');
    expect(badge).toHaveClass('cb-exp-badge-lg');
  });

  it('allows hiding icon when showIcon is false', () => {
    const { container } = render(
      <ExperienceVerificationBadge status="verified" showIcon={false} />
    );
    expect(container.querySelector('.cb-exp-status-icon')).toBeNull();
  });
});
