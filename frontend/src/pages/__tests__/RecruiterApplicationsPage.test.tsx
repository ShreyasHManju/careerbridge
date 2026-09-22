import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RecruiterApplicationsPage } from '../RecruiterApplicationsPage';
import * as applicationsApi from '@/api/applications';
import * as jobsApi from '@/api/jobs';
import { Application } from '@/types/application';
import { JobPosting } from '@/types/job';

const mockRecruiterApp1: Application = {
  id: 301,
  job_posting_id: 10,
  student_id: 12,
  status: 'applied',
  cover_message: 'Strong Python and Django background.',
  created_at: '2026-09-19T08:00:00Z',
  updated_at: '2026-09-19T08:00:00Z',
};

const mockRecruiterApp2: Application = {
  id: 302,
  job_posting_id: 10,
  student_id: 14,
  status: 'reviewing',
  cover_message: 'Frontend React specialist.',
  created_at: '2026-09-18T08:00:00Z',
  updated_at: '2026-09-18T10:00:00Z',
};

const mockJob10: JobPosting = {
  id: 10,
  recruiter_id: 2,
  title: 'Full Stack Engineer',
  description: 'Building modern platforms.',
  opportunity_type: 'job',
  company_name: 'Alpha Software',
  location: 'San Jose, CA',
  is_remote: true,
  employment_type: 'full_time',
  skills: 'React, Python',
  minimum_qualification: 'BS in CS',
  experience_required: '1+ years',
  salary_min: 95000,
  salary_max: 120000,
  application_deadline: '2026-12-31T23:59:59Z',
  is_active: true,
  created_at: '2026-09-15T10:00:00Z',
  updated_at: '2026-09-15T10:00:00Z',
};

