import React from 'react';
import { MilestoneStatus } from '@/types/innovationProject';

interface MilestoneStatusBadgeProps {
  status: MilestoneStatus;
  className?: string;
}

const statusConfig: Record<
  MilestoneStatus,
  { label: string; badgeClass: string; icon: string }
> = {
  todo: {
    label: 'To do',
    badgeClass: 'cb-badge-todo',
    icon: '⏳',
  },
  in_progress: {
    label: 'In progress',
    badgeClass: 'cb-badge-in-progress',
    icon: '⚡',
  },
  completed: {
    label: 'Completed',
    badgeClass: 'cb-badge-completed',
    icon: '✅',
  },
};

export const MilestoneStatusBadge: React.FC<MilestoneStatusBadgeProps> = ({
  status,
  className = '',
}) => {
  const config = statusConfig[status] || {
    label: status,
    badgeClass: 'cb-badge-secondary',
    icon: '📌',
  };

  return (
    <span
      className={`cb-badge cb-milestone-badge ${config.badgeClass} ${className}`}
      data-testid={`milestone-status-${status}`}
      aria-label={`Milestone status: ${config.label}`}
    >
      <span aria-hidden="true" className="cb-badge-icon">
        {config.icon}
      </span>{' '}
      {config.label}
    </span>
  );
};
