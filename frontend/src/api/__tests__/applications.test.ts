import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiClient } from '../client';
import { applyToJob } from '../applications';
import { Application } from '@/types/job';
import { ApiErrorResponse } from '@/types/api';

const mockApplication: Application = {
  id: 101,
  job_posting_id: 1,
  student_id: 2,
  status: 'applied',
  cover_message: 'I am excited about this frontend role!',
  resume_id: 5,
  created_at: '2026-09-19T12:00:00Z',
  updated_at: '2026-09-19T12:00:00Z',
};

describe('Applications API Service Module', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('dispatches POST to /jobs/:id/applications with cover_message when provided', async () => {
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      data: mockApplication,
    });

    const result = await applyToJob(1, { cover_message: 'I am excited about this frontend role!' });

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

  it('propagates 400 when student has not uploaded a resume', async () => {
    const mock400Error: ApiErrorResponse = {
      success: false,
      message: 'Please upload a resume before applying',
      error_code: 'BAD_REQUEST',
      status: 400,
    };

    vi.spyOn(apiClient, 'post').mockRejectedValueOnce(mock400Error);

    await expect(applyToJob(1)).rejects.toEqual(mock400Error);
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
