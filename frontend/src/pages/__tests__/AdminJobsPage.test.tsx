import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminJobsPage } from '../AdminJobsPage';
import * as adminApi from '@/api/admin';
import { JobPostingPagination, JobPosting } from '@/types/job';

vi.mock('@/api/admin');

const mockJob1: JobPosting = {
  id: 101,
  recruiter_id: 2,
  title: 'Full Stack Engineer',
  description: 'Building modern web apps',
  opportunity_type: 'job',
  employment_type: 'full_time',
  location: 'Seattle, WA',
  is_remote: true,
  skills: null,
  minimum_qualification: null,
  experience_required: null,
  salary_min: null,
  salary_max: null,
  application_deadline: null,
  is_active: true,
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-01T10:00:00Z',
  company_name: 'Nexus Corp',
};

const mockJob2: JobPosting = {
  id: 102,
  recruiter_id: 3,
  title: 'Backend Software Intern',
  description: 'Python & FastAPI services',
  opportunity_type: 'internship',
  employment_type: 'part_time',
  location: 'San Francisco, CA',
  is_remote: false,
  skills: null,
  minimum_qualification: null,
  experience_required: null,
  salary_min: null,
  salary_max: null,
  application_deadline: null,
  is_active: false,
  created_at: '2026-09-02T10:00:00Z',
  updated_at: '2026-09-02T10:00:00Z',
  company_name: 'Acme Corp',
};

const mockPaginationResponse: JobPostingPagination = {
  items: [mockJob1, mockJob2],
  page: 1,
  page_size: 10,
  total: 2,
  total_pages: 1,
};

describe('AdminJobsPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    vi.spyOn(adminApi, 'getAdminJobs').mockReturnValue(new Promise(() => {}));

    render(<AdminJobsPage />);

    expect(screen.getByText(/Loading job postings for moderation/i)).toBeInTheDocument();
  });

  it('renders active and inactive job postings in table', async () => {
    vi.spyOn(adminApi, 'getAdminJobs').mockResolvedValue(mockPaginationResponse);

    render(<AdminJobsPage />);

    await waitFor(() => {
      expect(screen.getByText('Full Stack Engineer')).toBeInTheDocument();
      expect(screen.getByText('Backend Software Intern')).toBeInTheDocument();
      expect(screen.getByTestId('job-status-101')).toHaveTextContent('Active');
      expect(screen.getByTestId('job-status-102')).toHaveTextContent('Inactive');
    });
  });

  it('filters by search, opportunity type, employment type, and active status', async () => {
    const fetchSpy = vi.spyOn(adminApi, 'getAdminJobs').mockResolvedValue(mockPaginationResponse);

    render(<AdminJobsPage />);

    await waitFor(() => {
      expect(screen.getByText('Full Stack Engineer')).toBeInTheDocument();
    });

    const searchInput = screen.getByTestId('job-search-input');
    fireEvent.change(searchInput, { target: { value: 'Engineer' } });
    fireEvent.click(screen.getByTestId('search-jobs-btn'));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'Engineer', page: 1 })
      );
    });

    fireEvent.change(screen.getByTestId('opp-type-filter-select'), {
      target: { value: 'internship' },
    });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ opportunity_type: 'internship', page: 1 })
      );
    });

    fireEvent.change(screen.getByTestId('emp-type-filter-select'), {
      target: { value: 'full_time' },
    });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ employment_type: 'full_time', page: 1 })
      );
    });

    fireEvent.change(screen.getByTestId('job-status-filter-select'), {
      target: { value: 'false' },
    });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ is_active: false, page: 1 })
      );
    });
  });

  it('opens JobModerationModal and updates status on success', async () => {
    vi.spyOn(adminApi, 'getAdminJobs').mockResolvedValue(mockPaginationResponse);
    vi.spyOn(adminApi, 'updateAdminJobStatus').mockResolvedValue({
      ...mockJob1,
      is_active: false,
    });

    render(<AdminJobsPage />);

    await waitFor(() => {
      expect(screen.getByText('Full Stack Engineer')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('toggle-job-101-btn'));

    expect(screen.getByTestId('job-moderation-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('confirm-job-moderation-btn'));

    await waitFor(() => {
      expect(
        screen.getByText(/Job posting "Full Stack Engineer" status was successfully updated to Inactive/i)
      ).toBeInTheDocument();
    });
  });
});
