import React from 'react';
import { OfferStatus } from '@/types/jobOffer';

interface OfferStatusBadgeProps {
  status: OfferStatus;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const STATUS_CONFIG: Record<
  OfferStatus,
  { label: string; badgeClass: string; description: string }
> = {
  draft: {
    label: 'Draft',
    badgeClass: 'cb-offer-badge-draft',
    description: 'Job offer saved as draft, not yet released to candidate',
  },
  offered: {
    label: 'Offered',
    badgeClass: 'cb-offer-badge-offered',
    description: 'Official job offer extended to candidate, awaiting response',
  },
  accepted: {
    label: 'Accepted',
    badgeClass: 'cb-offer-badge-accepted',
    description: 'Candidate accepted the job offer',
  },
  rejected: {
    label: 'Declined',
    badgeClass: 'cb-offer-badge-rejected',
    description: 'Candidate declined the job offer',
  },
  withdrawn: {
    label: 'Withdrawn',
    badgeClass: 'cb-offer-badge-withdrawn',
    description: 'Job offer was withdrawn by employer',
  },
  expired: {
    label: 'Expired',
    badgeClass: 'cb-offer-badge-expired',
    description: 'Job offer response window has expired',
  },
};

export const OfferStatusBadge: React.FC<OfferStatusBadgeProps> = ({
  status,
  size = 'md',
  className = '',
}) => {
  const config = STATUS_CONFIG[status] || {
    label: status,
    badgeClass: 'cb-offer-badge-default',
    description: `Offer Status: ${status}`,
  };

  const sizeClass = size === 'sm' ? 'cb-app-badge-sm' : size === 'lg' ? 'cb-app-badge-lg' : '';

  return (
    <span
      className={`cb-offer-status-badge ${config.badgeClass} ${sizeClass} ${className}`.trim()}
      role="status"
      aria-label={`Offer status: ${config.label}`}
      title={config.description}
      data-testid="offer-status-badge"
    >
      <span className="cb-offer-status-indicator" aria-hidden="true" />
      <span className="cb-offer-status-label">{config.label}</span>
    </span>
  );
};
