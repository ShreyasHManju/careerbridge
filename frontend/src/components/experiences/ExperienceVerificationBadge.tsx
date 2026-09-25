import React from 'react';
import { VerificationStatus } from '@/types/experience';

export interface ExperienceVerificationBadgeProps {
  status: VerificationStatus;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showIcon?: boolean;
}

interface StatusConfig {
  label: string;
  badgeClass: string;
  icon: string;
  description: string;
}

const STATUS_CONFIG: Record<VerificationStatus, StatusConfig> = {
  draft: {
    label: 'Draft',
    badgeClass: 'cb-exp-badge-draft',
    icon: '📝',
    description: 'Draft record - visible only to you',
  },
  claimed: {
    label: 'Claimed',
    badgeClass: 'cb-exp-badge-claimed',
    icon: '👤',
    description: 'Self-claimed experience record',
  },
  pending_verification: {
    label: 'Pending Verification',
    badgeClass: 'cb-exp-badge-pending_verification',
    icon: '⏳',
    description: 'Submitted for verification review',
  },
  verified: {
    label: 'Verified',
    badgeClass: 'cb-exp-badge-verified',
    icon: '✓',
    description: 'Verified achievement confirmed by organization or platform',
  },
  rejected: {
    label: 'Rejected',
    badgeClass: 'cb-exp-badge-rejected',
    icon: '✕',
    description: 'Verification was not approved',
  },
};

export const ExperienceVerificationBadge: React.FC<ExperienceVerificationBadgeProps> = ({
  status,
  size = 'md',
  className = '',
  showIcon = true,
}) => {
  const config = STATUS_CONFIG[status] || {
    label: status,
    badgeClass: 'cb-exp-badge-default',
    icon: '•',
    description: `Status: ${status}`,
  };

  const sizeClass =
    size === 'sm' ? 'cb-exp-badge-sm' : size === 'lg' ? 'cb-exp-badge-lg' : '';

  return (
    <span
      className={`cb-exp-status-badge ${config.badgeClass} ${sizeClass} ${className}`.trim()}
      role="status"
      aria-label={`Verification status: ${config.label}`}
      title={config.description}
      data-testid={`experience-status-${status}`}
    >
      {showIcon && (
        <span className="cb-exp-status-icon" aria-hidden="true">
          {config.icon}
        </span>
      )}
      <span className="cb-exp-status-indicator" aria-hidden="true" />
      <span className="cb-exp-status-label">{config.label}</span>
    </span>
  );
};
