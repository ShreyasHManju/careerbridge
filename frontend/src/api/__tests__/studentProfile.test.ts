import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiClient } from '../client';
import {
  getStudentProfileApi,
  createStudentProfileApi,
  updateStudentProfileApi,
} from '../studentProfile';
import {
  StudentProfile,
  StudentProfileCreateRequest,
  StudentProfileUpdateRequest,
} from '@/types/studentProfile';
import { ApiErrorResponse } from '@/types/api';

const mockProfile: StudentProfile = {
  id: 1,
  user_id: 10,
  full_name: 'Jane Doe',
  phone: '+91 9876543210',
  college: 'National Institute of Technology',
  degree: 'B.Tech',
  branch: 'Computer Science',
  graduation_year: 2026,
  bio: 'Software engineering student',
  skills: 'Python, React, PostgreSQL',
  github_url: 'https://github.com/janedoe',
  linkedin_url: 'https://linkedin.com/in/janedoe',
  portfolio_url: 'https://janedoe.dev',
  created_at: '2026-09-19T10:00:00Z',
  updated_at: '2026-09-19T10:00:00Z',
};

describe('Student Profile API Module', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getStudentProfileApi', () => {
    it('dispatches GET /student/profile and returns profile data', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: mockProfile,
      });

      const result = await getStudentProfileApi();

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith('/student/profile');
      expect(result).toEqual(mockProfile);
    });

    it('propagates 404 NOT_FOUND error when profile does not exist', async () => {
      const mock404Error: ApiErrorResponse = {
        success: false,
        message: 'Student profile not found',
        error_code: 'NOT_FOUND',
        detail: 'Student profile not found',
        status: 404,
      };

      vi.spyOn(apiClient, 'get').mockRejectedValueOnce(mock404Error);

      await expect(getStudentProfileApi()).rejects.toEqual(mock404Error);
    });
  });

  describe('createStudentProfileApi', () => {
    it('dispatches POST /student/profile with valid creation payload', async () => {
      const createPayload: StudentProfileCreateRequest = {
        full_name: 'Jane Doe',
        phone: '+91 9876543210',
        college: 'Example University',
        degree: 'B.Tech',
        branch: 'Computer Science',
        graduation_year: 2026,
        bio: 'Software engineering student',
        skills: 'Python, React, PostgreSQL',
        github_url: 'https://github.com/janedoe',
        linkedin_url: 'https://linkedin.com/in/janedoe',
        portfolio_url: 'https://janedoe.dev',
      };

      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        data: mockProfile,
      });

      const result = await createStudentProfileApi(createPayload);

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith('/student/profile', createPayload);
      expect(result).toEqual(mockProfile);
    });

    it('propagates 409 RESOURCE_CONFLICT error if profile already exists', async () => {
      const mock409Error: ApiErrorResponse = {
        success: false,
        message: 'Student profile already exists for this account',
        error_code: 'RESOURCE_CONFLICT',
        status: 409,
      };

      vi.spyOn(apiClient, 'post').mockRejectedValueOnce(mock409Error);

      await expect(
        createStudentProfileApi({ full_name: 'Jane Doe' })
      ).rejects.toEqual(mock409Error);
    });

    it('contract protection: does not inject user_id or system fields into POST payload', async () => {
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        data: mockProfile,
      });

      const inputPayload: StudentProfileCreateRequest = {
        full_name: 'Jane Doe',
        college: 'MIT',
      };

      await createStudentProfileApi(inputPayload);

      const sentPayload = postSpy.mock.calls[0][1] as Record<string, unknown>;
      expect(sentPayload).not.toHaveProperty('user_id');
      expect(sentPayload).not.toHaveProperty('id');
      expect(sentPayload).not.toHaveProperty('created_at');
      expect(sentPayload).not.toHaveProperty('updated_at');
    });
  });

  describe('updateStudentProfileApi', () => {
    it('dispatches PATCH /student/profile with partial update payload', async () => {
      const updatePayload: StudentProfileUpdateRequest = {
        bio: 'Updated professional bio',
        skills: 'Python, FastAPI, React',
      };

      const updatedProfile: StudentProfile = {
        ...mockProfile,
        bio: 'Updated professional bio',
        skills: 'Python, FastAPI, React',
        updated_at: '2026-09-19T11:00:00Z',
      };

      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValueOnce({
        data: updatedProfile,
      });

      const result = await updateStudentProfileApi(updatePayload);

      expect(patchSpy).toHaveBeenCalledTimes(1);
      expect(patchSpy).toHaveBeenCalledWith('/student/profile', updatePayload);
      expect(result).toEqual(updatedProfile);
    });

    it('propagates 422 VALIDATION_ERROR on invalid field input', async () => {
      const mock422Error: ApiErrorResponse = {
        success: false,
        message: 'Request validation failed.',
        error_code: 'VALIDATION_ERROR',
        status: 422,
        detail: [{ type: 'greater_than_equal', loc: ['body', 'graduation_year'], msg: 'Input should be greater than or equal to 1900' }],
      };

      vi.spyOn(apiClient, 'patch').mockRejectedValueOnce(mock422Error);

      await expect(
        updateStudentProfileApi({ graduation_year: 1850 })
      ).rejects.toEqual(mock422Error);
    });

    it('contract protection: does not inject user_id or system fields into PATCH payload', async () => {
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValueOnce({
        data: mockProfile,
      });

      const updatePayload: StudentProfileUpdateRequest = {
        college: 'Stanford',
      };

      await updateStudentProfileApi(updatePayload);

      const sentPayload = patchSpy.mock.calls[0][1] as Record<string, unknown>;
      expect(sentPayload).not.toHaveProperty('user_id');
      expect(sentPayload).not.toHaveProperty('id');
      expect(sentPayload).not.toHaveProperty('created_at');
      expect(sentPayload).not.toHaveProperty('updated_at');
    });
  });
});
