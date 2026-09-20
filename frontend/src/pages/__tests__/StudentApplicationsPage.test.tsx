import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StudentApplicationsPage } from '../StudentApplicationsPage';
import * as applicationsApi from '@/api/applications';
import * as jobsApi from '@/api/jobs';
import { Application } from '@/types/application';
import { JobPosting } from '@/types/job';

const mockApp1: Application = {
  id: 101,
  job_posting_id: 10,
  student_id: 5,
  status: 'applied',
  cover_message: 'Interested in frontend architecture.',
  created_at: '2026-09-19T10:00:00Z',
  updated_at: '2026-09-19T10:00:00Z',
};

const mockApp2: Application = {
  id: 102,
  job_posting_id: 10, // Same job ID to test deduplication
  student_id: 5,
  status: 'shortlisted',
  cover_message: 'Follow-up note.',
  created_at: '2026-09-18T10:00:00Z',
  updated_at: '2026-09-19T12:00:00Z',
};

const mockApp3: Application = {
  id: 103,
  job_posting_id: 20,
  student_id: 5,
  status: 'rejected',
  cover_message: null,
  created_at: '2026-09-17T10:00:00Z',
  updated_at: '2026-09-17T10:00:00Z',
};

const mockJob10: JobPosting = {
  id: 10,
  recruiter_id: 2,
  title: 'Full Stack React Engineer',
  description: 'Work on cutting-edge features.',
  opportunity_type: 'job',
  company_name: 'Nexus Tech',
  location: 'San Francisco, CA',
  is_remote: true,
  employment_type: 'full_time',
  skills: 'React, Node.js',
  minimum_qualification: 'BS in CS',
  experience_required: '2+ years',
  salary_min: 100000,
  salary_max: 130000,
  application_deadline: '2026-12-31T23:59:59Z',
  is_active: true,
  created_at: '2026-09-15T10:00:00Z',
  updated_at: '2026-09-15T10:00:00Z',
};

const mockJob20: JobPosting = {
  id: 20,
  recruiter_id: 3,
  title: 'Data Science Intern',
  description: 'ML model training.',
  opportunity_type: 'internship',
  company_name: 'DataCorp',
  location: 'New York, NY',
  is_remote: false,
  employment_type: 'full_time',
  skills: 'Python, PyTorch',
  minimum_qualification: 'Enrolled in MS/BS',
  experience_required: 'None',
  salary_min: 40000,
  salary_max: 50000,
  application_deadline: '2026-12-31T23:59:59Z',
  is_active: true,
  created_at: '2026-09-15T10:00:00Z',
  updated_at: '2026-09-15T10:00:00Z',
};

