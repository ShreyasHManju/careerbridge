import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CandidateReviewModal } from '../CandidateReviewModal';
import * as passportApi from '@/api/passport';
import * as interviewsApi from '@/api/interviews';
import * as projectEvaluationsApi from '@/api/projectEvaluations';
import { Application } from '@/types/application';
import { JobPosting } from '@/types/job';
import { PassportResponse } from '@/types/passport';
import { Interview } from '@/types/interview';

const mockApplication: Application = {
  id: 501,
  job_posting_id: 10,
  student_id: 25,
  status: 'applied',
  cover_message: 'Passionate about distributed backend systems.',
  created_at: '2026-09-18T12:00:00Z',
  updated_at: '2026-09-18T12:00:00Z',
};

const mockJob: JobPosting = {
  id: 10,
  recruiter_id: 2,
  title: 'Senior Backend Engineer',
  description: 'Scalable backend services.',
  opportunity_type: 'job',
  company_name: 'TechFlow Corp',
  location: 'San Francisco, CA',
  is_remote: true,
  employment_type: 'full_time',
  skills: 'Python, FastAPI, Redis',
  minimum_qualification: 'BS in CS',
  experience_required: '2+ years',
  salary_min: 130000,
  salary_max: 160000,
  application_deadline: '2026-12-31T23:59:59Z',
  is_active: true,
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-01T10:00:00Z',
};

const mockPassport: PassportResponse = {
  identity: {
    user_id: 25,
    email: 'alex.rivera@example.edu',
    full_name: 'Alex Rivera',
    college: 'Stanford University',
    degree: 'B.S. Computer Science',
    branch: 'Software Systems',
    graduation_year: 2026,
    bio: 'Software engineer passionate about AI and distributed systems.',
    github_url: 'https://github.com/alexrivera',
    linkedin_url: 'https://linkedin.com/in/alexrivera',
    portfolio_url: 'https://alexrivera.dev',
    profile_image_url: null,
    is_verified: true,
    created_at: '2026-08-01T00:00:00Z',
  },
  summary: {
    verified_experiences_count: 1,
    public_projects_count: 1,
    canonical_skills_count: 2,
    completed_milestones_count: 3,
    verified_evidence_count: 1,
    total_evaluations_count: 0,
    average_project_score: null,
  },
  skills: [
    { id: 1, name: 'Python', slug: 'python', category: 'Backend', is_verified: true, sources: ['Project'] },
    { id: 2, name: 'PostgreSQL', slug: 'postgresql', category: 'Database', is_verified: true, sources: ['Experience'] },
  ],
  verified_experiences: [
    {
      id: 1,
      title: 'Software Engineering Intern',
      organization_name: 'Stripe',
      experience_type: 'internship',
      start_date: '2026-05-01',
      end_date: '2026-08-15',
      is_current: false,
      description: 'Built high-throughput payment settlement pipelines.',
      status: 'verified',
      verification_source: 'institutional',
      verified_at: '2026-08-20T00:00:00Z',
      innovation_project_id: null,
      innovation_project_title: null,
      skills: 'Python, Stripe API',
      structured_skills: [],
    },
  ],
  projects: [
    {
      id: 77,
      title: 'Neural Cash Flow Engine',
      slug: 'neural-cash-flow-engine',
      short_description: 'Real-time financial forecasting.',
      description: 'Distributed microservice architecture for cash flow forecasting.',
      project_type: 'software',
      status: 'active',
      visibility: 'public',
      repository_url: 'https://github.com/alexrivera/neural-cash-flow',
      live_demo_url: 'https://neural-cash-flow.app',
      skills: 'Python, FastAPI, PyTorch',
      structured_skills: [
        {
          id: 1,
          name: 'Python',
          slug: 'python',
          category: 'Backend',
          is_verified: true,
          created_at: '2026-08-01T00:00:00Z',
        },
      ],
      total_milestones: 4,
      completed_milestones: 3,
      progress_percentage: 75,
      milestones: [],
      verified_evidence: [
        {
          id: 10,
          innovation_project_id: 77,
          milestone_id: 1,
          milestone_title: 'API Gateway',
          title: 'Load Test Benchmark',
          description: '10k RPS benchmark',
          evidence_type: 'benchmark',
          url: 'https://benchmarks.example.com/test-77',
          verified_at: '2026-09-01T00:00:00Z',
        },
      ],
      verified_evidence_count: 1,
      evaluations: [],
    },
  ],
  milestones: [],
  verified_evidence: [],
  resume: null,
  is_owner: false,
};

