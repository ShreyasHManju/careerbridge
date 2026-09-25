import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App } from '@/App';
import * as useAuthModule from '@/auth/useAuth';
import * as experiencesApi from '@/api/experiences';
import * as notificationsApi from '@/api/notifications';
import { ExperienceRecord } from '@/types/experience';
import { User } from '@/types/auth';

const studentUser: User = {
  id: 10,
  email: 'student@example.com',
  role: 'student',
  is_active: true,
  is_verified: true,
  created_at: '2026-09-25T00:00:00Z',
  updated_at: '2026-09-25T00:00:00Z',
};

const recruiterUser: User = {
  id: 20,
  email: 'recruiter@apexcloud.io',
  role: 'recruiter',
  is_active: true,
  is_verified: true,
  created_at: '2026-09-25T00:00:00Z',
  updated_at: '2026-09-25T00:00:00Z',
};

const adminUser: User = {
  id: 99,
  email: 'admin@careerbridge.io',
  role: 'admin',
  is_active: true,
  is_verified: true,
  created_at: '2026-09-25T00:00:00Z',
  updated_at: '2026-09-25T00:00:00Z',
};

const mockExperience: ExperienceRecord = {
  id: 101,
  student_id: 10,
  title: 'Full Stack Engineer Intern',
  organization_name: 'Apex Cloud Systems',
  experience_type: 'internship',
  start_date: '2025-05-01',
  end_date: '2025-08-31',
  is_current: false,
  description: 'Built scalable API microservices and React dashboards.',
  status: 'claimed',
  verification_source: 'self_claimed',
  innovation_project_id: 42,
  verifier_id: null,
  verifier_name: null,
  verified_at: null,
  verification_notes: null,
  skills: 'FastAPI, React, PostgreSQL',
  structured_skills: [
    {
      id: 1,
      name: 'FastAPI',
      slug: 'fastapi',
      category: 'Backend',
      is_verified: true,
      created_at: '2026-09-24T00:00:00Z',
    },
    {
      id: 2,
      name: 'React',
      slug: 'react',
      category: 'Frontend',
      is_verified: true,
      created_at: '2026-09-24T00:00:00Z',
    },
  ],
  created_at: '2026-09-25T00:00:00Z',
  updated_at: '2026-09-25T00:00:00Z',
};

const setupAuthMock = (user: User | null) => {
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    user,
    token: user ? 'valid-jwt-token' : null,
    isAuthenticated: Boolean(user),
    isLoading: false,
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    clearAuthentication: vi.fn(),
    initializeSession: vi.fn(),
    clearError: vi.fn(),
  });
};