describe('RecruiterApplicationsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('displays loading state while applications are being fetched', () => {
    vi.spyOn(applicationsApi, 'getRecruiterApplications').mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter>
        <RecruiterApplicationsPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('status', { name: /Loading applications/i })).toBeInTheDocument();
    expect(screen.getByText(/Loading candidate applications.../i)).toBeInTheDocument();
  });

  it('renders received applications list with candidate and job metadata', async () => {
    vi.spyOn(applicationsApi, 'getRecruiterApplications').mockResolvedValue([
      mockRecruiterApp1,
      mockRecruiterApp2,
    ]);
    vi.spyOn(jobsApi, 'getJobById').mockResolvedValue(mockJob10);

    render(
      <MemoryRouter>
        <RecruiterApplicationsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Application #301')).toBeInTheDocument();
      expect(screen.getByText('Candidate #12')).toBeInTheDocument();
      expect(screen.getByText('Application #302')).toBeInTheDocument();
      expect(screen.getByText('Candidate #14')).toBeInTheDocument();
      expect(screen.getAllByText('Full Stack Engineer')).toHaveLength(2);
    });
  });

  it('renders empty state when recruiter has received 0 applications', async () => {
    vi.spyOn(applicationsApi, 'getRecruiterApplications').mockResolvedValue([]);

    render(
      <MemoryRouter>
        <RecruiterApplicationsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('No Candidate Applications Yet')).toBeInTheDocument();
    });
  });

  it('displays error alert with retry button when initial fetch fails, and retries on click', async () => {
    const getAppsSpy = vi
      .spyOn(applicationsApi, 'getRecruiterApplications')
      .mockRejectedValueOnce({
        status: 500,
        message: 'Internal server error',
      })
      .mockResolvedValueOnce([mockRecruiterApp1]);

    vi.spyOn(jobsApi, 'getJobById').mockResolvedValue(mockJob10);

    render(
      <MemoryRouter>
        <RecruiterApplicationsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Internal server error/i);
    });

    const retryBtn = screen.getByRole('button', { name: /Try Again/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('Application #301')).toBeInTheDocument();
    });

    expect(getAppsSpy).toHaveBeenCalledTimes(2);
  });

  it('successfully updates candidate status and shows success toast', async () => {
    vi.spyOn(applicationsApi, 'getRecruiterApplications').mockResolvedValue([mockRecruiterApp1]);
    vi.spyOn(jobsApi, 'getJobById').mockResolvedValue(mockJob10);

    const updateStatusSpy = vi.spyOn(applicationsApi, 'updateApplicationStatus').mockResolvedValue({
      ...mockRecruiterApp1,
      status: 'shortlisted',
      updated_at: '2026-09-20T08:00:00Z',
    });

    render(
      <MemoryRouter>
        <RecruiterApplicationsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Application #301')).toBeInTheDocument();
    });

    const select = screen.getByLabelText(/Change status for Application #301/i);
    fireEvent.change(select, { target: { value: 'shortlisted' } });

    await waitFor(() => {
      expect(updateStatusSpy).toHaveBeenCalledWith(301, 'shortlisted');
      expect(
        screen.getByText(/Application #301 status updated to shortlisted/i)
      ).toBeInTheDocument();
    });
  });

  it('opens ScheduleInterviewModal when Schedule Interview is clicked', async () => {
    vi.spyOn(applicationsApi, 'getRecruiterApplications').mockResolvedValue([mockRecruiterApp1]);
    vi.spyOn(jobsApi, 'getJobById').mockResolvedValue(mockJob10);

    render(
      <MemoryRouter>
        <RecruiterApplicationsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Application #301')).toBeInTheDocument();
    });

    const scheduleBtn = screen.getByTestId('schedule-interview-btn-301');
    fireEvent.click(scheduleBtn);

    expect(screen.getByTestId('schedule-interview-modal')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Schedule Interview/i })).toBeInTheDocument();
  });

  it('filters candidate applications by status client-side', async () => {
    vi.spyOn(applicationsApi, 'getRecruiterApplications').mockResolvedValue([
      mockRecruiterApp1,
      mockRecruiterApp2,
    ]);
    vi.spyOn(jobsApi, 'getJobById').mockResolvedValue(mockJob10);

    render(
      <MemoryRouter>
        <RecruiterApplicationsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Application #301')).toBeInTheDocument();
      expect(screen.getByText('Application #302')).toBeInTheDocument();
    });

    const statusSelect = screen.getByRole('combobox', { name: /Filter by application status/i });
    fireEvent.change(statusSelect, { target: { value: 'reviewing' } });

    expect(screen.queryByText('Application #301')).not.toBeInTheDocument();
    expect(screen.getByText('Application #302')).toBeInTheDocument();
  });

  it('filters candidate applications by keyword search', async () => {
    vi.spyOn(applicationsApi, 'getRecruiterApplications').mockResolvedValue([
      mockRecruiterApp1,
      mockRecruiterApp2,
    ]);
    vi.spyOn(jobsApi, 'getJobById').mockResolvedValue(mockJob10);

    render(
      <MemoryRouter>
        <RecruiterApplicationsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Application #301')).toBeInTheDocument();
      expect(screen.getByText('Application #302')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search by candidate ID/i);
    // 1. Search by candidate ID
    fireEvent.change(searchInput, { target: { value: 'Candidate #14' } });
    expect(screen.queryByText('Application #301')).not.toBeInTheDocument();
    expect(screen.getByText('Application #302')).toBeInTheDocument();

    // 2. Search by cover message
    fireEvent.change(searchInput, { target: { value: 'Django background' } });
    expect(screen.getByText('Application #301')).toBeInTheDocument();
    expect(screen.queryByText('Application #302')).not.toBeInTheDocument();

    // 3. Search by application ID string does NOT match
    fireEvent.change(searchInput, { target: { value: 'Application #301' } });
    expect(screen.queryByText('Application #301')).not.toBeInTheDocument();
    expect(screen.getByText(/No candidate applications match your selected filter criteria/i)).toBeInTheDocument();
  });

  it('handles multi-select and select all toggling', async () => {
    vi.spyOn(applicationsApi, 'getRecruiterApplications').mockResolvedValue([
      mockRecruiterApp1,
      mockRecruiterApp2,
    ]);
    vi.spyOn(jobsApi, 'getJobById').mockResolvedValue(mockJob10);

    render(
      <MemoryRouter>
        <RecruiterApplicationsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Application #301')).toBeInTheDocument();
    });

    const selectAllCheckbox = screen.getByTestId('select-all-checkbox');
    expect(selectAllCheckbox).not.toBeChecked();

    // Select All
    fireEvent.click(selectAllCheckbox);
    expect(screen.getByTestId('selected-count-badge')).toHaveTextContent('2 selected');

    // Deselect single
    const checkbox1 = screen.getByTestId('select-app-checkbox-301');
    fireEvent.click(checkbox1);
    expect(screen.getByTestId('selected-count-badge')).toHaveTextContent('1 selected');
  });

  it('performs atomic bulk status update for selected applications', async () => {
    vi.spyOn(applicationsApi, 'getRecruiterApplications').mockResolvedValue([
      mockRecruiterApp1,
      mockRecruiterApp2,
    ]);
    vi.spyOn(jobsApi, 'getJobById').mockResolvedValue(mockJob10);
    const bulkSpy = vi.spyOn(applicationsApi, 'bulkUpdateApplicationStatus').mockResolvedValue({
      updated_count: 2,
      status: 'shortlisted',
      items: [
        { ...mockRecruiterApp1, status: 'shortlisted' },
        { ...mockRecruiterApp2, status: 'shortlisted' },
      ],
    });

    render(
      <MemoryRouter>
        <RecruiterApplicationsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Application #301')).toBeInTheDocument();
    });

    // Select All
    fireEvent.click(screen.getByTestId('select-all-checkbox'));

    // Choose shortlisted and apply
    fireEvent.change(screen.getByTestId('bulk-status-select'), {
      target: { value: 'shortlisted' },
    });
    fireEvent.click(screen.getByTestId('apply-bulk-status-btn'));

    await waitFor(() => {
      expect(bulkSpy).toHaveBeenCalledWith([301, 302], 'shortlisted');
      expect(screen.getByText(/Successfully updated 2 applications to "shortlisted"/i)).toBeInTheDocument();
    });
  });

  it('triggers CSV export when clicking the export button', async () => {
    vi.spyOn(applicationsApi, 'getRecruiterApplications').mockResolvedValue([
      mockRecruiterApp1,
    ]);
    vi.spyOn(jobsApi, 'getJobById').mockResolvedValue(mockJob10);

    render(
      <MemoryRouter>
        <RecruiterApplicationsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Application #301')).toBeInTheDocument();
    });

    const exportBtn = screen.getByTestId('export-applications-btn');
    expect(exportBtn).toBeInTheDocument();
  });
});
