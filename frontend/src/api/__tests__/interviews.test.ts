import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiClient } from '../client';
import {
  scheduleInterview,
  getMyInterviews,
  getRecruiterInterviews,
  getInterviewById,
  updateInterview,
  cancelInterview,
} from '../interviews';
import { Interview, InterviewCreate, InterviewUpdate } from '@/types/interview';
import { ApiErrorResponse } from '@/types/api';

const mockInterview: Interview = {
  id: 1,
  application_id: 10,
  recruiter_id: 2,
  student_id: 5,
  job_id: 3,
  job_title: 'Full-Stack Software Engineering Intern',
  company_name: 'Acme Innovations Ltd',
  candidate_email: 'student@example.com',
  recruiter_email: 'recruiter@acme.com',
  scheduled_at: '2026-10-15T10:00:00Z',
  duration_minutes: 45,
  interview_type: 'online',
  location_or_link: 'https://meet.google.com/abc-defg-hij',
  notes: 'Technical coding round',
  status: 'scheduled',
  created_at: '2026-09-19T15:00:00Z',
  updated_at: '2026-09-19T15:00:00Z',
};

const mockInterviewList: Interview[] = [
  mockInterview,
  {
    id: 2,
    application_id: 11,
    recruiter_id: 2,
    student_id: 6,
    job_id: 3,
    job_title: 'Full-Stack Software Engineering Intern',
    company_name: 'Acme Innovations Ltd',
    candidate_email: 'other_student@example.com',
    recruiter_email: 'recruiter@acme.com',
    scheduled_at: '2026-10-16T14:00:00Z',
    duration_minutes: 60,
    interview_type: 'in_person',
    location_or_link: 'Building 4, Room 202',
    notes: 'System architecture round',
    status: 'scheduled',
    created_at: '2026-09-19T15:30:00Z',
    updated_at: '2026-09-19T15:30:00Z',
  },
];

