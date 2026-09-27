import React from 'react';
import { EvidenceVerificationStatus } from '@/types/innovationProject';

interface VerificationStatusBadgeProps {
  status?: EvidenceVerificationStatus | null;
  className?: string;
  testId?: string;
}

export const VerificationStatusBadge: React.FC<VerificationStatusBadgeProps> = ({
  status = 'pending',
  className = '',
  testId,
}) => {
  const normalizedStatus = status || 'pending';

  const config: Record<
    EvidenceVerificationStatus,
    { label: string; icon: string; badgeClass: string; title: string }
  > = {
    pending: {
      label: 'Pending Review',
      icon: '⏳',
      badgeClass: 'cb-badge-warning cb-badge-pending',
      title: 'This evidence artifact is awaiting administrative verification.',
    },
    verified: {
      label: 'Verified Evidence',
      icon: '✓',
      badgeClass: 'cb-badge-success cb-badge-verified',
      title: 'This evidence artifact has been reviewed and verified by platform administration.',
    },
    rejected: {
      label: 'Review Rejected',
      icon: '✕',
      badgeClass: 'cb-badge-danger cb-badge-rejected',
      title: 'This evidence artifact was reviewed and rejected. Revision or additional proof is required.',
    },
  };

  const item = config[normalizedStatus] || config.pending;

  return (
    <span
      className={`cb-badge cb-verification-badge ${item.badgeClass} ${className}`.trim()}
      title={item.title}
      aria-label={`Verification status: ${item.label}`}
      data-testid={testId || `verification-badge-${normalizedStatus}`}
    >
      <span className="cb-badge-icon" aria-hidden="true" style={{ marginRight: '0.25rem' }}>
        {item.icon}
      </span>
      {item.label}
    </span>
  );
};
