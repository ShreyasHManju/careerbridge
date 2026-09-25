import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiClient } from '../client';
import { getMyPassport, getStudentPassport } from '../passport';
import { PassportResponse } from '@/types/passport';

const mockPassportResponse: PassportResponse = {
  identity: {
    user_id: 10,
    email: 'alex@example.com',
    full_name: 'Alex Morgan',
    college: 'MIT',
    degree: 'Bachelor of Science',
    branch: 'Computer Science',
    graduation_year: 2026,
    bio: 'Full-stack developer.',
    github_url: 'https://github.com/alexmorgan',
    linkedin_url: 'https://linkedin.com/in/alexmorgan',
    portfolio_url: 'https://alexmorgan.dev',
    profile_image_url: '/api/v1/profile-image/10',
    is_verified: true,
    created_at: '2026-09-20T00:00:00Z',
  },
  summary: {
    verified_experiences_count: 2,
    public_projects_count: 1,
    canonical_skills_count: 3,
    completed_milestones_count: 2,
  },
  verified_experiences: [
    {
      id: 1,
      title: 'Backend Intern',
      organization_name: 'Apex Systems',
      experience_type: 'internship',
      start_date: '2025-06-01',
      end_date: '2025-08-31',
      is_current: false,
      description: 'Worked on distributed event streaming.',
      status: 'verified',
      verification_source: 'recruiter_confirmed',
      verified_at: '2025-09-01T12:00:00Z',
      innovation_project_id: null,
      innovation_project_title: null,
      skills: 'Python, FastAPI',
      structured_skills: [
        {
          id: 1,
          name: 'Python',
          slug: 'python',
          category: 'Backend',
          is_verified: true,
          created_at: '2026-09-20T00:00:00Z',
        },
      ],
    },
  ],
  projects: [
    {
      id: 1,
      title: 'Task Orchestrator',
      slug: 'task-orchestrator',
      short_description: 'Distributed workflow engine',
      description: 'Full stack project.',
      project_type: 'software',
      status: 'active',
      visibility: 'public',
      repository_url: 'https://github.com/alexmorgan/orchestrator',
      live_demo_url: 'https://orchestrator.dev',
      skills: 'Python, Redis',
      structured_skills: [],
      total_milestones: 2,
      completed_milestones: 2,
      progress_percentage: 100,
      milestones: [
        {
          id: 1,
          innovation_project_id: 1,
          project_title: 'Task Orchestrator',
          title: 'Core Engine',
          description: 'Initial engine setup',
          status: 'completed',
          display_order: 1,
          due_date: null,
          completed_at: '2026-09-22T00:00:00Z',
        },
      ],
    },
  ],
  skills: [
    {
      id: 1,
      name: 'Python',
      slug: 'python',
      category: 'Backend',
      is_verified: true,
      sources: ['experience', 'profile'],
    },
  ],
  milestones: [
    {
      id: 1,
      innovation_project_id: 1,
      project_title: 'Task Orchestrator',
      title: 'Core Engine',
      description: 'Initial engine setup',
      status: 'completed',
      display_order: 1,
      due_date: null,
      completed_at: '2026-09-22T00:00:00Z',
    },
  ],
  resume: {
    id: 5,
    original_filename: 'Alex_Morgan_Resume.pdf',
    content_type: 'application/pdf',
    file_size: 102400,
    updated_at: '2026-09-21T00:00:00Z',
  },
  is_owner: true,
};

describe('Passport API Service Module', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getMyPassport', () => {
    it('dispatches GET to /passport/me and returns passport payload', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: mockPassportResponse,
      });

      const result = await getMyPassport();

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith('/passport/me');
      expect(result).toEqual(mockPassportResponse);
      expect(result.is_owner).toBe(true);
    });

    it('propagates error when user is unauthenticated or forbidden', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValueOnce({
        success: false,
        message: 'Not authenticated',
        status: 401,
      });

      await expect(getMyPassport()).rejects.toEqual(
        expect.objectContaining({
          success: false,
          status: 401,
        })
      );
    });
  });

  describe('getStudentPassport', () => {
    it('dispatches GET to /passport/{student_id} and returns student passport payload', async () => {
      const recruiterView: PassportResponse = {
        ...mockPassportResponse,
        is_owner: false,
      };

      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: recruiterView,
      });

      const result = await getStudentPassport(10);

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith('/passport/10');
      expect(result).toEqual(recruiterView);
      expect(result.is_owner).toBe(false);
    });

    it('propagates 404 error when student is not found', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValueOnce({
        success: false,
        message: 'Student not found',
        status: 404,
      });

      await expect(getStudentPassport(999)).rejects.toEqual(
        expect.objectContaining({
          success: false,
          status: 404,
        })
      );
    });
  });
});
