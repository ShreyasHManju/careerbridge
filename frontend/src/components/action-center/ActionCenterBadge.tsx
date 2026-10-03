import React from 'react';
import { ActionPriority } from '@/types/actionCenter';

export interface ActionCenterBadgeProps {
  priority?: ActionPriority;
  label?: string;
  count?: number;
  className?: string;
  dataTestId?: string;
}

export const ActionCenterBadge: React.FC<ActionCenterBadgeProps> = ({
  priority = 'standard',
  label,
  count,
  className = '',
  dataTestId = 'action-center-badge',
}) => {
  const displayLabel = label || (priority === 'urgent' ? 'Urgent Action' : priority === 'high' ? 'High Priority' : 'Action');

  return (
    <span
      className={`cb-action-priority-badge cb-badge-${priority} ${className}`}
      data-testid={dataTestId}
    >
      {count !== undefined && count > 0 && <span className="cb-action-badge-count">{count}</span>}
      <span>{displayLabel}</span>
    </span>
  );
};
