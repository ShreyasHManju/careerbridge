import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiClient } from '../client';
import {
  getAdminUsers,
  getAdminUserDetail,
  updateAdminUserStatus,
  getAdminRecruiters,
  updateAdminRecruiterVerification,
  getAdminJobs,
  updateAdminJobStatus,
} from '../admin';
import {
  AdminUser,
  AdminUserPaginationResponse,
  AdminRecruiter,
  AdminRecruiterPaginationResponse,
} from '@/types/admin';
import { JobPostingPagination, JobPosting } from '@/types/job';
import { ApiErrorResponse } from '@/types/api';

const mockUser: AdminUser = {
  id: 1,
  email: 'student@example.com',
  role: 'student',
  is_active: true,
  is_verified: true,
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-01T10:00:00Z',
};

const mockUserList: AdminUserPaginationResponse = {
  items: [mockUser],
  page: 1,
  page_size: 10,
  total: 1,
  total_pages: 1,
};

const mockRecruiter: AdminRecruiter = {
  id: 10,
  user_id: 2,
  email: 'recruiter@company.com',
  company_name: 'Tech Corp',
  company_description: 'Software solutions',
  contact_name: 'Jane Doe',
  phone: '+1234567890',
  company_website: 'https://techcorp.com',
  company_location: 'New York, NY',
  industry: 'Technology',
  company_size: '51-200',
  is_verified: false,
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-01T10:00:00Z',
};

const mockRecruiterList: AdminRecruiterPaginationResponse = {
  items: [mockRecruiter],
  page: 1,
  page_size: 10,
  total: 1,
  total_pages: 1,
};

const mockJob: JobPosting = {
  id: 101,
  recruiter_id: 2,
  title: 'Full Stack Engineer',
  description: 'Developing web applications',
  opportunity_type: 'job',
  employment_type: 'full_time',
  location: 'New York, NY',
  is_remote: true,
  skills: null,
  minimum_qualification: null,
  experience_required: null,
  salary_min: null,
  salary_max: null,
  application_deadline: null,
  is_active: true,
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-01T10:00:00Z',
  company_name: 'Tech Corp',
};

const mockJobList: JobPostingPagination = {
  items: [mockJob],
  page: 1,
  page_size: 10,
  total: 1,
  total_pages: 1,
};

describe('Admin API Client Module (Phase F-11)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getAdminUsers', () => {
    it('sends GET request to /admin/users with query params and returns paginated users', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: mockUserList,
      });

      const params = { search: 'student', role: 'student' as const, is_active: true, page: 1, page_size: 10 };
      const result = await getAdminUsers(params);

      expect(getSpy).toHaveBeenCalledWith('/admin/users', { params });
      expect(result).toEqual(mockUserList);
    });

    it('propagates error when GET /admin/users fails', async () => {
      const mockError: ApiErrorResponse = {
        success: false,
        message: 'Forbidden',
        error_code: 'FORBIDDEN',
        detail: 'Forbidden: Admin role required',
      };
      vi.spyOn(apiClient, 'get').mockRejectedValueOnce(mockError);

      await expect(getAdminUsers()).rejects.toEqual(mockError);
    });
  });

  describe('getAdminUserDetail', () => {
    it('sends GET request to /admin/users/:userId and returns user detail', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: mockUser,
      });

      const result = await getAdminUserDetail(1);

      expect(getSpy).toHaveBeenCalledWith('/admin/users/1');
      expect(result).toEqual(mockUser);
    });
  });

  describe('updateAdminUserStatus', () => {
    it('sends PATCH request to /admin/users/:userId/status and returns updated user', async () => {
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValueOnce({
        data: { ...mockUser, is_active: false },
      });

      const result = await updateAdminUserStatus(1, { is_active: false });

      expect(patchSpy).toHaveBeenCalledWith('/admin/users/1/status', {
        is_active: false,
      });
      expect(result.is_active).toBe(false);
    });

    it('handles 400 self-deactivation error', async () => {
      const mockError: ApiErrorResponse = {
        success: false,
        message: 'Bad Request',
        error_code: 'BAD_REQUEST',
        detail: 'Administrators cannot deactivate their own account',
      };
      vi.spyOn(apiClient, 'patch').mockRejectedValueOnce(mockError);

      await expect(updateAdminUserStatus(1, { is_active: false })).rejects.toEqual(mockError);
    });
  });

  describe('getAdminRecruiters', () => {
    it('sends GET request to /admin/recruiters with query params and returns paginated recruiters', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: mockRecruiterList,
      });

      const params = { search: 'Tech Corp', is_verified: false, page: 1, page_size: 10 };
      const result = await getAdminRecruiters(params);

      expect(getSpy).toHaveBeenCalledWith('/admin/recruiters', { params });
      expect(result).toEqual(mockRecruiterList);
    });
  });

  describe('updateAdminRecruiterVerification', () => {
    it('sends PATCH request to /admin/recruiters/:userId/verification using userId', async () => {
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValueOnce({
        data: { ...mockRecruiter, is_verified: true },
      });

      const result = await updateAdminRecruiterVerification(2, { is_verified: true });

      expect(patchSpy).toHaveBeenCalledWith('/admin/recruiters/2/verification', {
        is_verified: true,
      });
      expect(result.is_verified).toBe(true);
    });
  });

  describe('getAdminJobs', () => {
    it('sends GET request to /admin/jobs with query params and returns paginated jobs', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: mockJobList,
      });

      const params = {
        search: 'Engineer',
        opportunity_type: 'job' as const,
        employment_type: 'full_time' as const,
        is_active: true,
        page: 1,
        page_size: 10,
      };
      const result = await getAdminJobs(params);

      expect(getSpy).toHaveBeenCalledWith('/admin/jobs', { params });
      expect(result).toEqual(mockJobList);
    });
  });

  describe('updateAdminJobStatus', () => {
    it('sends PATCH request to /admin/jobs/:jobId/status and returns updated job', async () => {
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValueOnce({
        data: { ...mockJob, is_active: false },
      });

      const result = await updateAdminJobStatus(101, { is_active: false });

      expect(patchSpy).toHaveBeenCalledWith('/admin/jobs/101/status', {
        is_active: false,
      });
      expect(result.is_active).toBe(false);
    });
  });
});
