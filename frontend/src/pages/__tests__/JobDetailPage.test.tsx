import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { JobDetailPage } from '../JobDetailPage';
import * as jobsApi from '@/api/jobs';
import * as savedJobsApi from '@/api/savedJobs';
import * as useAuthModule from '@/auth/useAuth';
import { JobPosting } from '@/types/job';
import { User } from '@/types/auth';

const mockJob: JobPosting = {
  id: 42,
  recruiter_id: 15,
  title: 'Cloud Infrastructure Intern',
  description: 'Work with AWS, Kubernetes, and Terraform to deploy microservices.',
  opportunity_type: 'internship',
  company_name: 'SkyHigh Clouds',
  location: 'Seattle, WA',
  is_remote: true,
  employment_type: 'full_time',
  skills: 'AWS, Docker, Kubernetes, Terraform',
  minimum_qualification: 'Pursuing degree in Computer Science',
  experience_required: 'Knowledge of Linux and containerization',
  salary_min: 55000,
  salary_max: 75000,
  application_deadline: '2026-12-31T23:59:59Z',
  is_active: true,
  created_at: '2026-09-19T10:00:00Z',
  updated_at: '2026-09-19T10:00:00Z',
};

const mockStudentUser: User = {
  id: 5,
  email: 'student@example.com',
  role: 'student',
  is_active: true,
  is_verified: true,
  created_at: '2026-09-19T10:00:00Z',
  updated_at: '2026-09-19T10:00:00Z',
};

const mockRecruiterUser: User = {
  id: 15,
  email: 'recruiter@example.com',
  role: 'recruiter',
  is_active: true,
  is_verified: true,
  created_at: '2026-09-19T10:00:00Z',
  updated_at: '2026-09-19T10:00:00Z',
};

