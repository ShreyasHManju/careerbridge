import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiClient } from '../client';
import { getSavedJobs, getSavedJobStatus, saveJob, unsaveJob } from '../savedJobs';
import { SavedJob, SavedJobStatus } from '@/types/job';
import { ApiErrorResponse } from '@/types/api';

const mockSavedJob: SavedJob = {
  id: 10,
  student_id: 2,
  job_posting_id: 1,
  created_at: '2026-09-19T11:00:00Z',
  job_posting: {
    id: 1,
    recruiter_id: 5,
    title: 'Frontend Developer Intern',
    description: 'React, TypeScript role',
    opportunity_type: 'internship',
    company_name: 'TechFlow Corp',
    location: 'Remote',
    is_remote: true,
    employment_type: 'full_time',
    skills: 'React, TypeScript',
    minimum_qualification: 'B.S.',
    experience_required: '0-1 years',
    salary_min: 30000,
    salary_max: 50000,
    application_deadline: null,
    is_active: true,
    created_at: '2026-09-19T10:00:00Z',
    updated_at: '2026-09-19T10:00:00Z',
  },
};

const mockSavedStatus: SavedJobStatus = {
  job_id: 1,
  is_saved: true,
  saved_at: '2026-09-19T11:00:00Z',
};

describe('Saved Jobs API Service Module', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getSavedJobs', () => {
    it('dispatches GET to /saved-jobs and returns saved jobs array', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: [mockSavedJob],
      });

      const result = await getSavedJobs();

      expect(getSpy).toHaveBeenCalledWith('/saved-jobs');
      expect(result).toEqual([mockSavedJob]);
      expect(result).toHaveLength(1);
    });

    it('propagates 403 error for non-student users', async () => {
      const mock403Error: ApiErrorResponse = {
        success: false,
        message: 'Permission denied. Students only.',
        error_code: 'FORBIDDEN',
        status: 403,
      };

      vi.spyOn(apiClient, 'get').mockRejectedValueOnce(mock403Error);

      await expect(getSavedJobs()).rejects.toEqual(mock403Error);
    });
  });

  describe('getSavedJobStatus', () => {
    it('dispatches GET to /jobs/:id/saved and returns saved status', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: mockSavedStatus,
      });

      const result = await getSavedJobStatus(1);

      expect(getSpy).toHaveBeenCalledWith('/jobs/1/saved');
      expect(result).toEqual(mockSavedStatus);
      expect(result.is_saved).toBe(true);
    });

    it('propagates 404 if job does not exist', async () => {
      const mock404Error: ApiErrorResponse = {
        success: false,
        message: 'Job posting not found',
        error_code: 'NOT_FOUND',
        status: 404,
      };

      vi.spyOn(apiClient, 'get').mockRejectedValueOnce(mock404Error);

      await expect(getSavedJobStatus(999)).rejects.toEqual(mock404Error);
    });
  });

  describe('saveJob', () => {
    it('dispatches POST to /jobs/:id/save and returns 201 status', async () => {
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        data: mockSavedStatus,
      });

      const result = await saveJob(1);

      expect(postSpy).toHaveBeenCalledWith('/jobs/1/save');
      expect(result).toEqual(mockSavedStatus);
    });

    it('propagates 400 when attempting to save an inactive job posting', async () => {
      const mock400Error: ApiErrorResponse = {
        success: false,
        message: 'Cannot save an inactive job posting',
        error_code: 'BAD_REQUEST',
        status: 400,
      };

      vi.spyOn(apiClient, 'post').mockRejectedValueOnce(mock400Error);

      await expect(saveJob(1)).rejects.toEqual(mock400Error);
    });

    it('propagates 409 when job is already saved', async () => {
      const mock409Error: ApiErrorResponse = {
        success: false,
        message: 'Job already saved',
        error_code: 'RESOURCE_CONFLICT',
        status: 409,
      };

      vi.spyOn(apiClient, 'post').mockRejectedValueOnce(mock409Error);

      await expect(saveJob(1)).rejects.toEqual(mock409Error);
    });
  });

  describe('unsaveJob', () => {
    it('dispatches DELETE to /jobs/:id/save', async () => {
      const deleteSpy = vi.spyOn(apiClient, 'delete').mockResolvedValueOnce({
        data: undefined,
      });

      await unsaveJob(1);

      expect(deleteSpy).toHaveBeenCalledWith('/jobs/1/save');
    });

    it('propagates 404 if the job was not saved', async () => {
      const mock404Error: ApiErrorResponse = {
        success: false,
        message: 'Saved job not found',
        error_code: 'NOT_FOUND',
        status: 404,
      };

      vi.spyOn(apiClient, 'delete').mockRejectedValueOnce(mock404Error);

      await expect(unsaveJob(1)).rejects.toEqual(mock404Error);
    });
  });
});
