import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createCandidateEvaluation,
  getCandidateEvaluations,
  updateCandidateEvaluation,
} from '@/api/candidateEvaluations';
import {
  CandidateEvaluation,
  CandidateEvaluationPayload,
  CandidateRecommendation,
} from '@/types/candidateEvaluation';
import { ApiErrorResponse } from '@/types/api';

interface CandidateEvaluationPanelProps {
  applicationId: number;
  /** When opened from a completed interview, scope a new scorecard to that round. */
  initialInterviewId?: number | null;
}

type ScoreField =
  | 'technical_score'
  | 'problem_solving_score'
  | 'communication_score'
  | 'role_fit_score';

type TextField = 'strengths' | 'areas_for_growth' | 'summary_notes';

const SCORE_FIELDS: { key: ScoreField; label: string; help: string }[] = [
  { key: 'technical_score', label: 'Technical competency', help: 'Role-specific knowledge and practical skills' },
  { key: 'problem_solving_score', label: 'Problem solving', help: 'Reasoning, analysis, and approach to challenges' },
  { key: 'communication_score', label: 'Communication', help: 'Clarity, collaboration, and listening' },
  { key: 'role_fit_score', label: 'Role fit', help: 'Alignment with the role and working expectations' },
];

const RECOMMENDATIONS: { value: CandidateRecommendation; label: string }[] = [
  { value: 'strong_hire', label: 'Strong hire' },
  { value: 'hire', label: 'Hire' },
  { value: 'no_hire', label: 'No hire' },
  { value: 'strong_no_hire', label: 'Strong no hire' },
];

const emptyPayload = (interviewId: number | null = null): CandidateEvaluationPayload => ({
  interview_id: interviewId,
  technical_score: null,
  problem_solving_score: null,
  communication_score: null,
  role_fit_score: null,
  recommendation: null,
  strengths: '',
  areas_for_growth: '',
  summary_notes: '',
});

function getErrorMessage(error: unknown, fallback: string): string {
  const apiError = error as ApiErrorResponse;
  if (typeof apiError?.detail === 'string') return apiError.detail;
  return apiError?.message || fallback;
}

