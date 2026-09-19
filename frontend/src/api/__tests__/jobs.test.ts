import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiClient } from '../client';
import { getJobs, getJobById } from '../jobs';
import { JobPosting, JobPostingPagination } from '@/types/job';
import { ApiErrorResponse } from '@/types/api';

const mockJob: JobPosting = {
  id: 1,
  recruiter_id: 5,
  title: 'Full Stack Engineer Intern',
  description: 'Join our team to develop scalable web applications.',
  opportunity_type: 'internship',
  company_name: 'TechFlow Corp',
  location: 'San Francisco, CA',
  is_remote: true,
  employment_type: 'full_time',
  skills: 'React, TypeScript, Python',
  minimum_qualification: 'B.S. in Computer Science or equivalent',
  experience_required: '0-1 years',
  salary_min: 40000,
  salary_max: 60000,
  application_deadline: '2026-11-30T23:59:59Z',
  is_active: true,
  created_at: '2026-09-19T10:00:00Z',
  updated_at: '2026-09-19T10:00:00Z',
};

const mockPaginationResponse: JobPostingPagination = {
  items: [mockJob],
  page: 1,
  page_size: 10,
  total: 1,
  total_pages: 1,
};

describe('Jobs API Service Module', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getJobs', () => {
    it('dispatches GET to /jobs with default empty params when no filters provided', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: mockPaginationResponse,
      });

      const result = await getJobs();

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith('/jobs', { params: {} });
      expect(result).toEqual(mockPaginationResponse);
    });

    it('serializes keyword search parameter q properly', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: mockPaginationResponse,
      });

      await getJobs({ q: 'python developer' });

      expect(getSpy).toHaveBeenCalledWith('/jobs', {
        params: { q: 'python developer' },
      });
    });

    it('serializes all supported filters properly', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: mockPaginationResponse,
      });

      await getJobs({
        opportunity_type: 'internship',
        employment_type: 'full_time',
        is_remote: true,
        location: 'Bengaluru',
        skills: 'TypeScript',
        salary_min: 25000,
        salary_max: 50000,
      });

      expect(getSpy).toHaveBeenCalledWith('/jobs', {
        params: {
          opportunity_type: 'internship',
          employment_type: 'full_time',
          is_remote: true,
          location: 'Bengaluru',
          skills: 'TypeScript',
          salary_min: 25000,
          salary_max: 50000,
        },
      });
    });

    it('serializes is_remote=false correctly as boolean false', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: mockPaginationResponse,
      });

      await getJobs({ is_remote: false });

      expect(getSpy).toHaveBeenCalledWith('/jobs', {
        params: { is_remote: false },
      });
    });

    it('serializes pagination and sorting parameters with page_size capping at 100', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: mockPaginationResponse,
      });

      await getJobs({
        page: 3,
        page_size: 150, // exceeds 100 -> should cap to 100
        sort_by: 'salary_min',
        sort_order: 'asc',
      });

      expect(getSpy).toHaveBeenCalledWith('/jobs', {
        params: {
          page: 3,
          page_size: 100,
          sort_by: 'salary_min',
          sort_order: 'asc',
        },
      });
    });

    it('trims whitespace and ignores empty string filters', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: mockPaginationResponse,
      });

      await getJobs({
        q: '   ',
        location: '  ',
        skills: '  ',
      });

      expect(getSpy).toHaveBeenCalledWith('/jobs', { params: {} });
    });

    it('propagates 422 validation error when salary_min > salary_max', async () => {
      const mock422Error: ApiErrorResponse = {
        success: false,
        message: 'salary_min cannot be greater than salary_max',
        error_code: 'VALIDATION_ERROR',
        status: 422,
        detail: 'salary_min cannot be greater than salary_max',
      };

      vi.spyOn(apiClient, 'get').mockRejectedValueOnce(mock422Error);

      await expect(getJobs({ salary_min: 80000, salary_max: 50000 })).rejects.toEqual(mock422Error);
    });

    it('propagates 500 server error', async () => {
      const mock500Error: ApiErrorResponse = {
        success: false,
        message: 'Internal server error',
        error_code: 'INTERNAL_SERVER_ERROR',
        status: 500,
      };

      vi.spyOn(apiClient, 'get').mockRejectedValueOnce(mock500Error);

      await expect(getJobs()).rejects.toEqual(mock500Error);
    });
  });

  describe('getJobById', () => {
    it('dispatches GET to /jobs/:id with correct job ID', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: mockJob,
      });

      const result = await getJobById(1);

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith('/jobs/1');
      expect(result).toEqual(mockJob);
    });

    it('propagates 404 NOT_FOUND error when job does not exist or is inactive', async () => {
      const mock404Error: ApiErrorResponse = {
        success: false,
        message: 'Job posting not found',
        error_code: 'NOT_FOUND',
        status: 404,
      };

      vi.spyOn(apiClient, 'get').mockRejectedValueOnce(mock404Error);

      await expect(getJobById(999)).rejects.toEqual(mock404Error);
    });
  });
});