const mockInterview: Interview = {
  id: 88,
  application_id: 501,
  student_id: 25,
  recruiter_id: 2,
  job_id: 10,
  job_title: 'Senior Backend Engineer',
  company_name: 'TechFlow Corp',
  candidate_email: 'alex.rivera@example.edu',
  recruiter_email: 'recruiter@techflow.com',
  scheduled_at: '2026-10-15T14:00:00Z',
  duration_minutes: 60,
  interview_type: 'online',
  location_or_link: 'https://meet.google.com/abc-defg-hij',
  notes: 'Technical coding round focusing on system design.',
  status: 'scheduled',
  created_at: '2026-09-20T10:00:00Z',
  updated_at: '2026-09-20T10:00:00Z',
};

describe('CandidateReviewModal Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(passportApi, 'getStudentPassport').mockResolvedValue(mockPassport);
    vi.spyOn(interviewsApi, 'getRecruiterInterviews').mockResolvedValue([mockInterview]);
    vi.spyOn(projectEvaluationsApi, 'getProjectEvaluations').mockResolvedValue([]);
  });

  it('renders modal with candidate identity and tabs when open', async () => {
    const handleClose = vi.fn();
    const handleStatusChange = vi.fn();

    render(
      <MemoryRouter>
        <CandidateReviewModal
          isOpen={true}
          application={mockApplication}
          job={mockJob}
          onClose={handleClose}
          onStatusChange={handleStatusChange}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('candidate-review-modal-501')).toBeInTheDocument();
      expect(screen.getByText('Alex Rivera')).toBeInTheDocument();
      expect(screen.getByText(/Senior Backend Engineer/i)).toBeInTheDocument();
      expect(screen.getByText(/Passionate about distributed backend systems/i)).toBeInTheDocument();
    });
  });

  it('switches between tabs and displays skills & projects', async () => {
    render(
      <MemoryRouter>
        <CandidateReviewModal
          isOpen={true}
          application={mockApplication}
          job={mockJob}
          onClose={vi.fn()}
          onStatusChange={vi.fn()}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Alex Rivera')).toBeInTheDocument();
    });

    // Tab: Skills & Experience
    fireEvent.click(screen.getByTestId('tab-skills'));
    expect(screen.getByText('Python')).toBeInTheDocument();
    expect(screen.getByText(/Stripe/i)).toBeInTheDocument();
    expect(screen.getByText('Software Engineering Intern')).toBeInTheDocument();

    // Tab: Projects & Evidence
    fireEvent.click(screen.getByTestId('tab-projects'));
    expect(screen.getByText('Neural Cash Flow Engine')).toBeInTheDocument();
    expect(screen.getByTestId('evaluate-project-btn-77')).toBeInTheDocument();
  });

  it('opens ProjectEvaluationModal when Evaluate Project is clicked and handles save', async () => {
    const createEvalSpy = vi.spyOn(projectEvaluationsApi, 'createProjectEvaluation').mockResolvedValue({
      id: 99,
      project_id: 77,
      student_id: 25,
      recruiter_id: 2,
      status: 'submitted',
      technical_quality_score: 5,
      problem_solving_score: 5,
      execution_score: 4,
      communication_documentation_score: 4,
      evidence_quality_score: 5,
      overall_score: 4.6,
      recommendation: 'strongly_recommended',
      strengths: 'Exceptional architectural design',
      improvement_areas: 'Add more unit tests',
      feedback: 'Very impressive engineering.',
      skill_assessments: [],
      submitted_at: '2026-10-03T10:00:00Z',
      created_at: '2026-10-03T10:00:00Z',
      updated_at: '2026-10-03T10:00:00Z',
    });

    render(
      <MemoryRouter>
        <CandidateReviewModal
          isOpen={true}
          application={mockApplication}
          job={mockJob}
          onClose={vi.fn()}
          onStatusChange={vi.fn()}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Alex Rivera')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('tab-projects'));
    const evalBtn = screen.getByTestId('evaluate-project-btn-77');
    fireEvent.click(evalBtn);

    // Project Evaluation modal should open
    await waitFor(() => {
      expect(screen.getByTestId('project-evaluation-modal')).toBeInTheDocument();
      expect(screen.getByText('Evaluate Innovation Project')).toBeInTheDocument();
    });

    // Save evaluation draft
    const saveDraftBtn = screen.getByTestId('save-draft-btn');
    fireEvent.click(saveDraftBtn);

    await waitFor(() => {
      expect(createEvalSpy).toHaveBeenCalledWith(77, expect.any(Object));
      expect(screen.getByTestId('review-action-success')).toBeInTheDocument();
    });
  });

  it('manages interviews: displays scheduled interview with Reschedule, Mark Complete, and Cancel actions', async () => {
    const cancelSpy = vi.spyOn(interviewsApi, 'cancelInterview').mockResolvedValue({
      ...mockInterview,
      status: 'cancelled',
    });
    const updateSpy = vi.spyOn(interviewsApi, 'updateInterview').mockResolvedValue({
      ...mockInterview,
      status: 'completed',
    });

    render(
      <MemoryRouter>
        <CandidateReviewModal
          isOpen={true}
          application={mockApplication}
          job={mockJob}
          onClose={vi.fn()}
          onStatusChange={vi.fn()}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Alex Rivera')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('tab-interviews'));

    expect(screen.getByTestId('candidate-interview-item-88')).toBeInTheDocument();
    expect(screen.getByTestId('reschedule-interview-btn-88')).toBeInTheDocument();
    expect(screen.getByTestId('complete-interview-btn-88')).toBeInTheDocument();
    expect(screen.getByTestId('cancel-interview-btn-88')).toBeInTheDocument();

    // 1. Mark Complete
    fireEvent.click(screen.getByTestId('complete-interview-btn-88'));
    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(88, { status: 'completed' });
      expect(screen.getByText(/Interview marked as completed/i)).toBeInTheDocument();
    });

    // 2. Cancel Interview
    fireEvent.click(screen.getByTestId('cancel-interview-btn-88'));
    await waitFor(() => {
      expect(cancelSpy).toHaveBeenCalledWith(88);
      expect(screen.getByText(/Interview cancelled successfully/i)).toBeInTheDocument();
    });
  });

  it('opens RescheduleInterviewModal when Reschedule is clicked', async () => {
    render(
      <MemoryRouter>
        <CandidateReviewModal
          isOpen={true}
          application={mockApplication}
          job={mockJob}
          onClose={vi.fn()}
          onStatusChange={vi.fn()}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Alex Rivera')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('tab-interviews'));
    fireEvent.click(screen.getByTestId('reschedule-interview-btn-88'));

    await waitFor(() => {
      expect(screen.getByTestId('reschedule-interview-modal')).toBeInTheDocument();
    });
  });

  it('opens ScheduleInterviewModal when Schedule Interview is clicked from footer or tab', async () => {
    vi.spyOn(interviewsApi, 'getRecruiterInterviews').mockResolvedValue([]);

    render(
      <MemoryRouter>
        <CandidateReviewModal
          isOpen={true}
          application={mockApplication}
          job={mockJob}
          onClose={vi.fn()}
          onStatusChange={vi.fn()}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Alex Rivera')).toBeInTheDocument();
    });

    // Click from footer
    fireEvent.click(screen.getByTestId('action-schedule-interview-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('schedule-interview-modal')).toBeInTheDocument();
    });
  });

  it('executes quick hiring decisions: Shortlist, Reviewing, and Accept', async () => {
    const handleStatusChange = vi.fn().mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <CandidateReviewModal
          isOpen={true}
          application={mockApplication}
          job={mockJob}
          onClose={vi.fn()}
          onStatusChange={handleStatusChange}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Alex Rivera')).toBeInTheDocument();
    });

    // 1. Mark Reviewing
    const reviewingBtn = screen.getByTestId('action-mark-reviewing-btn');
    fireEvent.click(reviewingBtn);
    await waitFor(() => {
      expect(handleStatusChange).toHaveBeenCalledWith(501, 'reviewing');
      expect(screen.getByText(/Application status successfully updated to "reviewing"/i)).toBeInTheDocument();
    });

    // 2. Shortlist
    const shortlistBtn = screen.getByTestId('action-shortlist-btn');
    fireEvent.click(shortlistBtn);
    await waitFor(() => {
      expect(handleStatusChange).toHaveBeenCalledWith(501, 'shortlisted');
      expect(screen.getByText(/Application status successfully updated to "shortlisted"/i)).toBeInTheDocument();
    });

    // 3. Accept
    const acceptBtn = screen.getByTestId('action-accept-btn');
    fireEvent.click(acceptBtn);
    await waitFor(() => {
      expect(handleStatusChange).toHaveBeenCalledWith(501, 'accepted');
      expect(screen.getByText(/Application status successfully updated to "accepted"/i)).toBeInTheDocument();
    });
  });

  it('executes Reject flow with confirmation banner', async () => {
    const handleStatusChange = vi.fn().mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <CandidateReviewModal
          isOpen={true}
          application={mockApplication}
          job={mockJob}
          onClose={vi.fn()}
          onStatusChange={handleStatusChange}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Alex Rivera')).toBeInTheDocument();
    });

    const rejectBtn = screen.getByTestId('action-reject-btn');
    fireEvent.click(rejectBtn);

    expect(screen.getByTestId('rejection-confirm-banner')).toBeInTheDocument();
    const confirmRejectBtn = screen.getByTestId('confirm-reject-btn');
    fireEvent.click(confirmRejectBtn);

    await waitFor(() => {
      expect(handleStatusChange).toHaveBeenCalledWith(501, 'rejected');
      expect(screen.getByText(/Application status successfully updated to "rejected"/i)).toBeInTheDocument();
    });
  });

  describe('Phase 32: Candidate Verified Project Credential Presentation', () => {
    it('displays verified project credential badge and evidence links on projects tab', async () => {
      const passportWithEvidence: PassportResponse = {
        ...mockPassport,
        projects: [
          {
            id: 77,
            title: 'Neural Cash Flow Engine',
            slug: 'neural-cash-flow-engine',
            short_description: 'Real-time financial forecasting.',
            description: 'Distributed microservice architecture for cash flow forecasting.',
            project_type: 'software',
            status: 'active',
            visibility: 'public',
            skills: 'Python, FastAPI, Redis',
            structured_skills: [],
            repository_url: 'https://github.com/alexrivera/cashflow',
            live_demo_url: 'https://cashflow.demo',
            total_milestones: 3,
            completed_milestones: 3,
            progress_percentage: 100,
            milestones: [],
            verified_evidence: [
              {
                id: 10,
                innovation_project_id: 77,
                milestone_id: 1,
                milestone_title: 'Architecture',
                title: 'Architecture Benchmark PDF',
                description: 'Full benchmark results',
                evidence_type: 'document',
                url: 'https://s3.amazonaws.com/benchmark.pdf',
                verified_at: '2026-08-20T00:00:00Z',
              },
            ],
            verified_evidence_count: 1,
            evaluations: [],
          },
        ],
      };

      vi.spyOn(passportApi, 'getStudentPassport').mockResolvedValueOnce(passportWithEvidence);

      render(
        <MemoryRouter>
          <CandidateReviewModal
            isOpen={true}
            application={mockApplication}
            job={mockJob}
            onClose={vi.fn()}
            onStatusChange={vi.fn()}
          />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Alex Rivera')).toBeInTheDocument();
      });

      // Switch to Projects tab
      const projectsTab = screen.getByTestId('tab-projects');
      fireEvent.click(projectsTab);

      expect(screen.getByTestId('section-projects')).toBeInTheDocument();
      expect(screen.getByText('Neural Cash Flow Engine')).toBeInTheDocument();
      expect(screen.getByTestId('verified-project-credential-badge-77')).toBeInTheDocument();
      expect(screen.getByText(/🛡️ Verified Project Credential/i)).toBeInTheDocument();
      expect(screen.getByText(/Architecture Benchmark PDF/i)).toBeInTheDocument();
    });

    it('does not display verified credential badge for projects without verified evidence', async () => {
      const passportWithoutEvidence: PassportResponse = {
        ...mockPassport,
        projects: [
          {
            id: 88,
            title: 'Simple Mockup App',
            slug: 'simple-mockup-app',
            short_description: 'Mockup app without evidence.',
            description: 'A simple prototype.',
            project_type: 'software',
            status: 'draft',
            visibility: 'public',
            skills: 'React, CSS',
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
      };

      vi.spyOn(passportApi, 'getStudentPassport').mockResolvedValueOnce(passportWithoutEvidence);

      render(
        <MemoryRouter>
          <CandidateReviewModal
            isOpen={true}
            application={mockApplication}
            job={mockJob}
            onClose={vi.fn()}
            onStatusChange={vi.fn()}
          />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Alex Rivera')).toBeInTheDocument();
      });

      // Switch to Projects tab
      const projectsTab = screen.getByTestId('tab-projects');
      fireEvent.click(projectsTab);

      expect(screen.getByTestId('section-projects')).toBeInTheDocument();
      expect(screen.getByText('Simple Mockup App')).toBeInTheDocument();
      expect(screen.queryByTestId('verified-project-credential-badge-88')).not.toBeInTheDocument();
    });
  });
});
