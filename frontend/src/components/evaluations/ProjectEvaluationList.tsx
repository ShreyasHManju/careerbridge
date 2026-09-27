import React from 'react';
import { ProjectEvaluation } from '@/types/projectEvaluation';
import { ProjectEvaluationCard } from './ProjectEvaluationCard';

interface ProjectEvaluationListProps {
  evaluations: ProjectEvaluation[];
  currentUserId?: number;
  userRole?: string;
  onEdit?: (evaluation: ProjectEvaluation) => void;
  onSubmitDraft?: (evaluationId: number) => void;
  onWithdraw?: (evaluationId: number) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export const ProjectEvaluationList: React.FC<ProjectEvaluationListProps> = ({
  evaluations,
  currentUserId,
  userRole,
  onEdit,
  onSubmitDraft,
  onWithdraw,
  isLoading = false,
  error = null,
  onRetry,
}) => {
  if (isLoading) {
    return (
      <div className="cb-evaluations-loading" data-testid="evaluations-loading" style={{ textAlign: 'center', padding: '2rem' }}>
        <div className="cb-spinner" style={{ margin: '0 auto 1rem' }} />
        <p style={{ color: 'var(--cb-text-muted, #64748b)' }}>Loading project evaluations...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="cb-evaluations-error" data-testid="evaluations-error" style={{ textAlign: 'center', padding: '2rem' }}>
        <p className="cb-error-text" style={{ color: 'var(--cb-danger, #ef4444)', marginBottom: '1rem' }}>{error}</p>
        {onRetry && (
          <button
            type="button"
            className="cb-btn cb-btn-secondary cb-btn-sm"
            onClick={onRetry}
          >
            Retry Loading Evaluations
          </button>
        )}
      </div>
    );
  }

  if (!evaluations || evaluations.length === 0) {
    return (
      <div
        className="cb-evaluations-empty"
        data-testid="evaluations-empty"
        style={{
          textAlign: 'center',
          padding: '2.5rem 1.5rem',
          backgroundColor: 'var(--cb-surface-muted, #f8fafc)',
          borderRadius: '0.5rem',
          border: '1px dashed var(--cb-border, #e2e8f0)',
        }}
      >
        <p style={{ color: 'var(--cb-text-muted, #64748b)', fontSize: '0.95rem', margin: 0 }}>
          No evaluations have been submitted for this project yet.
        </p>
      </div>
    );
  }

  return (
    <div className="cb-evaluation-list" data-testid="evaluation-list" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {evaluations.map((evaluation) => {
        const isAuthor = currentUserId === evaluation.recruiter_id;
        const canEdit = isAuthor && evaluation.status === 'draft';
        const canSubmit = isAuthor && evaluation.status === 'draft';
        const canWithdraw = (isAuthor || userRole === 'admin') && evaluation.status === 'submitted';

        return (
          <ProjectEvaluationCard
            key={evaluation.id}
            evaluation={evaluation}
            canEdit={canEdit}
            canSubmit={canSubmit}
            canWithdraw={canWithdraw}
            onEdit={onEdit ? () => onEdit(evaluation) : undefined}
            onSubmitDraft={onSubmitDraft ? () => onSubmitDraft(evaluation.id) : undefined}
            onWithdraw={onWithdraw ? () => onWithdraw(evaluation.id) : undefined}
          />
        );
      })}
    </div>
  );
};
