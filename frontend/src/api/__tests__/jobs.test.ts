import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiClient } from '../client';
import { getJobs, getJobById, getMyJobPostings, createJob, updateJob, deleteJob } from '../jobs';
import { JobPosting, JobPostingPagination, JobPostingCreate, JobPostingUpdate } from '@/types/job';
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

  describe('getMyJobPostings', () => {
    it('dispatches GET to /jobs/my and returns recruiter jobs list', async () => {
      const mockList: JobPosting[] = [
        mockJob,
        { ...mockJob, id: 2, title: 'Backend Engineer', is_active: false },
      ];
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: mockList,
      });

      const result = await getMyJobPostings();

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith('/jobs/my');
      expect(result).toEqual(mockList);
    });

    it('propagates 403 FORBIDDEN error when non-recruiter accesses', async () => {
      const mock403Error: ApiErrorResponse = {
        success: false,
        message: 'Only recruiters can access their job postings',
        error_code: 'FORBIDDEN',
        status: 403,
      };

      vi.spyOn(apiClient, 'get').mockRejectedValueOnce(mock403Error);

      await expect(getMyJobPostings()).rejects.toEqual(mock403Error);
    });
  });

  describe('createJob', () => {
    it('dispatches POST to /jobs with the payload and returns created JobPosting', async () => {
      const payload: JobPostingCreate = {
        title: 'Junior Frontend Developer',
        description: 'Great opportunity for junior developers to build modern UIs.',
        opportunity_type: 'job',
        company_name: 'Acme Corp',
        location: 'New York, NY',
        is_remote: true,
        employment_type: 'full_time',
        skills: 'React, TypeScript',
        minimum_qualification: 'Bachelor degree',
        experience_required: '1 year',
        salary_min: 60000,
        salary_max: 85000,
        application_deadline: '2026-12-31T23:59:59Z',
        is_active: true,
      };

      const createdJob: JobPosting = {
        ...mockJob,
        ...payload,
        id: 10,
        skills: payload.skills ?? null,
        minimum_qualification: payload.minimum_qualification ?? null,
        experience_required: payload.experience_required ?? null,
        location: payload.location ?? null,
        is_remote: payload.is_remote ?? false,
        salary_min: payload.salary_min ?? null,
        salary_max: payload.salary_max ?? null,
        application_deadline: payload.application_deadline ?? null,
        is_active: payload.is_active ?? true,
      };

      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        data: createdJob,
      });

      const result = await createJob(payload);

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith('/jobs', payload);
      expect(result).toEqual(createdJob);
    });

    it('propagates 422 error on invalid create payload', async () => {
      const mock422: ApiErrorResponse = {
        success: false,
        message: 'Validation failed',
        error_code: 'VALIDATION_ERROR',
        status: 422,
      };

      vi.spyOn(apiClient, 'post').mockRejectedValueOnce(mock422);

      await expect(
        createJob({
          title: 'A', // too short
          description: 'Too short',
          opportunity_type: 'job',
          company_name: 'Acme',
          employment_type: 'full_time',
        })
      ).rejects.toEqual(mock422);
    });
  });

  describe('updateJob', () => {
    it('dispatches PATCH to /jobs/:id with partial update payload', async () => {
      const payload: JobPostingUpdate = {
        title: 'Senior Frontend Developer',
        is_active: false,
      };

      const updatedJob: JobPosting = {
        ...mockJob,
        title: 'Senior Frontend Developer',
        is_active: false,
      };

      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValueOnce({
        data: updatedJob,
      });

      const result = await updateJob(1, payload);

      expect(patchSpy).toHaveBeenCalledTimes(1);
      expect(patchSpy).toHaveBeenCalledWith('/jobs/1', payload);
      expect(result).toEqual(updatedJob);
    });

    it('supports deactivating a job with { is_active: false }', async () => {
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValueOnce({
        data: { ...mockJob, is_active: false },
      });

      const result = await updateJob(1, { is_active: false });

      expect(patchSpy).toHaveBeenCalledWith('/jobs/1', { is_active: false });
      expect(result.is_active).toBe(false);
    });

    it('propagates 403 when updating a job not owned by the recruiter', async () => {
      const mock403: ApiErrorResponse = {
        success: false,
        message: 'You can only update your own job postings',
        error_code: 'FORBIDDEN',
        status: 403,
      };

      vi.spyOn(apiClient, 'patch').mockRejectedValueOnce(mock403);

      await expect(updateJob(99, { is_active: false })).rejects.toEqual(mock403);
    });
  });

  describe('deleteJob', () => {
    it('dispatches DELETE to /jobs/:id and resolves void on 204 No Content', async () => {
      const deleteSpy = vi.spyOn(apiClient, 'delete').mockResolvedValueOnce({
        data: undefined,
      });

      await expect(deleteJob(1)).resolves.toBeUndefined();
      expect(deleteSpy).toHaveBeenCalledTimes(1);
      expect(deleteSpy).toHaveBeenCalledWith('/jobs/1');
    });

    it('propagates 404 when deleting a non-existent job', async () => {
      const mock404: ApiErrorResponse = {
        success: false,
        message: 'Job posting not found',
        error_code: 'NOT_FOUND',
        status: 404,
      };

      vi.spyOn(apiClient, 'delete').mockRejectedValueOnce(mock404);

      await expect(deleteJob(999)).rejects.toEqual(mock404);
    });
  });
});
