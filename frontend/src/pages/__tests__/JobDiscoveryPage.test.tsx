import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { JobDiscoveryPage } from '../JobDiscoveryPage';
import { AppLayout } from '@/layouts/AppLayout';
import * as jobsApi from '@/api/jobs';
import * as savedJobsApi from '@/api/savedJobs';
import * as applicationsApi from '@/api/applications';
import * as useAuthModule from '@/auth/useAuth';
import { JobPosting, JobPostingPagination, SavedJob } from '@/types/job';
import { User } from '@/types/auth';

const mockStudentUser: User = {
  id: 10,
  email: 'student@careerbridge.io',
  role: 'student',
  is_active: true,
  is_verified: true,
  created_at: '2026-09-19T10:00:00Z',
  updated_at: '2026-09-19T10:00:00Z',
};

const mockRecruiterUser: User = {
  id: 20,
  email: 'recruiter@careerbridge.io',
  role: 'recruiter',
  is_active: true,
  is_verified: true,
  created_at: '2026-09-19T10:00:00Z',
  updated_at: '2026-09-19T10:00:00Z',
};

const mockAdminUser: User = {
  id: 30,
  email: 'admin@careerbridge.io',
  role: 'admin',
  is_active: true,
  is_verified: true,
  created_at: '2026-09-19T10:00:00Z',
  updated_at: '2026-09-19T10:00:00Z',
};

const mockJob1: JobPosting = {
  id: 1,
  recruiter_id: 20,
  title: 'Frontend React Intern',
  description: 'Build modern responsive React web applications.',
  opportunity_type: 'internship',
  company_name: 'TechFlow Corp',
  location: 'Bengaluru, India',
  is_remote: true,
  employment_type: 'full_time',
  skills: 'React, TypeScript',
  minimum_qualification: 'B.Tech',
  experience_required: '0-1 years',
  salary_min: 30000,
  salary_max: 50000,
  application_deadline: '2026-11-30T23:59:59Z',
  is_active: true,
  created_at: '2026-09-19T10:00:00Z',
  updated_at: '2026-09-19T10:00:00Z',
};

const mockJob2: JobPosting = {
  id: 2,
  recruiter_id: 20,
  title: 'Python Backend Engineer',
  description: 'Design distributed backend systems with FastAPI and Postgres.',
  opportunity_type: 'job',
  company_name: 'TechFlow Corp',
  location: 'San Francisco, CA',
  is_remote: false,
  employment_type: 'full_time',
  skills: 'Python, FastAPI, SQL',
  minimum_qualification: 'B.S. in CS',
  experience_required: '1-3 years',
  salary_min: 80000,
  salary_max: 110000,
  application_deadline: '2026-12-15T23:59:59Z',
  is_active: true,
  created_at: '2026-09-18T10:00:00Z',
  updated_at: '2026-09-18T10:00:00Z',
};

const mockPaginationResponse: JobPostingPagination = {
  items: [mockJob1, mockJob2],
  page: 1,
  page_size: 10,
  total: 2,
  total_pages: 1,
};

const mockSavedJobItem: SavedJob = {
  id: 100,
  student_id: 10,
  job_posting_id: 1, // Job 1 is saved
  created_at: '2026-09-19T11:00:00Z',
  job_posting: mockJob1,
};

