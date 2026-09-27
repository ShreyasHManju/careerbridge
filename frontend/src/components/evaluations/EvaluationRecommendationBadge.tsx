import React from 'react';
import { EvaluationRecommendation } from '@/types/projectEvaluation';

interface EvaluationRecommendationBadgeProps {
  recommendation?: EvaluationRecommendation | null;
  className?: string;
  testId?: string;
}

export const EvaluationRecommendationBadge: React.FC<EvaluationRecommendationBadgeProps> = ({
  recommendation,
  className = '',
  testId,
}) => {
  if (!recommendation) return null;

  const config: Record<
    EvaluationRecommendation,
    { label: string; icon: string; badgeClass: string }
  > = {
    not_recommended: {
      label: 'Not Recommended',
      icon: '✕',
      badgeClass: 'cb-badge-danger',
    },
    developing: {
      label: 'Developing Candidate',
      icon: '⚡',
      badgeClass: 'cb-badge-warning',
    },
    recommended: {
      label: 'Recommended',
      icon: '★',
      badgeClass: 'cb-badge-info',
    },
    strongly_recommended: {
      label: 'Strongly Recommended',
      icon: '★',
      badgeClass: 'cb-badge-success',
    },
  };

  const item = config[recommendation] || {
    label: recommendation,
    icon: '•',
    badgeClass: 'cb-badge-neutral',
  };

  return (
    <span
      className={`cb-badge cb-recommendation-badge ${item.badgeClass} ${className}`.trim()}
      aria-label={`Recommendation: ${item.label}`}
      data-testid={testId || `recommendation-badge-${recommendation}`}
    >
      <span className="cb-badge-icon" aria-hidden="true" style={{ marginRight: '0.25rem' }}>
        {item.icon}
      </span>
      {item.label}
    </span>
  );
};
