import React from 'react';
import { ApplicationStatus } from '@/types/application';

interface ApplicationStatusBadgeProps {
  status: ApplicationStatus;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const STATUS_CONFIG: Record<
  ApplicationStatus,
  { label: string; badgeClass: string; description: string }
> = {
  applied: {
    label: 'Applied',
    badgeClass: 'cb-app-badge-applied',
    description: 'Application submitted and awaiting recruiter review',
  },
  reviewing: {
    label: 'Reviewing',
    badgeClass: 'cb-app-badge-reviewing',
    description: 'Recruiter is currently evaluating candidate profile and cover message',
  },
  shortlisted: {
    label: 'Shortlisted',
    badgeClass: 'cb-app-badge-shortlisted',
    description: 'Candidate shortlisted for interview or advanced screening',
  },
  rejected: {
    label: 'Rejected',
    badgeClass: 'cb-app-badge-rejected',
    description: 'Application not selected for this opportunity',
  },
  accepted: {
    label: 'Accepted',
    badgeClass: 'cb-app-badge-accepted',
    description: 'Candidate offered or accepted for the position',
  },
};

export const ApplicationStatusBadge: React.FC<ApplicationStatusBadgeProps> = ({
  status,
  size = 'md',
  className = '',
}) => {
  const config = STATUS_CONFIG[status] || {
    label: status,
    badgeClass: 'cb-app-badge-default',
    description: `Status: ${status}`,
  };

  const sizeClass = size === 'sm' ? 'cb-app-badge-sm' : size === 'lg' ? 'cb-app-badge-lg' : '';

  return (
    <span
      className={`cb-app-status-badge ${config.badgeClass} ${sizeClass} ${className}`.trim()}
      role="status"
      aria-label={`Application status: ${config.label}`}
      title={config.description}
    >
      <span className="cb-app-status-indicator" aria-hidden="true" />
      <span className="cb-app-status-label">{config.label}</span>
    </span>
  );
};
