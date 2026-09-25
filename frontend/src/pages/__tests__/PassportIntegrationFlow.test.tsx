import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '@/App';
import * as useAuthModule from '@/auth/useAuth';
import * as passportApi from '@/api/passport';
import * as applicationsApi from '@/api/applications';
import * as jobsApi from '@/api/jobs';
import * as notificationsApi from '@/api/notifications';
import { User } from '@/types/auth';
import { PassportResponse } from '@/types/passport';
import { Application } from '@/types/application';
import { JobPosting } from '@/types/job';

const mockStudentUser: User = {
  id: 1,
  email: 'alex@example.com',
  role: 'student',
  is_active: true,
  is_verified: true,
  created_at: '2026-09-20T00:00:00Z',
  updated_at: '2026-09-20T00:00:00Z',
};

const mockRecruiterUser: User = {
  id: 2,
  email: 'recruiter@apex.com',
  role: 'recruiter',
  is_active: true,
  is_verified: true,
  created_at: '2026-09-20T00:00:00Z',
  updated_at: '2026-09-20T00:00:00Z',
};

const mockComprehensivePassport: PassportResponse = {
  identity: {
    user_id: 1,
    email: 'alex@example.com',
    full_name: 'Alex Morgan',
    college: 'MIT',
    degree: 'B.S.',
    branch: 'Computer Science',
    graduation_year: 2026,
    bio: 'Passionate distributed systems engineer & builder.',
    github_url: 'https://github.com/alexmorgan',
    linkedin_url: 'https://linkedin.com/in/alexmorgan',
    portfolio_url: 'https://alexmorgan.dev',
    profile_image_url: '/api/v1/profile-image/1',
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
      id: 101,
      title: 'Backend Systems Intern',
      organization_name: 'Apex Cloud Systems',
      experience_type: 'internship',
      start_date: '2025-06-01',
      end_date: '2025-08-31',
      is_current: false,
      description: 'Built high-throughput event streaming services with Redis.',
      status: 'verified',
      verification_source: 'recruiter_confirmed',
      verified_at: '2025-09-01T00:00:00Z',
      innovation_project_id: 201,
      innovation_project_title: 'Distributed Task Engine',
      skills: 'Python, Redis',
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
      id: 201,
      title: 'Distributed Task Engine',
      slug: 'distributed-task-engine',
      short_description: 'Scalable async job runner',
      description: 'Built with Python and FastAPI.',
      project_type: 'software',
      status: 'active',
      visibility: 'public',
      repository_url: 'https://github.com/alexmorgan/task-engine',
      live_demo_url: 'https://engine.dev',
      skills: 'Python, Docker',
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
      total_milestones: 2,
      completed_milestones: 2,
      progress_percentage: 100,
      milestones: [
        {
          id: 301,
          innovation_project_id: 201,
          project_title: 'Distributed Task Engine',
          title: 'Core Engine Architecture',
          description: null,
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
      sources: ['profile', 'experience'],
    },
  ],
  milestones: [
    {
      id: 301,
      innovation_project_id: 201,
      project_title: 'Distributed Task Engine',
      title: 'Core Engine Architecture',
      description: null,
      status: 'completed',
      display_order: 1,
      due_date: null,
      completed_at: '2026-09-22T00:00:00Z',
    },
  ],
  resume: {
    id: 401,
    original_filename: 'Alex_Morgan_Resume_2026.pdf',
    content_type: 'application/pdf',
    file_size: 1048576,
    updated_at: '2026-09-21T00:00:00Z',
  },
  is_owner: true,
};

const mockCandidatePassport: PassportResponse = {
  ...mockComprehensivePassport,
  identity: {
    ...mockComprehensivePassport.identity,
    user_id: 8,
    full_name: 'Candidate Sam',
    email: 'sam@example.com',
  },
  is_owner: false,
};

const mockApplication: Application = {
  id: 501,
  job_posting_id: 10,
  student_id: 8,
  status: 'applied',
  cover_message: 'Excited about backend engineering.',
  created_at: '2026-09-21T10:00:00Z',
  updated_at: '2026-09-21T10:00:00Z',
};

const mockJob: JobPosting = {
  id: 10,
  recruiter_id: 2,
  title: 'Backend Platform Engineer',
  description: 'Scalable services.',
  opportunity_type: 'job',
  company_name: 'Apex Systems',
  location: 'Remote',
  is_remote: true,
  employment_type: 'full_time',
  skills: 'Python, FastAPI',
  minimum_qualification: 'BS',
  experience_required: '1+ years',
  salary_min: 90000,
  salary_max: 120000,
  application_deadline: '2026-12-31T23:59:59Z',
  is_active: true,
  created_at: '2026-09-19T00:00:00Z',
  updated_at: '2026-09-19T00:00:00Z',
};

const setupAuthMock = (user: User | null) => {
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    user,
    token: user ? 'mock-token' : null,
    isAuthenticated: Boolean(user),
    isLoading: false,
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    clearAuthentication: vi.fn(),
    initializeSession: vi.fn(),
    clearError: vi.fn(),
  });
};

