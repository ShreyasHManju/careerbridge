import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JobOfferModal } from '../JobOfferModal';
import * as jobOffersApi from '@/api/jobOffers';
import { JobOffer } from '@/types/jobOffer';

vi.mock('@/api/jobOffers', () => ({
  createJobOffer: vi.fn(),
  updateJobOffer: vi.fn(),
  sendJobOffer: vi.fn(),
  withdrawJobOffer: vi.fn(),
  getApplicationJobOffer: vi.fn(),
}));

describe('JobOfferModal Component', () => {
  const mockOffer: JobOffer = {
    id: 1,
    application_id: 10,
    recruiter_id: 20,
    title: 'Frontend Engineer',
    compensation: 95000,
    currency: 'USD',
    start_date: '2026-11-01T00:00:00Z',
    expiration_date: '2026-11-15T23:59:59Z',
    terms: 'Full medical, dental, 401(k) match.',
    status: 'draft',
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
  };

  const defaultProps = {
    isOpen: true,
    applicationId: 10,
    candidateName: 'Alex Student',
    jobTitle: 'Frontend Engineer',
    companyName: 'Acme Corp',
    existingOffer: null,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly when open and loads existing offer if none passed', async () => {
    (jobOffersApi.getApplicationJobOffer as any).mockResolvedValueOnce(null);

    render(<JobOfferModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('offer-title-input')).toBeInTheDocument();
    });

    expect(screen.getByTestId('job-offer-modal')).toBeInTheDocument();
    expect(screen.getByText(/Alex Student/)).toBeInTheDocument();
    expect(screen.getByTestId('offer-title-input')).toHaveValue('Frontend Engineer');
  });

  it('validates required fields before submitting draft', async () => {
    (jobOffersApi.getApplicationJobOffer as any).mockResolvedValueOnce(null);

    render(<JobOfferModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('offer-title-input')).toBeInTheDocument();
    });

    const titleInput = screen.getByTestId('offer-title-input');
    fireEvent.change(titleInput, { target: { value: '' } });

    const saveDraftBtn = screen.getByTestId('save-draft-offer-btn');
    fireEvent.click(saveDraftBtn);

    expect(screen.getByTestId('offer-error-alert')).toHaveTextContent(/Offer title \/ position is required/i);
    expect(jobOffersApi.createJobOffer).not.toHaveBeenCalled();
  });

  it('creates a new draft offer successfully', async () => {
    (jobOffersApi.getApplicationJobOffer as any).mockResolvedValueOnce(null);
    (jobOffersApi.createJobOffer as any).mockResolvedValueOnce(mockOffer);

    render(<JobOfferModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('offer-title-input')).toBeInTheDocument();
    });

    const compInput = screen.getByTestId('offer-compensation-input');
    fireEvent.change(compInput, { target: { value: '95000' } });

    const saveDraftBtn = screen.getByTestId('save-draft-offer-btn');
    fireEvent.click(saveDraftBtn);

    await waitFor(() => {
      expect(jobOffersApi.createJobOffer).toHaveBeenCalledWith(10, expect.objectContaining({
        title: 'Frontend Engineer',
        compensation: 95000,
      }));
      expect(defaultProps.onSuccess).toHaveBeenCalledWith(mockOffer);
      expect(screen.getByTestId('offer-success-alert')).toBeInTheDocument();
    });
  });

  it('creates and sends an offer successfully', async () => {
    (jobOffersApi.getApplicationJobOffer as any).mockResolvedValueOnce(null);
    const draftOffer = { ...mockOffer, status: 'draft' as const };
    const sentOffer = { ...mockOffer, status: 'offered' as const };
    (jobOffersApi.createJobOffer as any).mockResolvedValueOnce(draftOffer);
    (jobOffersApi.sendJobOffer as any).mockResolvedValueOnce(sentOffer);

    render(<JobOfferModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('offer-title-input')).toBeInTheDocument();
    });

    const sendBtn = screen.getByTestId('send-offer-btn');
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(jobOffersApi.createJobOffer).toHaveBeenCalledWith(10, expect.objectContaining({
        title: 'Frontend Engineer',
      }));
      expect(jobOffersApi.sendJobOffer).toHaveBeenCalledWith(draftOffer.id);
      expect(defaultProps.onSuccess).toHaveBeenCalledWith(sentOffer);
    });
  });

  it('updates and sends an existing draft offer', async () => {
    const sentOffer = { ...mockOffer, status: 'offered' as const };
    (jobOffersApi.updateJobOffer as any).mockResolvedValueOnce(mockOffer);
    (jobOffersApi.sendJobOffer as any).mockResolvedValueOnce(sentOffer);

    render(<JobOfferModal {...defaultProps} existingOffer={mockOffer} />);

    await waitFor(() => {
      expect(screen.getByTestId('offer-title-input')).toBeInTheDocument();
    });

    const sendBtn = screen.getByTestId('send-offer-btn');
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(jobOffersApi.updateJobOffer).toHaveBeenCalledWith(1, expect.any(Object));
      expect(jobOffersApi.sendJobOffer).toHaveBeenCalledWith(1);
      expect(defaultProps.onSuccess).toHaveBeenCalledWith(sentOffer);
    });
  });

  it('handles withdrawal of an active offer with confirmation', async () => {
    const activeOffer = { ...mockOffer, status: 'offered' as const };
    const withdrawnOffer = { ...mockOffer, status: 'withdrawn' as const };
    (jobOffersApi.withdrawJobOffer as any).mockResolvedValueOnce(withdrawnOffer);

    render(<JobOfferModal {...defaultProps} existingOffer={activeOffer} />);

    const withdrawTriggerBtn = screen.getByTestId('withdraw-offer-trigger-btn');
    fireEvent.click(withdrawTriggerBtn);

    const confirmWithdrawBtn = screen.getByTestId('confirm-withdraw-offer-btn');
    fireEvent.click(confirmWithdrawBtn);

    await waitFor(() => {
      expect(jobOffersApi.withdrawJobOffer).toHaveBeenCalledWith(1);
      expect(defaultProps.onSuccess).toHaveBeenCalledWith(withdrawnOffer);
    });
  });

  it('closes modal on close button click and on Escape key', () => {
    render(<JobOfferModal {...defaultProps} existingOffer={mockOffer} />);

    const closeBtn = screen.getByTestId('close-offer-modal-btn');
    fireEvent.click(closeBtn);
    expect(defaultProps.onClose).toHaveBeenCalled();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(defaultProps.onClose).toHaveBeenCalledTimes(2);
  });
});