describe('Interviews API Service Module (Phase F-08)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // scheduleInterview
  // ==========================================================================
  describe('scheduleInterview', () => {
    it('dispatches POST to /applications/:id/interviews with valid payload', async () => {
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        data: mockInterview,
      });

      const payload: InterviewCreate = {
        scheduled_at: '2026-10-15T10:00:00Z',
        duration_minutes: 45,
        interview_type: 'online',
        location_or_link: 'https://meet.google.com/abc-defg-hij',
        notes: 'Technical coding round',
      };

      const result = await scheduleInterview(10, payload);

      expect(postSpy).toHaveBeenCalledWith('/applications/10/interviews', payload);
      expect(result).toEqual(mockInterview);
    });

    it('propagates 400 when scheduling for an ineligible application status', async () => {
      const mock400Error: ApiErrorResponse = {
        success: false,
        message: "Cannot schedule interview for application in 'rejected' status",
        error_code: 'BAD_REQUEST',
        status: 400,
      };

      vi.spyOn(apiClient, 'post').mockRejectedValueOnce(mock400Error);

      await expect(
        scheduleInterview(10, {
          scheduled_at: '2026-10-15T10:00:00Z',
          duration_minutes: 45,
        })
      ).rejects.toEqual(mock400Error);
    });

    it('propagates 409 conflict when recruiter or student has an overlapping interview', async () => {
      const mock409Error: ApiErrorResponse = {
        success: false,
        message: 'Recruiter has a conflicting interview scheduled during this time window',
        error_code: 'RESOURCE_CONFLICT',
        status: 409,
      };

      vi.spyOn(apiClient, 'post').mockRejectedValueOnce(mock409Error);

      await expect(
        scheduleInterview(10, {
          scheduled_at: '2026-10-15T10:00:00Z',
          duration_minutes: 45,
        })
      ).rejects.toEqual(mock409Error);
    });

    it('propagates 403 forbidden error on cross-recruiter scheduling attempt', async () => {
      const mock403Error: ApiErrorResponse = {
        success: false,
        message: 'Not authorized to schedule interviews for this application',
        error_code: 'FORBIDDEN',
        status: 403,
      };

      vi.spyOn(apiClient, 'post').mockRejectedValueOnce(mock403Error);

      await expect(
        scheduleInterview(10, {
          scheduled_at: '2026-10-15T10:00:00Z',
          duration_minutes: 45,
        })
      ).rejects.toEqual(mock403Error);
    });

    it('propagates 404 error when application does not exist', async () => {
      const mock404Error: ApiErrorResponse = {
        success: false,
        message: 'Application not found',
        error_code: 'NOT_FOUND',
        status: 404,
      };

      vi.spyOn(apiClient, 'post').mockRejectedValueOnce(mock404Error);

      await expect(
        scheduleInterview(9999, {
          scheduled_at: '2026-10-15T10:00:00Z',
          duration_minutes: 45,
        })
      ).rejects.toEqual(mock404Error);
    });

    it('propagates 422 unprocessable entity on invalid duration', async () => {
      const mock422Error: ApiErrorResponse = {
        success: false,
        message: 'Input validation failed',
        error_code: 'VALIDATION_ERROR',
        status: 422,
      };

      vi.spyOn(apiClient, 'post').mockRejectedValueOnce(mock422Error);

      await expect(
        scheduleInterview(10, {
          scheduled_at: '2026-10-15T10:00:00Z',
          duration_minutes: 0,
        })
      ).rejects.toEqual(mock422Error);
    });
  });

  // ==========================================================================
  // getMyInterviews
  // ==========================================================================
  describe('getMyInterviews', () => {
    it('dispatches GET to /interviews/me and returns student interviews', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: mockInterviewList,
      });

      const result = await getMyInterviews();

      expect(getSpy).toHaveBeenCalledWith('/interviews/me');
      expect(result).toEqual(mockInterviewList);
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

      await expect(getMyInterviews()).rejects.toEqual(mock401Error);
    });

    it('propagates 403 forbidden error when called by non-student', async () => {
      const mock403Error: ApiErrorResponse = {
        success: false,
        message: 'Permission denied',
        error_code: 'FORBIDDEN',
        status: 403,
      };

      vi.spyOn(apiClient, 'get').mockRejectedValueOnce(mock403Error);

      await expect(getMyInterviews()).rejects.toEqual(mock403Error);
    });
  });

  // ==========================================================================
  // getRecruiterInterviews
  // ==========================================================================
  describe('getRecruiterInterviews', () => {
    it('dispatches GET to /recruiter/interviews and returns recruiter interviews', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: mockInterviewList,
      });

      const result = await getRecruiterInterviews();

      expect(getSpy).toHaveBeenCalledWith('/recruiter/interviews');
      expect(result).toEqual(mockInterviewList);
    });

    it('propagates 403 forbidden error when called by non-recruiter', async () => {
      const mock403Error: ApiErrorResponse = {
        success: false,
        message: 'Permission denied',
        error_code: 'FORBIDDEN',
        status: 403,
      };

      vi.spyOn(apiClient, 'get').mockRejectedValueOnce(mock403Error);

      await expect(getRecruiterInterviews()).rejects.toEqual(mock403Error);
    });
  });

  // ==========================================================================
  // getInterviewById
  // ==========================================================================
  describe('getInterviewById', () => {
    it('dispatches GET to /interviews/:id and returns interview detail', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: mockInterview,
      });

      const result = await getInterviewById(1);

      expect(getSpy).toHaveBeenCalledWith('/interviews/1');
      expect(result).toEqual(mockInterview);
    });

    it('propagates 404 not found error', async () => {
      const mock404Error: ApiErrorResponse = {
        success: false,
        message: 'Interview not found',
        error_code: 'NOT_FOUND',
        status: 404,
      };

      vi.spyOn(apiClient, 'get').mockRejectedValueOnce(mock404Error);

      await expect(getInterviewById(9999)).rejects.toEqual(mock404Error);
    });

    it('propagates 403 forbidden error on unauthorized interview inspection', async () => {
      const mock403Error: ApiErrorResponse = {
        success: false,
        message: 'Not authorized to view this interview',
        error_code: 'FORBIDDEN',
        status: 403,
      };

      vi.spyOn(apiClient, 'get').mockRejectedValueOnce(mock403Error);

      await expect(getInterviewById(1)).rejects.toEqual(mock403Error);
    });
  });

  // ==========================================================================
  // updateInterview
  // ==========================================================================
  describe('updateInterview', () => {
    it('dispatches PATCH to /interviews/:id with updated fields', async () => {
      const updatedInterview: Interview = {
        ...mockInterview,
        scheduled_at: '2026-10-16T14:00:00Z',
        duration_minutes: 60,
        status: 'rescheduled',
      };

      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValueOnce({
        data: updatedInterview,
      });

      const payload: InterviewUpdate = {
        scheduled_at: '2026-10-16T14:00:00Z',
        duration_minutes: 60,
      };

      const result = await updateInterview(1, payload);

      expect(patchSpy).toHaveBeenCalledWith('/interviews/1', payload);
      expect(result.status).toBe('rescheduled');
      expect(result.duration_minutes).toBe(60);
    });

    it('propagates 409 conflict when reschedule creates an overlap', async () => {
      const mock409Error: ApiErrorResponse = {
        success: false,
        message: 'Student has a conflicting interview scheduled during this time window',
        error_code: 'RESOURCE_CONFLICT',
        status: 409,
      };

      vi.spyOn(apiClient, 'patch').mockRejectedValueOnce(mock409Error);

      await expect(
        updateInterview(1, { scheduled_at: '2026-10-15T10:30:00Z' })
      ).rejects.toEqual(mock409Error);
    });

    it('propagates 403 forbidden when updating an interview not owned by recruiter', async () => {
      const mock403Error: ApiErrorResponse = {
        success: false,
        message: 'Not authorized to update this interview',
        error_code: 'FORBIDDEN',
        status: 403,
      };

      vi.spyOn(apiClient, 'patch').mockRejectedValueOnce(mock403Error);

      await expect(
        updateInterview(1, { notes: 'Updated notes' })
      ).rejects.toEqual(mock403Error);
    });
  });

  // ==========================================================================
  // cancelInterview
  // ==========================================================================
  describe('cancelInterview', () => {
    it('dispatches DELETE to /interviews/:id and returns cancelled interview', async () => {
      const cancelledInterview: Interview = {
        ...mockInterview,
        status: 'cancelled',
      };

      const deleteSpy = vi.spyOn(apiClient, 'delete').mockResolvedValueOnce({
        data: cancelledInterview,
      });

      const result = await cancelInterview(1);

      expect(deleteSpy).toHaveBeenCalledWith('/interviews/1');
      expect(result.status).toBe('cancelled');
    });

    it('propagates 403 forbidden error on unauthorized cancellation', async () => {
      const mock403Error: ApiErrorResponse = {
        success: false,
        message: 'Not authorized to cancel this interview',
        error_code: 'FORBIDDEN',
        status: 403,
      };

      vi.spyOn(apiClient, 'delete').mockRejectedValueOnce(mock403Error);

      await expect(cancelInterview(1)).rejects.toEqual(mock403Error);
    });

    it('propagates 404 not found error when interview does not exist', async () => {
      const mock404Error: ApiErrorResponse = {
        success: false,
        message: 'Interview not found',
        error_code: 'NOT_FOUND',
        status: 404,
      };

      vi.spyOn(apiClient, 'delete').mockRejectedValueOnce(mock404Error);

      await expect(cancelInterview(9999)).rejects.toEqual(mock404Error);
    });
  });
});
