import React from 'react';
import { Link } from 'react-router-dom';
import { CandidateSourcingResult } from '@/types/candidate';

export interface CandidateSourcingCardProps {
  candidate: CandidateSourcingResult;
  onInvite?: (candidate: CandidateSourcingResult) => void;
  className?: string;
}

const getInitials = (name: string | null): string => {
  if (!name || !name.trim()) return 'ST';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const CandidateSourcingCard: React.FC<CandidateSourcingCardProps> = ({
  candidate,
  onInvite,
  className = '',
}) => {
  const candidateName = candidate.full_name || `Candidate #${candidate.id}`;
  const initials = getInitials(candidate.full_name);

  const educationParts: string[] = [];
  if (candidate.education.degree) {
    educationParts.push(
      candidate.education.branch
        ? `${candidate.education.degree} in ${candidate.education.branch}`
        : candidate.education.degree
    );
  } else if (candidate.education.branch) {
    educationParts.push(candidate.education.branch);
  }

  if (candidate.education.college) {
    educationParts.push(candidate.education.college);
  }

  if (candidate.education.graduation_year) {
    educationParts.push(`Class of ${candidate.education.graduation_year}`);
  }

  const educationText = educationParts.length > 0 ? educationParts.join(' • ') : 'Academic details not specified';

  // Verified skills vs general skills
  const verifiedSkills = candidate.verified_skills && candidate.verified_skills.length > 0
    ? candidate.verified_skills
    : (candidate.skills || []).filter((s) => s.is_verified);

  const otherSkills = (candidate.skills || []).filter((s) => !s.is_verified);

  const topProjects = (candidate.top_projects || []).filter(
    (p) => p.visibility === 'public'
  );

  return (
    <article
      className={`cb-card cb-candidate-sourcing-card ${className}`.trim()}
      data-testid={`candidate-sourcing-card-${candidate.id}`}
      aria-labelledby={`candidate-name-${candidate.id}`}
    >
      {/* Header Profile Section */}
      <header className="cb-sourcing-header">
        <div className="cb-sourcing-profile-info">
          <div className="cb-sourcing-avatar-wrapper">
            {candidate.profile_image_url ? (
              <img
                src={candidate.profile_image_url}
                alt={`${candidateName}'s profile`}
                className="cb-sourcing-avatar-img"
              />
            ) : (
              <div className="cb-sourcing-avatar-fallback" aria-hidden="true">
                {initials}
              </div>
            )}
          </div>

          <div className="cb-sourcing-title-group">
            <div className="cb-sourcing-name-row">
              <h3 id={`candidate-name-${candidate.id}`} className="cb-sourcing-name">
                <Link
                  to={`/app/passport/${candidate.id}`}
                  className="cb-sourcing-name-link"
                >
                  {candidateName}
                </Link>
              </h3>

              {candidate.passport_summary?.is_verified && (
                <span
                  className="cb-tag cb-tag-verified-passport"
                  title="Experience Passport has verified institutional or employer claims"
                  data-testid={`passport-verified-badge-${candidate.id}`}
                >
                  🛡️ Verified Passport
                </span>
              )}
            </div>

            <p className="cb-sourcing-education" data-testid={`candidate-education-${candidate.id}`}>
              🎓 {educationText}
            </p>

            {/* Social / Portfolio Links */}
            {(candidate.github_url || candidate.linkedin_url || candidate.portfolio_url) && (
              <div className="cb-sourcing-links" aria-label="Candidate web presence">
                {candidate.github_url && (
                  <a
                    href={candidate.github_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cb-sourcing-link-badge"
                    aria-label={`GitHub profile of ${candidateName}`}
                  >
                    GitHub ↗
                  </a>
                )}
                {candidate.linkedin_url && (
                  <a
                    href={candidate.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cb-sourcing-link-badge"
                    aria-label={`LinkedIn profile of ${candidateName}`}
                  >
                    LinkedIn ↗
                  </a>
                )}
                {candidate.portfolio_url && (
                  <a
                    href={candidate.portfolio_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cb-sourcing-link-badge"
                    aria-label={`Portfolio website of ${candidateName}`}
                  >
                    Portfolio ↗
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Candidate Bio */}
      {candidate.bio && (
        <p className="cb-sourcing-bio" data-testid={`candidate-bio-${candidate.id}`}>
          {candidate.bio}
        </p>
      )}

      {/* Passport Credential Stats Pills */}
      <div className="cb-sourcing-stats-grid" aria-label="Verified Credentials Summary">
        <div className="cb-sourcing-stat-pill" title="Verified Experience Claims">
          <span className="cb-sourcing-stat-icon" aria-hidden="true">🛡️</span>
          <span className="cb-sourcing-stat-text">
            <strong>{candidate.passport_summary?.verified_experiences_count ?? 0}</strong> Verified Claims
          </span>
        </div>

        <div className="cb-sourcing-stat-pill" title="Public Innovation Projects">
          <span className="cb-sourcing-stat-icon" aria-hidden="true">🚀</span>
          <span className="cb-sourcing-stat-text">
            <strong>{candidate.passport_summary?.public_projects_count ?? topProjects.length}</strong> Public Projects
          </span>
        </div>

        {candidate.passport_summary?.total_evaluations_count !== undefined &&
          candidate.passport_summary.total_evaluations_count > 0 && (
            <div className="cb-sourcing-stat-pill cb-sourcing-stat-highlight" title="Recruiter Project Evaluations">
              <span className="cb-sourcing-stat-icon" aria-hidden="true">⭐</span>
              <span className="cb-sourcing-stat-text">
                <strong>{candidate.passport_summary.total_evaluations_count}</strong> Reviews
                {candidate.passport_summary.average_project_score && (
                  <> ({candidate.passport_summary.average_project_score.toFixed(1)}/5)</>
                )}
              </span>
            </div>
          )}
      </div>

      {/* Skills Showcase */}
      {(verifiedSkills.length > 0 || otherSkills.length > 0) && (
        <div className="cb-sourcing-skills-section" aria-label="Demonstrated and Verified Skills">
          <span className="cb-sourcing-section-label">Skills & Provenance:</span>
          <div className="cb-sourcing-skills-wrap">
            {verifiedSkills.map((s) => (
              <span
                key={`verified-${s.id}`}
                className="cb-tag cb-tag-verified"
                title={`Verified skill from approved claims or project evidence: ${s.name}`}
                data-testid={`verified-skill-${s.slug || s.id}`}
              >
                🛡️ {s.name} <span className="cb-verified-check">✓</span>
              </span>
            ))}

            {otherSkills.slice(0, 6).map((s) => (
              <span
                key={`skill-${s.id}`}
                className="cb-tag cb-tag-skill"
                title={`Skill listed by candidate: ${s.name}`}
              >
                {s.name}
              </span>
            ))}

            {otherSkills.length > 6 && (
              <span className="cb-tag cb-tag-more">
                +{otherSkills.length - 6} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Top Public Projects Preview */}
      {topProjects.length > 0 && (
        <div className="cb-sourcing-projects-section" aria-label="Featured Public Projects">
          <span className="cb-sourcing-section-label">Featured Public Projects:</span>
          <div className="cb-sourcing-projects-list">
            {topProjects.map((project) => (
              <div
                key={project.id}
                className="cb-sourcing-project-item"
                data-testid={`candidate-project-${project.id}`}
              >
                <div className="cb-sourcing-project-header">
                  <Link
                    to={`/app/projects/${project.id}`}
                    className="cb-sourcing-project-title"
                  >
                    {project.title}
                  </Link>
                  <span className="cb-tag cb-tag-project-type">
                    {project.project_type || 'Project'}
                  </span>
                </div>

                {project.short_description && (
                  <p className="cb-sourcing-project-desc">{project.short_description}</p>
                )}

                <div className="cb-sourcing-project-meta">
                  <span className="cb-sourcing-evidence-badge">
                    📎 {project.verified_evidence_count} Artifact{project.verified_evidence_count === 1 ? '' : 's'}
                  </span>

                  {project.average_evaluation_score !== null &&
                    project.average_evaluation_score !== undefined && (
                      <span className="cb-sourcing-eval-badge" title="Recruiter Evaluation Score">
                        ⭐ {project.average_evaluation_score.toFixed(1)}/5 ({project.evaluations_count || 1} review
                        {(project.evaluations_count || 1) === 1 ? '' : 's'})
                      </span>
                    )}

                  {project.progress_percentage !== undefined && (
                    <span className="cb-sourcing-progress-badge">
                      {project.progress_percentage}% completed
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Footer */}
      <footer className="cb-sourcing-card-actions">
        <Link
          to={`/app/passport/${candidate.id}`}
          className="cb-btn cb-btn-outline cb-btn-sm"
          data-testid={`view-passport-btn-${candidate.id}`}
        >
          View Experience Passport
        </Link>

        <Link
          to={`/app/messages?recipientId=${candidate.id}`}
          className="cb-btn cb-btn-secondary cb-btn-sm"
          data-testid={`message-candidate-btn-${candidate.id}`}
        >
          💬 Message Candidate
        </Link>

        {onInvite && (
          <button
            type="button"
            className="cb-btn cb-btn-primary cb-btn-sm"
            onClick={() => onInvite(candidate)}
            data-testid={`invite-candidate-btn-${candidate.id}`}
          >
            📩 Invite to Apply
          </button>
        )}
      </footer>
    </article>
  );
};