describe('Verified Experience Full End-to-End Integration Flow (Phase 5)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(notificationsApi, 'getUnreadCount').mockResolvedValue({ unread_count: 0 });
  });

  describe('Flow 1: Student Lifecycle (Create -> Edit -> Request Verification -> Delete)', () => {
    it('executes full student experience workflow seamlessly', async () => {
      setupAuthMock(studentUser);

      // Initial empty state
      vi.spyOn(experiencesApi, 'getMyExperiences').mockResolvedValueOnce({
        items: [],
        total: 0,
      });

      render(
        <MemoryRouter initialEntries={['/app/experiences']}>
          <App />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('No Experience Records Found')).toBeInTheDocument();
      });

      // Step A: Create Experience
      const createSpy = vi
        .spyOn(experiencesApi, 'createExperience')
        .mockResolvedValueOnce(mockExperience);

      fireEvent.click(screen.getByTestId('add-experience-btn'));
      expect(screen.getByText('Add Experience Record')).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText(/Title \/ Role/i), {
        target: { value: 'Full Stack Engineer Intern' },
      });
      fireEvent.change(screen.getByLabelText(/Organization \/ Company \/ Lab/i), {
        target: { value: 'Apex Cloud Systems' },
      });
      fireEvent.change(screen.getByLabelText(/Experience Type/i), {
        target: { value: 'internship' },
      });
      fireEvent.change(screen.getByLabelText(/Start Date/i), {
        target: { value: '2025-05-01' },
      });
      fireEvent.change(screen.getByLabelText(/End Date/i), {
        target: { value: '2025-08-31' },
      });
      fireEvent.change(screen.getByLabelText(/Description & Responsibilities/i), {
        target: { value: 'Built scalable API microservices and React dashboards.' },
      });
      fireEvent.change(screen.getByLabelText(/Linked Innovation Project ID/i), {
        target: { value: '42' },
      });

      fireEvent.click(screen.getByTestId('submit-experience-btn'));

      await waitFor(() => {
        expect(createSpy).toHaveBeenCalledWith({
          title: 'Full Stack Engineer Intern',
          organization_name: 'Apex Cloud Systems',
          experience_type: 'internship',
          start_date: '2025-05-01',
          end_date: '2025-08-31',
          is_current: false,
          description: 'Built scalable API microservices and React dashboards.',
          skills: null,
          innovation_project_id: 42,
        });
        expect(screen.getByText('Full Stack Engineer Intern')).toBeInTheDocument();
        expect(screen.getByTestId('experience-status-claimed')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /View linked Innovation Project #42/i })).toBeInTheDocument();
      });

      // Step B: Edit Experience
      const updatedExperience: ExperienceRecord = {
        ...mockExperience,
        title: 'Lead Full Stack Engineer Intern',
      };
      const updateSpy = vi
        .spyOn(experiencesApi, 'updateExperience')
        .mockResolvedValueOnce(updatedExperience);

      fireEvent.click(screen.getByTestId('edit-experience-btn-101'));
      expect(screen.getByText('Edit Experience Record')).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText(/Title \/ Role/i), {
        target: { value: 'Lead Full Stack Engineer Intern' },
      });

      fireEvent.click(screen.getByTestId('submit-experience-btn'));

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalledWith(101, expect.objectContaining({
          title: 'Lead Full Stack Engineer Intern',
        }));
        expect(screen.getByText('Lead Full Stack Engineer Intern')).toBeInTheDocument();
      });

      // Step C: Request Verification
      const pendingExperience: ExperienceRecord = {
        ...updatedExperience,
        status: 'pending_verification',
      };
      const verifyReqSpy = vi
        .spyOn(experiencesApi, 'requestExperienceVerification')
        .mockResolvedValueOnce(pendingExperience);

      fireEvent.click(screen.getByTestId('request-verify-btn-101'));

      await waitFor(() => {
        expect(verifyReqSpy).toHaveBeenCalledWith(101);
        expect(screen.getByText('Pending Verification')).toBeInTheDocument();
        expect(
          screen.getByText(/Verification request in review by authorized partner/i)
        ).toBeInTheDocument();
      });

      // Step D: Delete Experience
      const deleteSpy = vi
        .spyOn(experiencesApi, 'deleteExperience')
        .mockResolvedValueOnce(undefined);

      fireEvent.click(screen.getByTestId('delete-experience-btn-101'));
      expect(screen.getByText('Confirm Experience Deletion')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('confirm-delete-experience-btn'));

      await waitFor(() => {
        expect(deleteSpy).toHaveBeenCalledWith(101);
        expect(screen.queryByText('Lead Full Stack Engineer Intern')).not.toBeInTheDocument();
      });
    });
  });

  describe('Flow 2: Recruiter Verification Queue & Decision Workflows', () => {
    it('allows recruiter to view pending claims, approve, and reject with feedback notes', async () => {
      setupAuthMock(recruiterUser);

      const pendingRecord: ExperienceRecord = {
        ...mockExperience,
        id: 202,
        status: 'pending_verification',
      };

      vi.spyOn(experiencesApi, 'getPendingVerifications').mockResolvedValueOnce({
        items: [pendingRecord],
        total: 1,
      });

      render(
        <MemoryRouter initialEntries={['/app/recruiter/experiences/verification']}>
          <App />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Full Stack Engineer Intern')).toBeInTheDocument();
        expect(screen.getByText(/Apex Cloud Systems/i)).toBeInTheDocument();
        expect(screen.getByText(/Candidate:/i)).toBeInTheDocument();
      });

      // Approve Flow
      const verifiedRecord: ExperienceRecord = {
        ...pendingRecord,
        status: 'verified',
        verification_source: 'recruiter_confirmed',
        verifier_id: 20,
        verified_at: '2026-09-25T12:00:00Z',
      };

      const decideSpy = vi
        .spyOn(experiencesApi, 'decideExperienceVerification')
        .mockResolvedValueOnce(verifiedRecord);

      fireEvent.click(screen.getByTestId('approve-btn-202'));

      await waitFor(() => {
        expect(decideSpy).toHaveBeenCalledWith(202, { action: 'approve' });
        expect(
          screen.getByText('Experience "Full Stack Engineer Intern" was verified successfully.')
        ).toBeInTheDocument();
        expect(screen.queryByTestId('verification-request-card-202')).not.toBeInTheDocument();
      });
    });

    it('processes rejection with audit notes and clears from queue', async () => {
      setupAuthMock(recruiterUser);

      const pendingRecord: ExperienceRecord = {
        ...mockExperience,
        id: 203,
        status: 'pending_verification',
      };

      vi.spyOn(experiencesApi, 'getPendingVerifications').mockResolvedValueOnce({
        items: [pendingRecord],
        total: 1,
      });

      render(
        <MemoryRouter initialEntries={['/app/recruiter/experiences/verification']}>
          <App />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Full Stack Engineer Intern')).toBeInTheDocument();
      });

      const rejectedRecord: ExperienceRecord = {
        ...pendingRecord,
        status: 'rejected',
        verification_notes: 'Employment records indicate student finished in April, not August.',
      };

      const decideSpy = vi
        .spyOn(experiencesApi, 'decideExperienceVerification')
        .mockResolvedValueOnce(rejectedRecord);

      fireEvent.click(screen.getByTestId('reject-btn-203'));
      expect(screen.getByTestId('rejection-box-203')).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText(/Reason for Rejection/i), {
        target: { value: 'Employment records indicate student finished in April, not August.' },
      });

      fireEvent.click(screen.getByTestId('confirm-reject-btn-203'));

      await waitFor(() => {
        expect(decideSpy).toHaveBeenCalledWith(203, {
          action: 'reject',
          notes: 'Employment records indicate student finished in April, not August.',
        });
        expect(screen.queryByTestId('verification-request-card-203')).not.toBeInTheDocument();
        expect(
          screen.getByText('Experience "Full Stack Engineer Intern" was rejected successfully.')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Flow 3: Rejected Experience Resubmission Flow', () => {
    it('allows student to resubmit a previously rejected experience claim', async () => {
      setupAuthMock(studentUser);

      const rejectedExperience: ExperienceRecord = {
        ...mockExperience,
        id: 303,
        status: 'rejected',
        verification_notes: 'Please update dates to reflect actual start date.',
      };

      vi.spyOn(experiencesApi, 'getMyExperiences').mockResolvedValueOnce({
        items: [rejectedExperience],
        total: 1,
      });

      render(
        <MemoryRouter initialEntries={['/app/experiences']}>
          <App />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Full Stack Engineer Intern')).toBeInTheDocument();
        expect(screen.getByText('Rejected')).toBeInTheDocument();
        expect(
          screen.getByText('✕ Verification not approved. You may edit and resubmit.')
        ).toBeInTheDocument();
      });

      const resubmitBtn = screen.getByTestId('request-verify-btn-303');
      expect(resubmitBtn).toHaveTextContent('Resubmit Verification');

      const rePendingExperience: ExperienceRecord = {
        ...rejectedExperience,
        status: 'pending_verification',
      };

      const requestSpy = vi
        .spyOn(experiencesApi, 'requestExperienceVerification')
        .mockResolvedValueOnce(rePendingExperience);

      fireEvent.click(resubmitBtn);

      await waitFor(() => {
        expect(requestSpy).toHaveBeenCalledWith(303);
        expect(screen.getByText('Pending Verification')).toBeInTheDocument();
        expect(
          screen.getByText('Verification request submitted for "Full Stack Engineer Intern".')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Flow 4: Platform Administrator Verification Queue', () => {
    it('allows platform administrator to approve claims across organizations', async () => {
      setupAuthMock(adminUser);

      const adminClaim: ExperienceRecord = {
        ...mockExperience,
        id: 404,
        status: 'pending_verification',
      };

      vi.spyOn(experiencesApi, 'getPendingVerifications').mockResolvedValueOnce({
        items: [adminClaim],
        total: 1,
      });

      render(
        <MemoryRouter initialEntries={['/app/admin/experiences/verification']}>
          <App />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Full Stack Engineer Intern')).toBeInTheDocument();
        expect(screen.getByText('Experience Verification Moderation')).toBeInTheDocument();
      });

      const verifiedRecord: ExperienceRecord = {
        ...adminClaim,
        status: 'verified',
        verification_source: 'admin_confirmed',
      };

      const decideSpy = vi
        .spyOn(experiencesApi, 'decideExperienceVerification')
        .mockResolvedValueOnce(verifiedRecord);

      fireEvent.click(screen.getByTestId('approve-btn-404'));

      await waitFor(() => {
        expect(decideSpy).toHaveBeenCalledWith(404, { action: 'approve' });
        expect(
          screen.getByText(
            'Admin decision recorded: Experience "Full Stack Engineer Intern" was verified.'
          )
        ).toBeInTheDocument();
      });
    });
  });

  describe('Flow 5: Security & Role Boundaries', () => {
    it('strictly denies unauthorized cross-role access to verification routes', () => {
      // Student attempting to access Recruiter Verification
      setupAuthMock(studentUser);

      const { unmount } = render(
        <MemoryRouter initialEntries={['/app/recruiter/experiences/verification']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByText(/403 — Access Denied/i)).toBeInTheDocument();
      unmount();

      // Recruiter attempting to access Student Experiences management
      setupAuthMock(recruiterUser);

      render(
        <MemoryRouter initialEntries={['/app/experiences']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByText(/403 — Access Denied/i)).toBeInTheDocument();
    });
  });

  describe('Flow 6: Error Handling & Resilience (400, 403, 404, 409, 500)', () => {
    it('gracefully handles backend conflict error during verification request', async () => {
      setupAuthMock(studentUser);

      vi.spyOn(experiencesApi, 'getMyExperiences').mockResolvedValueOnce({
        items: [mockExperience],
        total: 1,
      });

      vi.spyOn(experiencesApi, 'requestExperienceVerification').mockRejectedValueOnce({
        message: 'Experience record is already verified or in review.',
        status: 409,
      });

      render(
        <MemoryRouter initialEntries={['/app/experiences']}>
          <App />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Full Stack Engineer Intern')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('request-verify-btn-101'));

      await waitFor(() => {
        expect(
          screen.getByText('Experience record is already verified or in review.')
        ).toBeInTheDocument();
        // Experience record remains intact in the list
        expect(screen.getByText('Full Stack Engineer Intern')).toBeInTheDocument();
      });
    });
  });
});
