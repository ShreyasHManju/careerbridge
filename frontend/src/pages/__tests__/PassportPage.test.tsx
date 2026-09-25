import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { PassportPage } from '../PassportPage';
import * as passportApi from '@/api/passport';
import { PassportResponse } from '@/types/passport';

const mockPopulatedPassport: PassportResponse = {
  identity: {
    user_id: 1,
    email: 'student@example.com',
    full_name: 'Alex Morgan',
    college: 'MIT',
    degree: 'B.S.',
    branch: 'Computer Science',
    graduation_year: 2026,
    bio: 'Software engineer & builder.',
    github_url: 'https://github.com/alexmorgan',
    linkedin_url: 'https://linkedin.com/in/alexmorgan',
    portfolio_url: 'https://alexmorgan.dev',
    profile_image_url: null,
    is_verified: true,
    created_at: '2026-09-20T00:00:00Z',
  },
  summary: {
    verified_experiences_count: 1,
    public_projects_count: 1,
    canonical_skills_count: 1,
    completed_milestones_count: 1,
  },
  verified_experiences: [
    {
      id: 1,
      title: 'Software Intern',
      organization_name: 'Apex Systems',
      experience_type: 'internship',
      start_date: '2025-06-01',
      end_date: '2025-08-31',
      is_current: false,
      description: 'Worked on backend APIs.',
      status: 'verified',
      verification_source: 'recruiter_confirmed',
      verified_at: '2025-09-01T00:00:00Z',
      innovation_project_id: null,
      innovation_project_title: null,
      skills: 'Python',
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
      title: 'Cloud Monitor',
      slug: 'cloud-monitor',
      short_description: 'Real-time observability system',
      description: 'Observability platform.',
      project_type: 'software',
      status: 'active',
      visibility: 'public',
      repository_url: 'https://github.com/alexmorgan/cloud-monitor',
      live_demo_url: null,
      skills: 'Python',
      structured_skills: [],
      total_milestones: 1,
      completed_milestones: 1,
      progress_percentage: 100,
      milestones: [
        {
          id: 1,
          innovation_project_id: 1,
          project_title: 'Cloud Monitor',
          title: 'Collector Agent',
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
      sources: ['experience', 'profile'],
    },
  ],
  milestones: [
    {
      id: 1,
      innovation_project_id: 1,
      project_title: 'Cloud Monitor',
      title: 'Collector Agent',
      description: null,
      status: 'completed',
      display_order: 1,
      due_date: null,
      completed_at: '2026-09-22T00:00:00Z',
    },
  ],
  resume: {
    id: 10,
    original_filename: 'Alex_Morgan_Resume.pdf',
    content_type: 'application/pdf',
    file_size: 1048576,
    updated_at: '2026-09-21T00:00:00Z',
  },
  is_owner: true,
};

const mockEmptyPassport: PassportResponse = {
  identity: {
    user_id: 2,
    email: 'newuser@example.com',
    full_name: null,
    college: null,
    degree: null,
    branch: null,
    graduation_year: null,
    bio: null,
    github_url: null,
    linkedin_url: null,
    portfolio_url: null,
    profile_image_url: null,
    is_verified: false,
    created_at: '2026-09-20T00:00:00Z',
  },
  summary: {
    verified_experiences_count: 0,
    public_projects_count: 0,
    canonical_skills_count: 0,
    completed_milestones_count: 0,
  },
  verified_experiences: [],
  projects: [],
  skills: [],
  milestones: [],
  resume: null,
  is_owner: true,
};

describe('PassportPage Component Foundation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading indicator while fetching passport', () => {
    vi.spyOn(passportApi, 'getMyPassport').mockReturnValue(new Promise(() => {}));

    render(<PassportPage />);

    expect(screen.getByTestId('passport-loading')).toBeInTheDocument();
    expect(screen.getByText('Assembling your Experience Passport...')).toBeInTheDocument();
  });

  it('renders populated passport with header, summary, and sections upon successful fetch', async () => {
    vi.spyOn(passportApi, 'getMyPassport').mockResolvedValueOnce(mockPopulatedPassport);

    render(<PassportPage />);

    await waitFor(() => {
      expect(screen.queryByTestId('passport-loading')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('passport-student-name')).toHaveTextContent('Alex Morgan');
    expect(screen.getByTestId('stat-count-experiences')).toHaveTextContent('1');
    expect(screen.getByTestId('exp-title-1')).toHaveTextContent('Software Intern');
    expect(screen.getByTestId('proj-title-1')).toHaveTextContent('Cloud Monitor');
    expect(screen.getByTestId('passport-skill-python')).toHaveTextContent('Python');
    expect(screen.getByTestId('passport-resume-filename')).toHaveTextContent('Alex_Morgan_Resume.pdf');
  });

  it('renders clean empty state fallback messages when student has no data', async () => {
    vi.spyOn(passportApi, 'getMyPassport').mockResolvedValueOnce(mockEmptyPassport);

    render(<PassportPage />);

    await waitFor(() => {
      expect(screen.queryByTestId('passport-loading')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('passport-student-name')).toHaveTextContent('newuser@example.com');
    expect(screen.getByTestId('stat-count-experiences')).toHaveTextContent('0');
    expect(screen.getByTestId('passport-experiences-empty')).toHaveTextContent('No verified experience records available.');
    expect(screen.getByTestId('passport-projects-empty')).toHaveTextContent('No active public innovation projects on record.');
    expect(screen.getByTestId('passport-skills-empty')).toHaveTextContent('No skills added yet to this passport.');
    expect(screen.getByTestId('passport-resume-empty')).toHaveTextContent('No resume document uploaded.');
  });

  it('renders error state and handles retry action on fetch failure', async () => {
    const getSpy = vi
      .spyOn(passportApi, 'getMyPassport')
      .mockRejectedValueOnce({
        message: 'Network error connecting to passport server.',
      })
      .mockResolvedValueOnce(mockPopulatedPassport);

    render(<PassportPage />);

    await waitFor(() => {
      expect(screen.getByTestId('passport-error')).toBeInTheDocument();
    });

    expect(screen.getByText('Network error connecting to passport server.')).toBeInTheDocument();

    // Click Retry
    fireEvent.click(screen.getByTestId('passport-retry-button'));

    expect(getSpy).toHaveBeenCalledTimes(2);

    await waitFor(() => {
      expect(screen.getByTestId('passport-student-name')).toHaveTextContent('Alex Morgan');
    });
  });

  it('calls getStudentPassport with route studentId parameter when provided', async () => {
    const getStudentSpy = vi
      .spyOn(passportApi, 'getStudentPassport')
      .mockResolvedValueOnce({
        ...mockPopulatedPassport,
        identity: {
          ...mockPopulatedPassport.identity,
          user_id: 42,
          full_name: 'Candidate Student',
        },
        is_owner: false,
      });
    const getMySpy = vi.spyOn(passportApi, 'getMyPassport');

    render(
      <MemoryRouter initialEntries={['/app/passport/42']}>
        <Routes>
          <Route path="/app/passport/:studentId" element={<PassportPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('passport-student-name')).toHaveTextContent('Candidate Student');
    });

    expect(getStudentSpy).toHaveBeenCalledTimes(1);
    expect(getStudentSpy).toHaveBeenCalledWith(42);
    expect(getMySpy).not.toHaveBeenCalled();
    expect(screen.queryByTestId('passport-owner-badge')).not.toBeInTheDocument();
  });
});