function setupAuth(user: User = mockStudentUser) {
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    user,
    token: 'valid-token',
    isAuthenticated: true,
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

function renderWithRouter(initialEntry: string = '/app/jobs/42') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/app/jobs/:jobId" element={<JobDetailPage />} />
        <Route path="/app/jobs" element={<div>Opportunities List Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('JobDetailPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setupAuth(mockStudentUser);
    vi.spyOn(savedJobsApi, 'getSavedJobStatus').mockResolvedValue({
      job_id: 42,
      is_saved: false,
      saved_at: null,
    });
  });

  it('displays loading screen while fetching job details', () => {
    vi.spyOn(jobsApi, 'getJobById').mockReturnValue(new Promise(() => {})); // pending

    renderWithRouter();

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/Loading job details\.\.\./i)).toBeInTheDocument();
  });

  it('renders all job detail fields successfully', async () => {
    vi.spyOn(jobsApi, 'getJobById').mockResolvedValueOnce(mockJob);

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByTestId('job-detail-container')).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { level: 1, name: 'Cloud Infrastructure Intern' })).toBeInTheDocument();
    expect(screen.getByText('SkyHigh Clouds')).toBeInTheDocument();
    expect(screen.getByText(/Seattle, WA/)).toBeInTheDocument();
    expect(screen.getByText('Remote')).toBeInTheDocument();
    expect(screen.getByText('$55,000 - $75,000')).toBeInTheDocument();
    expect(screen.getByText(/Work with AWS, Kubernetes, and Terraform/)).toBeInTheDocument();
    expect(screen.getByText('AWS')).toBeInTheDocument();
    expect(screen.getByText('Docker')).toBeInTheDocument();
    expect(screen.getByText('Pursuing degree in Computer Science')).toBeInTheDocument();
    expect(screen.getByText('Knowledge of Linux and containerization')).toBeInTheDocument();
  });

  it('renders friendly unavailable state on 404', async () => {
    vi.spyOn(jobsApi, 'getJobById').mockRejectedValueOnce({
      status: 404,
      message: 'Job posting not found',
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByTestId('job-404-state')).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: /Job Unavailable/i })).toBeInTheDocument();
    expect(
      screen.getByText('Job posting is no longer active or available.')
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to Opportunities/i })).toBeInTheDocument();
  });

  it('renders friendly unavailable state for invalid non-numeric jobId', async () => {
    renderWithRouter('/app/jobs/invalid-id');

    await waitFor(() => {
      expect(screen.getByTestId('job-404-state')).toBeInTheDocument();
    });

    expect(
      screen.getByText('Job posting is no longer active or available.')
    ).toBeInTheDocument();
  });

  it('displays error state with Retry button on 500 server error', async () => {
    const getJobSpy = vi.spyOn(jobsApi, 'getJobById').mockRejectedValueOnce({
      status: 500,
      message: 'Internal server error occurred',
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(screen.getByText(/Unable to Load Opportunity/i)).toBeInTheDocument();
    expect(screen.getByText(/Internal server error occurred/i)).toBeInTheDocument();

    // Click retry
    getJobSpy.mockResolvedValueOnce(mockJob);
    fireEvent.click(screen.getByRole('button', { name: /Retry/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Cloud Infrastructure Intern' })).toBeInTheDocument();
    });
  });

  it('renders Save and Apply buttons for student role', async () => {
    vi.spyOn(jobsApi, 'getJobById').mockResolvedValueOnce(mockJob);

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByTestId('detail-apply-btn')).toBeInTheDocument();
      expect(screen.getByTestId('detail-save-btn')).toBeInTheDocument();
    });
  });

  it('does NOT render Save and Apply buttons for recruiter role', async () => {
    setupAuth(mockRecruiterUser);
    vi.spyOn(jobsApi, 'getJobById').mockResolvedValueOnce(mockJob);

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Cloud Infrastructure Intern' })).toBeInTheDocument();
    });

    expect(screen.queryByTestId('detail-apply-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('detail-save-btn')).not.toBeInTheDocument();
  });

  it('allows student to save and unsave from detail page', async () => {
    vi.spyOn(jobsApi, 'getJobById').mockResolvedValueOnce(mockJob);
    const saveSpy = vi.spyOn(savedJobsApi, 'saveJob').mockResolvedValueOnce({
      job_id: 42,
      is_saved: true,
      saved_at: '2026-09-19T12:00:00Z',
    });
    const unsaveSpy = vi.spyOn(savedJobsApi, 'unsaveJob').mockResolvedValueOnce();

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByTestId('detail-save-btn')).toHaveTextContent('☆ Save Opportunity');
    });

    // Save
    fireEvent.click(screen.getByTestId('detail-save-btn'));

    await waitFor(() => {
      expect(saveSpy).toHaveBeenCalledWith(42);
      expect(screen.getByTestId('detail-save-btn')).toHaveTextContent('★ Saved to Bookmarks');
    });

    // Unsave
    fireEvent.click(screen.getByTestId('detail-save-btn'));

    await waitFor(() => {
      expect(unsaveSpy).toHaveBeenCalledWith(42);
      expect(screen.getByTestId('detail-save-btn')).toHaveTextContent('☆ Save Opportunity');
    });
  });

  it('opens Apply modal when student clicks Apply Now', async () => {
    vi.spyOn(jobsApi, 'getJobById').mockResolvedValueOnce(mockJob);

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByTestId('detail-apply-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('detail-apply-btn'));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Apply for Cloud Infrastructure Intern/i })).toBeInTheDocument();
  });

  it('renders job details successfully even when saved status check fails', async () => {
    vi.spyOn(jobsApi, 'getJobById').mockResolvedValueOnce(mockJob);
    vi.spyOn(savedJobsApi, 'getSavedJobStatus').mockRejectedValueOnce({
      status: 500,
      message: 'Failed to fetch saved status',
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByTestId('job-detail-container')).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { level: 1, name: 'Cloud Infrastructure Intern' })).toBeInTheDocument();
    expect(screen.getByTestId('detail-save-btn')).toHaveTextContent('☆ Save Opportunity');
  });
});