describe('CareerBridge 2.0-E — Experience Passport Integration Flow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(notificationsApi, 'getUnreadCount').mockResolvedValue({ unread_count: 0 });
  });

  it('Student owner integration flow: renders complete Experience Passport from /app/passport', async () => {
    setupAuthMock(mockStudentUser);
    const getMySpy = vi.spyOn(passportApi, 'getMyPassport').mockResolvedValueOnce(mockComprehensivePassport);
    const getStudentSpy = vi.spyOn(passportApi, 'getStudentPassport');

    render(
      <MemoryRouter initialEntries={['/app/passport']}>
        <App />
      </MemoryRouter>
    );

    // Verify loading state transitions to populated content
    expect(await screen.findByTestId('passport-page')).toBeInTheDocument();
    expect(await screen.findByTestId('passport-student-name')).toHaveTextContent('Alex Morgan');

    // Verify data source call
    expect(getMySpy).toHaveBeenCalledTimes(1);
    expect(getStudentSpy).not.toHaveBeenCalled();

    // Verify sections
    expect(screen.getByTestId('passport-verified-badge')).toBeInTheDocument();
    expect(screen.getByTestId('passport-owner-badge')).toHaveTextContent('Your Passport');
    expect(screen.getByTestId('passport-academic-info')).toHaveTextContent('B.S. • Computer Science • MIT • Class of 2026');
    expect(screen.getByTestId('stat-count-experiences')).toHaveTextContent('2');
    expect(screen.getByTestId('exp-title-101')).toHaveTextContent('Backend Systems Intern');
    expect(screen.getByTestId('exp-project-101')).toHaveTextContent('🚀 Distributed Task Engine');
    expect(screen.getByTestId('proj-title-201')).toHaveTextContent('Distributed Task Engine');
    expect(screen.getByTestId('passport-skill-python')).toHaveTextContent('Python');
    expect(screen.getByTestId('skill-source-python-profile')).toHaveTextContent('Profile');
    expect(screen.getByTestId('skill-source-python-experience')).toHaveTextContent('Experience');
    expect(screen.getByTestId('passport-resume-filename')).toHaveTextContent('Alex_Morgan_Resume_2026.pdf');
  });

  it('Recruiter application integration flow: clicking View Passport navigates to /app/recruiter/passport/8 and displays read-only candidate passport', async () => {
    setupAuthMock(mockRecruiterUser);
    vi.spyOn(applicationsApi, 'getRecruiterApplications').mockResolvedValueOnce([mockApplication]);
    vi.spyOn(jobsApi, 'getJobById').mockResolvedValueOnce(mockJob);
    const getStudentSpy = vi.spyOn(passportApi, 'getStudentPassport').mockResolvedValueOnce(mockCandidatePassport);
    const getMySpy = vi.spyOn(passportApi, 'getMyPassport');

    render(
      <MemoryRouter initialEntries={['/app/recruiter/applications']}>
        <App />
      </MemoryRouter>
    );

    // 1. Recruiter sees candidate application card with "View Passport" button
    const viewPassportBtn = await screen.findByTestId('view-passport-btn-501');
    expect(viewPassportBtn).toBeInTheDocument();
    expect(viewPassportBtn).toHaveAttribute('href', '/app/recruiter/passport/8');

    // 2. Click "View Passport"
    fireEvent.click(viewPassportBtn);

    // 3. Candidate Passport loads
    expect(await screen.findByTestId('passport-page')).toBeInTheDocument();
    expect(await screen.findByTestId('passport-student-name')).toHaveTextContent('Candidate Sam');

    // 4. Verify correct student ID was passed to getStudentPassport
    expect(getStudentSpy).toHaveBeenCalledTimes(1);
    expect(getStudentSpy).toHaveBeenCalledWith(8);
    expect(getMySpy).not.toHaveBeenCalled();

    // 5. Verify candidate view is strictly read-only (no owner badge)
    expect(screen.queryByTestId('passport-owner-badge')).not.toBeInTheDocument();
  });

  it('General candidate read-only route flow: authenticated user navigates to /app/passport/8', async () => {
    setupAuthMock(mockStudentUser);
    const getStudentSpy = vi.spyOn(passportApi, 'getStudentPassport').mockResolvedValueOnce(mockCandidatePassport);
    const getMySpy = vi.spyOn(passportApi, 'getMyPassport');

    render(
      <MemoryRouter initialEntries={['/app/passport/8']}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByTestId('passport-page')).toBeInTheDocument();
    expect(await screen.findByTestId('passport-student-name')).toHaveTextContent('Candidate Sam');
    expect(getStudentSpy).toHaveBeenCalledWith(8);
    expect(getMySpy).not.toHaveBeenCalled();
    expect(screen.queryByTestId('passport-owner-badge')).not.toBeInTheDocument();
  });

  it('Candidate error and retry flow: handles 404 cleanly and retries successfully', async () => {
    setupAuthMock(mockRecruiterUser);
    const getStudentSpy = vi
      .spyOn(passportApi, 'getStudentPassport')
      .mockRejectedValueOnce({ message: 'Student candidate not found' })
      .mockResolvedValueOnce(mockCandidatePassport);

    render(
      <MemoryRouter initialEntries={['/app/recruiter/passport/999']}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByTestId('passport-error')).toBeInTheDocument();
    expect(screen.getByText('Student candidate not found')).toBeInTheDocument();

    // Trigger retry
    fireEvent.click(screen.getByTestId('passport-retry-button'));

    expect(await screen.findByTestId('passport-content')).toBeInTheDocument();
    expect(getStudentSpy).toHaveBeenCalledTimes(2);
    expect(getStudentSpy).toHaveBeenCalledWith(999);
  });
});
