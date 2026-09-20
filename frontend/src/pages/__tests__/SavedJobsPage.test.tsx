import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SavedJobsPage } from '../SavedJobsPage';
import * as useAuthModule from '@/auth/useAuth';
import * as savedJobsApi from '@/api/savedJobs';
import * as applicationsApi from '@/api/applications';
import { User } from '@/types/auth';
import { SavedJob } from '@/types/job';

const mockStudentUser: User = {
  id: 1,
  email: 'student@example.com',
  role: 'student',
  is_active: true,
  is_verified: true,
  created_at: '2026-09-19T10:00:00Z',
  updated_at: '2026-09-19T10:00:00Z',
};

const mockRecruiterUser: User = {
  id: 2,
  email: 'recruiter@example.com',
  role: 'recruiter',
  is_active: true,
  is_verified: true,
  created_at: '2026-09-19T10:00:00Z',
  updated_at: '2026-09-19T10:00:00Z',
};

const mockSavedJob1: SavedJob = {
  id: 101,
  saved_id: 1,
  title: 'Full Stack Engineering Intern',
  description: 'Work with React, FastAPI, and PostgreSQL on modern cloud systems.',
  opportunity_type: 'internship',
  company_name: 'Acme Technologies',
  location: 'San Francisco, CA',
  is_remote: true,
  employment_type: 'full_time',
  skills: 'React, Python, TypeScript',
  minimum_qualification: 'B.S. in Computer Science',
  experience_required: '0-1 years',
  salary_min: 40000,
  salary_max: 60000,
  application_deadline: '2026-10-15T00:00:00Z',
  is_active: true,
  created_at: '2026-09-18T10:00:00Z',
  updated_at: '2026-09-18T10:00:00Z',
  saved_at: '2026-09-19T14:00:00Z',
};

const mockSavedJob2: SavedJob = {
  id: 102,
  saved_id: 2,
  title: 'Frontend Developer',
  description: 'Design and build accessible user interfaces.',
  opportunity_type: 'job',
  company_name: 'PixelCraft Labs',
  location: 'New York, NY',
  is_remote: false,
  employment_type: 'full_time',
  skills: 'Vue, JavaScript',
  minimum_qualification: 'Associate Degree',
  experience_required: '1-2 years',
  salary_min: 75000,
  salary_max: 95000,
  application_deadline: null,
  is_active: true,
  created_at: '2026-09-15T09:00:00Z',
  updated_at: '2026-09-15T09:00:00Z',
  saved_at: '2026-09-19T15:00:00Z',
};

function setupAuth(user: User | null = mockStudentUser) {
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    user,
    token: user ? 'mock-token' : null,
    isAuthenticated: !!user,
    isLoading: false,
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    clearAuthentication: vi.fn(),
    initializeSession: vi.fn(),
    clearError: vi.fn(),
  });
}

