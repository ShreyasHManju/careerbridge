import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { JobCard } from '@/components/jobs/JobCard';
import { RecruiterApplicationCard } from '@/components/applications/RecruiterApplicationCard';
import { InterviewCard } from '@/components/interviews/InterviewCard';
import { StudentApplicationsPage } from '@/pages/StudentApplicationsPage';
import { RecruiterApplicationsPage } from '@/pages/RecruiterApplicationsPage';
import { AdminUsersPage } from '@/pages/AdminUsersPage';
import { AdminRecruitersPage } from '@/pages/AdminRecruitersPage';
import { AdminJobsPage } from '@/pages/AdminJobsPage';
import * as applicationsApi from '@/api/applications';
import * as adminApi from '@/api/admin';
import * as authHook from '@/auth/useAuth';
import { JobPosting } from '@/types/job';
import { Application } from '@/types/application';
import { Interview } from '@/types/interview';

describe('Phase 30B Workflows & Integrations', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const sampleJob: JobPosting = {
    id: 10,
    recruiter_id: 20,
    title: 'Frontend Developer Intern',
    description: 'React, TypeScript and modern web tech.',
    opportunity_type: 'internship',
    employment_type: 'full_time',
    company_name: 'Acme Systems',
    location: 'New York, NY',
    is_remote: true,
    skills: 'React, TypeScript',
    minimum_qualification: 'B.S. in CS',
    experience_required: 'None',
    salary_min: 60000,
    salary_max: 80000,
    application_deadline: '2026-12-31T00:00:00Z',
    is_active: true,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  };

  const sampleApp: Application = {
    id: 55,
    student_id: 88,
    job_posting_id: 10,
    status: 'applied',
    cover_message: 'Excited about this opportunity!',
    created_at: '2026-09-10T12:00:00Z',
    updated_at: '2026-09-10T12:00:00Z',
  };

  const sampleInterview: Interview = {
    id: 99,
    application_id: 55,
    recruiter_id: 20,
    student_id: 88,
    job_id: 10,
    job_title: 'Frontend Developer Intern',
    company_name: 'Acme Systems',
    candidate_email: 'candidate@example.com',
    recruiter_email: 'hiring@acmesystems.com',
    scheduled_at: '2026-10-01T14:00:00Z',
    duration_minutes: 45,
    interview_type: 'online',
    location_or_link: 'https://meet.google.com/xyz-abc',
    notes: 'Technical video interview',
    status: 'scheduled',
    created_at: '2026-09-15T00:00:00Z',
    updated_at: '2026-09-15T00:00:00Z',
  };

  describe('P0 Feature 2 — Contextual Messaging', () => {
    it('renders RecruiterApplicationCard message action linking to candidate with recipientId', () => {
      render(
        <MemoryRouter>
          <RecruiterApplicationCard
            application={sampleApp}
            job={sampleJob}
            onStatusChange={vi.fn()}
          />
        </MemoryRouter>
      );

      const msgBtn = screen.getByTestId('message-candidate-btn-55');
      expect(msgBtn).toBeInTheDocument();
      expect(msgBtn).toHaveAttribute('href', '/app/messages?recipientId=88');
      expect(msgBtn).toHaveTextContent('Message Candidate');
    });

    it('renders InterviewCard message action for recruiter linking to student with recipientId', () => {
      render(
        <MemoryRouter>
          <InterviewCard interview={sampleInterview} role="recruiter" />
        </MemoryRouter>
      );

      const msgBtn = screen.getByTestId('interview-message-candidate-btn-99');
      expect(msgBtn).toBeInTheDocument();
      expect(msgBtn).toHaveAttribute('href', '/app/messages?recipientId=88');
      expect(msgBtn).toHaveTextContent('Message Candidate');
    });

    it('renders InterviewCard message action for student linking to recruiter with recipientId', () => {
      render(
        <MemoryRouter>
          <InterviewCard interview={sampleInterview} role="student" />
        </MemoryRouter>
      );

      const msgBtn = screen.getByTestId('interview-message-recruiter-btn-99');
      expect(msgBtn).toBeInTheDocument();
      expect(msgBtn).toHaveAttribute('href', '/app/messages?recipientId=20');
      expect(msgBtn).toHaveTextContent('Message Hiring Team');
    });
  });

  describe('P0 Feature 3 — Job Discovery Badges', () => {
    it('displays Applied and Saved badges for authenticated students', () => {
      render(
        <MemoryRouter>
          <JobCard
            job={sampleJob}
            isApplied={true}
            isSaved={true}
            userRole="student"
          />
        </MemoryRouter>
      );

      const appliedBadge = screen.getByTestId('applied-badge-10');
      expect(appliedBadge).toBeInTheDocument();
      expect(appliedBadge).toHaveTextContent('✓ Applied');

      const savedBadge = screen.getByTestId('saved-badge-10');
      expect(savedBadge).toBeInTheDocument();
      expect(savedBadge).toHaveTextContent('★ Saved');
    });

    it('does NOT display student Applied/Saved badges to recruiter role', () => {
      render(
        <MemoryRouter>
          <JobCard
            job={sampleJob}
            isApplied={true}
            isSaved={true}
            userRole="recruiter"
          />
        </MemoryRouter>
      );

      expect(screen.queryByTestId('applied-badge-10')).not.toBeInTheDocument();
      expect(screen.queryByTestId('saved-badge-10')).not.toBeInTheDocument();
    });

    it('handles empty/false applied and saved state cleanly without badges', () => {
      render(
        <MemoryRouter>
          <JobCard
            job={sampleJob}
            isApplied={false}
            isSaved={false}
            userRole="student"
          />
        </MemoryRouter>
      );

      expect(screen.queryByTestId('applied-badge-10')).not.toBeInTheDocument();
      expect(screen.queryByTestId('saved-badge-10')).not.toBeInTheDocument();
    });
  });

  describe('P0 Feature 4 — Actionable Dashboard Navigation & Filter Ingestion', () => {
    it('initializes StudentApplicationsPage filter from query param ?status=reviewing', async () => {
      vi.spyOn(applicationsApi, 'getMyApplications').mockResolvedValue([
        { ...sampleApp, id: 1, status: 'reviewing' },
        { ...sampleApp, id: 2, status: 'applied' },
      ]);

      render(
        <MemoryRouter initialEntries={['/app/applications?status=reviewing']}>
          <Routes>
            <Route path="/app/applications" element={<StudentApplicationsPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        const statusSelect = screen.getByLabelText('Filter by application status') as HTMLSelectElement;
        expect(statusSelect.value).toBe('reviewing');
      });
    });

    it('initializes RecruiterApplicationsPage filter from query param ?status=shortlisted', async () => {
      vi.spyOn(applicationsApi, 'getRecruiterApplications').mockResolvedValue([
        { ...sampleApp, id: 1, status: 'shortlisted' },
      ]);

      render(
        <MemoryRouter initialEntries={['/app/recruiter/applications?status=shortlisted']}>
          <Routes>
            <Route path="/app/recruiter/applications" element={<RecruiterApplicationsPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        const statusSelect = screen.getByLabelText('Filter by application status') as HTMLSelectElement;
        expect(statusSelect.value).toBe('shortlisted');
      });
    });

    it('initializes AdminUsersPage filters from query params ?role=student&is_active=true', async () => {
      vi.spyOn(authHook, 'useAuth').mockReturnValue({
        user: { id: 1, email: 'admin@cb.com', role: 'admin', is_active: true, is_verified: true, created_at: '', updated_at: '' },
        token: 'token',
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

      const fetchSpy = vi.spyOn(adminApi, 'getAdminUsers').mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        page_size: 10,
        total_pages: 0,
      });

      render(
        <MemoryRouter initialEntries={['/app/admin/users?role=student&is_active=true']}>
          <Routes>
            <Route path="/app/admin/users" element={<AdminUsersPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.objectContaining({ role: 'student', is_active: true })
        );
      });
    });

    it('initializes AdminRecruitersPage filter from query param ?is_verified=true', async () => {
      const fetchSpy = vi.spyOn(adminApi, 'getAdminRecruiters').mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        page_size: 10,
        total_pages: 0,
      });

      render(
        <MemoryRouter initialEntries={['/app/admin/recruiters?is_verified=true']}>
          <Routes>
            <Route path="/app/admin/recruiters" element={<AdminRecruitersPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.objectContaining({ is_verified: true })
        );
      });
    });

    it('initializes AdminJobsPage filter from query param ?is_active=true', async () => {
      const fetchSpy = vi.spyOn(adminApi, 'getAdminJobs').mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        page_size: 10,
        total_pages: 0,
      });

      render(
        <MemoryRouter initialEntries={['/app/admin/jobs?is_active=true']}>
          <Routes>
            <Route path="/app/admin/jobs" element={<AdminJobsPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.objectContaining({ is_active: true })
        );
      });
    });
  });
});
