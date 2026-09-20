import { apiClient } from './client';
import {
  Application,
  ApplicationCreate,
  ApplicationStatus,
  ApplicationUpdate,
} from '@/types/application';

/**
 * Applications API Service Module (Phase F-06)
 * Handles student application submission and tracking,
 * as well as recruiter application review and status lifecycle updates.
 */

// ============================================================================
// Student Application Services
// ============================================================================

/**
 * Submit an application to a job posting (student only).
 * POST /api/v1/jobs/{jobId}/applications
 */
export async function applyToJob(
  jobId: number,
  data?: ApplicationCreate
): Promise<Application> {
  const payload =
    data && data.cover_message !== undefined
      ? { cover_message: data.cover_message }
      : {};
  const response = await apiClient.post<Application>(
    `/jobs/${jobId}/applications`,
    payload
  );
  return response.data;
}

/**
 * Retrieve all applications submitted by the current authenticated student.
 * Ordered newest first.
 * GET /api/v1/applications/me
 */
export async function getMyApplications(): Promise<Application[]> {
  const response = await apiClient.get<Application[]>('/applications/me');
  return response.data;
}

/**
 * Retrieve a single application detail by ID.
 * Accessible to applicant student, hiring recruiter, or admin.
 * GET /api/v1/applications/{applicationId}
 */
export async function getApplicationById(
  applicationId: number
): Promise<Application> {
  const response = await apiClient.get<Application>(
    `/applications/${applicationId}`
  );
  return response.data;
}

// ============================================================================
// Recruiter Application Services
// ============================================================================

/**
 * Retrieve all candidate applications received across all job postings
 * owned by the authenticated recruiter. Ordered newest first.
 * GET /api/v1/recruiter/applications
 */
export async function getRecruiterApplications(): Promise<Application[]> {
  const response = await apiClient.get<Application[]>('/recruiter/applications');
  return response.data;
}

/**
 * Retrieve a single candidate application detail for a job posting
 * owned by the authenticated recruiter.
 * GET /api/v1/recruiter/applications/{applicationId}
 */
export async function getRecruiterApplicationById(
  applicationId: number
): Promise<Application> {
  const response = await apiClient.get<Application>(
    `/recruiter/applications/${applicationId}`
  );
  return response.data;
}

/**
 * Update candidate application status (recruiter only).
 * Valid statuses: 'applied', 'reviewing', 'shortlisted', 'rejected', 'accepted'.
 * PATCH /api/v1/recruiter/applications/{applicationId}
 */
export async function updateApplicationStatus(
  applicationId: number,
  status: ApplicationStatus
): Promise<Application> {
  const payload: ApplicationUpdate = { status };
  const response = await apiClient.patch<Application>(
    `/recruiter/applications/${applicationId}`,
    payload
  );
  return response.data;
}
