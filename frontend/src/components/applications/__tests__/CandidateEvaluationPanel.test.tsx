import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  createCandidateEvaluation,
  getCandidateEvaluations,
  updateCandidateEvaluation,
} from '@/api/candidateEvaluations';
import { CandidateEvaluation } from '@/types/candidateEvaluation';
import { CandidateEvaluationPanel } from '../CandidateEvaluationPanel';

vi.mock('@/api/candidateEvaluations', () => ({
  createCandidateEvaluation: vi.fn(),
  getCandidateEvaluations: vi.fn(),
  updateCandidateEvaluation: vi.fn(),
  submitCandidateEvaluation: vi.fn(),
}));

const makeEvaluation = (overrides: Partial<CandidateEvaluation> = {}): CandidateEvaluation => ({
  id: 7,
  application_id: 501,
  interview_id: null,
  recruiter_id: 2,
  status: 'draft',
  technical_score: 4,
  problem_solving_score: 4,
  communication_score: 3,
  role_fit_score: 4,
  overall_score: 3.75,
  recommendation: 'hire',
  strengths: 'Strong fundamentals',
  areas_for_growth: 'System design depth',
  summary_notes: 'Discussed API design.',
  submitted_at: null,
  created_at: '2026-10-10T10:00:00Z',
  updated_at: '2026-10-10T10:00:00Z',
  ...overrides,
});

describe('CandidateEvaluationPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCandidateEvaluations).mockResolvedValue([]);
  });

  it('loads scorecard history and creates a draft', async () => {
    vi.mocked(createCandidateEvaluation).mockResolvedValue(makeEvaluation());
    render(<CandidateEvaluationPanel applicationId={501} />);

    expect(await screen.findByTestId('candidate-evaluation-form')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Technical competency'), { target: { value: '4' } });
    fireEvent.click(screen.getByTestId('save-candidate-evaluation-draft-btn'));

    await waitFor(() => expect(createCandidateEvaluation).toHaveBeenCalledWith(
      501,
      expect.objectContaining({ technical_score: 4, is_submitted: false })
    ));
    expect(await screen.findByRole('status')).toHaveTextContent('Draft saved.');
  });

  it('creates a scorecard scoped to the selected interview round', async () => {
    vi.mocked(createCandidateEvaluation).mockResolvedValue(makeEvaluation({ interview_id: 88 }));
    render(<CandidateEvaluationPanel applicationId={501} initialInterviewId={88} />);

    expect(await screen.findByTestId('candidate-evaluation-form')).toBeInTheDocument();
    expect(screen.getByTestId('candidate-evaluation-context')).toHaveTextContent('Interview round #88');

    fireEvent.change(screen.getByLabelText('Technical competency'), { target: { value: '4' } });
    fireEvent.click(screen.getByTestId('save-candidate-evaluation-draft-btn'));

    await waitFor(() => expect(createCandidateEvaluation).toHaveBeenCalledWith(
      501,
      expect.objectContaining({ interview_id: 88, technical_score: 4, is_submitted: false })
    ));
  });

  it('requires all four scores and a recommendation before submission', async () => {
    render(<CandidateEvaluationPanel applicationId={501} />);

    const submit = await screen.findByTestId('submit-candidate-evaluation-btn');
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Technical competency'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Problem solving'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Communication'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Role fit'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Hiring recommendation'), { target: { value: 'hire' } });

    expect(submit).toBeEnabled();
    vi.mocked(createCandidateEvaluation).mockResolvedValue(makeEvaluation({
      status: 'submitted',
      submitted_at: '2026-10-10T11:00:00Z',
    }));
    fireEvent.click(submit);

    await waitFor(() => expect(createCandidateEvaluation).toHaveBeenCalledWith(
      501,
      expect.objectContaining({
        technical_score: 4,
        problem_solving_score: 4,
        communication_score: 3,
        role_fit_score: 5,
        recommendation: 'hire',
        is_submitted: true,
      })
    ));
    expect(await screen.findByTestId('submitted-candidate-evaluation')).toBeInTheDocument();
  });

  it('renders submitted evaluations as read-only', async () => {
    vi.mocked(getCandidateEvaluations).mockResolvedValue([
      makeEvaluation({ status: 'submitted', submitted_at: '2026-10-10T11:00:00Z' }),
    ]);
    render(<CandidateEvaluationPanel applicationId={501} />);

    expect(await screen.findByTestId('submitted-candidate-evaluation')).toBeInTheDocument();
    expect(screen.queryByTestId('candidate-evaluation-form')).not.toBeInTheDocument();
    expect(screen.getByText(/Final scorecard/)).toBeInTheDocument();
  });

  it('updates an existing draft instead of creating a duplicate', async () => {
    vi.mocked(getCandidateEvaluations).mockResolvedValue([makeEvaluation()]);
    vi.mocked(updateCandidateEvaluation).mockResolvedValue(makeEvaluation({ technical_score: 5 }));
    render(<CandidateEvaluationPanel applicationId={501} />);

    await screen.findByTestId('candidate-evaluation-form');
    fireEvent.change(screen.getByLabelText('Technical competency'), { target: { value: '5' } });
    fireEvent.click(screen.getByTestId('save-candidate-evaluation-draft-btn'));

    await waitFor(() => expect(updateCandidateEvaluation).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ technical_score: 5, is_submitted: false })
    ));
    expect(createCandidateEvaluation).not.toHaveBeenCalled();
  });
});
