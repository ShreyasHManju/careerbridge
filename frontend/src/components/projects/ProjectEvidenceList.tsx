import React from 'react';
import { ProjectEvidence, ProjectMilestone } from '@/types/innovationProject';
import { EvidenceTypeBadge } from './EvidenceTypeBadge';

interface ProjectEvidenceListProps {
  evidenceList: ProjectEvidence[];
  milestones?: ProjectMilestone[];
  isOwner: boolean;
  onAddEvidence?: () => void;
  onEditEvidence?: (evidence: ProjectEvidence) => void;
  onDeleteEvidence?: (evidence: ProjectEvidence) => void;
}

export const ProjectEvidenceList: React.FC<ProjectEvidenceListProps> = ({
  evidenceList,
  milestones = [],
  isOwner,
  onAddEvidence,
  onEditEvidence,
  onDeleteEvidence,
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

              {isOwner && (
                <div className="cb-evidence-actions">
                  {onEditEvidence && (
                    <button
                      type="button"
                      className="cb-btn cb-btn-secondary cb-btn-xs"
                      onClick={() => onEditEvidence(item)}
                      aria-label={`Edit ${item.title}`}
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
                    >
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>

            {item.description && (
              <p className="cb-evidence-desc">{item.description}</p>
            )}

            <div className="cb-evidence-footer">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="cb-btn cb-btn-outline cb-btn-sm cb-evidence-link"
                aria-label={`Open artifact link for ${item.title}`}
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
