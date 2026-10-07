import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StudentOfferDecisionModal } from '../StudentOfferDecisionModal';
import * as jobOffersApi from '@/api/jobOffers';
import { JobOffer } from '@/types/jobOffer';
import { JobPosting } from '@/types/job';

vi.mock('@/api/jobOffers', () => ({
  acceptJobOffer: vi.fn(),
  rejectJobOffer: vi.fn(),
  getJobOfferById: vi.fn(),
}));

describe('StudentOfferDecisionModal Component', () => {
  const mockOffer: JobOffer = {
    id: 42,
    application_id: 101,
    recruiter_id: 202,
    title: 'Full-Stack Developer',
    compensation: 105000,
    currency: 'USD',
    start_date: '2026-12-01T00:00:00Z',
    expiration_date: '2026-12-15T23:59:59Z',
    terms: 'Relocation package included. 4 weeks PTO.',
    status: 'offered',
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
  };

  const mockJob: JobPosting = {
    id: 5,
    title: 'Full-Stack Developer',
    company_name: 'Tech Innovations Inc',
    location: 'San Francisco, CA',
    is_remote: true,
    opportunity_type: 'job',
  } as any;

  const defaultProps = {
    isOpen: true,
    offer: mockOffer,
    job: mockJob,
    onClose: vi.fn(),
    onDecisionComplete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders offer details and company information accurately', () => {
    render(<StudentOfferDecisionModal {...defaultProps} />);

    expect(screen.getByTestId('student-offer-decision-modal')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Full-Stack Developer' })).toBeInTheDocument();
    expect(screen.getByText('Tech Innovations Inc')).toBeInTheDocument();
    expect(screen.getByText(/Relocation package included/)).toBeInTheDocument();
    expect(screen.getByTestId('accept-offer-trigger-btn')).toBeInTheDocument();
    expect(screen.getByTestId('reject-offer-trigger-btn')).toBeInTheDocument();
  });

  it('completes offer acceptance flow after confirmation', async () => {
    const acceptedOffer = { ...mockOffer, status: 'accepted' as const };
    (jobOffersApi.acceptJobOffer as any).mockResolvedValueOnce(acceptedOffer);

    render(<StudentOfferDecisionModal {...defaultProps} />);

    // Click Accept Offer to open confirmation dialog
    fireEvent.click(screen.getByTestId('accept-offer-trigger-btn'));
    expect(screen.getByTestId('accept-confirm-box')).toBeInTheDocument();

    // Confirm acceptance
    fireEvent.click(screen.getByTestId('confirm-accept-btn'));

    await waitFor(() => {
      expect(jobOffersApi.acceptJobOffer).toHaveBeenCalledWith(42);
      expect(defaultProps.onDecisionComplete).toHaveBeenCalledWith(acceptedOffer, 'accepted');
      expect(screen.getByTestId('student-offer-success-alert')).toHaveTextContent(/Congratulations! You have accepted the job offer/i);
    });
  });

  it('completes offer decline flow after confirmation', async () => {
    const rejectedOffer = { ...mockOffer, status: 'rejected' as const };
    (jobOffersApi.rejectJobOffer as any).mockResolvedValueOnce(rejectedOffer);

    render(<StudentOfferDecisionModal {...defaultProps} />);

    // Click Decline Offer to open confirmation dialog
    fireEvent.click(screen.getByTestId('reject-offer-trigger-btn'));
    expect(screen.getByTestId('reject-confirm-box')).toBeInTheDocument();

    // Confirm decline
    fireEvent.click(screen.getByTestId('confirm-reject-btn'));

    await waitFor(() => {
      expect(jobOffersApi.rejectJobOffer).toHaveBeenCalledWith(42);
      expect(defaultProps.onDecisionComplete).toHaveBeenCalledWith(rejectedOffer, 'rejected');
      expect(screen.getByTestId('student-offer-success-alert')).toHaveTextContent(/You have declined the job offer/i);
    });
  });

  it('handles backend 400 error and refetches offer state without claiming success', async () => {
    (jobOffersApi.acceptJobOffer as any).mockRejectedValueOnce({
      detail: 'Cannot accept offer with status withdrawn.',
    });
    const refreshedOffer = { ...mockOffer, status: 'withdrawn' as const };
    (jobOffersApi.getJobOfferById as any).mockResolvedValueOnce(refreshedOffer);

    render(<StudentOfferDecisionModal {...defaultProps} />);

    fireEvent.click(screen.getByTestId('accept-offer-trigger-btn'));
    fireEvent.click(screen.getByTestId('confirm-accept-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('student-offer-error-alert')).toHaveTextContent(/Cannot accept offer with status withdrawn/i);
      expect(jobOffersApi.getJobOfferById).toHaveBeenCalledWith(42);
      expect(defaultProps.onDecisionComplete).not.toHaveBeenCalled();
    });
  });

  it('does not display accept or reject buttons for non-offered terminal states', () => {
    const expiredOffer = { ...mockOffer, status: 'expired' as const };
    render(<StudentOfferDecisionModal {...defaultProps} offer={expiredOffer} />);

    expect(screen.queryByTestId('accept-offer-trigger-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('reject-offer-trigger-btn')).not.toBeInTheDocument();
    expect(screen.getByText(/The response window for this job offer has expired/i)).toBeInTheDocument();
  });
});
