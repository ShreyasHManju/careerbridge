import { apiClient } from './client';
import { JobPosting, JobPostingPagination, JobFilters } from '@/types/job';

/**
 * Opportunity Discovery API Service
 * Handles listing, searching, filtering, paginating, and fetching job details.
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