describe('StudentApplicationsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('displays loading state while applications are being fetched', () => {
    vi.spyOn(applicationsApi, 'getMyApplications').mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter>
        <StudentApplicationsPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('status', { name: /Loading applications/i })).toBeInTheDocument();
    expect(screen.getByText(/Loading your submitted applications.../i)).toBeInTheDocument();
  });

  it('renders application cards with resolved job metadata on success', async () => {
    vi.spyOn(applicationsApi, 'getMyApplications').mockResolvedValue([mockApp1, mockApp3]);
    vi.spyOn(jobsApi, 'getJobById').mockImplementation(async (id: number) => {
      if (id === 10) return mockJob10;
      if (id === 20) return mockJob20;
      throw new Error('Not found');
    });

    render(
      <MemoryRouter>
        <StudentApplicationsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Full Stack React Engineer')).toBeInTheDocument();
      expect(screen.getByText('Nexus Tech')).toBeInTheDocument();
      expect(screen.getByText('Data Science Intern')).toBeInTheDocument();
      expect(screen.getByText('DataCorp')).toBeInTheDocument();
    });

    expect(
      screen.getByRole('status', { name: /Application status: Applied/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('status', { name: /Application status: Rejected/i })
    ).toBeInTheDocument();
  });

  it('deduplicates unique job IDs so getJobById is only called once per job', async () => {
    // Both App1 and App2 point to job_posting_id = 10
    vi.spyOn(applicationsApi, 'getMyApplications').mockResolvedValue([mockApp1, mockApp2]);
    const getJobByIdSpy = vi.spyOn(jobsApi, 'getJobById').mockResolvedValue(mockJob10);

    render(
      <MemoryRouter>
        <StudentApplicationsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(
        screen.getByRole('status', { name: /Application status: Shortlisted/i })
      ).toBeInTheDocument();
    });

    // Despite 2 applications pointing to Job 10, getJobById should be called exactly once
    expect(getJobByIdSpy).toHaveBeenCalledTimes(1);
    expect(getJobByIdSpy).toHaveBeenCalledWith(10);
  });

  it('handles job lookup failure gracefully without crashing the application list', async () => {
    vi.spyOn(applicationsApi, 'getMyApplications').mockResolvedValue([mockApp1]);
    vi.spyOn(jobsApi, 'getJobById').mockRejectedValue(new Error('Network error on job fetch'));

    render(
      <MemoryRouter>
        <StudentApplicationsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Opportunity #10')).toBeInTheDocument();
      expect(screen.getByText('Hiring Organization')).toBeInTheDocument();
      expect(
        screen.getByRole('status', { name: /Application status: Applied/i })
      ).toBeInTheDocument();
    });
  });

  it('renders empty state when student has no submitted applications', async () => {
    vi.spyOn(applicationsApi, 'getMyApplications').mockResolvedValue([]);

    render(
      <MemoryRouter>
        <StudentApplicationsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('No Applications Submitted Yet')).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: /Browse Active Opportunities/i })
      ).toHaveAttribute('href', '/app/jobs');
    });
  });

  it('displays error alert with retry button when initial fetch fails, and retries on click', async () => {
    const getAppsSpy = vi
      .spyOn(applicationsApi, 'getMyApplications')
      .mockRejectedValueOnce({
        status: 500,
        message: 'Internal server error',
      })
      .mockResolvedValueOnce([mockApp1]);

    vi.spyOn(jobsApi, 'getJobById').mockResolvedValue(mockJob10);

    render(
      <MemoryRouter>
        <StudentApplicationsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Internal server error/i);
    });

    const retryBtn = screen.getByRole('button', { name: /Try Again/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('Full Stack React Engineer')).toBeInTheDocument();
    });

    expect(getAppsSpy).toHaveBeenCalledTimes(2);
  });

  it('filters applications by status client-side', async () => {
    vi.spyOn(applicationsApi, 'getMyApplications').mockResolvedValue([mockApp1, mockApp3]);
    vi.spyOn(jobsApi, 'getJobById').mockImplementation(async (id: number) => {
      if (id === 10) return mockJob10;
      if (id === 20) return mockJob20;
      throw new Error('Not found');
    });

    render(
      <MemoryRouter>
        <StudentApplicationsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Full Stack React Engineer')).toBeInTheDocument();
      expect(screen.getByText('Data Science Intern')).toBeInTheDocument();
    });

    // Select 'rejected' status filter
    const statusSelect = screen.getByRole('combobox', { name: /Filter by application status/i });
    fireEvent.change(statusSelect, { target: { value: 'rejected' } });

    expect(screen.queryByText('Full Stack React Engineer')).not.toBeInTheDocument();
    expect(screen.getByText('Data Science Intern')).toBeInTheDocument();
  });

  it('filters applications by keyword search client-side', async () => {
    vi.spyOn(applicationsApi, 'getMyApplications').mockResolvedValue([mockApp1, mockApp3]);
    vi.spyOn(jobsApi, 'getJobById').mockImplementation(async (id: number) => {
      if (id === 10) return mockJob10;
      if (id === 20) return mockJob20;
      throw new Error('Not found');
    });

    render(
      <MemoryRouter>
        <StudentApplicationsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Full Stack React Engineer')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search by job title/i);
    fireEvent.change(searchInput, { target: { value: 'Nexus' } });

    expect(screen.getByText('Full Stack React Engineer')).toBeInTheDocument();
    expect(screen.queryByText('Data Science Intern')).not.toBeInTheDocument();

    // Verify searching by cover message does NOT match for student
    fireEvent.change(searchInput, { target: { value: 'frontend architecture' } });
    expect(screen.queryByText('Full Stack React Engineer')).not.toBeInTheDocument();
    expect(screen.getByText(/No applications match your selected filter criteria/i)).toBeInTheDocument();
  });
});
