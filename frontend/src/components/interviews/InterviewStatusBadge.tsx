import React from 'react';
import { InterviewStatus } from '@/types/interview';

interface InterviewStatusBadgeProps {
  status: InterviewStatus;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const STATUS_CONFIG: Record<
  InterviewStatus,
  { label: string; badgeClass: string; description: string }
> = {
  scheduled: {
    label: 'Scheduled',
    badgeClass: 'cb-interview-badge-scheduled',
    description: 'Interview is confirmed and scheduled',
  },
  rescheduled: {
    label: 'Rescheduled',
    badgeClass: 'cb-interview-badge-rescheduled',
    description: 'Interview time or details have been updated',
  },
  completed: {
    label: 'Completed',
    badgeClass: 'cb-interview-badge-completed',
    description: 'Interview concluded successfully',
  },
  cancelled: {
    label: 'Cancelled',
    badgeClass: 'cb-interview-badge-cancelled',
    description: 'Interview was cancelled',
  },
};

export const InterviewStatusBadge: React.FC<InterviewStatusBadgeProps> = ({
  status,
  size = 'md',
  className = '',
}) => {
  const config = STATUS_CONFIG[status] || {
    label: status,
    badgeClass: 'cb-interview-badge-default',
    description: `Status: ${status}`,
  };

  const sizeClass =
    size === 'sm'
      ? 'cb-interview-badge-sm'
      : size === 'lg'
      ? 'cb-interview-badge-lg'
      : '';

  return (
    <span
      className={`cb-interview-status-badge ${config.badgeClass} ${sizeClass} ${className}`.trim()}
      role="status"
      aria-label={`Interview status: ${config.label}`}
      title={config.description}
    >
      <span className="cb-interview-status-indicator" aria-hidden="true" />
      <span className="cb-interview-status-label">{config.label}</span>
    </span>
  );
};
