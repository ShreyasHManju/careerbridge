import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { JobInviteModal } from '../JobInviteModal';
import * as jobsApi from '@/api/jobs';
import * as invitationsApi from '@/api/invitations';
import { CandidateSourcingResult } from '@/types/candidate';
import { JobPosting } from '@/types/job';

const mockCandidate: CandidateSourcingResult = {
  id: 101,
  full_name: 'Elena Rostova',
  bio: 'Systems and distributed backend engineer',
  profile_image_url: null,
  github_url: 'https://github.com/elena',
  linkedin_url: null,
  portfolio_url: null,
  education: {
    college: 'Georgia Tech',
    degree: 'B.S.',
    branch: 'Computer Science',
    graduation_year: 2026,
  },
  skills: [
    { id: 1, name: 'C++', slug: 'cpp', category: 'Systems', is_verified: true },
    { id: 2, name: 'Distributed Systems', slug: 'dist-sys', category: 'Systems', is_verified: true },
  ],
  verified_skills: [
    { id: 1, name: 'C++', slug: 'cpp', category: 'Systems', is_verified: true },
  ],
  top_projects: [],
  passport_summary: {
    verified_experiences_count: 2,
    public_projects_count: 1,
    canonical_skills_count: 2,
    completed_milestones_count: 4,
    verified_evidence_count: 3,
    is_verified: true,
  },
  created_at: '2026-08-01T10:00:00Z',
};

const mockJobs: JobPosting[] = [
  {
    id: 1,
    recruiter_id: 10,
    title: 'Distributed Systems Engineer',
    description: 'High performance distributed backends',
    opportunity_type: 'job' as any,
    company_name: 'Apex Global Tech',
    location: 'Remote',
    is_remote: true,
    employment_type: 'full_time' as any,
    is_active: true,
    created_at: '2026-08-01T10:00:00Z',
  } as any,
  {
    id: 2,
    recruiter_id: 10,
    title: 'Cloud Architect Intern',
    description: 'Cloud architecture design',
    opportunity_type: 'internship' as any,
    company_name: 'Apex Global Tech',
    location: 'Atlanta, GA',
    is_remote: false,
    employment_type: 'full_time' as any,
    is_active: true,
    created_at: '2026-08-05T10:00:00Z',
  } as any,
];

describe('JobInviteModal Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. does not render when isOpen is false', () => {
    render(
      <JobInviteModal
        candidate={mockCandidate}
        isOpen={false}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByTestId('job-invite-modal')).not.toBeInTheDocument();
  });

  it('2. renders candidate preview, fetches recruiter jobs, and displays select input', async () => {
    vi.spyOn(jobsApi, 'getMyJobPostings').mockResolvedValue(mockJobs);

    render(
      <JobInviteModal
        candidate={mockCandidate}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Elena Rostova')).toBeInTheDocument();
    expect(screen.getByText(/Georgia Tech/)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('invite-job-select')).toBeInTheDocument();
      expect(screen.getByText(/Distributed Systems Engineer — Apex Global Tech/)).toBeInTheDocument();
      expect(screen.getByText(/Cloud Architect Intern — Apex Global Tech/)).toBeInTheDocument();
    });
  });

  it('3. submits invitation with selected job and optional message', async () => {
    vi.spyOn(jobsApi, 'getMyJobPostings').mockResolvedValue(mockJobs);

    const createSpy = vi.spyOn(invitationsApi, 'createJobInvitation').mockResolvedValue({
      id: 99,
      job_id: 1,
      recruiter_id: 10,
      student_id: 101,
      message: 'Great profile! Please apply.',
      status: 'pending',
      created_at: '2026-08-10T10:00:00Z',
      updated_at: '2026-08-10T10:00:00Z',
    });

    const onSuccessMock = vi.fn();

    render(
      <JobInviteModal
        candidate={mockCandidate}
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={onSuccessMock}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('invite-job-select')).toBeInTheDocument();
    });

    const messageInput = screen.getByTestId('invite-message-input');
    fireEvent.change(messageInput, { target: { value: 'Great profile! Please apply.' } });

    const submitBtn = screen.getByTestId('submit-invite-btn');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(1, {
        student_id: 101,
        message: 'Great profile! Please apply.',
      });
      expect(screen.getByTestId('job-invite-success')).toBeInTheDocument();
      expect(screen.getByText('Invitation Sent Successfully!')).toBeInTheDocument();
      expect(onSuccessMock).toHaveBeenCalled();
    });
  });

  it('4. displays error message when API fails (e.g. duplicate invitation)', async () => {
    vi.spyOn(jobsApi, 'getMyJobPostings').mockResolvedValue(mockJobs);

    vi.spyOn(invitationsApi, 'createJobInvitation').mockRejectedValue({
      detail: 'A pending invitation to apply for this job has already been sent to this student',
    });

    render(
      <JobInviteModal
        candidate={mockCandidate}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('invite-job-select')).toBeInTheDocument();
    });

    const submitBtn = screen.getByTestId('submit-invite-btn');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByTestId('job-invite-error-alert')).toHaveTextContent(
        'A pending invitation to apply for this job has already been sent to this student'
      );
    });
  });

  it('5. displays empty state if recruiter has no active job postings', async () => {
    vi.spyOn(jobsApi, 'getMyJobPostings').mockResolvedValue([]);

    render(
      <JobInviteModal
        candidate={mockCandidate}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('no-active-jobs-state')).toBeInTheDocument();
      expect(screen.getByText('No Active Job Postings')).toBeInTheDocument();
    });
  });

  it('6. closes when Close or Cancel button is clicked', async () => {
    vi.spyOn(jobsApi, 'getMyJobPostings').mockResolvedValue(mockJobs);

    const onCloseMock = vi.fn();

    render(
      <JobInviteModal
        candidate={mockCandidate}
        isOpen={true}
        onClose={onCloseMock}
      />
    );

    const closeBtn = screen.getByTestId('close-invite-modal-btn');
    fireEvent.click(closeBtn);

    expect(onCloseMock).toHaveBeenCalled();
  });
});
