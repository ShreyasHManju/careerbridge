import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvaluationRecommendationBadge } from '../EvaluationRecommendationBadge';
import { ProjectEvaluationCard } from '../ProjectEvaluationCard';
import { ProjectEvaluationList } from '../ProjectEvaluationList';
import { ProjectEvaluationModal } from '../ProjectEvaluationModal';
import { ProjectEvaluation, EvaluationRecommendation } from '@/types/projectEvaluation';
import { InnovationProject } from '@/types/innovationProject';

const mockProject: InnovationProject = {
  id: 1,
  student_id: 10,
  title: 'Cloud Analytics Platform',
  slug: 'cloud-analytics-platform',
  short_description: 'A distributed data processing pipeline',
  description: 'Full stack distributed architecture for log analysis',
  project_type: 'software',
  status: 'active',
  visibility: 'public',
  repository_url: 'https://github.com/test/repo',
  live_demo_url: 'https://demo.test.com',
  skills: 'Python, TypeScript',
  structured_skills: [
    { id: 101, name: 'Python', slug: 'python', category: 'Backend', is_verified: true, created_at: '2026-09-20T00:00:00Z' },
    { id: 102, name: 'TypeScript', slug: 'typescript', category: 'Frontend', is_verified: true, created_at: '2026-09-20T00:00:00Z' },
  ],
  created_at: '2026-09-20T00:00:00Z',
  updated_at: '2026-09-20T00:00:00Z',
};

const mockSubmittedEvaluation: ProjectEvaluation = {
  id: 42,
  project_id: 1,
  student_id: 10,
  recruiter_id: 20,
  status: 'submitted',
  technical_quality_score: 5,
  problem_solving_score: 4,
  execution_score: 5,
  communication_documentation_score: 4,
  evidence_quality_score: 5,
  overall_score: 4.6,
  recommendation: 'strongly_recommended',
  strengths: 'Outstanding architecture and high test coverage.',
  improvement_areas: 'Consider adding load testing reports.',
  feedback: 'Impressive engineering rigor demonstrated throughout.',
  skill_assessments: [
    {
      id: 1,
      evaluation_id: 42,
      skill_id: 101,
      skill_name: 'Python',
      proficiency: 'advanced',
      notes: 'Clean idiomatic code',
      created_at: '2026-09-27T10:00:00Z',
    },
  ],
  recruiter_name: 'Sarah Connor',
  company_name: 'Cyberdyne Systems',
  submitted_at: '2026-09-27T10:00:00Z',
  created_at: '2026-09-27T09:00:00Z',
  updated_at: '2026-09-27T10:00:00Z',
};

const mockDraftEvaluation: ProjectEvaluation = {
  ...mockSubmittedEvaluation,
  id: 43,
  status: 'draft',
  submitted_at: null,
};

describe('EvaluationRecommendationBadge Component', () => {
  const recommendations: Array<[EvaluationRecommendation, string]> = [
    ['strongly_recommended', 'Strongly Recommended'],
    ['recommended', 'Recommended'],
    ['developing', 'Developing Candidate'],
    ['not_recommended', 'Not Recommended'],
  ];

  it.each(recommendations)('renders badge correctly for recommendation: %s', (rec, expectedLabel) => {
    render(<EvaluationRecommendationBadge recommendation={rec} />);
    expect(screen.getByText(expectedLabel)).toBeInTheDocument();
  });
});

