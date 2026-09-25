import React from 'react';
import { PassportProjectItem } from '@/types/passport';

export interface PassportProjectsProps {
  projects: PassportProjectItem[];
}

export const formatMilestoneStatusText = (status: string): string => {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'in_progress':
      return 'In Progress';
    case 'pending':
      return 'Pending';
    default:
      return status;
  }
};

export const PassportProjects: React.FC<PassportProjectsProps> = ({ projects }) => {
  if (!projects || projects.length === 0) {
    return (
      <section className="cb-card cb-passport-section" data-testid="passport-projects-section">
        <h2 className="cb-passport-section-title">Innovation Projects & Milestones</h2>
        <div className="cb-empty-state" data-testid="passport-projects-empty">
          <p className="cb-empty-text">No active public innovation projects on record.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="cb-card cb-passport-section" data-testid="passport-projects-section">
      <div className="cb-passport-section-header">
        <h2 className="cb-passport-section-title">Innovation Projects & Milestones</h2>
        <span className="cb-badge cb-badge-neutral">{projects.length} Projects</span>
      </div>

      <div className="cb-passport-projects-list" data-testid="passport-projects-list">
        {projects.map((proj) => (
          <div
            key={proj.id}
            className="cb-passport-project-card"
            data-testid={`passport-project-${proj.id}`}
          >
            <div className="cb-passport-proj-header">
              <div>
                <h3 className="cb-passport-proj-title" data-testid={`proj-title-${proj.id}`}>
                  {proj.title}
                </h3>
                {proj.short_description && (
                  <p className="cb-passport-proj-sub" data-testid={`proj-short-desc-${proj.id}`}>
                    {proj.short_description}
                  </p>
                )}
              </div>

              <div className="cb-passport-proj-badges">
                <span className="cb-badge cb-badge-secondary">
                  {proj.project_type.toUpperCase()}
                </span>
                <span className="cb-badge cb-badge-success">
                  {proj.status.toUpperCase()}
                </span>
              </div>
            </div>

            <p className="cb-passport-proj-desc" data-testid={`proj-desc-${proj.id}`}>
              {proj.description}
            </p>

            {/* Links */}
            {(proj.repository_url || proj.live_demo_url) && (
              <div className="cb-passport-proj-links">
                {proj.repository_url && (
                  <a
                    href={proj.repository_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cb-btn cb-btn-outline cb-btn-sm"
                    aria-label={`Repository for ${proj.title}`}
                    data-testid={`proj-repo-${proj.id}`}
                  >
                    Code Repository
                  </a>
                )}
                {proj.live_demo_url && (
                  <a
                    href={proj.live_demo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cb-btn cb-btn-outline cb-btn-sm"
                    aria-label={`Live demo for ${proj.title}`}
                    data-testid={`proj-demo-${proj.id}`}
                  >
                    Live Demo
                  </a>
                )}
              </div>
            )}

            {/* Project Skills */}
            {proj.structured_skills && proj.structured_skills.length > 0 && (
              <div className="cb-passport-proj-skills">
                {proj.structured_skills.map((s) => (
                  <span key={s.id} className="cb-badge cb-badge-secondary cb-badge-sm">
                    {s.name}
                  </span>
                ))}
              </div>
            )}

            {/* Milestones execution bar */}
            {proj.milestones && proj.milestones.length > 0 && (
              <div className="cb-passport-milestones-box" data-testid={`proj-milestones-${proj.id}`}>
                <div className="cb-passport-milestones-header">
                  <h4 className="cb-passport-milestones-title">
                    Milestone Progress ({proj.completed_milestones} / {proj.total_milestones} completed)
                  </h4>
                  <span className="cb-passport-milestone-pct">{proj.progress_percentage}%</span>
                </div>

                <div
                  className="cb-progress-bar-track"
                  role="progressbar"
                  aria-valuenow={proj.progress_percentage}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="cb-progress-bar-fill"
                    style={{ width: `${proj.progress_percentage}%` }}
                  />
                </div>

                <ul className="cb-passport-milestone-items" aria-label={`Milestones for ${proj.title}`}>
                  {proj.milestones.map((m) => {
                    const isDone = m.status === 'completed';
                    return (
                      <li
                        key={m.id}
                        className={`cb-passport-milestone-row ${isDone ? 'cb-milestone-done' : ''}`}
                        data-testid={`milestone-item-${m.id}`}
                      >
                        <span className="cb-milestone-status-icon" aria-hidden="true">
                          {isDone ? '✓' : '○'}
                        </span>
                        <span className="cb-milestone-name">{m.title}</span>
                        <span
                          className={`cb-badge cb-badge-sm ${
                            isDone ? 'cb-badge-success' : 'cb-badge-neutral'
                          }`}
                        >
                          {formatMilestoneStatusText(m.status)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};