function setupAuthMock(user: User = mockStudentUser) {
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    user,
    token: 'test-token',
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

describe('JobDiscoveryPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setupAuthMock(mockStudentUser);
    vi.spyOn(savedJobsApi, 'getSavedJobs').mockResolvedValue([]);
  });

  it('displays loading screen while opportunities are being fetched', () => {
    vi.spyOn(jobsApi, 'getJobs').mockReturnValue(new Promise(() => {})); // pending

    render(
      <MemoryRouter>
        <JobDiscoveryPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/Loading opportunities\.\.\./i)).toBeInTheDocument();
  });

  it('renders list of opportunities successfully when fetch completes', async () => {
    vi.spyOn(jobsApi, 'getJobs').mockResolvedValueOnce(mockPaginationResponse);

    render(
      <MemoryRouter>
        <JobDiscoveryPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    expect(screen.getByText('Frontend React Intern')).toBeInTheDocument();
    expect(screen.getByText('Python Backend Engineer')).toBeInTheDocument();
    expect(screen.getByText(/Showing 2 of 2 opportunities/i)).toBeInTheDocument();
  });

  it('loads saved jobs for students on mount without N+1 calls', async () => {
    const getSavedJobsSpy = vi
      .spyOn(savedJobsApi, 'getSavedJobs')
      .mockResolvedValueOnce([mockSavedJobItem]);
    vi.spyOn(jobsApi, 'getJobs').mockResolvedValueOnce(mockPaginationResponse);

    render(
      <MemoryRouter>
        <JobDiscoveryPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Frontend React Intern')).toBeInTheDocument();
    });

    // Verify getSavedJobs was called exactly once on mount
    expect(getSavedJobsSpy).toHaveBeenCalledTimes(1);

    // Job 1 should be rendered as saved, Job 2 as unsaved
    const job1SaveBtn = screen.getByTestId('save-btn-1');
    const job2SaveBtn = screen.getByTestId('save-btn-2');
    expect(job1SaveBtn).toHaveTextContent('★ Saved');
    expect(job2SaveBtn).toHaveTextContent('☆ Save');
  });

  it('displays empty state when items is empty with total = 0', async () => {
    vi.spyOn(jobsApi, 'getJobs').mockResolvedValueOnce({
      items: [],
      page: 1,
      page_size: 10,
      total: 0,
      total_pages: 1,
    });

    render(
      <MemoryRouter>
        <JobDiscoveryPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('empty-jobs-state')).toBeInTheDocument();
    });

    expect(screen.getByText(/No opportunities found/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reset All Filters/i })).toBeInTheDocument();
  });

  it('displays error state with Retry button when fetch fails', async () => {
    const getJobsSpy = vi
      .spyOn(jobsApi, 'getJobs')
      .mockRejectedValueOnce({
        status: 500,
        message: 'Internal server error occurred',
      });

    render(
      <MemoryRouter>
        <JobDiscoveryPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(screen.getByText(/Failed to Load Opportunities/i)).toBeInTheDocument();
    expect(screen.getByText(/Internal server error occurred/i)).toBeInTheDocument();

    // Clicking Retry attempts fetch again
    getJobsSpy.mockResolvedValueOnce(mockPaginationResponse);
    fireEvent.click(screen.getByRole('button', { name: /Retry/i }));

    await waitFor(() => {
      expect(screen.getByText('Frontend React Intern')).toBeInTheDocument();
    });
  });

  it('serializes keyword search to q and fetches filtered results', async () => {
    const getJobsSpy = vi
      .spyOn(jobsApi, 'getJobs')
      .mockResolvedValue(mockPaginationResponse);

    render(
      <MemoryRouter>
        <JobDiscoveryPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Frontend React Intern')).toBeInTheDocument();
    });

    const searchInput = screen.getByLabelText(/Keyword Search/i);
    fireEvent.change(searchInput, { target: { value: 'React' } });
    fireEvent.click(screen.getByRole('button', { name: /Apply Filters/i }));

    await waitFor(() => {
      expect(getJobsSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: 'React', page: 1 })
      );
    });
  });

  it('navigates pagination when clicking Next and Previous buttons', async () => {
    const getJobsSpy = vi.spyOn(jobsApi, 'getJobs').mockResolvedValue({
      items: [mockJob1],
      page: 1,
      page_size: 1,
      total: 2,
      total_pages: 2,
    });

    render(
      <MemoryRouter>
        <JobDiscoveryPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Page 1 of 2/i)).toBeInTheDocument();
    });

    const prevBtn = screen.getByRole('button', { name: /Previous page/i });
    const nextBtn = screen.getByRole('button', { name: /Next page/i });

    expect(prevBtn).toBeDisabled();
    expect(nextBtn).toBeEnabled();

    // Click Next
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(getJobsSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 })
      );
    });
  });

  it('handles page size selection and resets to page 1', async () => {
    const getJobsSpy = vi
      .spyOn(jobsApi, 'getJobs')
      .mockResolvedValue(mockPaginationResponse);

    render(
      <MemoryRouter>
        <JobDiscoveryPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Frontend React Intern')).toBeInTheDocument();
    });

    const pageSizeSelect = screen.getByLabelText(/Per page:/i);
    fireEvent.change(pageSizeSelect, { target: { value: '25' } });

    await waitFor(() => {
      expect(getJobsSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ page_size: 25, page: 1 })
      );
    });
  });

  it('allows student to save an unsaved job and updates bookmark state', async () => {
    vi.spyOn(jobsApi, 'getJobs').mockResolvedValueOnce(mockPaginationResponse);
    const saveJobSpy = vi.spyOn(savedJobsApi, 'saveJob').mockResolvedValueOnce({
      job_id: 1,
      is_saved: true,
      saved_at: '2026-09-19T12:00:00Z',
    });

    render(
      <MemoryRouter>
        <JobDiscoveryPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('save-btn-1')).toHaveTextContent('☆ Save');
    });

    fireEvent.click(screen.getByTestId('save-btn-1'));

    await waitFor(() => {
      expect(saveJobSpy).toHaveBeenCalledWith(1);
      expect(screen.getByTestId('save-btn-1')).toHaveTextContent('★ Saved');
      expect(screen.getByRole('status')).toHaveTextContent(/Opportunity saved to your bookmarks!/i);
    });
  });

  it('allows student to unsave an already saved job', async () => {
    vi.spyOn(savedJobsApi, 'getSavedJobs').mockResolvedValueOnce([mockSavedJobItem]);
    vi.spyOn(jobsApi, 'getJobs').mockResolvedValueOnce(mockPaginationResponse);
    const unsaveJobSpy = vi.spyOn(savedJobsApi, 'unsaveJob').mockResolvedValueOnce();

    render(
      <MemoryRouter>
        <JobDiscoveryPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('save-btn-1')).toHaveTextContent('★ Saved');
    });

    fireEvent.click(screen.getByTestId('save-btn-1'));

    await waitFor(() => {
      expect(unsaveJobSpy).toHaveBeenCalledWith(1);
      expect(screen.getByTestId('save-btn-1')).toHaveTextContent('☆ Save');
      expect(screen.getByRole('status')).toHaveTextContent(/Opportunity removed from your saved list\./i);
    });
  });

  it('allows student to open Apply modal and submit an application', async () => {
    vi.spyOn(jobsApi, 'getJobs').mockResolvedValueOnce(mockPaginationResponse);
    const applySpy = vi.spyOn(applicationsApi, 'applyToJob').mockResolvedValueOnce({
      id: 201,
      job_posting_id: 1,
      student_id: 10,
      status: 'applied',
      cover_message: 'Interested in React position',
      resume_id: 4,
      created_at: '2026-09-19T12:00:00Z',
      updated_at: '2026-09-19T12:00:00Z',
    });

    render(
      <MemoryRouter>
        <JobDiscoveryPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('apply-btn-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('apply-btn-1'));

    // Apply modal opens
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Apply for Frontend React Intern/i })).toBeInTheDocument();

    const messageInput = screen.getByLabelText(/Cover Note \/ Message/i);
    fireEvent.change(messageInput, { target: { value: 'Interested in React position' } });

    fireEvent.click(screen.getByTestId('submit-application-btn'));

    await waitFor(() => {
      expect(applySpy).toHaveBeenCalledWith(1, { cover_message: 'Interested in React position' });
    });
  });

  it('hides Save and Apply buttons for recruiter users', async () => {
    setupAuthMock(mockRecruiterUser);
    vi.spyOn(jobsApi, 'getJobs').mockResolvedValueOnce(mockPaginationResponse);

    render(
      <MemoryRouter>
        <JobDiscoveryPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Frontend React Intern')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('save-btn-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('apply-btn-1')).not.toBeInTheDocument();
  });

  it('hides Save and Apply buttons for admin users', async () => {
    setupAuthMock(mockAdminUser);
    vi.spyOn(jobsApi, 'getJobs').mockResolvedValueOnce(mockPaginationResponse);

    render(
      <MemoryRouter>
        <JobDiscoveryPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Frontend React Intern')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('save-btn-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('apply-btn-1')).not.toBeInTheDocument();
  });

  it('renders active Opportunities navigation link in AppLayout', () => {
    render(
      <MemoryRouter initialEntries={['/app']}>
        <AppLayout />
      </MemoryRouter>
    );

    const oppLink = screen.getByRole('link', { name: /^Opportunities$/i });
    expect(oppLink).toBeInTheDocument();
    expect(oppLink).toHaveAttribute('href', '/app/jobs');
  });
});
