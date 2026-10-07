import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '../client';
import {
  createJobOffer,
  getApplicationJobOffer,
  getJobOfferById,
  updateJobOffer,
  sendJobOffer,
  withdrawJobOffer,
  getRecruiterOffers,
  getStudentOffers,
  acceptJobOffer,
  rejectJobOffer,
} from '../jobOffers';
import { JobOffer, JobOfferCreate, JobOfferUpdate } from '@/types/jobOffer';

vi.mock('../client', () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

describe('jobOffers API client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockOffer: JobOffer = {
    id: 10,
    application_id: 101,
    recruiter_id: 201,
    title: 'Senior Frontend Engineer',
    compensation: 120000,
    currency: 'USD',
    start_date: '2026-11-01T09:00:00Z',
    expiration_date: '2026-11-15T23:59:59Z',
    terms: 'Standard employee stock and benefits apply.',
    status: 'draft',
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
  };

  it('createJobOffer calls POST /api/v1/applications/{applicationId}/offers with payload', async () => {
    (apiClient.post as any).mockResolvedValueOnce({ data: mockOffer });

    const payload: JobOfferCreate = {
      title: 'Senior Frontend Engineer',
      compensation: 120000,
      currency: 'USD',
    };

    const result = await createJobOffer(101, payload);

    expect(apiClient.post).toHaveBeenCalledWith('/applications/101/offers', payload);
    expect(result).toEqual(mockOffer);
  });

  it('getApplicationJobOffer calls GET /api/v1/applications/{applicationId}/offers and returns data', async () => {
    (apiClient.get as any).mockResolvedValueOnce({ data: mockOffer });

    const result = await getApplicationJobOffer(101);

    expect(apiClient.get).toHaveBeenCalledWith('/applications/101/offers');
    expect(result).toEqual(mockOffer);
  });

  it('getApplicationJobOffer returns null when 404 is encountered', async () => {
    (apiClient.get as any).mockRejectedValueOnce({ response: { status: 404 } });

    const result = await getApplicationJobOffer(999);

    expect(result).toBeNull();
  });

  it('getJobOfferById calls GET /api/v1/offers/{offerId}', async () => {
    (apiClient.get as any).mockResolvedValueOnce({ data: mockOffer });

    const result = await getJobOfferById(10);

    expect(apiClient.get).toHaveBeenCalledWith('/offers/10');
    expect(result).toEqual(mockOffer);
  });

  it('updateJobOffer calls PATCH /api/v1/offers/{offerId} with update fields', async () => {
    const updatedOffer = { ...mockOffer, title: 'Lead Engineer' };
    (apiClient.patch as any).mockResolvedValueOnce({ data: updatedOffer });

    const payload: JobOfferUpdate = { title: 'Lead Engineer' };
    const result = await updateJobOffer(10, payload);

    expect(apiClient.patch).toHaveBeenCalledWith('/offers/10', payload);
    expect(result).toEqual(updatedOffer);
  });

  it('sendJobOffer calls POST /api/v1/offers/{offerId}/send', async () => {
    const sentOffer = { ...mockOffer, status: 'offered' as const };
    (apiClient.post as any).mockResolvedValueOnce({ data: sentOffer });

    const result = await sendJobOffer(10);

    expect(apiClient.post).toHaveBeenCalledWith('/offers/10/send');
    expect(result.status).toBe('offered');
  });

  it('withdrawJobOffer calls POST /api/v1/offers/{offerId}/withdraw', async () => {
    const withdrawnOffer = { ...mockOffer, status: 'withdrawn' as const };
    (apiClient.post as any).mockResolvedValueOnce({ data: withdrawnOffer });

    const result = await withdrawJobOffer(10);

    expect(apiClient.post).toHaveBeenCalledWith('/offers/10/withdraw');
    expect(result.status).toBe('withdrawn');
  });

  it('getRecruiterOffers calls GET /api/v1/recruiter/offers with status filter', async () => {
    const listResponse = [mockOffer];
    (apiClient.get as any).mockResolvedValueOnce({ data: listResponse });

    const result = await getRecruiterOffers('offered');

    expect(apiClient.get).toHaveBeenCalledWith('/recruiter/offers', {
      params: { status: 'offered' },
    });
    expect(result).toEqual(listResponse);
  });

  it('getStudentOffers calls GET /api/v1/student/offers', async () => {
    const listResponse = [mockOffer];
    (apiClient.get as any).mockResolvedValueOnce({ data: listResponse });

    const result = await getStudentOffers();

    expect(apiClient.get).toHaveBeenCalledWith('/student/offers');
    expect(result).toEqual(listResponse);
  });

  it('acceptJobOffer calls POST /api/v1/offers/{offerId}/accept', async () => {
    const acceptedOffer = { ...mockOffer, status: 'accepted' as const };
    (apiClient.post as any).mockResolvedValueOnce({ data: acceptedOffer });

    const result = await acceptJobOffer(10);

    expect(apiClient.post).toHaveBeenCalledWith('/offers/10/accept');
    expect(result.status).toBe('accepted');
  });

  it('rejectJobOffer calls POST /api/v1/offers/{offerId}/reject', async () => {
    const rejectedOffer = { ...mockOffer, status: 'rejected' as const };
    (apiClient.post as any).mockResolvedValueOnce({ data: rejectedOffer });

    const result = await rejectJobOffer(10);

    expect(apiClient.post).toHaveBeenCalledWith('/offers/10/reject');
    expect(result.status).toBe('rejected');
  });
});
