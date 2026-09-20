import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiClient } from '../client';
import {
  applyToJob,
  getMyApplications,
  getApplicationById,
  getRecruiterApplications,
  getRecruiterApplicationById,
  updateApplicationStatus,
} from '../applications';
import { Application, ApplicationStatus } from '@/types/application';
import { ApiErrorResponse } from '@/types/api';

const mockApplication: Application = {
  id: 101,
  job_posting_id: 1,
  student_id: 2,
  status: 'applied',
  cover_message: 'I am excited about this frontend role!',
  created_at: '2026-09-19T12:00:00Z',
  updated_at: '2026-09-19T12:00:00Z',
};

const mockApplicationList: Application[] = [
  mockApplication,
  {
    id: 102,
    job_posting_id: 4,
    student_id: 2,
    status: 'shortlisted',
    cover_message: null,
    created_at: '2026-09-18T10:00:00Z',
    updated_at: '2026-09-19T08:00:00Z',
  },
];

describe('Applications API Service Module (Phase F-06)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // applyToJob
  // ==========================================================================
  describe('applyToJob', () => {
    it('dispatches POST to /jobs/:id/applications with cover_message when provided', async () => {
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        data: mockApplication,
      });

      const result = await applyToJob(1, {
        cover_message: 'I am excited about this frontend role!',
      });

      expect(postSpy).toHaveBeenCalledWith('/jobs/1/applications', {
        cover_message: 'I am excited about this frontend role!',
      });
      expect(result).toEqual(mockApplication);
    });

    it('sends empty object when cover_message is omitted or undefined', async () => {
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        data: { ...mockApplication, cover_message: null },
      });

      const result = await applyToJob(1);

      expect(postSpy).toHaveBeenCalledWith('/jobs/1/applications', {});
      expect(result.status).toBe('applied');
    });

    it('propagates 400 when attempting to apply to an inactive job', async () => {
      const mock400InactiveError: ApiErrorResponse = {
        success: false,
        message: 'Cannot apply to an inactive job posting',
        error_code: 'BAD_REQUEST',
        status: 400,
      };

      vi.spyOn(apiClient, 'post').mockRejectedValueOnce(mock400InactiveError);

      await expect(applyToJob(1)).rejects.toEqual(mock400InactiveError);
    });

    it('propagates 409 duplicate application error', async () => {
      const mock409Error: ApiErrorResponse = {
        success: false,
        message: 'You have already applied to this job posting',
        error_code: 'RESOURCE_CONFLICT',
        status: 409,
      };

      vi.spyOn(apiClient, 'post').mockRejectedValueOnce(mock409Error);

      await expect(applyToJob(1)).rejects.toEqual(mock409Error);
    });

    it('propagates 403 forbidden error when a recruiter attempts to apply', async () => {
      const mock403Error: ApiErrorResponse = {
        success: false,
        message: 'Permission denied. Students only.',
        error_code: 'FORBIDDEN',
        status: 403,
      };

      vi.spyOn(apiClient, 'post').mockRejectedValueOnce(mock403Error);

      await expect(applyToJob(1)).rejects.toEqual(mock403Error);
    });
  });

  // ==========================================================================
  // getMyApplications
  // ==========================================================================
  describe('getMyApplications', () => {
    it('dispatches GET to /applications/me and returns application list', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: mockApplicationList,
      });

      const result = await getMyApplications();

      expect(getSpy).toHaveBeenCalledWith('/applications/me');
      expect(result).toEqual(mockApplicationList);
      expect(result).toHaveLength(2);
    });

    it('propagates 401 unauthorized error', async () => {
      const mock401Error: ApiErrorResponse = {
        success: false,
        message: 'Not authenticated',
        error_code: 'UNAUTHORIZED',
        status: 401,
      };

      vi.spyOn(apiClient, 'get').mockRejectedValueOnce(mock401Error);

      await expect(getMyApplications()).rejects.toEqual(mock401Error);
    });

    it('propagates 403 forbidden error if non-student attempts to call', async () => {
      const mock403Error: ApiErrorResponse = {
        success: false,
        message: 'Permission denied',
        error_code: 'FORBIDDEN',
        status: 403,
      };

      vi.spyOn(apiClient, 'get').mockRejectedValueOnce(mock403Error);

      await expect(getMyApplications()).rejects.toEqual(mock403Error);
    });
  });

  // ==========================================================================
  // getApplicationById
  // ==========================================================================
  describe('getApplicationById', () => {
    it('dispatches GET to /applications/:id and returns single application detail', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: mockApplication,
      });

      const result = await getApplicationById(101);

      expect(getSpy).toHaveBeenCalledWith('/applications/101');
      expect(result).toEqual(mockApplication);
    });

    it('propagates 404 not found error when application does not exist', async () => {
      const mock404Error: ApiErrorResponse = {
        success: false,
        message: 'Application not found',
        error_code: 'NOT_FOUND',
        status: 404,
      };

      vi.spyOn(apiClient, 'get').mockRejectedValueOnce(mock404Error);

      await expect(getApplicationById(9999)).rejects.toEqual(mock404Error);
    });

    it('propagates 403 forbidden error on cross-student detail access', async () => {
      const mock403Error: ApiErrorResponse = {
        success: false,
        message: 'Not enough permissions to view this application',
        error_code: 'FORBIDDEN',
        status: 403,
      };

      vi.spyOn(apiClient, 'get').mockRejectedValueOnce(mock403Error);

      await expect(getApplicationById(101)).rejects.toEqual(mock403Error);
    });
  });

  // ==========================================================================
  // getRecruiterApplications
  // ==========================================================================
  describe('getRecruiterApplications', () => {
    it('dispatches GET to /recruiter/applications and returns received applications', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: mockApplicationList,
      });

      const result = await getRecruiterApplications();

      expect(getSpy).toHaveBeenCalledWith('/recruiter/applications');
      expect(result).toEqual(mockApplicationList);
    });

    it('propagates 403 forbidden error when student attempts to access recruiter endpoint', async () => {
      const mock403Error: ApiErrorResponse = {
        success: false,
        message: 'Permission denied',
        error_code: 'FORBIDDEN',
        status: 403,
      };

      vi.spyOn(apiClient, 'get').mockRejectedValueOnce(mock403Error);

      await expect(getRecruiterApplications()).rejects.toEqual(mock403Error);
    });
  });

  // ==========================================================================
  // getRecruiterApplicationById
  // ==========================================================================
  describe('getRecruiterApplicationById', () => {
    it('dispatches GET to /recruiter/applications/:id and returns application detail', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: mockApplication,
      });

      const result = await getRecruiterApplicationById(101);

      expect(getSpy).toHaveBeenCalledWith('/recruiter/applications/101');
      expect(result).toEqual(mockApplication);
    });

    it('propagates 403 forbidden on cross-recruiter detail access', async () => {
      const mock403Error: ApiErrorResponse = {
        success: false,
        message: 'Not enough permissions to view this application',
        error_code: 'FORBIDDEN',
        status: 403,
      };

      vi.spyOn(apiClient, 'get').mockRejectedValueOnce(mock403Error);

      await expect(getRecruiterApplicationById(101)).rejects.toEqual(mock403Error);
    });
  });

  // ==========================================================================
  // updateApplicationStatus
  // ==========================================================================
  describe('updateApplicationStatus', () => {
    const validStatuses: ApplicationStatus[] = [
      'applied',
      'reviewing',
      'shortlisted',
      'rejected',
      'accepted',
    ];

    validStatuses.forEach((status) => {
      it(`dispatches PATCH to /recruiter/applications/:id with status '${status}'`, async () => {
        const updatedApp = { ...mockApplication, status, updated_at: '2026-09-20T08:00:00Z' };
        const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValueOnce({
          data: updatedApp,
        });

        const result = await updateApplicationStatus(101, status);

        expect(patchSpy).toHaveBeenCalledWith('/recruiter/applications/101', {
          status,
        });
        expect(result.status).toBe(status);
      });
    });

    it('propagates 403 forbidden error when updating an application not owned by recruiter', async () => {
      const mock403Error: ApiErrorResponse = {
        success: false,
        message: 'Not enough permissions to update this application',
        error_code: 'FORBIDDEN',
        status: 403,
      };

      vi.spyOn(apiClient, 'patch').mockRejectedValueOnce(mock403Error);

      await expect(updateApplicationStatus(101, 'shortlisted')).rejects.toEqual(mock403Error);
    });

    it('propagates 404 not found error when application does not exist', async () => {
      const mock404Error: ApiErrorResponse = {
        success: false,
        message: 'Application not found',
        error_code: 'NOT_FOUND',
        status: 404,
      };

      vi.spyOn(apiClient, 'patch').mockRejectedValueOnce(mock404Error);

      await expect(updateApplicationStatus(9999, 'rejected')).rejects.toEqual(mock404Error);
    });

    it('propagates 422 unprocessable entity error when backend rejects invalid status', async () => {
      const mock422Error: ApiErrorResponse = {
        success: false,
        message: 'Invalid status value',
        error_code: 'VALIDATION_ERROR',
        status: 422,
      };

      vi.spyOn(apiClient, 'patch').mockRejectedValueOnce(mock422Error);

      await expect(
        updateApplicationStatus(101, 'invalid_status' as ApplicationStatus)
      ).rejects.toEqual(mock422Error);
    });
  });
});
