import { apiClient } from './client';
import { SavedJob, SavedJobStatus } from '@/types/job';

/**
 * Saved Jobs API Service Module
 * Student-only endpoints for saving, unsaving, and retrieving bookmarked opportunities.
 */

export async function getSavedJobs(): Promise<SavedJob[]> {
  const response = await apiClient.get<SavedJob[]>('/saved-jobs');
  return response.data;
}

export async function getSavedJobStatus(jobId: number): Promise<SavedJobStatus> {
  const response = await apiClient.get<SavedJobStatus>(`/jobs/${jobId}/saved`);
  return response.data;
}

export async function saveJob(jobId: number): Promise<SavedJobStatus> {
  const response = await apiClient.post<SavedJobStatus>(`/jobs/${jobId}/save`);
  return response.data;
}

export async function unsaveJob(jobId: number): Promise<void> {
  await apiClient.delete<void>(`/jobs/${jobId}/save`);
}
