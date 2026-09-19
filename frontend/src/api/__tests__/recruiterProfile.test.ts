import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiClient } from '../client';
import {
  getRecruiterProfileApi,
  createRecruiterProfileApi,
  updateRecruiterProfileApi,
} from '../recruiterProfile';
import {
  RecruiterProfile,
  RecruiterProfileCreateRequest,
  RecruiterProfileUpdateRequest,
} from '@/types/recruiterProfile';
import { ApiErrorResponse } from '@/types/api';

const mockProfile: RecruiterProfile = {
  id: 1,
  user_id: 10,
  company_name: 'Acme Innovations Inc.',
  company_description: 'Pioneering next-generation cloud infrastructure.',
  contact_name: 'Jane Doe',
  phone: '+1-555-0200',
  company_website: 'https://acme-innovations.example.com',
  company_location: 'San Francisco, CA',
  industry: 'Technology',
  company_size: '51-200',
  is_verified: false,
  created_at: '2026-09-19T10:00:00Z',
  updated_at: '2026-09-19T10:00:00Z',
};

describe('Recruiter Profile API Service Module', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getRecruiterProfileApi', () => {
    // 1. GET correct path
    it('dispatches GET to the correct endpoint path /recruiter/profile', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: mockProfile,
      });

      await getRecruiterProfileApi();

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith('/recruiter/profile');
    });

    // 2. GET returns profile
    it('returns the profile data upon successful GET request', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: mockProfile,
      });

      const result = await getRecruiterProfileApi();

      expect(result).toEqual(mockProfile);
      expect(result.company_name).toBe('Acme Innovations Inc.');
      expect(result.is_verified).toBe(false);
    });

    // 3. GET 404 propagates
    it('propagates 404 NOT_FOUND error when profile does not exist', async () => {
      const mock404Error: ApiErrorResponse = {
        success: false,
        message: 'Recruiter profile not found',
        error_code: 'NOT_FOUND',
        detail: 'Recruiter profile not found',
        status: 404,
      };

      vi.spyOn(apiClient, 'get').mockRejectedValueOnce(mock404Error);

      await expect(getRecruiterProfileApi()).rejects.toEqual(mock404Error);
    });
  });

  describe('createRecruiterProfileApi', () => {
    const validCreatePayload: RecruiterProfileCreateRequest = {
      company_name: 'Acme Innovations Inc.',
      company_description: 'Pioneering next-generation cloud infrastructure.',
      contact_name: 'Jane Doe',
      phone: '+1-555-0200',
      company_website: 'https://acme-innovations.example.com',
      company_location: 'San Francisco, CA',
      industry: 'Technology',
      company_size: '51-200',
    };

    // 4. POST correct path
    it('dispatches POST to the correct endpoint path /recruiter/profile', async () => {
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        data: mockProfile,
      });

      await createRecruiterProfileApi(validCreatePayload);

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy.mock.calls[0][0]).toBe('/recruiter/profile');
    });

    // 5. POST correct payload
    it('transmits the correct creation payload with required and optional fields', async () => {
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        data: mockProfile,
      });

      const result = await createRecruiterProfileApi(validCreatePayload);

      expect(postSpy).toHaveBeenCalledWith('/recruiter/profile', validCreatePayload);
      expect(result).toEqual(mockProfile);
    });

    // 6. POST 409 propagates
    it('propagates 409 RESOURCE_CONFLICT error if profile already exists', async () => {
      const mock409Error: ApiErrorResponse = {
        success: false,
        message: 'Recruiter profile already exists for this account',
        error_code: 'RESOURCE_CONFLICT',
        status: 409,
      };

      vi.spyOn(apiClient, 'post').mockRejectedValueOnce(mock409Error);

      await expect(createRecruiterProfileApi(validCreatePayload)).rejects.toEqual(mock409Error);
    });

    // 7. POST never sends protected fields
    it('never sends protected fields (id, user_id, is_verified, created_at, updated_at) in POST payload', async () => {
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        data: mockProfile,
      });

      await createRecruiterProfileApi(validCreatePayload);

      const sentBody = postSpy.mock.calls[0][1] as Record<string, unknown>;
      expect(sentBody).not.toHaveProperty('id');
      expect(sentBody).not.toHaveProperty('user_id');
      expect(sentBody).not.toHaveProperty('is_verified');
      expect(sentBody).not.toHaveProperty('created_at');
      expect(sentBody).not.toHaveProperty('updated_at');
      expect(sentBody).not.toHaveProperty('password');
      expect(sentBody).not.toHaveProperty('password_hash');
    });
  });

  describe('updateRecruiterProfileApi', () => {
    const partialUpdatePayload: RecruiterProfileUpdateRequest = {
      company_description: 'Updated enterprise mission.',
      company_size: '201-500',
    };

    // 8. PATCH correct path
    it('dispatches PATCH to the correct endpoint path /recruiter/profile', async () => {
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValueOnce({
        data: { ...mockProfile, ...partialUpdatePayload },
      });

      await updateRecruiterProfileApi(partialUpdatePayload);

      expect(patchSpy).toHaveBeenCalledTimes(1);
      expect(patchSpy.mock.calls[0][0]).toBe('/recruiter/profile');
    });

    // 9. PATCH supports partial payload
    it('supports partial payload without requiring untouched fields', async () => {
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValueOnce({
        data: { ...mockProfile, ...partialUpdatePayload },
      });

      const result = await updateRecruiterProfileApi(partialUpdatePayload);

      expect(patchSpy).toHaveBeenCalledWith('/recruiter/profile', partialUpdatePayload);
      expect(result.company_description).toBe('Updated enterprise mission.');
      expect(result.company_size).toBe('201-500');
    });

    // 10. PATCH 422 propagates
    it('propagates 422 UNPROCESSABLE_ENTITY validation error from the backend', async () => {
      const mock422Error: ApiErrorResponse = {
        success: false,
        message: 'Validation failed',
        error_code: 'VALIDATION_ERROR',
        status: 422,
        detail: [
          {
            loc: ['body', 'company_name'],
            msg: 'String should have at least 2 characters',
            type: 'string_too_short',
          },
        ],
      };

      vi.spyOn(apiClient, 'patch').mockRejectedValueOnce(mock422Error);

      await expect(
        updateRecruiterProfileApi({ company_name: 'A' })
      ).rejects.toEqual(mock422Error);
    });

    // 11. PATCH never sends protected fields
    it('never sends protected fields (id, user_id, is_verified, created_at, updated_at) in PATCH payload', async () => {
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValueOnce({
        data: mockProfile,
      });

      await updateRecruiterProfileApi(partialUpdatePayload);

      const sentBody = patchSpy.mock.calls[0][1] as Record<string, unknown>;
      expect(sentBody).not.toHaveProperty('id');
      expect(sentBody).not.toHaveProperty('user_id');
      expect(sentBody).not.toHaveProperty('is_verified');
      expect(sentBody).not.toHaveProperty('created_at');
      expect(sentBody).not.toHaveProperty('updated_at');
    });
  });
});
