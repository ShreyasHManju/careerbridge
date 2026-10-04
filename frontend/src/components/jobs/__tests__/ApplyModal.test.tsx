import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ApplyModal } from '../ApplyModal';
import { JobPosting, Application } from '@/types/job';
import * as applicationsApi from '@/api/applications';
import * as passportApi from '@/api/passport';

const mockJob: JobPosting = {
  id: 1,
  recruiter_id: 10,
  title: 'Backend Engineer Intern',
  description: 'Python and FastAPI role.',
  opportunity_type: 'internship',
  company_name: 'CloudScale Inc',
  location: 'Remote',
  is_remote: true,
  employment_type: 'full_time',
  skills: 'Python, FastAPI',
  minimum_qualification: 'B.S.',
  experience_required: '0-1 years',
  salary_min: 60000,
  salary_max: 80000,
  application_deadline: null,
  is_active: true,
  created_at: '2026-09-19T10:00:00Z',
  updated_at: '2026-09-19T10:00:00Z',
};

const mockApplicationResponse: Application = {
  id: 101,
  job_posting_id: 1,
  student_id: 5,
  status: 'applied',
  cover_message: 'Excited for this opportunity!',
  created_at: '2026-09-19T12:00:00Z',
  updated_at: '2026-09-19T12:00:00Z',
};

