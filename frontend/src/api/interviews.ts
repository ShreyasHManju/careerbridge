import { apiClient } from './client';
import {
  Interview,
  InterviewCreate,
  InterviewUpdate,
} from '@/types/interview';

/**
 * Interview Scheduling API Service Module (Phase F-08)
 * Handles scheduling, listing, updating/rescheduling, and cancelling interviews.
 */

// ============================================================================
// Recruiter Interview Services
// ============================================================================

/**
 * Schedule a new interview for a job application (recruiter only).
 * POST /api/v1/applications/{applicationId}/interviews
 */
export async function scheduleInterview(
  applicationId: number,
  data: InterviewCreate
): Promise<Interview> {
  const response = await apiClient.post<Interview>(
    `/applications/${applicationId}/interviews`,
    data
  );
  return response.data;
}

/**
 * Retrieve all interviews scheduled by the current recruiter.
 * GET /api/v1/recruiter/interviews
 */
export async function getRecruiterInterviews(): Promise<Interview[]> {
  const response = await apiClient.get<Interview[]>('/recruiter/interviews');
  return response.data;
}

/**
 * Update or reschedule an interview (recruiter only).
 * PATCH /api/v1/interviews/{interviewId}
 */
export async function updateInterview(
  interviewId: number,
  data: InterviewUpdate
): Promise<Interview> {
  const response = await apiClient.patch<Interview>(
    `/interviews/${interviewId}`,
    data
  );
  return response.data;
}

/**
 * Cancel an interview (recruiter only).
 * DELETE /api/v1/interviews/{interviewId}
 */
export async function cancelInterview(
  interviewId: number
): Promise<Interview> {
  const response = await apiClient.delete<Interview>(
    `/interviews/${interviewId}`
  );
  return response.data;
}

// ============================================================================
// Student & Common Interview Services
// ============================================================================

/**
 * Retrieve all interviews scheduled for the current student.
 * GET /api/v1/interviews/me
 */
export async function getMyInterviews(): Promise<Interview[]> {
  const response = await apiClient.get<Interview[]>('/interviews/me');
  return response.data;
}

/**
 * Retrieve a single interview detail by ID.
 * Accessible to participating student, hiring recruiter, or admin.
 * GET /api/v1/interviews/{interviewId}
 */
export async function getInterviewById(
  interviewId: number
): Promise<Interview> {
  const response = await apiClient.get<Interview>(
    `/interviews/${interviewId}`
  );
  return response.data;
}
