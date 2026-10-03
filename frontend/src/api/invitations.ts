import { apiClient } from './client';
import {
  CreateJobInvitationPayload,
  JobInvitation,
  RespondJobInvitationPayload,
} from '@/types/invitation';

/**
 * Send an invitation to apply for a job posting.
 * POST /api/v1/jobs/{job_id}/invitations
 */
export async function createJobInvitation(
  jobId: number,
  payload: CreateJobInvitationPayload
): Promise<JobInvitation> {
  const response = await apiClient.post<JobInvitation>(`/jobs/${jobId}/invitations`, payload);
  return response.data;
}

/**
 * List all invitations sent for a specific job posting.
 * GET /api/v1/jobs/{job_id}/invitations
 */
export async function getJobInvitations(jobId: number): Promise<JobInvitation[]> {
  const response = await apiClient.get<JobInvitation[]>(`/jobs/${jobId}/invitations`);
  return response.data;
}

/**
 * List all invitations received by the authenticated student.
 * GET /api/v1/student/invitations
 */
export async function getStudentInvitations(): Promise<JobInvitation[]> {
  const response = await apiClient.get<JobInvitation[]>('/student/invitations');
  return response.data;
}

/**
 * Respond to a job invitation (Accept or Decline).
 * PATCH /api/v1/invitations/{invitation_id}
 */
export async function respondToJobInvitation(
  invitationId: number,
  payload: RespondJobInvitationPayload
): Promise<JobInvitation> {
  const response = await apiClient.patch<JobInvitation>(`/invitations/${invitationId}`, payload);
  return response.data;
}
