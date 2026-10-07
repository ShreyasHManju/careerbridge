import { apiClient } from './client';
import {
  JobOffer,
  JobOfferCreate,
  JobOfferUpdate,
} from '@/types/jobOffer';

/**
 * Job Offers API Service Module (Phase 35B.4)
 * Handles job offer creation, editing, sending, withdrawal,
 * candidate decision actions (accept/reject), and offer retrieval.
 */

// ============================================================================
// Application-scoped Offer Endpoints
// ============================================================================

/**
 * Create a new job offer for a candidate application (recruiter only).
 * POST /api/v1/applications/{applicationId}/offers
 */
export async function createJobOffer(
  applicationId: number,
  data: JobOfferCreate
): Promise<JobOffer> {
  const response = await apiClient.post<JobOffer>(
    `/applications/${applicationId}/offers`,
    data
  );
  return response.data;
}

/**
 * Retrieve the job offer associated with an application.
 * Accessible by owning recruiter or candidate student (if released).
 * GET /api/v1/applications/{applicationId}/offers
 */
export async function getApplicationJobOffer(
  applicationId: number
): Promise<JobOffer | null> {
  try {
    const response = await apiClient.get<JobOffer>(
      `/applications/${applicationId}/offers`
    );
    return response.data;
  } catch (err: unknown) {
    const apiErr = err as { response?: { status?: number } };
    if (apiErr?.response?.status === 404) {
      return null;
    }
    throw err;
  }
}

// ============================================================================
// Standalone Job Offer Lifecycle Endpoints (/offers/{offerId})
// ============================================================================

/**
 * Retrieve a specific job offer by ID.
 * GET /api/v1/offers/{offerId}
 */
export async function getJobOfferById(offerId: number): Promise<JobOffer> {
  const response = await apiClient.get<JobOffer>(`/offers/${offerId}`);
  return response.data;
}

/**
 * Update an existing job offer (recruiter only).
 * PATCH /api/v1/offers/{offerId}
 */
export async function updateJobOffer(
  offerId: number,
  data: JobOfferUpdate
): Promise<JobOffer> {
  const response = await apiClient.patch<JobOffer>(
    `/offers/${offerId}`,
    data
  );
  return response.data;
}

/**
 * Send a draft job offer to the candidate student (recruiter only).
 * Transitions JobOffer to OFFERED and Application to OFFERED.
 * POST /api/v1/offers/{offerId}/send
 */
export async function sendJobOffer(offerId: number): Promise<JobOffer> {
  const response = await apiClient.post<JobOffer>(
    `/offers/${offerId}/send`
  );
  return response.data;
}

/**
 * Withdraw an active or draft job offer (recruiter only).
 * POST /api/v1/offers/{offerId}/withdraw
 */
export async function withdrawJobOffer(offerId: number): Promise<JobOffer> {
  const response = await apiClient.post<JobOffer>(
    `/offers/${offerId}/withdraw`
  );
  return response.data;
}

/**
 * Accept an extended job offer (student only).
 * Transitions JobOffer and Application to ACCEPTED, creating a verified ExperienceRecord.
 * POST /api/v1/offers/{offerId}/accept
 */
export async function acceptJobOffer(offerId: number): Promise<JobOffer> {
  const response = await apiClient.post<JobOffer>(
    `/offers/${offerId}/accept`
  );
  return response.data;
}

/**
 * Decline / reject an extended job offer (student only).
 * Transitions JobOffer and Application to REJECTED.
 * POST /api/v1/offers/{offerId}/reject
 */
export async function rejectJobOffer(offerId: number): Promise<JobOffer> {
  const response = await apiClient.post<JobOffer>(
    `/offers/${offerId}/reject`
  );
  return response.data;
}

// ============================================================================
// Collection Endpoints
// ============================================================================

/**
 * Retrieve all job offers created by the authenticated recruiter.
 * GET /api/v1/recruiter/offers
 */
export async function getRecruiterOffers(status?: string): Promise<JobOffer[]> {
  const params = status ? { status } : undefined;
  const response = await apiClient.get<JobOffer[]>('/recruiter/offers', { params });
  return response.data;
}

/**
 * Retrieve all released job offers received by the authenticated student.
 * GET /api/v1/student/offers
 */
export async function getStudentOffers(): Promise<JobOffer[]> {
  const response = await apiClient.get<JobOffer[]>('/student/offers');
  return response.data;
}
