import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiClient } from '../client';
import {
  getStudentDashboard,
  getRecruiterDashboard,
  getAdminDashboard,
} from '../dashboards';
import {
  StudentDashboard,
  RecruiterDashboard,
  AdminDashboard,
} from '@/types/dashboard';
import { ApiErrorResponse } from '@/types/api';

const mockStudentDashboard: StudentDashboard = {
  total_applications: 8,
  applications_under_review: 3,
  shortlisted_applications: 2,
  accepted_applications: 1,
  saved_internships: 5,
  upcoming_interviews: 2,
};

const mockRecruiterDashboard: RecruiterDashboard = {
  active_internships: 4,
  total_applications: 32,
  applications_awaiting_review: 14,
  shortlisted_candidates: 6,
  scheduled_interviews: 5,
};

const mockAdminDashboard: AdminDashboard = {
  total_students: 142,
  total_companies: 28,
  verified_companies: 22,
  published_internships: 35,
  total_applications: 310,
  application_success_rate: 18.5,
  monthly_registrations: [
    { month: '2026-08', count: 45 },
    { month: '2026-09', count: 68 },
  ],
};

describe('Dashboards API Client Module (Phase 22)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getStudentDashboard', () => {
    it('sends GET request to /dashboard/student and returns student metrics', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: mockStudentDashboard,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await getStudentDashboard();

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith('/dashboard/student');
      expect(result).toEqual(mockStudentDashboard);
      expect(result.total_applications).toBe(8);
      expect(result.applications_under_review).toBe(3);
      expect(result.shortlisted_applications).toBe(2);
      expect(result.accepted_applications).toBe(1);
      expect(result.saved_internships).toBe(5);
      expect(result.upcoming_interviews).toBe(2);
    });

    it('propagates 401 unauthorized error on unauthenticated request', async () => {
      const mockError: ApiErrorResponse = {
        success: false,
        message: 'Could not validate credentials',
        error_code: 'AUTHENTICATION_REQUIRED',
        status: 401,
      };

      vi.spyOn(apiClient, 'get').mockRejectedValueOnce(mockError);

      await expect(getStudentDashboard()).rejects.toEqual(mockError);
    });

    it('propagates 403 forbidden error when non-student attempts access', async () => {
      const mockError: ApiErrorResponse = {
        success: false,
        message: 'Not enough permissions',
        error_code: 'FORBIDDEN',
        status: 403,
      };

      vi.spyOn(apiClient, 'get').mockRejectedValueOnce(mockError);

      await expect(getStudentDashboard()).rejects.toEqual(mockError);
    });
  });

  describe('getRecruiterDashboard', () => {
    it('sends GET request to /dashboard/recruiter and returns recruiter metrics', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: mockRecruiterDashboard,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await getRecruiterDashboard();

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith('/dashboard/recruiter');
      expect(result).toEqual(mockRecruiterDashboard);
      expect(result.active_internships).toBe(4);
      expect(result.total_applications).toBe(32);
      expect(result.applications_awaiting_review).toBe(14);
      expect(result.shortlisted_candidates).toBe(6);
      expect(result.scheduled_interviews).toBe(5);
    });

    it('propagates 403 forbidden error when student attempts access', async () => {
      const mockError: ApiErrorResponse = {
        success: false,
        message: 'Not enough permissions',
        error_code: 'FORBIDDEN',
        status: 403,
      };

      vi.spyOn(apiClient, 'get').mockRejectedValueOnce(mockError);

      await expect(getRecruiterDashboard()).rejects.toEqual(mockError);
    });
  });

  describe('getAdminDashboard', () => {
    it('sends GET request to /dashboard/admin without params when periodYear is omitted', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: mockAdminDashboard,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await getAdminDashboard();

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith('/dashboard/admin', { params: undefined });
      expect(result).toEqual(mockAdminDashboard);
      expect(result.total_students).toBe(142);
      expect(result.total_companies).toBe(28);
      expect(result.verified_companies).toBe(22);
      expect(result.published_internships).toBe(35);
      expect(result.total_applications).toBe(310);
      expect(result.application_success_rate).toBe(18.5);
      expect(result.monthly_registrations).toHaveLength(2);
    });

    it('sends GET request with ?period_year=2026 when periodYear parameter is provided', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: mockAdminDashboard,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await getAdminDashboard(2026);

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith('/dashboard/admin', {
        params: { period_year: 2026 },
      });
      expect(result).toEqual(mockAdminDashboard);
    });

    it('propagates 422 validation error when periodYear is out of bounds', async () => {
      const mockError: ApiErrorResponse = {
        success: false,
        message: 'Input should be greater than or equal to 2000',
        error_code: 'VALIDATION_ERROR',
        status: 422,
      };

      vi.spyOn(apiClient, 'get').mockRejectedValueOnce(mockError);

      await expect(getAdminDashboard(1850)).rejects.toEqual(mockError);
    });

    it('propagates 403 forbidden error when non-admin attempts access', async () => {
      const mockError: ApiErrorResponse = {
        success: false,
        message: 'Not enough permissions',
        error_code: 'FORBIDDEN',
        status: 403,
      };

      vi.spyOn(apiClient, 'get').mockRejectedValueOnce(mockError);

      await expect(getAdminDashboard()).rejects.toEqual(mockError);
    });
  });
});
