import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiClient } from '../client';
import {
  createExperience,
  decideExperienceVerification,
  deleteExperience,
  getMyExperience,
  getMyExperiences,
  getPendingVerifications,
  getStudentExperiences,
  requestExperienceVerification,
  updateExperience,
} from '../experiences';
import {
  ExperienceRecord,
  ExperienceRecordCreate,
  ExperienceRecordListResponse,
  ExperienceRecordUpdate,
  ExperienceVerificationDecision,
} from '@/types/experience';

const mockExperience: ExperienceRecord = {
  id: 1,
  student_id: 10,
  title: 'Backend Software Intern',
  organization_name: 'Acme Corp',
  experience_type: 'internship',
  start_date: '2025-06-01',
  end_date: '2025-08-31',
  is_current: false,
  description: 'Built REST APIs and optimized database queries in PostgreSQL.',
  status: 'claimed',
  verification_source: 'self_claimed',
  innovation_project_id: null,
  verifier_id: null,
  verifier_name: null,
  verified_at: null,
  verification_notes: null,
  skills: 'FastAPI, PostgreSQL, Python',
  structured_skills: [
    {
      id: 1,
      name: 'Python',
      slug: 'python',
      category: 'Backend',
      is_verified: true,
      created_at: '2026-09-24T00:00:00Z',
    },
  ],
  created_at: '2026-09-25T00:00:00Z',
  updated_at: '2026-09-25T00:00:00Z',
};

describe('Experiences API Service Module', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getMyExperiences', () => {
    it('calls GET /students/me/experiences and returns experience list', async () => {
      const listResponse: ExperienceRecordListResponse = {
        items: [mockExperience],
        total: 1,
      };
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: listResponse });

      const result = await getMyExperiences();
      expect(getSpy).toHaveBeenCalledWith('/students/me/experiences');
      expect(result).toEqual(listResponse);
    });
  });

  describe('getMyExperience', () => {
    it('calls GET /students/me/experiences/:id and returns single experience', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: mockExperience });

      const result = await getMyExperience(1);
      expect(getSpy).toHaveBeenCalledWith('/students/me/experiences/1');
      expect(result).toEqual(mockExperience);
    });
  });

  describe('createExperience', () => {
    it('calls POST /students/me/experiences with valid payload', async () => {
      const payload: ExperienceRecordCreate = {
        title: 'Backend Software Intern',
        organization_name: 'Acme Corp',
        experience_type: 'internship',
        start_date: '2025-06-01',
        end_date: '2025-08-31',
        is_current: false,
        description: 'Built REST APIs and optimized database queries in PostgreSQL.',
        skills: 'FastAPI, PostgreSQL, Python',
      };
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: mockExperience });

      const result = await createExperience(payload);
      expect(postSpy).toHaveBeenCalledWith('/students/me/experiences', payload);
      expect(result).toEqual(mockExperience);
    });
  });

  describe('updateExperience', () => {
    it('calls PATCH /students/me/experiences/:id with partial payload', async () => {
      const payload: ExperienceRecordUpdate = {
        title: 'Lead Software Intern',
      };
      const updatedMock = { ...mockExperience, title: 'Lead Software Intern' };
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValueOnce({ data: updatedMock });

      const result = await updateExperience(1, payload);
      expect(patchSpy).toHaveBeenCalledWith('/students/me/experiences/1', payload);
      expect(result).toEqual(updatedMock);
    });
  });

  describe('deleteExperience', () => {
    it('calls DELETE /students/me/experiences/:id', async () => {
      const deleteSpy = vi.spyOn(apiClient, 'delete').mockResolvedValueOnce({ data: null });

      await deleteExperience(1);
      expect(deleteSpy).toHaveBeenCalledWith('/students/me/experiences/1');
    });
  });

  describe('requestExperienceVerification', () => {
    it('calls POST /students/me/experiences/:id/request-verification', async () => {
      const pendingRecord: ExperienceRecord = {
        ...mockExperience,
        status: 'pending_verification',
      };
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: pendingRecord });

      const result = await requestExperienceVerification(1);
      expect(postSpy).toHaveBeenCalledWith('/students/me/experiences/1/request-verification');
      expect(result).toEqual(pendingRecord);
    });
  });

  describe('getPendingVerifications', () => {
    it('calls GET /verifications/pending', async () => {
      const listResponse: ExperienceRecordListResponse = {
        items: [{ ...mockExperience, status: 'pending_verification' }],
        total: 1,
      };
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: listResponse });

      const result = await getPendingVerifications();
      expect(getSpy).toHaveBeenCalledWith('/verifications/pending');
      expect(result).toEqual(listResponse);
    });
  });

  describe('decideExperienceVerification', () => {
    it('calls POST /verifications/:id/decision with decision payload', async () => {
      const decisionPayload: ExperienceVerificationDecision = {
        action: 'approve',
        notes: 'Confirmed by engineering team.',
      };
      const verifiedRecord: ExperienceRecord = {
        ...mockExperience,
        status: 'verified',
        verification_source: 'recruiter_confirmed',
        verifier_id: 99,
        verified_at: '2026-09-25T12:00:00Z',
      };
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: verifiedRecord });

      const result = await decideExperienceVerification(1, decisionPayload);
      expect(postSpy).toHaveBeenCalledWith('/verifications/1/decision', decisionPayload);
      expect(result).toEqual(verifiedRecord);
    });
  });

  describe('getStudentExperiences', () => {
    it('calls GET /students/:userId/experiences', async () => {
      const listResponse: ExperienceRecordListResponse = {
        items: [{ ...mockExperience, status: 'verified' }],
        total: 1,
      };
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: listResponse });

      const result = await getStudentExperiences(10);
      expect(getSpy).toHaveBeenCalledWith('/students/10/experiences');
      expect(result).toEqual(listResponse);
    });
  });

  describe('Error propagation', () => {
    it('propagates API client errors correctly', async () => {
      const errorObj = {
        success: false,
        message: 'Experience record not found',
        error_code: 'NOT_FOUND',
        status: 404,
      };
      vi.spyOn(apiClient, 'get').mockRejectedValueOnce(errorObj);

      await expect(getMyExperience(999)).rejects.toEqual(errorObj);
    });
  });
});
