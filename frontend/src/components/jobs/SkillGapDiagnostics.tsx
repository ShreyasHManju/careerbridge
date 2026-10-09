import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { JobMatchSummary } from '@/types/job';

interface SkillGapDiagnosticsProps {
  matchSummary: JobMatchSummary;
  jobTitle?: string;
  className?: string;
}

export const SkillGapDiagnostics: React.FC<SkillGapDiagnosticsProps> = ({
  matchSummary,
  jobTitle,
  className = '',
}) => {
  const navigate = useNavigate();

  const {
    match_percentage,
    total_required,
    total_matched,
    total_verified_matched,
    matched_skills,
    missing_skills,
  } = matchSummary;

  const handleBridgeGap = () => {
    navigate('/app/student/projects', {
      state: {
        openCreateModal: true,
        prefilledSkills: missing_skills.map((skill) => skill.name).join(', '),
        jobTitle: jobTitle,
      },
    });
  };

  const getMatchTier = (pct: number): 'high' | 'medium' | 'low' => {
    if (pct >= 75) return 'high';
    if (pct >= 50) return 'medium';
    return 'low';
  };

  const tier = getMatchTier(match_percentage);

  const getSourceLabel = (source: string): string => {
    switch (source) {
      case 'experience':
        return 'Work Experience';
      case 'evaluation':
        return 'Recruiter Evaluated';
      case 'project':
        return 'Project Evidence';
      case 'profile':
      default:
        return 'Profile Claim';
    }
  };

  return (
    <section
      className={`cb-card cb-skill-match-card ${className}`}
      data-testid="skill-gap-diagnostics"
      aria-labelledby="skill-diagnostics-heading"
    >
      <div className="cb-skill-match-header">
        <div className="cb-skill-match-title-group">
          <h3 id="skill-diagnostics-heading" className="cb-skill-match-title">
            Skill Match &amp; Gap Diagnostics
          </h3>
          <p className="cb-skill-match-subtitle">
            Personalized alignment between your Career Passport and this role's required competencies.
          </p>
        </div>

        <div className="cb-skill-match-score-badge-wrapper">
          <span
            className={`cb-badge cb-badge-match cb-badge-match-${tier}`}
            data-testid="match-percentage-badge"
            aria-label={`Match score: ${match_percentage} percent`}
          >
            🎯 {match_percentage}% Match
          </span>
        </div>
      </div>

      {/* Progress Bar & Summary Stats */}
      <div className="cb-skill-match-progress-container">
        <div
          className="cb-progress-bar-bg"
          role="progressbar"
          aria-valuenow={match_percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Role skill match progress: ${match_percentage}%`}
        >
          <div
            className={`cb-progress-bar-fill cb-progress-bar-${tier}`}
            style={{ width: `${Math.min(100, Math.max(0, match_percentage))}%` }}
          />
        </div>

        <div className="cb-skill-match-stats-row">
          <span className="cb-match-stat-text" data-testid="match-ratio-text">
            <strong>{total_matched}</strong> of <strong>{total_required}</strong> skills matched
          </span>
          {total_verified_matched > 0 && (
            <span className="cb-match-stat-verified" data-testid="verified-matched-count">
              ✓ {total_verified_matched} verified by evidence or evaluations
            </span>
          )}
        </div>
      </div>

      {/* Matched Skills Section */}
      <div className="cb-skill-breakdown-section">
        <h4 className="cb-skill-section-label">
          Matched Skills ({matched_skills.length})
        </h4>

        {matched_skills.length > 0 ? (
          <div className="cb-skill-pill-group" data-testid="matched-skills-list">
            {matched_skills.map((skill) => (
              <div
                key={skill.id}
                className={`cb-skill-diagnostics-pill cb-skill-pill-matched ${
                  skill.is_verified ? 'cb-skill-pill-verified' : ''
                }`}
                data-testid={`matched-skill-${skill.id}`}
              >
                <span className="cb-skill-pill-check" aria-hidden="true">✓</span>
                <span className="cb-skill-pill-name">{skill.name}</span>
                {skill.is_verified && (
                  <span
                    className="cb-skill-pill-verified-tag"
                    title={`Verified via ${getSourceLabel(skill.source)}`}
                  >
                    Verified
                  </span>
                )}
                <span className="cb-skill-pill-source-hint">
                  {getSourceLabel(skill.source)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="cb-skill-empty-notice">
            None of the required skills currently match your documented competencies.
          </p>
        )}
      </div>

      {/* Missing Skills Section */}
      <div className="cb-skill-breakdown-section">
        <h4 className="cb-skill-section-label">
          Missing Skills / Competency Gaps ({missing_skills.length})
        </h4>

        {missing_skills.length > 0 ? (
          <>
            <div className="cb-skill-pill-group" data-testid="missing-skills-list">
              {missing_skills.map((skill) => (
                <div
                  key={skill.id}
                  className="cb-skill-diagnostics-pill cb-skill-pill-missing"
                  data-testid={`missing-skill-${skill.id}`}
                >
                  <span className="cb-skill-pill-gap" aria-hidden="true">+</span>
                  <span className="cb-skill-pill-name">{skill.name}</span>
                </div>
              ))}
            </div>

            <div className="cb-skill-gap-callout">
              <span className="cb-skill-gap-callout-icon" aria-hidden="true">💡</span>
              <div className="cb-skill-gap-callout-content">
                <span className="cb-skill-gap-callout-text">
                  Boost your candidacy by building or documenting a project demonstrating these skills.
                </span>
                <div className="cb-skill-gap-callout-actions">
                  <button
                    type="button"
                    className="cb-btn cb-btn-primary cb-btn-sm"
                    data-testid="bridge-gap-button"
                    onClick={handleBridgeGap}
                  >
                    Bridge This Gap
                  </button>
                  <Link
                    to="/app/explore-projects"
                    className="cb-skill-gap-action-link"
                    aria-label="Explore public projects to close skill gaps"
                  >
                    Explore Innovation Projects →
                  </Link>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="cb-skill-all-matched-banner" data-testid="all-skills-matched">
            <span className="cb-match-success-icon" aria-hidden="true">🎉</span>
            <span>You meet 100% of the documented skill requirements for this opportunity!</span>
          </div>
        )}
      </div>
    </section>
  );
};