describe('ProjectEvaluationCard Component', () => {
  it('renders submitted evaluation with scores, feedback, strengths, and recruiter info', () => {
    render(
      <ProjectEvaluationCard
        evaluation={mockSubmittedEvaluation}
        canEdit={false}
        canSubmit={false}
        canWithdraw={false}
      />
    );

    expect(screen.getByText('Sarah Connor')).toBeInTheDocument();
    expect(screen.getByText('(Cyberdyne Systems)')).toBeInTheDocument();
    expect(screen.getByText('4.6')).toBeInTheDocument();
    expect(screen.getByText('Strongly Recommended')).toBeInTheDocument();
    expect(screen.getByText('Outstanding architecture and high test coverage.')).toBeInTheDocument();
    expect(screen.getByText('Consider adding load testing reports.')).toBeInTheDocument();
    expect(screen.getByText('Impressive engineering rigor demonstrated throughout.')).toBeInTheDocument();
    expect(screen.getByText('Python')).toBeInTheDocument();
    expect(screen.getByText('advanced')).toBeInTheDocument();
  });

  it('renders draft badge and allows recruiter author to edit or submit', () => {
    const onEditMock = vi.fn();
    const onSubmitDraftMock = vi.fn();

    render(
      <ProjectEvaluationCard
        evaluation={mockDraftEvaluation}
        canEdit={true}
        canSubmit={true}
        canWithdraw={false}
        onEdit={onEditMock}
        onSubmitDraft={onSubmitDraftMock}
      />
    );

    expect(screen.getByTestId('evaluation-status-badge')).toHaveTextContent('Draft Evaluation');
    const editBtn = screen.getByTestId('edit-evaluation-btn');
    const submitBtn = screen.getByTestId('submit-evaluation-btn');

    expect(editBtn).toBeInTheDocument();
    expect(submitBtn).toBeInTheDocument();

    fireEvent.click(editBtn);
    expect(onEditMock).toHaveBeenCalledTimes(1);

    fireEvent.click(submitBtn);
    expect(onSubmitDraftMock).toHaveBeenCalledTimes(1);
  });

  it('allows authorized recruiter or admin to withdraw submitted evaluation', () => {
    const onWithdrawMock = vi.fn();

    render(
      <ProjectEvaluationCard
        evaluation={mockSubmittedEvaluation}
        canEdit={false}
        canSubmit={false}
        canWithdraw={true}
        onWithdraw={onWithdrawMock}
      />
    );

    const withdrawBtn = screen.getByTestId('withdraw-evaluation-btn');
    expect(withdrawBtn).toBeInTheDocument();

    fireEvent.click(withdrawBtn);
    expect(onWithdrawMock).toHaveBeenCalledTimes(1);
  });
});

describe('ProjectEvaluationList Component', () => {
  it('renders loading state when isLoading is true', () => {
    render(<ProjectEvaluationList evaluations={[]} isLoading={true} />);
    expect(screen.getByTestId('evaluations-loading')).toBeInTheDocument();
    expect(screen.getByText(/loading project evaluations/i)).toBeInTheDocument();
  });

  it('renders error state and triggers retry', () => {
    const onRetryMock = vi.fn();
    render(
      <ProjectEvaluationList
        evaluations={[]}
        error="Failed to load evaluations"
        onRetry={onRetryMock}
      />
    );

    expect(screen.getByTestId('evaluations-error')).toBeInTheDocument();
    expect(screen.getByText('Failed to load evaluations')).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /retry loading evaluations/i });
    fireEvent.click(retryBtn);
    expect(onRetryMock).toHaveBeenCalledTimes(1);
  });

  it('renders empty state when no evaluations exist', () => {
    render(<ProjectEvaluationList evaluations={[]} isLoading={false} />);
    expect(screen.getByTestId('evaluations-empty')).toBeInTheDocument();
    expect(
      screen.getByText(/no evaluations have been submitted for this project yet/i)
    ).toBeInTheDocument();
  });

  it('renders list of evaluation cards', () => {
    render(
      <ProjectEvaluationList
        evaluations={[mockSubmittedEvaluation, mockDraftEvaluation]}
        currentUserId={20}
        userRole="recruiter"
      />
    );

    expect(screen.getByTestId('evaluation-list')).toBeInTheDocument();
    expect(screen.getAllByText('Sarah Connor').length).toBeGreaterThanOrEqual(1);
  });
});

