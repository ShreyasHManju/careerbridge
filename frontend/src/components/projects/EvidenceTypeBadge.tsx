import React from 'react';
import { EvidenceType } from '@/types/innovationProject';

interface EvidenceTypeBadgeProps {
  type: EvidenceType;
  className?: string;
}

const evidenceTypeConfig: Record<
  EvidenceType,
  { label: string; badgeClass: string; icon: string }
> = {
  repository: {
    label: 'Repository',
    badgeClass: 'cb-badge-repo',
    icon: '📂',
  },
  document: {
    label: 'Document',
    badgeClass: 'cb-badge-doc',
    icon: '📄',
  },
  image: {
    label: 'Image',
    badgeClass: 'cb-badge-img',
    icon: '🖼️',
  },
  video: {
    label: 'Video',
    badgeClass: 'cb-badge-video',
    icon: '🎥',
  },
  demo: {
    label: 'Live Demo',
    badgeClass: 'cb-badge-demo',
    icon: '🚀',
  },
  presentation: {
    label: 'Presentation',
    badgeClass: 'cb-badge-pres',
    icon: '📊',
  },
  link: {
    label: 'Link',
    badgeClass: 'cb-badge-link',
    icon: '🔗',
  },
  other: {
    label: 'Other',
    badgeClass: 'cb-badge-other',
    icon: '📌',
  },
};

export const EvidenceTypeBadge: React.FC<EvidenceTypeBadgeProps> = ({
  type,
  className = '',
}) => {
  const config = evidenceTypeConfig[type] || {
    label: type,
    badgeClass: 'cb-badge-secondary',
    icon: '📌',
  };

  return (
    <span
      className={`cb-badge cb-evidence-badge ${config.badgeClass} ${className}`}
      data-testid={`evidence-type-${type}`}
      aria-label={`Evidence type: ${config.label}`}
    >
      <span aria-hidden="true" className="cb-badge-icon">
        {config.icon}
      </span>{' '}
      {config.label}
    </span>
  );
};
