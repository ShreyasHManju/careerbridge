import { apiClient } from './client';
import {
  AdminUser,
  AdminUserPaginationResponse,
  AdminUserStatusUpdate,
  AdminUserQueryParams,
  AdminRecruiter,
  AdminRecruiterPaginationResponse,
  AdminRecruiterVerificationUpdate,
  AdminRecruiterQueryParams,
  AdminJobQueryParams,
  AdminJobStatusUpdate,
} from '@/types/admin';
import { JobPostingPagination, JobPosting } from '@/types/job';

/**
 * Retrieve paginated platform users with filtering and email search.
 * GET /api/v1/admin/users
 */
export async function getAdminUsers(
  params?: AdminUserQueryParams
): Promise<AdminUserPaginationResponse> {
  const response = await apiClient.get<AdminUserPaginationResponse>('/admin/users', {
    params,
  });
  return response.data;
}

/**
 * Retrieve safe details of a single user account.
 * GET /api/v1/admin/users/{user_id}
 */
export async function getAdminUserDetail(userId: number): Promise<AdminUser> {
  const response = await apiClient.get<AdminUser>(`/admin/users/${userId}`);
  return response.data;
}

/**
 * Activate or deactivate a user account.
 * Prohibits self-deactivation of the currently authenticated administrator.
 * PATCH /api/v1/admin/users/{user_id}/status
 */
export async function updateAdminUserStatus(
  userId: number,
  payload: AdminUserStatusUpdate
): Promise<AdminUser> {
  const response = await apiClient.patch<AdminUser>(
    `/admin/users/${userId}/status`,
    payload
  );
  return response.data;
}

/**
 * Retrieve paginated recruiters with verification filtering and search.
 * GET /api/v1/admin/recruiters
 */
export async function getAdminRecruiters(
  params?: AdminRecruiterQueryParams
): Promise<AdminRecruiterPaginationResponse> {
  const response = await apiClient.get<AdminRecruiterPaginationResponse>(
    '/admin/recruiters',
    { params }
  );
  return response.data;
}

/**
 * Verify or unverify a recruiter profile.
 * Note: Path expects the recruiter's user_id.
 * PATCH /api/v1/admin/recruiters/{user_id}/verification
 */
export async function updateAdminRecruiterVerification(
  userId: number,
  payload: AdminRecruiterVerificationUpdate
): Promise<AdminRecruiter> {
  const response = await apiClient.patch<AdminRecruiter>(
    `/admin/recruiters/${userId}/verification`,
    payload
  );
  return response.data;
}

/**
 * Retrieve all job postings across the platform for moderation (active and inactive).
 * GET /api/v1/admin/jobs
 */
export async function getAdminJobs(
  params?: AdminJobQueryParams
): Promise<JobPostingPagination> {
  const response = await apiClient.get<JobPostingPagination>('/admin/jobs', {
    params,
  });
  return response.data;
}

/**
 * Moderate job posting visibility by activating or deactivating the posting.
 * PATCH /api/v1/admin/jobs/{job_id}/status
 */
export async function updateAdminJobStatus(
  jobId: number,
  payload: AdminJobStatusUpdate
): Promise<JobPosting> {
  const response = await apiClient.patch<JobPosting>(
    `/admin/jobs/${jobId}/status`,
    payload
  );
  return response.data;
}
