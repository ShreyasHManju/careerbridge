import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { JobDiscoveryPage } from '../JobDiscoveryPage';
import { RecruiterApplicationsPage } from '../RecruiterApplicationsPage';
import { StudentApplicationsPage } from '../StudentApplicationsPage';
import * as jobsApi from '@/api/jobs';
import * as appsApi from '@/api/applications';
import * as savedJobsApi from '@/api/savedJobs';
import * as useAuthModule from '@/auth/useAuth';
import { JobPosting, JobPostingPagination } from '@/types/job';
import { Application } from '@/types/application';

const mockJob: JobPosting = {
  id: 101,
  recruiter_id: 201,
  title: 'Full Stack AI Engineer Intern',
  description: 'Develop full stack applications with React and FastAPI.',
  company_name: 'E2E Horizon Tech',
  location: 'San Francisco, CA',
  is_remote: true,
  opportunity_type: 'internship',
  employment_type: 'full_time',
  skills: 'React, TypeScript, FastAPI, PostgreSQL',
  minimum_qualification: 'Pursuing Bachelor in CS',
  experience_required: null,
  salary_min: 6000,
  salary_max: 9000,
  application_deadline: null,
  is_active: true,
  created_at: '2026-09-20T00:00:00Z',
  updated_at: '2026-09-20T00:00:00Z',
};

const mockJobsPagination: JobPostingPagination = {
  items: [mockJob],
  total: 1,
  page: 1,
  page_size: 10,
  total_pages: 1,
};

describe('CareerBridge End-to-End Integration Flow (Flow A + Flow B + Flow C)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('FLOW A: Student searches opportunities, opens apply modal, and submits application', async () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: 301, email: 'student@example.com', role: 'student', is_active: true, is_verified: true, created_at: '', updated_at: '' },
      token: 'student-jwt-token',
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

    vi.spyOn(savedJobsApi, 'getSavedJobs').mockResolvedValue([]);
    vi.spyOn(jobsApi, 'getJobs').mockResolvedValue(mockJobsPagination);
    const applySpy = vi.spyOn(appsApi, 'applyToJob').mockResolvedValue({
      id: 501,
      student_id: 301,
      job_posting_id: 101,
      status: 'applied',
      cover_message: 'E2E test cover letter.',
      created_at: '2026-09-20T10:00:00Z',
      updated_at: '2026-09-20T10:00:00Z',
    });

    render(
      <MemoryRouter>
        <JobDiscoveryPage />
      </MemoryRouter>
    );

    // 1. Job appears in discovery list
    await waitFor(() => {
      expect(screen.getByText('Full Stack AI Engineer Intern')).toBeInTheDocument();
      expect(screen.getByText('E2E Horizon Tech')).toBeInTheDocument();
    });

    // 2. Click Apply button
    const applyBtn = screen.getByTestId('apply-btn-101');
    fireEvent.click(applyBtn);

    // 3. Modal opens
    expect(screen.getByRole('heading', { name: /Apply for Full Stack AI Engineer Intern/i })).toBeInTheDocument();

    // 4. Fill cover message and submit
    const coverInput = screen.getByLabelText(/Cover Note \/ Message/i);
    fireEvent.change(coverInput, { target: { value: 'E2E test cover letter.' } });

    const submitAppBtn = screen.getByRole('button', { name: /Submit Application/i });
    fireEvent.click(submitAppBtn);

    // 5. Verify apply API called with correct payload
    await waitFor(() => {
      expect(applySpy).toHaveBeenCalledWith(101, {
        cover_message: 'E2E test cover letter.',
      });
      expect(screen.getByText('Application submitted successfully!')).toBeInTheDocument();
    });
  });

  it('FLOW B: Recruiter views received application and updates status to Accepted', async () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: 201, email: 'recruiter@horizon.com', role: 'recruiter', is_active: true, is_verified: true, created_at: '', updated_at: '' },
      token: 'recruiter-jwt-token',
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

    const mockApplication: Application = {
      id: 501,
      student_id: 301,
      job_posting_id: 101,
      status: 'applied',
      cover_message: 'E2E test cover letter.',
      created_at: '2026-09-20T10:00:00Z',
      updated_at: '2026-09-20T10:00:00Z',
    };

    vi.spyOn(appsApi, 'getRecruiterApplications').mockResolvedValue([mockApplication]);
    vi.spyOn(jobsApi, 'getJobById').mockResolvedValue(mockJob);
    const updateStatusSpy = vi.spyOn(appsApi, 'updateApplicationStatus').mockResolvedValue({
      ...mockApplication,
      status: 'accepted',
    });

    render(
      <MemoryRouter>
        <RecruiterApplicationsPage />
      </MemoryRouter>
    );

    // 1. Recruiter sees incoming candidate application
    await waitFor(() => {
      expect(screen.getByText('Full Stack AI Engineer Intern')).toBeInTheDocument();
      expect(screen.getByText('E2E test cover letter.')).toBeInTheDocument();
      expect(screen.getByRole('status', { name: /Application status: Applied/i })).toBeInTheDocument();
    });

    // 2. Recruiter transitions status to Accepted
    const statusSelect = screen.getByRole('combobox', { name: /Change status for Application #501/i });
    fireEvent.change(statusSelect, { target: { value: 'accepted' } });

    // 3. Verify API update called
    await waitFor(() => {
      expect(updateStatusSpy).toHaveBeenCalledWith(501, 'accepted');
      expect(screen.getByText('Application #501 status updated to accepted.')).toBeInTheDocument();
    });
  });

  it('FLOW C: Student observes the updated Accepted status in My Applications', async () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: 301, email: 'student@example.com', role: 'student', is_active: true, is_verified: true, created_at: '', updated_at: '' },
      token: 'student-jwt-token',
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

    const acceptedApplication: Application = {
      id: 501,
      student_id: 301,
      job_posting_id: 101,
      status: 'accepted',
      cover_message: 'E2E test cover letter.',
      created_at: '2026-09-20T10:00:00Z',
      updated_at: '2026-09-20T11:00:00Z',
    };

    vi.spyOn(appsApi, 'getMyApplications').mockResolvedValue([acceptedApplication]);
    vi.spyOn(jobsApi, 'getJobById').mockResolvedValue(mockJob);

    render(
      <MemoryRouter>
        <StudentApplicationsPage />
      </MemoryRouter>
    );

    // 1. Student sees application with Accepted badge
    await waitFor(() => {
      expect(screen.getByText('Full Stack AI Engineer Intern')).toBeInTheDocument();
      expect(screen.getByText('E2E Horizon Tech')).toBeInTheDocument();
      expect(screen.getByRole('status', { name: /Application status: Accepted/i })).toBeInTheDocument();
    });
  });
});
