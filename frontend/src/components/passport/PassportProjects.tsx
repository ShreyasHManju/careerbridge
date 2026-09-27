import React from 'react';
import { PassportProjectItem } from '@/types/passport';

export interface PassportProjectsProps {
  projects: PassportProjectItem[];
}

export const formatRecommendationText = (rec?: string | null): string => {
  if (!rec) return '';
  switch (rec) {
    case 'strongly_recommended':
      return 'Strongly Recommended';
    case 'recommended':
      return 'Recommended';
    case 'neutral':
      return 'Neutral';
    case 'not_recommended':
      return 'Not Recommended';
    default:
      return rec;
  }
};

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

            {/* Verified Evidence Artifacts */}
            {proj.verified_evidence && proj.verified_evidence.length > 0 && (
              <div
                className="cb-passport-evidence-box"
                data-testid={`proj-evidence-box-${proj.id}`}
                style={{ marginTop: '1rem', borderTop: '1px solid var(--cb-border-subtle, #e2e8f0)', paddingTop: '0.75rem' }}
              >
                <div className="cb-passport-evidence-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <h4 className="cb-passport-evidence-title" style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>
                    Verified Evidence ({proj.verified_evidence.length})
                  </h4>
                  <span className="cb-badge cb-badge-success cb-badge-sm">
                    Verified
                  </span>
                </div>

                <ul className="cb-passport-evidence-items" aria-label={`Verified evidence for ${proj.title}`} style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {proj.verified_evidence.map((ev) => (
                    <li
                      key={ev.id}
                      className="cb-passport-evidence-row"
                      data-testid={`evidence-item-${ev.id}`}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px dashed var(--cb-border-subtle, #e2e8f0)' }}
                    >
                      <div>
                        <span style={{ fontWeight: 500, marginRight: '0.5rem' }}>{ev.title}</span>
                        <span className="cb-badge cb-badge-neutral cb-badge-sm">
                          {ev.evidence_type.toUpperCase()}
                        </span>
                        {ev.milestone_title && (
                          <span style={{ fontSize: '0.8rem', color: 'var(--cb-text-muted, #64748b)', marginLeft: '0.5rem' }}>
                            (Milestone: {ev.milestone_title})
                          </span>
                        )}
                      </div>
                      <a
                        href={ev.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="cb-btn cb-btn-outline cb-btn-sm"
                        aria-label={`View evidence: ${ev.title}`}
                        data-testid={`evidence-link-${ev.id}`}
                      >
                        View Artifact &rarr;
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {/* Recruiter Project Evaluations */}
            {proj.evaluations && proj.evaluations.length > 0 && (
              <div
                className="cb-passport-evaluations-box"
                data-testid={`proj-evaluations-box-${proj.id}`}
                style={{ marginTop: '1rem', borderTop: '1px solid var(--cb-border-subtle, #e2e8f0)', paddingTop: '0.75rem' }}
              >
                <div className="cb-passport-evaluations-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <h4 className="cb-passport-evaluations-title" style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>
                    Recruiter Evaluations ({proj.evaluations.length})
                  </h4>
                  {proj.average_evaluation_score != null && (
                    <span className="cb-badge cb-badge-primary cb-badge-sm" data-testid={`proj-avg-eval-${proj.id}`}>
                      Avg Rating: {proj.average_evaluation_score.toFixed(1)} / 5.0
                    </span>
                  )}
                </div>

                <div className="cb-passport-eval-items" aria-label={`Recruiter evaluations for ${proj.title}`} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {proj.evaluations.map((ev) => (
                    <div
                      key={ev.id}
                      className="cb-card cb-passport-eval-card"
                      data-testid={`passport-eval-card-${ev.id}`}
                      style={{ padding: '0.75rem 1rem', background: 'var(--cb-bg-subtle, #f8fafc)', borderRadius: '6px', border: '1px solid var(--cb-border-subtle, #e2e8f0)' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <div>
                          <span style={{ fontWeight: 600, fontSize: '0.95rem' }} data-testid={`eval-company-${ev.id}`}>
                            {ev.recruiter_company || 'Verified Recruiter'}
                          </span>
                          {ev.recruiter_name && (
                            <span style={{ fontSize: '0.8rem', color: 'var(--cb-text-muted, #64748b)', marginLeft: '0.5rem' }}>
                              ({ev.recruiter_name})
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          {ev.recommendation && (
                            <span className={`cb-badge cb-badge-sm ${ev.recommendation.includes('recommended') ? 'cb-badge-success' : 'cb-badge-neutral'}`} data-testid={`eval-rec-${ev.id}`}>
                              {formatRecommendationText(ev.recommendation)}
                            </span>
                          )}
                          {ev.overall_score != null && (
                            <span className="cb-badge cb-badge-primary cb-badge-sm" data-testid={`eval-score-${ev.id}`}>
                              ⭐ {ev.overall_score.toFixed(1)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 5-Dimensional Scores Breakdown */}
                      <div
                        className="cb-passport-eval-dimensions"
                        data-testid={`eval-dimensions-${ev.id}`}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                          gap: '0.5rem',
                          background: '#ffffff',
                          padding: '0.5rem 0.75rem',
                          borderRadius: '4px',
                          border: '1px solid var(--cb-border-subtle, #e2e8f0)',
                          fontSize: '0.8rem',
                          marginBottom: '0.5rem'
                        }}
                      >
                        <div>
                          <span style={{ color: 'var(--cb-text-muted, #64748b)' }}>Technical Quality: </span>
                          <strong>{ev.technical_score ?? '—'}/5</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--cb-text-muted, #64748b)' }}>Problem Solving: </span>
                          <strong>{ev.problem_solving_score ?? '—'}/5</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--cb-text-muted, #64748b)' }}>Execution: </span>
                          <strong>{ev.execution_score ?? '—'}/5</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--cb-text-muted, #64748b)' }}>Communication: </span>
                          <strong>{ev.communication_score ?? '—'}/5</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--cb-text-muted, #64748b)' }}>Evidence Quality: </span>
                          <strong>{ev.evidence_score ?? '—'}/5</strong>
                        </div>
                      </div>

                      {ev.strengths && (
                        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--cb-text-primary, #1e293b)' }} data-testid={`eval-strengths-${ev.id}`}>
                          <strong>Strengths: </strong>{ev.strengths}
                        </p>
                      )}

                      {ev.assessed_skills && ev.assessed_skills.length > 0 && (
                        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: '0.5rem' }} data-testid={`eval-skills-${ev.id}`}>
                          {ev.assessed_skills.map((s) => (
                            <span key={s.id} className="cb-badge cb-badge-secondary cb-badge-sm">
                              ✓ {s.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};
