import { apiClient } from './client';
import {
  JobPosting,
  JobPostingPagination,
  JobFilters,
  JobPostingCreate,
  JobPostingUpdate,
} from '@/types/job';

/**
 * Opportunity Discovery & Recruiter Management API Service
 * Handles candidate discovery search/filtering, and recruiter-owned job CRUD operations.
 */

export async function getJobs(filters: JobFilters = {}): Promise<JobPostingPagination> {
  const params: Record<string, string | number | boolean> = {};

  if (filters.q && filters.q.trim()) {
    params.q = filters.q.trim();
  }
  if (filters.opportunity_type) {
    params.opportunity_type = filters.opportunity_type;
  }
  if (filters.employment_type) {
    params.employment_type = filters.employment_type;
  }
  if (typeof filters.is_remote === 'boolean') {
    params.is_remote = filters.is_remote;
  }
  if (filters.location && filters.location.trim()) {
    params.location = filters.location.trim();
  }
  if (filters.skills && filters.skills.trim()) {
    params.skills = filters.skills.trim();
  }
  if (typeof filters.salary_min === 'number' && !isNaN(filters.salary_min)) {
    params.salary_min = filters.salary_min;
  }
  if (typeof filters.salary_max === 'number' && !isNaN(filters.salary_max)) {
    params.salary_max = filters.salary_max;
  }
  if (filters.page && filters.page >= 1) {
    params.page = filters.page;
  }
  if (filters.page_size && filters.page_size >= 1) {
    params.page_size = Math.min(filters.page_size, 100);
  }
  if (filters.sort_by) {
    params.sort_by = filters.sort_by;
  }
  if (filters.sort_order) {
    params.sort_order = filters.sort_order;
  }

  const response = await apiClient.get<JobPostingPagination>('/jobs', { params });
  return response.data;
}

export async function getJobById(id: number): Promise<JobPosting> {
  const response = await apiClient.get<JobPosting>(`/jobs/${id}`);
  return response.data;
}

/**
 * Retrieve all job postings owned by the authenticated recruiter (active and inactive).
 * GET /api/v1/jobs/my
 */
export async function getMyJobPostings(): Promise<JobPosting[]> {
  const response = await apiClient.get<JobPosting[]>('/jobs/my');
  return response.data;
}

/**
 * Create a new job or internship posting (recruiter only).
 * POST /api/v1/jobs
 */
export async function createJob(payload: JobPostingCreate): Promise<JobPosting> {
  const response = await apiClient.post<JobPosting>('/jobs', payload);
  return response.data;
}

/**
 * Partially update an existing job posting (owning recruiter only).
 * PATCH /api/v1/jobs/{id}
 */
export async function updateJob(
  jobId: number,
  payload: JobPostingUpdate
): Promise<JobPosting> {
  const response = await apiClient.patch<JobPosting>(`/jobs/${jobId}`, payload);
  return response.data;
}

/**
 * Permanently delete a job posting (owning recruiter only).
 * DELETE /api/v1/jobs/{id}
 */
export async function deleteJob(jobId: number): Promise<void> {
  await apiClient.delete<void>(`/jobs/${jobId}`);
}
