import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiClient } from '../client';
import {
  getMyPassport,
  getStudentPassport,
  createPassportShare,
  listPassportShares,
  updatePassportShare,
  revokePassportShare,
  getPublicPassport,
} from '../passport';
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
    verified_evidence_count: 0,
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
      verified_evidence: [],
      verified_evidence_count: 0,
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
  verified_evidence: [],
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

  describe('createPassportShare', () => {
    it('dispatches POST to /passport/shares and returns creation response with raw token', async () => {
      const mockCreated = {
        id: 1,
        share_token: 'raw_token_xyz_123',
        share_url: '/p/raw_token_xyz_123',
        label: 'Google Recruiter',
        is_active: true,
        allow_contact_info: true,
        allow_unverified_projects: false,
        view_count: 0,
        expires_at: '2026-11-01T00:00:00Z',
        created_at: '2026-10-08T00:00:00Z',
      };

      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        data: mockCreated,
      });

      const payload = {
        label: 'Google Recruiter',
        expires_in_days: 30,
        allow_contact_info: true,
        allow_unverified_projects: false,
      };

      const result = await createPassportShare(payload);

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith('/passport/shares', payload);
      expect(result).toEqual(mockCreated);
      expect(result.share_token).toBe('raw_token_xyz_123');
    });
  });

  describe('listPassportShares', () => {
    it('dispatches GET to /passport/shares and returns summary list', async () => {
      const mockShares = [
        {
          id: 1,
          token_preview: 'cb_share_abc...',
          share_url: null,
          label: 'Default Link',
          is_active: true,
          allow_contact_info: false,
          allow_unverified_projects: false,
          view_count: 5,
          last_accessed_at: '2026-10-07T12:00:00Z',
          expires_at: null,
          created_at: '2026-10-01T00:00:00Z',
          revoked_at: null,
        },
      ];

      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: mockShares,
      });

      const result = await listPassportShares();

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith('/passport/shares');
      expect(result).toEqual(mockShares);
    });
  });

  describe('updatePassportShare', () => {
    it('dispatches PATCH to /passport/shares/{id} and returns updated share', async () => {
      const mockUpdated = {
        id: 1,
        token_preview: 'cb_share_abc...',
        share_url: null,
        label: 'Updated Label',
        is_active: true,
        allow_contact_info: true,
        allow_unverified_projects: true,
        view_count: 5,
        last_accessed_at: null,
        expires_at: '2026-11-01T00:00:00Z',
        created_at: '2026-10-01T00:00:00Z',
        revoked_at: null,
      };

      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValueOnce({
        data: mockUpdated,
      });

      const payload = {
        label: 'Updated Label',
        allow_contact_info: true,
        allow_unverified_projects: true,
      };

      const result = await updatePassportShare(1, payload);

      expect(patchSpy).toHaveBeenCalledTimes(1);
      expect(patchSpy).toHaveBeenCalledWith('/passport/shares/1', payload);
      expect(result).toEqual(mockUpdated);
    });
  });

  describe('revokePassportShare', () => {
    it('dispatches DELETE to /passport/shares/{id}', async () => {
      const deleteSpy = vi.spyOn(apiClient, 'delete').mockResolvedValueOnce({
        data: null,
      });

      await revokePassportShare(1);

      expect(deleteSpy).toHaveBeenCalledTimes(1);
      expect(deleteSpy).toHaveBeenCalledWith('/passport/shares/1');
    });
  });

  describe('getPublicPassport', () => {
    it('dispatches GET to /public/passport/{share_token} and returns public projection', async () => {
      const mockPublicResponse = {
        full_name: 'Alex Morgan',
        institution: 'MIT',
        major: 'Computer Science',
        degree: 'B.S.',
        graduation_year: 2026,
        bio: 'Builder',
        avatar_url: null,
        contact_info: null,
        verification_summary: {
          issuer: 'CareerBridge',
          verification_status: 'VERIFIED',
          verified_at: '2026-09-01T00:00:00Z',
          verified_placements_count: 1,
          verified_projects_count: 1,
          total_verified_skills: 2,
        },
        verified_skills: [
          {
            skill_name: 'Python',
            category: 'Backend',
            projects_count: 1,
            verified_placements_count: 1,
          },
        ],
        experience_timeline: [
          {
            company_name: 'Apex Systems',
            role_title: 'Software Intern',
            employment_type: 'Internship',
            start_date: '2025-06-01',
            end_date: '2025-08-31',
            is_current: false,
            is_verified: true,
            verified_at: '2025-09-01T00:00:00Z',
          },
        ],
        featured_projects: [
          {
            title: 'Task Orchestrator',
            tagline: 'Workflow engine',
            description: 'Scalable system',
            milestones_completed: 2,
            total_milestones: 2,
            repository_url: 'https://github.com/alexmorgan/orchestrator',
            live_demo_url: null,
            is_verified: true,
            verified_evidence_count: 1,
          },
        ],
      };

      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: mockPublicResponse,
      });

      const result = await getPublicPassport('test_token_abc_123');

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith('/public/passport/test_token_abc_123');
      expect(result).toEqual(mockPublicResponse);
      expect(result.verification_summary.verification_status).toBe('VERIFIED');
    });
  });
});
