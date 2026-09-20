import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { RecruiterJobsPage } from '../RecruiterJobsPage';
import * as useAuthModule from '@/auth/useAuth';
import * as jobsApi from '@/api/jobs';
import { JobPosting } from '@/types/job';
import { User } from '@/types/auth';
import { ApiErrorResponse } from '@/types/api';

const mockRecruiterUser: User = {
  id: 10,
  email: 'recruiter@techflow.com',
  role: 'recruiter',
  is_active: true,
  is_verified: true,
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-01T10:00:00Z',
};

const mockStudentUser: User = {
  id: 20,
  email: 'student@example.com',
  role: 'student',
  is_active: true,
  is_verified: true,
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-01T10:00:00Z',
};

const mockJobsList: JobPosting[] = [
  {
    id: 101,
    recruiter_id: 10,
    title: 'Senior Frontend Engineer',
    description: 'Lead frontend development with React and TypeScript.',
    opportunity_type: 'job',
    company_name: 'TechFlow Corp',
    location: 'San Francisco, CA',
    is_remote: true,
    employment_type: 'full_time',
    skills: 'React, TypeScript, CSS',
    minimum_qualification: 'B.S. in CS',
    experience_required: '3+ years',
    salary_min: 120000,
    salary_max: 150000,
    application_deadline: '2026-12-31T23:59:59Z',
    is_active: true,
    created_at: '2026-09-10T10:00:00Z',
    updated_at: '2026-09-10T10:00:00Z',
  },
  {
    id: 102,
    recruiter_id: 10,
    title: 'Backend Engineering Intern',
    description: 'Help develop high-throughput microservices.',
    opportunity_type: 'internship',
    company_name: 'TechFlow Corp',
    location: 'Austin, TX',
    is_remote: false,
    employment_type: 'part_time',
    skills: 'Python, FastAPI, PostgreSQL',
    minimum_qualification: 'Enrolled in STEM degree',
    experience_required: 'None',
    salary_min: 30000,
    salary_max: 45000,
    application_deadline: '2026-11-15T23:59:59Z',
    is_active: false,
    created_at: '2026-09-05T10:00:00Z',
    updated_at: '2026-09-05T10:00:00Z',
  },
];