describe('ProjectEvaluationModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when isOpen is false', () => {
    render(
      <ProjectEvaluationModal
        isOpen={false}
        project={mockProject}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByTestId('project-evaluation-modal')).not.toBeInTheDocument();
  });

  it('renders form inputs with initial values for editing', () => {
    render(
      <ProjectEvaluationModal
        isOpen={true}
        project={mockProject}
        existingEvaluation={mockDraftEvaluation}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByTestId('project-evaluation-modal')).toBeInTheDocument();
    expect(screen.getByText(/edit project evaluation/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Outstanding architecture and high test coverage.')).toBeInTheDocument();
  });

  it('validates required fields before submitting', async () => {
    const onSaveMock = vi.fn();
    render(
      <ProjectEvaluationModal
        isOpen={true}
        project={mockProject}
        onSave={onSaveMock}
        onClose={vi.fn()}
      />
    );

    const submitBtn = screen.getByTestId('submit-modal-btn');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByTestId('evaluation-form-error')).toBeInTheDocument();
      expect(screen.getByText(/all 5 dimensional scores/i)).toBeInTheDocument();
      expect(onSaveMock).not.toHaveBeenCalled();
    });
  });

  it('allows saving draft with partial scores', async () => {
    const onSaveMock = vi.fn().mockResolvedValue(undefined);
    render(
      <ProjectEvaluationModal
        isOpen={true}
        project={mockProject}
        onSave={onSaveMock}
        onClose={vi.fn()}
      />
    );

    fireEvent.change(screen.getByTestId('eval-tech-score-select'), { target: { value: '4' } });
    fireEvent.change(screen.getByTestId('eval-strengths-input'), {
      target: { value: 'Good foundation' },
    });

    const draftBtn = screen.getByTestId('save-draft-btn');
    fireEvent.click(draftBtn);

    await waitFor(() => {
      expect(onSaveMock).toHaveBeenCalledWith(
        expect.objectContaining({
          technical_quality_score: 4,
          strengths: 'Good foundation',
        }),
        false
      );
    });
  });

  it('successfully submits complete valid evaluation payload', async () => {
    const onSaveMock = vi.fn().mockResolvedValue(undefined);
    render(
      <ProjectEvaluationModal
        isOpen={true}
        project={mockProject}
        onSave={onSaveMock}
        onClose={vi.fn()}
      />
    );

    // Fill all 5 scores
    fireEvent.change(screen.getByTestId('eval-tech-score-select'), { target: { value: '5' } });
    fireEvent.change(screen.getByTestId('eval-problem-score-select'), { target: { value: '4' } });
    fireEvent.change(screen.getByTestId('eval-exec-score-select'), { target: { value: '5' } });
    fireEvent.change(screen.getByTestId('eval-comm-score-select'), { target: { value: '4' } });
    fireEvent.change(screen.getByTestId('eval-evidence-score-select'), { target: { value: '5' } });

    // Recommendation
    fireEvent.change(screen.getByTestId('eval-recommendation-select'), {
      target: { value: 'strongly_recommended' },
    });

    // Qualitative fields
    fireEvent.change(screen.getByTestId('eval-strengths-input'), {
      target: { value: 'Great architecture' },
    });
    fireEvent.change(screen.getByTestId('eval-feedback-input'), {
      target: { value: 'Very strong candidate' },
    });

    // Proficiency for Python
    fireEvent.change(screen.getByTestId('skill-proficiency-101'), {
      target: { value: 'advanced' },
    });

    // Submit
    const submitBtn = screen.getByTestId('submit-modal-btn');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onSaveMock).toHaveBeenCalledWith(
        expect.objectContaining({
          technical_quality_score: 5,
          problem_solving_score: 4,
          execution_score: 5,
          communication_documentation_score: 4,
          evidence_quality_score: 5,
          recommendation: 'strongly_recommended',
          strengths: 'Great architecture',
          feedback: 'Very strong candidate',
          skill_assessments: expect.arrayContaining([
            expect.objectContaining({
              skill_id: 101,
              proficiency: 'advanced',
            }),
          ]),
        }),
        true
      );
    });
  });
});
