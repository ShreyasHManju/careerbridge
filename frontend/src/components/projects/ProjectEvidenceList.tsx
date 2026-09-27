import React from 'react';
import { ProjectEvidence, ProjectMilestone } from '@/types/innovationProject';
import { EvidenceTypeBadge } from './EvidenceTypeBadge';
import { VerificationStatusBadge } from './VerificationStatusBadge';

interface ProjectEvidenceListProps {
  evidenceList: ProjectEvidence[];
  milestones?: ProjectMilestone[];
  isOwner: boolean;
  isAdmin?: boolean;
  onAddEvidence?: () => void;
  onEditEvidence?: (evidence: ProjectEvidence) => void;
  onDeleteEvidence?: (evidence: ProjectEvidence) => void;
  onVerifyEvidence?: (evidence: ProjectEvidence) => void;
}

export const ProjectEvidenceList: React.FC<ProjectEvidenceListProps> = ({
  evidenceList,
  milestones = [],
  isOwner,
  isAdmin = false,
  onAddEvidence,
  onEditEvidence,
  onDeleteEvidence,
  onVerifyEvidence,
}) => {
  const milestoneMap = new Map<number, ProjectMilestone>(
    milestones.map((m) => [m.id, m])
  );

  if (evidenceList.length === 0) {
    return (
      <div
        className="cb-evidence-empty cb-empty-state"
        data-testid="evidence-empty"
      >
        <div className="cb-empty-icon" aria-hidden="true">
          📁
        </div>
        <h4>No Evidence Artifacts Attached</h4>
        <p className="cb-empty-text">
          {isOwner
            ? 'Attach code repositories, live demos, design schematics, research documents, or video walkthroughs to provide tangible proof of your work.'
            : 'No tangible evidence artifacts have been published for this project.'}
        </p>
        {isOwner && onAddEvidence && (
          <button
            type="button"
            className="cb-btn cb-btn-primary cb-btn-sm"
            onClick={onAddEvidence}
            aria-label="Attach first evidence artifact"
          >
            + Attach First Evidence Artifact
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="cb-evidence-list"
      role="list"
      aria-label="Project Evidence Artifacts"
      data-testid="evidence-list"
    >
      {evidenceList.map((item) => {
        const attachedMilestone = item.milestone_id
          ? milestoneMap.get(item.milestone_id)
          : null;

        const verificationStatus = item.verification?.status || 'pending';

        return (
          <div
            key={item.id}
            className="cb-evidence-item cb-card"
            role="listitem"
            data-testid={`evidence-item-${item.id}`}
          >
            <div className="cb-evidence-header">
              <div className="cb-evidence-title-row">
                <div className="cb-evidence-badge-group">
                  <EvidenceTypeBadge type={item.evidence_type} />
                  <VerificationStatusBadge
                    status={verificationStatus}
                    testId={`verification-badge-${item.id}`}
                  />
                  {attachedMilestone && (
                    <span
                      className="cb-badge cb-badge-milestone-link"
                      title={`Attached to Milestone: ${attachedMilestone.title}`}
                    >
                      🚩 {attachedMilestone.title}
                    </span>
                  )}
                </div>
                <h4 className="cb-evidence-title">{item.title}</h4>
              </div>

              <div className="cb-evidence-actions">
                {isAdmin && onVerifyEvidence && (
                  <button
                    type="button"
                    className="cb-btn cb-btn-outline cb-btn-xs cb-btn-verify-action"
                    onClick={() => onVerifyEvidence(item)}
                    aria-label={`Review and verify ${item.title}`}
                    data-testid={`verify-btn-${item.id}`}
                  >
                    🛡️ Review / Verify
                  </button>
                )}
                {isOwner && (
                  <>
                    {onEditEvidence && (
                      <button
                        type="button"
                        className="cb-btn cb-btn-secondary cb-btn-xs"
                        onClick={() => onEditEvidence(item)}
                        aria-label={`Edit ${item.title}`}
                        data-testid={`edit-evidence-${item.id}`}
                      >
                        Edit
                      </button>
                    )}
                    {onDeleteEvidence && (
                      <button
                        type="button"
                        className="cb-btn cb-btn-danger cb-btn-xs"
                        onClick={() => onDeleteEvidence(item)}
                        aria-label={`Delete ${item.title}`}
                        data-testid={`delete-evidence-${item.id}`}
                      >
                        Delete
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {item.description && (
              <p className="cb-evidence-desc">{item.description}</p>
            )}

            {item.verification?.notes && (
              <div
                className={`cb-evidence-verification-notes cb-verification-notes-${verificationStatus}`}
                style={{
                  marginTop: '0.5rem',
                  marginBottom: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '4px',
                  fontSize: '0.85rem',
                  backgroundColor:
                    verificationStatus === 'verified'
                      ? '#f0fdf4'
                      : verificationStatus === 'rejected'
                      ? '#fef2f2'
                      : '#f8fafc',
                  borderLeft:
                    verificationStatus === 'verified'
                      ? '3px solid #22c55e'
                      : verificationStatus === 'rejected'
                      ? '3px solid #ef4444'
                      : '3px solid #64748b',
                }}
                data-testid={`verification-notes-${item.id}`}
              >
                <div style={{ fontWeight: 600, color: '#334155', marginBottom: '0.2rem' }}>
                  Verification Note:
                </div>
                <div style={{ color: '#475569' }}>{item.verification.notes}</div>
              </div>
            )}

            <div className="cb-evidence-footer">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="cb-btn cb-btn-outline cb-btn-sm cb-evidence-link"
                aria-label={`Open artifact link for ${item.title}`}
                data-testid={`evidence-link-${item.id}`}
              >
                🔗 Open Artifact Link ↗
              </a>
              <span className="cb-evidence-timestamp cb-text-muted">
                Added {new Date(item.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
