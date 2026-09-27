import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { VerificationStatusBadge } from '../VerificationStatusBadge';

describe('VerificationStatusBadge Component', () => {
  it('renders pending status badge with clock icon and accessible title', () => {
    render(<VerificationStatusBadge status="pending" />);
    const badge = screen.getByTestId('verification-badge-pending');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Pending Review');
    expect(badge).toHaveAttribute('aria-label', 'Verification status: Pending Review');
    expect(badge).toHaveClass('cb-badge-pending');
  });

  it('renders verified status badge with check icon', () => {
    render(<VerificationStatusBadge status="verified" />);
    const badge = screen.getByTestId('verification-badge-verified');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Verified Evidence');
    expect(badge).toHaveAttribute('aria-label', 'Verification status: Verified Evidence');
    expect(badge).toHaveClass('cb-badge-verified');
  });

  it('renders rejected status badge with cross icon', () => {
    render(<VerificationStatusBadge status="rejected" />);
    const badge = screen.getByTestId('verification-badge-rejected');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Review Rejected');
    expect(badge).toHaveAttribute('aria-label', 'Verification status: Review Rejected');
    expect(badge).toHaveClass('cb-badge-rejected');
  });

  it('defaults to pending when status is null or undefined', () => {
    render(<VerificationStatusBadge status={null} />);
    const badge = screen.getByTestId('verification-badge-pending');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Pending Review');
  });

  it('applies custom className and custom testId', () => {
    render(
      <VerificationStatusBadge
        status="verified"
        className="custom-audit-badge"
        testId="audit-badge-1"
      />
    );
    const badge = screen.getByTestId('audit-badge-1');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('custom-audit-badge');
  });
});
