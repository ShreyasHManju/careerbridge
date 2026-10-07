import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { OfferStatusBadge } from '../OfferStatusBadge';
import { OfferStatus } from '@/types/jobOffer';

describe('OfferStatusBadge', () => {
  const statuses: { status: OfferStatus; expectedLabel: string; expectedClass: string }[] = [
    { status: 'draft', expectedLabel: 'Draft', expectedClass: 'cb-offer-badge-draft' },
    { status: 'offered', expectedLabel: 'Offered', expectedClass: 'cb-offer-badge-offered' },
    { status: 'accepted', expectedLabel: 'Accepted', expectedClass: 'cb-offer-badge-accepted' },
    { status: 'rejected', expectedLabel: 'Declined', expectedClass: 'cb-offer-badge-rejected' },
    { status: 'withdrawn', expectedLabel: 'Withdrawn', expectedClass: 'cb-offer-badge-withdrawn' },
    { status: 'expired', expectedLabel: 'Expired', expectedClass: 'cb-offer-badge-expired' },
  ];

  statuses.forEach(({ status, expectedLabel, expectedClass }) => {
    it(`renders correct label and class for status "${status}"`, () => {
      render(<OfferStatusBadge status={status} />);
      const badge = screen.getByTestId('offer-status-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass(expectedClass);
      expect(screen.getByText(expectedLabel)).toBeInTheDocument();
    });
  });

  it('renders with size class when specified', () => {
    render(<OfferStatusBadge status="offered" size="sm" />);
    const badge = screen.getByTestId('offer-status-badge');
    expect(badge).toHaveClass('cb-app-badge-sm');
  });

  it('renders with accessible role status and aria-label', () => {
    render(<OfferStatusBadge status="accepted" />);
    const badge = screen.getByRole('status');
    expect(badge).toHaveAttribute('aria-label', 'Offer status: Accepted');
  });
});
