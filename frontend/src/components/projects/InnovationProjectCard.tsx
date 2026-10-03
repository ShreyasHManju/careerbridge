import React from 'react';
import { Link } from 'react-router-dom';
import { InnovationProject } from '@/types/innovationProject';

interface InnovationProjectCardProps {
  project: InnovationProject;
  isOwner?: boolean;
  onEdit?: (project: InnovationProject) => void;
  onDelete?: (project: InnovationProject) => void;
}

const formatProjectType = (type: string): string => {
  switch (type) {
    case 'software':
      return 'Software';
    case 'hardware':
      return 'Hardware';
    case 'research':
      return 'Research & AI';
    case 'academic':
      return 'Academic';
    case 'entrepreneurship':
      return 'Entrepreneurship';
    case 'social_impact':
      return 'Social Impact';
    default:
      return 'Project';
  }
};

export const InnovationProjectCard: React.FC<InnovationProjectCardProps> = ({
  project,
  isOwner = false,
  onEdit,
  onDelete,
}) => {
  const displaySkills =
    project.structured_skills && project.structured_skills.length > 0
      ? project.structured_skills.map((s) => s.name)
      : project.skills
      ? project.skills.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

  // Derive milestone progress and evidence readiness if available on project object
  const totalMilestones =
    project.total_milestones ??
    (project.milestones ? project.milestones.length : null);
  const completedMilestones =
    project.completed_milestones ??
    (project.milestones
      ? project.milestones.filter((m) => m.status === 'completed').length
      : null);
  const progressPct =
    project.progress_percentage ??
    (totalMilestones && totalMilestones > 0 && completedMilestones !== null
      ? Math.round((completedMilestones / totalMilestones) * 100)
      : null);
  const evidenceCount =
    (project as any).verified_evidence_count ??
    (project as any).evidence_items?.length ??
    null;

  return (
    <div className="cb-card cb-project-card" data-testid={`project-card-${project.id}`}>
      <div className="cb-project-card-header">
        <div className="cb-project-title-row">
          <h3 className="cb-project-title">
            <Link to={`/app/projects/${project.id}`} className="cb-project-title-link">
              {project.title}
            </Link>
          </h3>
          <div className="cb-project-badges">
            <span className={`cb-badge cb-badge-type cb-badge-type-${project.project_type}`}>
              {formatProjectType(project.project_type)}
            </span>
            <span className={`cb-badge cb-badge-status cb-badge-status-${project.status}`}>
              {project.status.toUpperCase()}
            </span>
            {isOwner && (
              <span
                className={`cb-badge cb-badge-visibility ${
                  project.visibility === 'public' ? 'cb-badge-public' : 'cb-badge-private'
                }`}
              >
                {project.visibility === 'public' ? '🌐 Public' : '🔒 Private'}
              </span>
            )}
          </div>
        </div>

        {project.owner_name && (
          <p className="cb-project-author">By {project.owner_name}</p>
        )}
      </div>

      <div className="cb-project-card-body">
        <p className="cb-project-description">
          {project.short_description || project.description}
        </p>

        {displaySkills.length > 0 && (
          <div className="cb-project-skills" aria-label="Project Technologies">
            {displaySkills.map((skillName, idx) => (
              <span key={idx} className="cb-skill-tag">
                {skillName}
              </span>
            ))}
          </div>
        )}

        {/* Milestone & Evidence Readiness */}
        {(totalMilestones != null && totalMilestones > 0) || (evidenceCount != null && evidenceCount > 0) ? (
          <div
            className="cb-project-readiness"
            style={{
              marginTop: '0.625rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              flexWrap: 'wrap',
              fontSize: '0.8125rem',
              color: 'var(--cb-text-muted, #64748b)',
            }}
          >
            {totalMilestones != null && totalMilestones > 0 && (
              <span data-testid={`project-milestones-${project.id}`}>
                🎯 Milestones: {completedMilestones ?? 0}/{totalMilestones} completed ({progressPct ?? 0}%)
              </span>
            )}
            {evidenceCount != null && evidenceCount > 0 && (
              <span
                className="cb-badge cb-badge-success cb-badge-sm"
                data-testid={`project-evidence-badge-${project.id}`}
                style={{ fontSize: '0.75rem' }}
              >
                ✓ {evidenceCount} Verified {evidenceCount === 1 ? 'Artifact' : 'Artifacts'}
              </span>
            )}
          </div>
        ) : null}
      </div>

      <div className="cb-project-card-footer">
        <div className="cb-project-links">
          {project.repository_url && (
            <a
              href={project.repository_url}
              target="_blank"
              rel="noopener noreferrer"
              className="cb-project-link cb-repo-link"
              title="View Repository"
            >
              📂 Code Repo
            </a>
          )}
          {project.live_demo_url && (
            <a
              href={project.live_demo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="cb-project-link cb-demo-link"
              title="View Live Demo"
            >
              🚀 Live Demo
            </a>
          )}
        </div>

        <div className="cb-project-actions">
          {isOwner && (
            <>
              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(project)}
                  className="cb-btn cb-btn-secondary cb-btn-xs"
                  aria-label={`Edit ${project.title}`}
                >
                  Edit
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(project)}
                  className="cb-btn cb-btn-danger cb-btn-xs"
                  aria-label={`Delete ${project.title}`}
                >
                  Delete
                </button>
              )}
            </>
          )}
          <Link
            to={`/app/projects/${project.id}`}
            className="cb-btn cb-btn-outline cb-btn-xs"
          >
            Details &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
};