function setupAuth(user: User | null) {
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    user,
    token: user ? 'valid-token' : null,
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

describe('RecruiterJobsPage Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('restricts non-recruiter users with forbidden access message', () => {
    setupAuth(mockStudentUser);
    render(
      <MemoryRouter>
        <RecruiterJobsPage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('recruiter-jobs-forbidden')).toBeInTheDocument();
    expect(
      screen.getByText(/Only recruiter accounts can manage job postings/i)
    ).toBeInTheDocument();
  });

  it('renders loading state initially while fetching recruiter jobs', async () => {
    setupAuth(mockRecruiterUser);
    vi.spyOn(jobsApi, 'getMyJobPostings').mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter>
        <RecruiterJobsPage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('recruiter-jobs-loading')).toBeInTheDocument();
  });

  it('renders error state and retries fetching when retry button is clicked', async () => {
    setupAuth(mockRecruiterUser);
    const getSpy = vi
      .spyOn(jobsApi, 'getMyJobPostings')
      .mockRejectedValueOnce({
        status: 500,
        message: 'Database connection failed',
      } as ApiErrorResponse)
      .mockResolvedValueOnce(mockJobsList);

    render(
      <MemoryRouter>
        <RecruiterJobsPage />
      </MemoryRouter>
    );

    expect(await screen.findByTestId('recruiter-jobs-error')).toBeInTheDocument();
    expect(screen.getByText(/Database connection failed/i)).toBeInTheDocument();

    // Click retry
    fireEvent.click(screen.getByRole('button', { name: /Retry/i }));

    expect(await screen.findByTestId('recruiter-jobs-list')).toBeInTheDocument();
    expect(getSpy).toHaveBeenCalledTimes(2);
  });

  it('renders empty state when recruiter has no postings yet', async () => {
    setupAuth(mockRecruiterUser);
    vi.spyOn(jobsApi, 'getMyJobPostings').mockResolvedValueOnce([]);

    render(
      <MemoryRouter>
        <RecruiterJobsPage />
      </MemoryRouter>
    );

    expect(await screen.findByTestId('recruiter-jobs-empty')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /No Job Postings Yet/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ Post Your First Job/i })).toBeInTheDocument();
  });

  it('renders populated job list with correct badges and counts', async () => {
    setupAuth(mockRecruiterUser);
    vi.spyOn(jobsApi, 'getMyJobPostings').mockResolvedValueOnce(mockJobsList);

    render(
      <MemoryRouter>
        <RecruiterJobsPage />
      </MemoryRouter>
    );

    expect(await screen.findByTestId('recruiter-jobs-list')).toBeInTheDocument();
    expect(screen.getByTestId('recruiter-jobs-count')).toHaveTextContent('2 total postings');

    // Cards
    expect(screen.getByTestId('recruiter-job-card-101')).toBeInTheDocument();
    expect(screen.getByTestId('recruiter-job-card-102')).toBeInTheDocument();

    // Status badges
    expect(screen.getByTestId('status-badge-101')).toHaveTextContent('Active');
    expect(screen.getByTestId('status-badge-102')).toHaveTextContent('Inactive');

    // Filter tabs counts
    expect(screen.getByTestId('filter-tab-all')).toHaveTextContent('All (2)');
    expect(screen.getByTestId('filter-tab-active')).toHaveTextContent('Active (1)');
    expect(screen.getByTestId('filter-tab-inactive')).toHaveTextContent('Inactive (1)');
  });

  it('filters postings by Active and Inactive status tabs', async () => {
    setupAuth(mockRecruiterUser);
    vi.spyOn(jobsApi, 'getMyJobPostings').mockResolvedValueOnce(mockJobsList);

    render(
      <MemoryRouter>
        <RecruiterJobsPage />
      </MemoryRouter>
    );

    await screen.findByTestId('recruiter-jobs-list');

    // Filter to Active only
    fireEvent.click(screen.getByTestId('filter-tab-active'));
    expect(screen.getByTestId('recruiter-job-card-101')).toBeInTheDocument();
    expect(screen.queryByTestId('recruiter-job-card-102')).not.toBeInTheDocument();

    // Filter to Inactive only
    fireEvent.click(screen.getByTestId('filter-tab-inactive'));
    expect(screen.queryByTestId('recruiter-job-card-101')).not.toBeInTheDocument();
    expect(screen.getByTestId('recruiter-job-card-102')).toBeInTheDocument();

    // Reset to All
    fireEvent.click(screen.getByTestId('filter-tab-all'));
    expect(screen.getByTestId('recruiter-job-card-101')).toBeInTheDocument();
    expect(screen.getByTestId('recruiter-job-card-102')).toBeInTheDocument();
  });

  it('opens Create Job modal and prepends newly created job to list', async () => {
    const user = userEvent.setup();
    setupAuth(mockRecruiterUser);
    vi.spyOn(jobsApi, 'getMyJobPostings').mockResolvedValueOnce(mockJobsList);

    const newJob: JobPosting = {
      id: 103,
      recruiter_id: 10,
      title: 'DevOps Cloud Engineer',
      description: 'Automate deployment pipelines and manage cloud infrastructure.',
      opportunity_type: 'job',
      company_name: 'TechFlow Corp',
      location: 'Remote',
      is_remote: true,
      employment_type: 'full_time',
      skills: 'Terraform, AWS, CI/CD',
      minimum_qualification: 'B.S. in Computer Science',
      experience_required: '2 years',
      salary_min: 110000,
      salary_max: 135000,
      application_deadline: '2026-12-15T23:59:59Z',
      is_active: true,
      created_at: '2026-09-20T10:00:00Z',
      updated_at: '2026-09-20T10:00:00Z',
    };

    vi.spyOn(jobsApi, 'createJob').mockResolvedValueOnce(newJob);

    render(
      <MemoryRouter>
        <RecruiterJobsPage />
      </MemoryRouter>
    );

    await screen.findByTestId('recruiter-jobs-list');

    // Click "+ Post a Job" button
    await user.click(screen.getByTestId('create-job-btn'));

    expect(screen.getByTestId('job-form-modal')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /Create New Job Posting/i })).toBeInTheDocument();

    // Fill form
    await user.type(screen.getByLabelText(/Job Title/i), 'DevOps Cloud Engineer');
    await user.type(screen.getByLabelText(/Company Name/i), 'TechFlow Corp');
    await user.type(
      screen.getByLabelText(/Description/i),
      'Automate deployment pipelines and manage cloud infrastructure.'
    );

    // Submit
    await user.click(screen.getByTestId('job-form-submit-btn'));

    await waitFor(() => {
      expect(screen.queryByTestId('job-form-modal')).not.toBeInTheDocument();
    });

    // Verify new job card rendered in list
    expect(screen.getByTestId('recruiter-job-card-103')).toBeInTheDocument();
    expect(screen.getByText('DevOps Cloud Engineer')).toBeInTheDocument();
    expect(screen.getByTestId('recruiter-jobs-count')).toHaveTextContent('3 total postings');
    expect(screen.getByTestId('recruiter-jobs-toast')).toHaveTextContent('created successfully');
  });

  it('opens Edit Job modal and updates job data in list upon submission', async () => {
    const user = userEvent.setup();
    setupAuth(mockRecruiterUser);
    vi.spyOn(jobsApi, 'getMyJobPostings').mockResolvedValueOnce(mockJobsList);

    const updatedJob: JobPosting = {
      ...mockJobsList[0],
      title: 'Staff Frontend Architect',
    };

    vi.spyOn(jobsApi, 'updateJob').mockResolvedValueOnce(updatedJob);

    render(
      <MemoryRouter>
        <RecruiterJobsPage />
      </MemoryRouter>
    );

    await screen.findByTestId('recruiter-jobs-list');

    // Click Edit button for job 101
    await user.click(screen.getByTestId('edit-job-btn-101'));

    expect(screen.getByTestId('job-form-modal')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /Edit Job Posting/i })).toBeInTheDocument();

    const titleInput = screen.getByLabelText(/Job Title/i);
    await user.clear(titleInput);
    await user.type(titleInput, 'Staff Frontend Architect');

    await user.click(screen.getByTestId('job-form-submit-btn'));

    await waitFor(() => {
      expect(screen.queryByTestId('job-form-modal')).not.toBeInTheDocument();
    });

    expect(screen.getByText('Staff Frontend Architect')).toBeInTheDocument();
    expect(screen.getByTestId('recruiter-jobs-toast')).toHaveTextContent('updated successfully');
  });

  it('handles quick deactivation and reactivation lifecycle toggles', async () => {
    setupAuth(mockRecruiterUser);
    vi.spyOn(jobsApi, 'getMyJobPostings').mockResolvedValueOnce(mockJobsList);

    const deactivatedJob: JobPosting = {
      ...mockJobsList[0],
      is_active: false,
    };

    const reactivatedJob: JobPosting = {
      ...mockJobsList[1],
      is_active: true,
    };

    const updateSpy = vi
      .spyOn(jobsApi, 'updateJob')
      .mockResolvedValueOnce(deactivatedJob)
      .mockResolvedValueOnce(reactivatedJob);

    render(
      <MemoryRouter>
        <RecruiterJobsPage />
      </MemoryRouter>
    );

    await screen.findByTestId('recruiter-jobs-list');

    // 1. Deactivate active job 101
    fireEvent.click(screen.getByTestId('toggle-active-btn-101'));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(101, { is_active: false });
    });

    expect(await screen.findByTestId('status-badge-101')).toHaveTextContent('Inactive');
    expect(screen.getByTestId('toggle-active-btn-101')).toHaveTextContent('Reactivate');

    // 2. Reactivate inactive job 102
    fireEvent.click(screen.getByTestId('toggle-active-btn-102'));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(102, { is_active: true });
    });

    expect(await screen.findByTestId('status-badge-102')).toHaveTextContent('Active');
    expect(screen.getByTestId('toggle-active-btn-102')).toHaveTextContent('Deactivate');
  });

  it('preserves valid state and displays error toast when status toggle mutation fails', async () => {
    setupAuth(mockRecruiterUser);
    vi.spyOn(jobsApi, 'getMyJobPostings').mockResolvedValueOnce(mockJobsList);

    vi.spyOn(jobsApi, 'updateJob').mockRejectedValueOnce({
      status: 403,
      message: 'You can only update your own job postings.',
    } as ApiErrorResponse);

    render(
      <MemoryRouter>
        <RecruiterJobsPage />
      </MemoryRouter>
    );

    await screen.findByTestId('recruiter-jobs-list');

    fireEvent.click(screen.getByTestId('toggle-active-btn-101'));

    expect(await screen.findByTestId('recruiter-jobs-toast')).toHaveTextContent(
      'You can only update your own job postings.'
    );

    // State preserved
    expect(screen.getByTestId('status-badge-101')).toHaveTextContent('Active');
    expect(screen.getByTestId('toggle-active-btn-101')).toHaveTextContent('Deactivate');
  });

  it('handles explicit delete confirmation flow and removes deleted job from state', async () => {
    setupAuth(mockRecruiterUser);
    vi.spyOn(jobsApi, 'getMyJobPostings').mockResolvedValueOnce(mockJobsList);
    const deleteSpy = vi.spyOn(jobsApi, 'deleteJob').mockResolvedValueOnce(undefined);

    render(
      <MemoryRouter>
        <RecruiterJobsPage />
      </MemoryRouter>
    );

    await screen.findByTestId('recruiter-jobs-list');

    // Click delete on job 102
    fireEvent.click(screen.getByTestId('delete-job-btn-102'));

    // Confirmation modal opens
    expect(screen.getByTestId('delete-confirm-modal')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to permanently delete/i)).toBeInTheDocument();

    // Confirm deletion
    fireEvent.click(screen.getByTestId('confirm-delete-btn'));

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith(102);
    });

    // Modal closed and job 102 removed from list
    expect(screen.queryByTestId('delete-confirm-modal')).not.toBeInTheDocument();
    expect(screen.queryByTestId('recruiter-job-card-102')).not.toBeInTheDocument();
    expect(screen.getByTestId('recruiter-jobs-count')).toHaveTextContent('1 total posting');
    expect(screen.getByTestId('recruiter-jobs-toast')).toHaveTextContent('permanently deleted');
  });

  it('cancels delete confirmation without deleting when Cancel is clicked', async () => {
    setupAuth(mockRecruiterUser);
    vi.spyOn(jobsApi, 'getMyJobPostings').mockResolvedValueOnce(mockJobsList);
    const deleteSpy = vi.spyOn(jobsApi, 'deleteJob');

    render(
      <MemoryRouter>
        <RecruiterJobsPage />
      </MemoryRouter>
    );

    await screen.findByTestId('recruiter-jobs-list');

    fireEvent.click(screen.getByTestId('delete-job-btn-101'));

    expect(screen.getByTestId('delete-confirm-modal')).toBeInTheDocument();

    // Click Cancel in modal
    fireEvent.click(screen.getByRole('button', { name: /^Cancel$/i }));

    expect(screen.queryByTestId('delete-confirm-modal')).not.toBeInTheDocument();
    expect(deleteSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId('recruiter-job-card-101')).toBeInTheDocument();
  });

  it('preserves state and shows error toast if delete API call fails', async () => {
    setupAuth(mockRecruiterUser);
    vi.spyOn(jobsApi, 'getMyJobPostings').mockResolvedValueOnce(mockJobsList);
    vi.spyOn(jobsApi, 'deleteJob').mockRejectedValueOnce({
      status: 500,
      message: 'Failed to delete job posting due to server error.',
    } as ApiErrorResponse);

    render(
      <MemoryRouter>
        <RecruiterJobsPage />
      </MemoryRouter>
    );

    await screen.findByTestId('recruiter-jobs-list');

    fireEvent.click(screen.getByTestId('delete-job-btn-101'));
    fireEvent.click(screen.getByTestId('confirm-delete-btn'));

    expect(await screen.findByTestId('recruiter-jobs-toast')).toHaveTextContent(
      'Failed to delete job posting due to server error.'
    );

    // Job is still in list
    expect(screen.getByTestId('recruiter-job-card-101')).toBeInTheDocument();
  });

  it('provides navigation links to View Details and View Applications', async () => {
    setupAuth(mockRecruiterUser);
    vi.spyOn(jobsApi, 'getMyJobPostings').mockResolvedValueOnce(mockJobsList);

    render(
      <MemoryRouter>
        <RecruiterJobsPage />
      </MemoryRouter>
    );

    await screen.findByTestId('recruiter-jobs-list');

    const detailsLink = screen.getAllByRole('link', { name: /View Details/i })[0];
    expect(detailsLink).toHaveAttribute('href', '/app/jobs/101');

    const appsLink = screen.getByTestId('view-apps-btn-101');
    expect(appsLink).toHaveAttribute('href', '/app/recruiter/applications');
  });
});
