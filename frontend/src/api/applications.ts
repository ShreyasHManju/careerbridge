import { apiClient } from './client';
import { Application, ApplicationCreate } from '@/types/job';

/**
 * Job Applications API Service Module
 * Student-only endpoint for submitting job/internship applications.
 */

export async function applyToJob(
  jobId: number,
  data?: ApplicationCreate
): Promise<Application> {
  const payload = data && data.cover_message !== undefined
    ? { cover_message: data.cover_message }
    : {};
  const response = await apiClient.post<Application>(`/jobs/${jobId}/applications`, payload);
  return response.data;
}
