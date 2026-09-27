import React from 'react';
import { ProjectEvaluation, EvaluationStatus } from '@/types/projectEvaluation';
import { EvaluationRecommendationBadge } from './EvaluationRecommendationBadge';

interface ProjectEvaluationCardProps {
  evaluation: ProjectEvaluation;
  isRecruiterOwner?: boolean;
  isAdmin?: boolean;
  canEdit?: boolean;
  canSubmit?: boolean;
  canWithdraw?: boolean;
  onEdit?: (evaluation: ProjectEvaluation) => void;
  onSubmit?: (evaluation: ProjectEvaluation) => void;
  onSubmitDraft?: (evaluationId: number) => void;
  onWithdraw?: ((evaluation: ProjectEvaluation) => void) | ((evaluationId: number) => void);
  isActionLoading?: boolean;
}

export const ProjectEvaluationCard: React.FC<ProjectEvaluationCardProps> = ({
  evaluation,
  isRecruiterOwner = false,
  isAdmin = false,
  canEdit,
  canSubmit,
  canWithdraw,
  onEdit,
  onSubmit,
  onSubmitDraft,
  onWithdraw,
  isActionLoading = false,
}) => {
  const allowEdit = canEdit ?? (isRecruiterOwner && evaluation.status === 'draft');
  const allowSubmit = canSubmit ?? (isRecruiterOwner && evaluation.status === 'draft');
  const allowWithdraw = canWithdraw ?? ((isRecruiterOwner || isAdmin) && evaluation.status === 'submitted');

  const statusConfig: Record<EvaluationStatus, { label: string; badgeClass: string }> = {
    draft: { label: 'Draft Evaluation', badgeClass: 'cb-badge-warning' },
    submitted: { label: 'Verified Review', badgeClass: 'cb-badge-success' },
    withdrawn: { label: 'Withdrawn', badgeClass: 'cb-badge-neutral' },
  };

  const statusItem = statusConfig[evaluation.status] || {
    label: evaluation.status,
    badgeClass: 'cb-badge-neutral',
  };

  const dimensions = [
    { label: 'Technical Quality', score: evaluation.technical_quality_score },
    { label: 'Problem Solving', score: evaluation.problem_solving_score },
    { label: 'Execution & Scope', score: evaluation.execution_score },
    { label: 'Communication & Docs', score: evaluation.communication_documentation_score },
    { label: 'Evidence Quality', score: evaluation.evidence_quality_score },
  ];

  const proficiencyClass = (prof: string) => {
    switch (prof) {
      case 'advanced':
        return 'cb-badge-success';
      case 'intermediate':
        return 'cb-badge-info';
      case 'basic':
        return 'cb-badge-warning';
      default:
        return 'cb-badge-neutral';
    }
  };

  const companyName = evaluation.recruiter_company || evaluation.company_name;

  return (
    <div
      className={`cb-card cb-evaluation-card cb-eval-status-${evaluation.status}`}
      data-testid={`evaluation-card-${evaluation.id}`}
      style={{
        border: '1px solid var(--cb-border-color, #334155)',
        borderRadius: '0.75rem',
        padding: '1.25rem',
        marginBottom: '1rem',
        backgroundColor: 'var(--cb-card-bg, #1e293b)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginBottom: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc' }}>
              {companyName ? `${companyName} Review` : 'Recruiter Evaluation'}
            </h4>
            <span className={`cb-badge ${statusItem.badgeClass}`} data-testid="evaluation-status-badge">
              {statusItem.label}
            </span>
            {evaluation.recommendation && (
              <EvaluationRecommendationBadge recommendation={evaluation.recommendation} />
            )}
          </div>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
            Evaluated by{' '}
            <strong style={{ color: '#cbd5e1' }}>
              {evaluation.recruiter_name || 'Recruiter'}
            </strong>{' '}
            {companyName && <span>({companyName}) </span>}
            {evaluation.submitted_at
              ? `on ${new Date(evaluation.submitted_at).toLocaleDateString()}`
              : `(Created ${new Date(evaluation.created_at).toLocaleDateString()})`}
          </p>
        </div>

        {/* Overall Score Badge */}
        {evaluation.overall_score !== null && evaluation.overall_score !== undefined && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              backgroundColor: '#0f172a',
              border: '1px solid #3b82f6',
              borderRadius: '0.5rem',
              padding: '0.4rem 0.8rem',
            }}
            data-testid="evaluation-overall-score"
          >
            <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.05em' }}>
              Overall Score
            </span>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#38bdf8' }}>
              {evaluation.overall_score.toFixed(1)}{' '}
              <span style={{ fontSize: '0.85rem', color: '#64748b' }}>/ 5.0</span>
            </span>
          </div>
        )}
      </div>

      {/* Dimensional Breakdown */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '0.5rem',
          backgroundColor: '#0f172a',
          padding: '0.75rem',
          borderRadius: '0.5rem',
          marginBottom: '1rem',
        }}
        data-testid="evaluation-dimensions-breakdown"
      >
        {dimensions.map((dim) => (
          <div key={dim.label} style={{ fontSize: '0.8rem' }}>
            <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.75rem' }}>
              {dim.label}
            </span>
            <span style={{ fontWeight: 600, color: dim.score ? '#f1f5f9' : '#64748b' }}>
              {dim.score ? `${dim.score} / 5` : '—'}
            </span>
          </div>
        ))}
      </div>

      {/* Assessed Skills */}
      {evaluation.skill_assessments && evaluation.skill_assessments.length > 0 && (
        <div style={{ marginBottom: '1rem' }} data-testid="evaluation-skills-section">
          <h5 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase' }}>
            Skill Proficiency Assessment
          </h5>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {evaluation.skill_assessments.map((sa) => (
              <div
                key={sa.id || sa.skill_id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  backgroundColor: '#0f172a',
                  padding: '0.3rem 0.6rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #334155',
                  fontSize: '0.8rem',
                }}
              >
                <span style={{ fontWeight: 600, color: '#f1f5f9' }}>{sa.skill_name}</span>
                <span className={`cb-badge ${proficiencyClass(sa.proficiency)}`} style={{ fontSize: '0.7rem' }}>
                  {sa.proficiency}
                </span>
                {sa.notes && (
                  <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.75rem' }}>
                    — "{sa.notes}"
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Qualitative Feedback Sections */}
      {evaluation.strengths && (
        <div style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>
          <strong style={{ color: '#22c55e' }}>Observed Strengths: </strong>
          <span style={{ color: '#e2e8f0' }}>{evaluation.strengths}</span>
        </div>
      )}

      {evaluation.improvement_areas && (
        <div style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>
          <strong style={{ color: '#f59e0b' }}>Growth Areas: </strong>
          <span style={{ color: '#e2e8f0' }}>{evaluation.improvement_areas}</span>
        </div>
      )}

      {evaluation.feedback && (
        <div style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>
          <strong style={{ color: '#38bdf8' }}>General Feedback: </strong>
          <span style={{ color: '#e2e8f0' }}>{evaluation.feedback}</span>
        </div>
      )}

      {/* Action Controls */}
      {(allowEdit || allowSubmit || allowWithdraw) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.5rem',
            marginTop: '1rem',
            paddingTop: '0.75rem',
            borderTop: '1px solid #334155',
          }}
        >
          {allowEdit && onEdit && (
            <button
              type="button"
              className="cb-btn cb-btn-secondary"
              onClick={() => onEdit(evaluation)}
              disabled={isActionLoading}
              data-testid="edit-evaluation-btn"
            >
              Edit Draft
            </button>
          )}
          {allowSubmit && (onSubmit || onSubmitDraft) && (
            <button
              type="button"
              className="cb-btn cb-btn-primary"
              onClick={() => (onSubmit ? onSubmit(evaluation) : onSubmitDraft?.(evaluation.id))}
              disabled={isActionLoading}
              data-testid="submit-evaluation-btn"
            >
              {isActionLoading ? 'Submitting...' : 'Submit Evaluation'}
            </button>
          )}

          {allowWithdraw && onWithdraw && (
            <button
              type="button"
              className="cb-btn cb-btn-danger"
              onClick={() => onWithdraw(evaluation as any)}
              disabled={isActionLoading}
              data-testid="withdraw-evaluation-btn"
              style={{ fontSize: '0.85rem' }}
            >
              Withdraw
            </button>
          )}
        </div>
      )}
    </div>
  );
};
