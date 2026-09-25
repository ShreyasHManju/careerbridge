import React from 'react';
import { ExperienceRecord } from '@/types/experience';
import { ExperienceCard } from './ExperienceCard';

export interface ExperienceListProps {
  experiences: ExperienceRecord[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  isOwner?: boolean;
  onEdit?: (experience: ExperienceRecord) => void;
  onDelete?: (experience: ExperienceRecord) => void;
  onRequestVerification?: (experience: ExperienceRecord) => void;
  isLoadingAction?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
}

export const ExperienceList: React.FC<ExperienceListProps> = ({
  experiences,
  isLoading = false,
  error = null,
  onRetry,
  isOwner = false,
  onEdit,
  onDelete,
  onRequestVerification,
  isLoadingAction = false,
  emptyTitle = 'No Experience Records Found',
  emptyMessage = 'No experience entries have been added to this profile yet.',
}) => {
  if (isLoading) {
    return (
      <div
        className="cb-experience-loading"
        data-testid="experience-list-loading"
        role="status"
        aria-label="Loading experiences"
      >
        <span className="cb-spinner" aria-hidden="true" />
        <p>Loading verified experiences...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="cb-experience-error"
        data-testid="experience-list-error"
        role="alert"
      >
        <span className="cb-error-icon" aria-hidden="true">
          ⚠️
        </span>
        <h4 className="cb-error-title">Failed to load experiences</h4>
        <p className="cb-error-message">{error}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="cb-btn cb-btn-secondary cb-btn-sm"
            data-testid="retry-btn"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (!experiences || experiences.length === 0) {
    return (
      <div
        className="cb-experience-empty"
        data-testid="experience-list-empty"
        role="status"
      >
        <span className="cb-empty-icon" aria-hidden="true">
          💼
        </span>
        <h4 className="cb-empty-title">{emptyTitle}</h4>
        <p className="cb-empty-message">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div
      className="cb-experience-list"
      data-testid="experience-list"
      aria-label="Experience records list"
    >
      {experiences.map((exp) => (
        <ExperienceCard
          key={exp.id}
          experience={exp}
          isOwner={isOwner}
          onEdit={onEdit}
          onDelete={onDelete}
          onRequestVerification={onRequestVerification}
          isLoadingAction={isLoadingAction}
        />
      ))}
    </div>
  );
};