describe('SavedJobsPage (Phase 30B.2)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading state initially while fetching saved jobs', () => {
    setupAuth(mockStudentUser);
    vi.spyOn(savedJobsApi, 'getSavedJobs').mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter>
        <SavedJobsPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Loading your saved opportunities...')).toBeInTheDocument();
  });

  it('renders empty state when student has no saved jobs', async () => {
    setupAuth(mockStudentUser);
    vi.spyOn(savedJobsApi, 'getSavedJobs').mockResolvedValue([]);

    render(
      <MemoryRouter>
        <SavedJobsPage />
      </MemoryRouter>
    );

    expect(await screen.findByTestId('saved-jobs-empty')).toBeInTheDocument();
    expect(screen.getByText('No Saved Opportunities Yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Explore Opportunities/i })).toHaveAttribute('href', '/app/jobs');
  });

  it('renders populated list of saved jobs with count badge and job details', async () => {
    setupAuth(mockStudentUser);
    vi.spyOn(savedJobsApi, 'getSavedJobs').mockResolvedValue([mockSavedJob1, mockSavedJob2]);

    render(
      <MemoryRouter>
        <SavedJobsPage />
      </MemoryRouter>
    );

    expect(await screen.findByTestId('saved-jobs-count')).toHaveTextContent('2 saved opportunities');
    expect(screen.getByText('Full Stack Engineering Intern')).toBeInTheDocument();
    expect(screen.getByText('PixelCraft Labs')).toBeInTheDocument();
    expect(screen.getByText('San Francisco, CA')).toBeInTheDocument();
    expect(screen.getByText('Remote')).toBeInTheDocument();

    // Verify job details links
    expect(screen.getByRole('link', { name: 'Full Stack Engineering Intern' })).toHaveAttribute('href', '/app/jobs/101');
    expect(screen.getByRole('link', { name: 'Frontend Developer' })).toHaveAttribute('href', '/app/jobs/102');
  });

  it('handles error state and provides a working retry button', async () => {
    setupAuth(mockStudentUser);
    const getSavedJobsSpy = vi.spyOn(savedJobsApi, 'getSavedJobs')
      .mockRejectedValueOnce({
        success: false,
        message: 'Network connection failed',
        error_code: 'NETWORK_ERROR',
      })
      .mockResolvedValueOnce([mockSavedJob1]);

    render(
      <MemoryRouter>
        <SavedJobsPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Network connection failed');

    const retryBtn = screen.getByRole('button', { name: /Retry/i });
    await userEvent.click(retryBtn);

    expect(getSavedJobsSpy).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('Full Stack Engineering Intern')).toBeInTheDocument();
  });

  it('successfully unsaves a job, updates list and shows confirmation message', async () => {
    const user = userEvent.setup();
    setupAuth(mockStudentUser);
    vi.spyOn(savedJobsApi, 'getSavedJobs').mockResolvedValue([mockSavedJob1, mockSavedJob2]);
    const unsaveSpy = vi.spyOn(savedJobsApi, 'unsaveJob').mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <SavedJobsPage />
      </MemoryRouter>
    );

    await screen.findByText('Full Stack Engineering Intern');
    expect(screen.getByTestId('saved-jobs-count')).toHaveTextContent('2 saved opportunities');

    // Click Unsave button on first job
    const unsaveBtn = screen.getByTestId('save-btn-101');
    await user.click(unsaveBtn);

    expect(unsaveSpy).toHaveBeenCalledWith(101);

    await waitFor(() => {
      expect(screen.queryByText('Full Stack Engineering Intern')).not.toBeInTheDocument();
      expect(screen.getByText('Frontend Developer')).toBeInTheDocument();
      expect(screen.getByTestId('saved-jobs-count')).toHaveTextContent('1 saved opportunity');
      expect(screen.getByText('Opportunity removed from your saved list.')).toBeInTheDocument();
    });
  });

  it('preserves saved jobs and displays error when unsave fails', async () => {
    const user = userEvent.setup();
    setupAuth(mockStudentUser);
    vi.spyOn(savedJobsApi, 'getSavedJobs').mockResolvedValue([mockSavedJob1]);
    vi.spyOn(savedJobsApi, 'unsaveJob').mockRejectedValue({
      success: false,
      message: 'Server error occurred while unsaving',
      error_code: 'INTERNAL_SERVER_ERROR',
    });

    render(
      <MemoryRouter>
        <SavedJobsPage />
      </MemoryRouter>
    );

    await screen.findByText('Full Stack Engineering Intern');

    const unsaveBtn = screen.getByTestId('save-btn-101');
    await user.click(unsaveBtn);

    await waitFor(() => {
      expect(screen.getByText('Full Stack Engineering Intern')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent('Server error occurred while unsaving');
    });
  });

  it('opens ApplyModal and submits an application directly from saved jobs list', async () => {
    const user = userEvent.setup();
    setupAuth(mockStudentUser);
    vi.spyOn(savedJobsApi, 'getSavedJobs').mockResolvedValue([mockSavedJob1]);
    const applySpy = vi.spyOn(applicationsApi, 'applyToJob').mockResolvedValue({
      id: 50,
      student_id: 1,
      job_posting_id: 101,
      cover_message: null,
      status: 'applied',
      created_at: '2026-09-20T10:00:00Z',
      updated_at: '2026-09-20T10:00:00Z',
    });

    render(
      <MemoryRouter>
        <SavedJobsPage />
      </MemoryRouter>
    );

    await screen.findByText('Full Stack Engineering Intern');

    const applyBtn = screen.getByTestId('apply-btn-101');
    await user.click(applyBtn);

    expect(screen.getByRole('dialog', { name: /Apply for Full Stack Engineering Intern/i })).toBeInTheDocument();

    const submitAppBtn = screen.getByRole('button', { name: /Submit Application/i });
    await user.click(submitAppBtn);

    expect(applySpy).toHaveBeenCalledWith(101, {
      cover_message: undefined,
    });

    await waitFor(() => {
      expect(screen.getByText(/Application submitted successfully for Full Stack Engineering Intern!/i)).toBeInTheDocument();
    });
  });

  it('displays access restriction for non-student roles', () => {
    setupAuth(mockRecruiterUser);

    render(
      <MemoryRouter>
        <SavedJobsPage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('saved-jobs-forbidden')).toBeInTheDocument();
    expect(screen.getByText(/Access restricted. Only student accounts can view and manage saved opportunities./i)).toBeInTheDocument();
  });
});
