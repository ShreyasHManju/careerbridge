import React from 'react';
import { ActionItem, ActionCenterSectionConfig } from '@/types/actionCenter';
import { ActionCenterItem } from './ActionCenterItem';

export interface ActionCenterProps {
  actions: ActionItem[];
  config?: ActionCenterSectionConfig;
  className?: string;
  isLoading?: boolean;
  headerExtra?: React.ReactNode;
  dataTestId?: string;
  children?: React.ReactNode;
}

export const ActionCenter: React.FC<ActionCenterProps> = ({
  actions,
  config = {},
  className = '',
  isLoading = false,
  headerExtra,
  dataTestId = 'action-center',
  children,
}) => {
  const {
    title = 'Recommended Actions',
    subtitle = 'High-impact steps to advance your career workflow',
    emptyTitle = 'All actions completed',
    emptyDescription = 'You have no outstanding actions requiring immediate attention.',
    maxItems,
  } = config;

  const displayActions = maxItems && maxItems > 0 ? actions.slice(0, maxItems) : actions;

  return (
    <section
      className={`cb-dashboard-section cb-action-center ${className}`}
      data-testid={dataTestId}
      aria-label={title}
    >
      {(title || subtitle || headerExtra) && (
        <div className="cb-section-header">
          <div>
            {title && <h2 className="cb-section-title">{title}</h2>}
            {subtitle && <p className="cb-section-subtitle">{subtitle}</p>}
          </div>
          {headerExtra && <div className="cb-section-header-extra">{headerExtra}</div>}
        </div>
      )}

      {children}

      {isLoading ? (
        <div className="cb-action-center-loading" data-testid="action-center-loading">
          <div className="cb-skeleton-card" style={{ height: '80px', marginBottom: '0.75rem' }} />
          <div className="cb-skeleton-card" style={{ height: '80px' }} />
        </div>
      ) : displayActions.length === 0 ? (
        <div className="cb-action-center-empty" data-testid="action-center-empty">
          <div className="cb-action-center-empty-icon" aria-hidden="true">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <p className="cb-empty-title">{emptyTitle}</p>
          <p className="cb-empty-desc">{emptyDescription}</p>
        </div>
      ) : (
        <div className="cb-career-actions-grid" data-testid="action-center-list">
          {displayActions.map((action) => (
            <ActionCenterItem key={action.id} action={action} />
          ))}
        </div>
      )}
    </section>
  );
};