describe('ApplyModal Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    render(
      <ApplyModal
        isOpen={false}
        job={mockJob}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders accessible dialog with job information and controls when open', () => {
    render(
      <ApplyModal
        isOpen={true}
        job={mockJob}
        onClose={vi.fn()}
      />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('heading', { level: 2, name: /Apply for Backend Engineer Intern/i })).toBeInTheDocument();
    expect(screen.getByText(/CloudScale Inc/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Cover Note \/ Message/i)).toBeInTheDocument();
    expect(screen.getByText(/0 \/ 2000 characters/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Submit Application/i })).toBeInTheDocument();
  });

  it('updates live character counter as user types', () => {
    render(
      <ApplyModal
        isOpen={true}
        job={mockJob}
        onClose={vi.fn()}
      />
    );

    const textarea = screen.getByLabelText(/Cover Note \/ Message/i);
    fireEvent.change(textarea, { target: { value: 'Hello world' } });

    expect(screen.getByText(/11 \/ 2000 characters/i)).toBeInTheDocument();
  });

  it('successfully submits application and shows success confirmation', async () => {
    const applySpy = vi.spyOn(applicationsApi, 'applyToJob').mockResolvedValueOnce(mockApplicationResponse);
    const onSuccessMock = vi.fn();

    render(
      <ApplyModal
        isOpen={true}
        job={mockJob}
        onClose={vi.fn()}
        onSuccess={onSuccessMock}
      />
    );

    const textarea = screen.getByLabelText(/Cover Note \/ Message/i);
    fireEvent.change(textarea, { target: { value: 'Excited for this opportunity!' } });

    fireEvent.click(screen.getByRole('button', { name: /Submit Application/i }));

    expect(screen.getByText(/Submitting Application\.\.\./i)).toBeInTheDocument();

    await waitFor(() => {
      expect(applySpy).toHaveBeenCalledWith(1, {
        cover_message: 'Excited for this opportunity!',
      });
      expect(onSuccessMock).toHaveBeenCalledWith(mockApplicationResponse);
      expect(screen.getByRole('status')).toHaveTextContent(/Application Submitted!/i);
    });
  });

  it('handles 400 missing resume error by displaying clear user error message', async () => {
    vi.spyOn(applicationsApi, 'applyToJob').mockRejectedValueOnce({
      status: 400,
      message: 'Please upload a resume before applying',
      detail: 'Please upload a resume before applying',
    });

    render(
      <ApplyModal
        isOpen={true}
        job={mockJob}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Submit Application/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Please upload a resume before applying');
    });
  });

  it('handles 409 duplicate application error by displaying clear error', async () => {
    vi.spyOn(applicationsApi, 'applyToJob').mockRejectedValueOnce({
      status: 409,
      message: 'You have already applied to this job posting',
      detail: 'You have already applied to this job posting',
    });

    render(
      <ApplyModal
        isOpen={true}
        job={mockJob}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Submit Application/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('You have already applied to this job posting');
    });
  });

  it('handles 400 inactive job error by displaying clear error', async () => {
    vi.spyOn(applicationsApi, 'applyToJob').mockRejectedValueOnce({
      status: 400,
      message: 'Cannot apply to an inactive job posting',
      detail: 'Cannot apply to an inactive job posting',
    });

    render(
      <ApplyModal
        isOpen={true}
        job={mockJob}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Submit Application/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Cannot apply to an inactive job posting');
    });
  });

  it('closes modal when Cancel button or Close button is clicked', () => {
    const onCloseMock = vi.fn();
    render(
      <ApplyModal
        isOpen={true}
        job={mockJob}
        onClose={onCloseMock}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(onCloseMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText(/Close apply dialog/i));
    expect(onCloseMock).toHaveBeenCalledTimes(2);
  });

  it('closes modal when Escape key is pressed', () => {
    const onCloseMock = vi.fn();
    render(
      <ApplyModal
        isOpen={true}
        job={mockJob}
        onClose={onCloseMock}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  describe('Phase 32: Verified Project Proof Presentation', () => {
    it('renders verified project proof with matching target skills', async () => {
      vi.spyOn(passportApi, 'getMyPassport').mockResolvedValueOnce({
        identity: {
          user_id: 5,
          email: 'student@cb.io',
          full_name: 'Test Student',
          college: null,
          degree: null,
          branch: null,
          graduation_year: null,
          bio: null,
          github_url: null,
          linkedin_url: null,
          portfolio_url: null,
          profile_image_url: null,
          is_verified: true,
          created_at: '2026-09-19T10:00:00Z',
        },
        summary: {
          verified_experiences_count: 1,
          public_projects_count: 1,
          canonical_skills_count: 2,
          completed_milestones_count: 3,
          verified_evidence_count: 1,
        },
        skills: [],
        verified_experiences: [],
        milestones: [],
        verified_evidence: [],
        resume: null,
        is_owner: true,
        projects: [
          {
            id: 42,
            title: 'Autonomous Drone Swarm',
            slug: 'autonomous-drone-swarm',
            short_description: 'Cooperative drone mapping',
            description: 'Cooperative drone mapping',
            project_type: 'software',
            status: 'active',
            visibility: 'public',
            skills: 'Python, FastAPI, PyTorch',
            structured_skills: [],
            repository_url: 'https://github.com/student/drone',
            live_demo_url: 'https://drone.demo.io',
            total_milestones: 2,
            completed_milestones: 2,
            progress_percentage: 100,
            milestones: [],
            verified_evidence: [
              {
                id: 1,
                innovation_project_id: 42,
                milestone_id: 10,
                milestone_title: 'Specs',
                title: 'Demo Video',
                description: 'Full video walkthrough',
                evidence_type: 'video',
                url: 'https://youtube.com/demo',
                verified_at: '2026-09-20T00:00:00Z',
              },
            ],
            verified_evidence_count: 1,
            evaluations: [],
          },
        ],
      });

      render(
        <ApplyModal
          isOpen={true}
          job={mockJob}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByTestId('verified-project-proof-section')).toBeInTheDocument();
      expect(await screen.findByText('Autonomous Drone Swarm')).toBeInTheDocument();
      expect(screen.getByText(/🛡️ Verified Proof/i)).toBeInTheDocument();
      expect(screen.getByText(/✓ 1 verified artifact/i)).toBeInTheDocument();
      // Verify skill highlighting with match target
      expect(screen.getByText(/Python 🎯/i)).toBeInTheDocument();
      expect(screen.getByText(/FastAPI 🎯/i)).toBeInTheDocument();
    });

    it('clearly labels unverified projects as self-declared without verified proof badges', async () => {
      vi.spyOn(passportApi, 'getMyPassport').mockResolvedValueOnce({
        identity: {
          user_id: 5,
          email: 'student@cb.io',
          full_name: 'Test Student',
          college: null,
          degree: null,
          branch: null,
          graduation_year: null,
          bio: null,
          github_url: null,
          linkedin_url: null,
          portfolio_url: null,
          profile_image_url: null,
          is_verified: false,
          created_at: '2026-09-19T10:00:00Z',
        },
        summary: {
          verified_experiences_count: 0,
          public_projects_count: 1,
          canonical_skills_count: 1,
          completed_milestones_count: 0,
          verified_evidence_count: 0,
        },
        skills: [],
        verified_experiences: [],
        milestones: [],
        verified_evidence: [],
        resume: null,
        is_owner: true,
        projects: [
          {
            id: 99,
            title: 'Simple Portfolio',
            slug: 'simple-portfolio',
            short_description: 'My basic HTML page',
            description: 'My basic HTML page',
            project_type: 'software',
            status: 'draft',
            visibility: 'public',
            skills: 'HTML, CSS',
            structured_skills: [],
            repository_url: null,
            live_demo_url: null,
            total_milestones: 0,
            completed_milestones: 0,
            progress_percentage: 0,
            milestones: [],
            verified_evidence: [],
            verified_evidence_count: 0,
            evaluations: [],
          },
        ],
      });

      render(
        <ApplyModal
          isOpen={true}
          job={mockJob}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByTestId('verified-project-proof-section')).toBeInTheDocument();
      expect(await screen.findByText('Simple Portfolio')).toBeInTheDocument();
      expect(screen.getByText(/Self-declared \(Unverified\)/i)).toBeInTheDocument();
      expect(screen.queryByText(/🛡️ Verified Proof/i)).not.toBeInTheDocument();
    });
  });
});