export const CandidateEvaluationPanel: React.FC<CandidateEvaluationPanelProps> = ({
  applicationId,
  initialInterviewId = null,
}) => {
  const [evaluations, setEvaluations] = useState<CandidateEvaluation[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<CandidateEvaluationPayload>(() => emptyPayload(initialInterviewId));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedEvaluation = useMemo(
    () => evaluations.find((item) => item.id === selectedId) ?? null,
    [evaluations, selectedId]
  );
  const isReadOnly = selectedEvaluation?.status === 'submitted';

  const loadEvaluations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const items = await getCandidateEvaluations(applicationId);
      setEvaluations(items);
      const draft = items.find((item) => item.status === 'draft');
      const activeForRequestedInterview =
        initialInterviewId === null
          ? undefined
          : items.find((item) => item.interview_id === initialInterviewId);
      const active =
        activeForRequestedInterview ??
        items.find((item) => item.id === selectedId) ??
        draft ??
        items[0] ??
        null;
      setSelectedId(active?.id ?? null);
      setForm(active ? {
        interview_id: active.interview_id,
        technical_score: active.technical_score,
        problem_solving_score: active.problem_solving_score,
        communication_score: active.communication_score,
        role_fit_score: active.role_fit_score,
        recommendation: active.recommendation,
        strengths: active.strengths ?? '',
        areas_for_growth: active.areas_for_growth ?? '',
        summary_notes: active.summary_notes ?? '',
      } : emptyPayload(initialInterviewId));
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load candidate scorecards.'));
    } finally {
      setIsLoading(false);
    }
  }, [applicationId, initialInterviewId, selectedId]);

  useEffect(() => {
    void loadEvaluations();
    // Load when the application changes; selection changes are handled locally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  const selectEvaluation = (evaluation: CandidateEvaluation) => {
    setSelectedId(evaluation.id);
    setError(null);
    setNotice(null);
    setForm({
      interview_id: evaluation.interview_id,
      technical_score: evaluation.technical_score,
      problem_solving_score: evaluation.problem_solving_score,
      communication_score: evaluation.communication_score,
      role_fit_score: evaluation.role_fit_score,
      recommendation: evaluation.recommendation,
      strengths: evaluation.strengths ?? '',
      areas_for_growth: evaluation.areas_for_growth ?? '',
      summary_notes: evaluation.summary_notes ?? '',
    });
  };

  const updateScore = (key: ScoreField, value: string) => {
    setForm((current) => ({ ...current, [key]: value ? Number(value) : null }));
  };

  const updateText = (key: TextField, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const save = async (submit: boolean) => {
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload: CandidateEvaluationPayload = {
        ...form,
        is_submitted: submit,
      };
      const saved = selectedEvaluation
        ? await updateCandidateEvaluation(selectedEvaluation.id, payload)
        : await createCandidateEvaluation(applicationId, payload);
      setEvaluations((current) => {
        const exists = current.some((item) => item.id === saved.id);
        return exists
          ? current.map((item) => item.id === saved.id ? saved : item)
          : [saved, ...current];
      });
      setSelectedId(saved.id);
      setForm({
        interview_id: saved.interview_id,
        technical_score: saved.technical_score,
        problem_solving_score: saved.problem_solving_score,
        communication_score: saved.communication_score,
        role_fit_score: saved.role_fit_score,
        recommendation: saved.recommendation,
        strengths: saved.strengths ?? '',
        areas_for_growth: saved.areas_for_growth ?? '',
        summary_notes: saved.summary_notes ?? '',
      });
      setNotice(submit ? 'Scorecard submitted and finalized.' : 'Draft saved.');
    } catch (err) {
      setError(getErrorMessage(
        err,
        'Could not save the scorecard. If another scorecard already exists, reload this panel.'
      ));
    } finally {
      setIsSaving(false);
    }
  };

  const canSubmit = SCORE_FIELDS.every(({ key }) => {
    const value = form[key];
    return typeof value === 'number' && value >= 1 && value <= 5;
  }) && Boolean(form.recommendation);

  if (isLoading) {
    return <div className="cb-card-inner-box" role="status">Loading candidate scorecards…</div>;
  }

  return (
    <section className="cb-review-section" data-testid="candidate-evaluation-panel">
      <div className="cb-card-inner-box" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <h4 className="cb-inner-box-title" style={{ marginBottom: '0.25rem' }}>Candidate scorecard</h4>
            <p
              data-testid="candidate-evaluation-context"
              style={{ margin: '0 0 0.375rem', color: '#1d4ed8', fontSize: '0.8125rem', fontWeight: 600 }}
            >
              {form.interview_id === null || form.interview_id === undefined
                ? 'Application-level evaluation'
                : `Interview round #${form.interview_id}`}
            </p>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>
              Rate each dimension from 1 (low) to 5 (excellent). Evaluations are private to authorized recruiters.
            </p>
          </div>
          {!evaluations.some((item) => item.interview_id === null) && (
            <button
              type="button"
              className="cb-btn cb-btn-outline-primary cb-btn-sm"
              onClick={() => {
                setSelectedId(null);
                setForm(emptyPayload(null));
                setError(null);
                setNotice(null);
              }}
              disabled={isSaving}
              data-testid="new-candidate-evaluation-btn"
            >
              New application scorecard
            </button>
          )}
        </div>
        {evaluations.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }} aria-label="Evaluation history">
            {evaluations.map((evaluation) => (
              <button
                key={evaluation.id}
                type="button"
                className={evaluation.id === selectedId ? 'cb-btn cb-btn-primary cb-btn-sm' : 'cb-btn cb-btn-outline-primary cb-btn-sm'}
                onClick={() => selectEvaluation(evaluation)}
                data-testid={`candidate-evaluation-history-${evaluation.id}`}
              >
                {evaluation.status === 'submitted' ? 'Submitted' : 'Draft'} · {evaluation.interview_id === null ? 'Application' : `Interview #${evaluation.interview_id}`}
                {evaluation.overall_score !== null ? ` · ${evaluation.overall_score}/5` : ''}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <div className="cb-alert cb-alert-danger" role="alert">{error}</div>}
      {notice && <div className="cb-alert" role="status" style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>{notice}</div>}

      {isReadOnly ? (
        <div className="cb-card-inner-box" data-testid="submitted-candidate-evaluation">
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <strong>Final scorecard</strong>
            <span>{selectedEvaluation.overall_score ?? '—'} / 5 · {selectedEvaluation.recommendation ? RECOMMENDATIONS.find((item) => item.value === selectedEvaluation.recommendation)?.label : 'No recommendation'}</span>
          </div>
          {SCORE_FIELDS.map(({ key, label }) => (
            <p key={key} style={{ margin: '0.75rem 0 0' }}>{label}: <strong>{selectedEvaluation[key] ?? '—'} / 5</strong></p>
          ))}
          {([
            ['strengths', 'Strengths'],
            ['areas_for_growth', 'Areas for growth'],
            ['summary_notes', 'Private notes'],
          ] as [TextField, string][]).map(([key, label]) => selectedEvaluation[key] ? (
            <div key={key} style={{ marginTop: '1rem' }}>
              <strong>{label}</strong>
              <p style={{ whiteSpace: 'pre-wrap', margin: '0.25rem 0 0' }}>{selectedEvaluation[key]}</p>
            </div>
          ) : null)}
          {selectedEvaluation.submitted_at && <p style={{ color: '#64748b', fontSize: '0.8125rem', marginBottom: 0 }}>Submitted {new Date(selectedEvaluation.submitted_at).toLocaleString()}</p>}
        </div>
      ) : (
        <form
          className="cb-card-inner-box"
          onSubmit={(event) => { event.preventDefault(); void save(false); }}
          data-testid="candidate-evaluation-form"
        >
          {SCORE_FIELDS.map(({ key, label, help }) => (
            <div key={key} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(9rem, 12rem)', gap: '1rem', alignItems: 'center', padding: '0.875rem 0', borderBottom: '1px solid #e2e8f0' }}>
              <label htmlFor={`candidate-evaluation-${key}`}>
                <strong style={{ display: 'block' }}>{label}</strong>
                <span style={{ color: '#64748b', fontSize: '0.8125rem' }}>{help}</span>
              </label>
              <select
                id={`candidate-evaluation-${key}`}
                className="cb-form-control"
                value={form[key] ?? ''}
                onChange={(event) => updateScore(key, event.target.value)}
                aria-label={label}
              >
                <option value="">Not rated</option>
                {[1, 2, 3, 4, 5].map((score) => <option key={score} value={score}>{score} / 5</option>)}
              </select>
            </div>
          ))}

          <div style={{ marginTop: '1rem' }}>
            <label htmlFor="candidate-evaluation-recommendation"><strong>Hiring recommendation</strong></label>
            <select
              id="candidate-evaluation-recommendation"
              className="cb-form-control"
              style={{ display: 'block', width: '100%', marginTop: '0.375rem' }}
              value={form.recommendation ?? ''}
              onChange={(event) => setForm((current) => ({
                ...current,
                recommendation: (event.target.value || null) as CandidateRecommendation | null,
              }))}
            >
              <option value="">Select a recommendation</option>
              {RECOMMENDATIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>

          {([
            ['strengths', 'Strengths', 'What did the candidate do well?'],
            ['areas_for_growth', 'Areas for growth', 'What could improve or needs follow-up?'],
            ['summary_notes', 'Private evaluator notes', 'Context for the hiring team. These notes are not candidate-facing.'],
          ] as [TextField, string, string][]).map(([key, label, placeholder]) => (
            <div key={key} style={{ marginTop: '1rem' }}>
              <label htmlFor={`candidate-evaluation-${key}`}><strong>{label}</strong></label>
              <textarea
                id={`candidate-evaluation-${key}`}
                className="cb-form-control"
                style={{ display: 'block', width: '100%', minHeight: key === 'summary_notes' ? '6rem' : '4.5rem', marginTop: '0.375rem', resize: 'vertical' }}
                value={String(form[key] ?? '')}
                onChange={(event) => updateText(key, event.target.value)}
                placeholder={placeholder}
              />
            </div>
          ))}

          <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
            <button
              type="submit"
              className="cb-btn cb-btn-secondary cb-btn-sm"
              disabled={isSaving}
              data-testid="save-candidate-evaluation-draft-btn"
            >
              {isSaving ? 'Saving…' : 'Save draft'}
            </button>
            <button
              type="button"
              className="cb-btn cb-btn-primary cb-btn-sm"
              onClick={() => void save(true)}
              disabled={isSaving || !canSubmit}
              title={!canSubmit ? 'Rate all four dimensions and select a recommendation to submit.' : undefined}
              data-testid="submit-candidate-evaluation-btn"
            >
              {isSaving ? 'Saving…' : 'Submit scorecard'}
            </button>
          </div>
          {!canSubmit && <p style={{ margin: '0.75rem 0 0', textAlign: 'right', fontSize: '0.8125rem', color: '#64748b' }}>Submission requires all four scores and a hiring recommendation.</p>}
        </form>
      )}
    </section>
  );
};
