import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getPublicPassport } from '@/api/passport';
import { PublicPassportResponse } from '@/types/passport';
import { ApiErrorResponse } from '@/types/api';

export const formatPublicDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length >= 2) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parts.length > 2 ? parseInt(parts[2], 10) : 1;
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      }
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime())
      ? dateStr
      : d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

export const PublicPassportPage: React.FC = () => {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [passport, setPassport] = useState<PublicPassportResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);

  const fetchPublicPassport = async () => {
    if (!shareToken) {
      setErrorStatus(404);
      setErrorMessage('Missing passport share token.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorStatus(null);
    setErrorMessage(null);
    setRetryAfter(null);

    try {
      const data = await getPublicPassport(shareToken);
      setPassport(data);
    } catch (err: unknown) {
      const apiError = err as ApiErrorResponse;
      const status = apiError?.status || 500;
      setErrorStatus(status);
      setErrorMessage(
        apiError?.message ||
          (typeof apiError?.detail === 'string' ? apiError.detail : null) ||
          'Failed to load CareerBridge Verified Passport.'
      );
      if (apiError?.retry_after) {
        setRetryAfter(apiError.retry_after);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPublicPassport();
  }, [shareToken]);

  // Loading State
  if (loading) {
    return (
      <div className="cb-page-container cb-public-passport-page" data-testid="public-passport-loading-container">
        <div
          className="cb-loading-container"
          style={{ padding: '5rem 0' }}
          aria-busy="true"
          aria-live="polite"
          data-testid="public-passport-loading"
        >
          <div className="cb-spinner" />
          <p className="cb-loading-text">Verifying CareerBridge credentials & loading passport...</p>
        </div>
      </div>
    );
  }

  // 404: Not Found State
  if (errorStatus === 404) {
    return (
      <div className="cb-page-container cb-public-passport-page" data-testid="public-passport-not-found">
        <div
          className="cb-card cb-error-card"
          style={{ maxWidth: '600px', margin: '3rem auto', textAlign: 'center', padding: '2.5rem 1.5rem' }}
          role="alert"
        >
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🔍</div>
          <h1 className="cb-error-title" style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
            Passport Link Not Found
          </h1>
          <p className="cb-error-message" style={{ margin: '0 auto 1.5rem auto', maxWidth: '460px' }}>
            This CareerBridge Verified Passport link does not exist or may have been mistyped.
          </p>
          <Link to="/" className="cb-btn cb-btn-primary" data-testid="public-passport-home-btn">
            Go to CareerBridge Home
          </Link>
        </div>
      </div>
    );
  }

  // 410: Expired or Revoked State
  if (errorStatus === 410) {
    return (
      <div className="cb-page-container cb-public-passport-page" data-testid="public-passport-expired-revoked">
        <div
          className="cb-card cb-error-card"
          style={{ maxWidth: '600px', margin: '3rem auto', textAlign: 'center', padding: '2.5rem 1.5rem' }}
          role="alert"
        >
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🔒</div>
          <h1 className="cb-error-title" style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
            Passport Link Expired or Revoked
          </h1>
          <p className="cb-error-message" style={{ margin: '0 auto 1.5rem auto', maxWidth: '460px' }}>
            This CareerBridge Verified Passport sharing link has expired or has been deactivated by the candidate.
          </p>
          <Link to="/" className="cb-btn cb-btn-secondary" data-testid="public-passport-expired-home-btn">
            Return to CareerBridge
          </Link>
        </div>
      </div>
    );
  }

  // 429: Rate Limited State
  if (errorStatus === 429) {
    return (
      <div className="cb-page-container cb-public-passport-page" data-testid="public-passport-rate-limited">
        <div
          className="cb-card cb-error-card"
          style={{ maxWidth: '600px', margin: '3rem auto', textAlign: 'center', padding: '2.5rem 1.5rem' }}
          role="alert"
        >
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>⏳</div>
          <h1 className="cb-error-title" style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
            Too Many Requests
          </h1>
          <p className="cb-error-message" style={{ margin: '0 auto 1.5rem auto', maxWidth: '460px' }}>
            You have sent too many requests. Please wait a moment before trying again.
            {retryAfter && ` (Retry after ${retryAfter} seconds)`}
          </p>
          <button
            type="button"
            className="cb-btn cb-btn-primary"
            onClick={fetchPublicPassport}
            data-testid="public-passport-rate-retry-btn"
          >
            Retry Now
          </button>
        </div>
      </div>
    );
  }

  // Generic Error State
  if (errorStatus || !passport) {
    return (
      <div className="cb-page-container cb-public-passport-page" data-testid="public-passport-generic-error">
        <div
          className="cb-card cb-error-card"
          style={{ maxWidth: '600px', margin: '3rem auto', textAlign: 'center', padding: '2.5rem 1.5rem' }}
          role="alert"
        >
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>⚠️</div>
          <h1 className="cb-error-title" style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
            Unable to Load Passport
          </h1>
          <p className="cb-error-message" style={{ margin: '0 auto 1.5rem auto', maxWidth: '460px' }}>
            {errorMessage || 'An unexpected error occurred while loading the verified passport.'}
          </p>
          <button
            type="button"
            className="cb-btn cb-btn-primary"
            onClick={fetchPublicPassport}
            data-testid="public-passport-retry-button"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // 200: Render Public Verified Passport
  const academicLine = [
    passport.degree,
    passport.major,
    passport.institution,
    passport.graduation_year ? `Class of ${passport.graduation_year}` : null,
  ]
    .filter(Boolean)
    .join(' • ');

  const initials = passport.full_name
    ? passport.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'CP';

  return (
    <div
      className="cb-page-container cb-public-passport-page"
      data-testid="public-passport-page"
      style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem 1rem' }}
    >
      {/* Top Platform Trust Banner */}
      <div
        className="cb-public-passport-banner"
        data-testid="public-passport-banner"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.75rem 1.25rem',
          borderRadius: 'var(--cb-radius-md, 8px)',
          background: 'linear-gradient(90deg, rgba(37, 99, 235, 0.12), rgba(16, 185, 129, 0.12))',
          border: '1px solid var(--cb-border-subtle, rgba(255, 255, 255, 0.1))',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.25rem' }}>🛡️</span>
          <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>
            CareerBridge Verified Passport
          </span>
        </div>
        <span
          className="cb-badge cb-badge-success"
          data-testid="public-platform-verified-badge"
          style={{ fontSize: '0.8125rem', padding: '0.25rem 0.6rem' }}
        >
          ✓ Authenticated & Evidence-Backed
        </span>
      </div>

      {/* Candidate Profile Header Card */}
      <header
        className="cb-card cb-public-passport-header"
        data-testid="public-passport-header"
        style={{ padding: '1.5rem', marginBottom: '1.5rem' }}
      >
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div className="cb-passport-avatar-wrapper">
            {passport.avatar_url ? (
              <img
                src={passport.avatar_url}
                alt={passport.full_name ? `${passport.full_name}'s profile photo` : 'Student profile photo'}
                className="cb-passport-avatar"
                data-testid="public-passport-avatar"
                style={{ width: '84px', height: '84px', borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <div
                className="cb-passport-avatar-placeholder"
                data-testid="public-passport-avatar-placeholder"
                style={{
                  width: '84px',
                  height: '84px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.75rem',
                  fontWeight: 700,
                  background: 'var(--cb-primary-subtle, rgba(59, 130, 246, 0.2))',
                  color: 'var(--cb-primary, #3b82f6)',
                }}
              >
                {initials}
              </div>
            )}
          </div>

          <div style={{ flex: 1, minWidth: '240px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h1
                className="cb-passport-name"
                data-testid="public-passport-name"
                style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700 }}
              >
                {passport.full_name || 'Verified Student'}
              </h1>
              <span
                className="cb-badge cb-badge-success"
                data-testid="public-verified-badge"
              >
                ✓ CareerBridge Verified
              </span>
            </div>

            {academicLine && (
              <p
                className="cb-passport-academic"
                data-testid="public-passport-academic"
                style={{ margin: '0.35rem 0 0 0', opacity: 0.85, fontSize: '0.9375rem' }}
              >
                {academicLine}
              </p>
            )}

            {passport.bio && (
              <p
                className="cb-passport-bio"
                data-testid="public-passport-bio"
                style={{ margin: '0.75rem 0 0 0', lineHeight: 1.5, fontSize: '0.9375rem' }}
              >
                {passport.bio}
              </p>
            )}

            {/* Direct Contact Information (Included ONLY if allow_contact_info was enabled) */}
            {passport.contact_info && (
              <div
                className="cb-public-contact-section"
                data-testid="public-contact-section"
                style={{
                  marginTop: '1rem',
                  paddingTop: '0.75rem',
                  borderTop: '1px dashed var(--cb-border-subtle, rgba(255, 255, 255, 0.08))',
                  display: 'flex',
                  gap: '0.75rem',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                }}
              >
                {passport.contact_info.email && (
                  <a
                    href={`mailto:${passport.contact_info.email}`}
                    className="cb-btn cb-btn-outline cb-btn-sm"
                    data-testid="public-contact-email"
                  >
                    ✉️ {passport.contact_info.email}
                  </a>
                )}
                {passport.contact_info.phone && (
                  <span
                    className="cb-btn cb-btn-outline cb-btn-sm"
                    data-testid="public-contact-phone"
                  >
                    📞 {passport.contact_info.phone}
                  </span>
                )}
                {passport.contact_info.github_url && (
                  <a
                    href={passport.contact_info.github_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cb-btn cb-btn-outline cb-btn-sm"
                    data-testid="public-contact-github"
                  >
                    GitHub ↗
                  </a>
                )}
                {passport.contact_info.linkedin_url && (
                  <a
                    href={passport.contact_info.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cb-btn cb-btn-outline cb-btn-sm"
                    data-testid="public-contact-linkedin"
                  >
                    LinkedIn ↗
                  </a>
                )}
                {passport.contact_info.portfolio_url && (
                  <a
                    href={passport.contact_info.portfolio_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cb-btn cb-btn-outline cb-btn-sm"
                    data-testid="public-contact-portfolio"
                  >
                    Portfolio ↗
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Verification Summary Metrics Bar */}
      <section
        className="cb-card cb-public-verification-summary"
        aria-label="Platform verification metrics"
        data-testid="public-verification-summary"
        style={{ padding: '1.25rem', marginBottom: '1.5rem' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
            Platform Verification Provenance
          </h2>
          <span style={{ fontSize: '0.8125rem', opacity: 0.75 }} data-testid="public-issuer">
            Issuer: <strong>{passport.verification_summary.issuer}</strong>
            {passport.verification_summary.verified_at && (
              <> • Verified: {formatPublicDate(passport.verification_summary.verified_at)}</>
            )}
          </span>
        </div>

        <div className="cb-stats-bar cb-passport-stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
          <div className="cb-stat-pill" data-testid="stat-public-placements">
            <span className="cb-stat-num" data-testid="stat-count-public-placements">
              {passport.verification_summary.verified_placements_count}
            </span>
            <span className="cb-stat-lbl">Verified Placements</span>
          </div>

          <div className="cb-stat-pill" data-testid="stat-public-projects">
            <span className="cb-stat-num" data-testid="stat-count-public-projects">
              {passport.verification_summary.verified_projects_count}
            </span>
            <span className="cb-stat-lbl">Verified Projects</span>
          </div>

          <div className="cb-stat-pill" data-testid="stat-public-skills">
            <span className="cb-stat-num" data-testid="stat-count-public-skills">
              {passport.verification_summary.total_verified_skills}
            </span>
            <span className="cb-stat-lbl">Verified Skills</span>
          </div>
        </div>
      </section>

      {/* Main Grid: Skills, Experience, Projects */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Verified Skills */}
        <section
          className="cb-card cb-public-skills-section"
          aria-labelledby="public-skills-title"
          data-testid="public-skills-section"
          style={{ padding: '1.5rem' }}
        >
          <h2 id="public-skills-title" className="cb-card-title" style={{ margin: '0 0 1rem 0', fontSize: '1.125rem' }}>
            🎯 Verified Competencies & Skills
          </h2>

          {passport.verified_skills.length === 0 ? (
            <p className="cb-empty-text" data-testid="public-skills-empty" style={{ opacity: 0.75, margin: 0 }}>
              No verified skill competencies recorded on this passport.
            </p>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: '0.75rem',
              }}
              data-testid="public-skills-grid"
            >
              {passport.verified_skills.map((skill, index) => (
                <div
                  key={`${skill.skill_name}-${index}`}
                  className="cb-public-skill-card"
                  data-testid={`public-skill-card-${skill.skill_name}`}
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--cb-radius-md, 8px)',
                    background: 'var(--cb-surface-card-subtle, rgba(255, 255, 255, 0.03))',
                    border: '1px solid var(--cb-border-subtle, rgba(255, 255, 255, 0.08))',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '0.9375rem' }}>{skill.skill_name}</strong>
                    {skill.category && (
                      <span className="cb-badge cb-badge-neutral" style={{ fontSize: '0.7rem' }}>
                        {skill.category}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: '0.5rem',
                      marginTop: '0.5rem',
                      fontSize: '0.75rem',
                      opacity: 0.8,
                    }}
                  >
                    {skill.projects_count > 0 && (
                      <span>📁 {skill.projects_count} {skill.projects_count === 1 ? 'Project' : 'Projects'}</span>
                    )}
                    {skill.verified_placements_count > 0 && (
                      <span>💼 {skill.verified_placements_count} {skill.verified_placements_count === 1 ? 'Placement' : 'Placements'}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Experience Timeline */}
        <section
          className="cb-card cb-public-experience-section"
          aria-labelledby="public-experience-title"
          data-testid="public-experience-section"
          style={{ padding: '1.5rem' }}
        >
          <h2 id="public-experience-title" className="cb-card-title" style={{ margin: '0 0 1rem 0', fontSize: '1.125rem' }}>
            💼 Verified Professional Experience
          </h2>

          {passport.experience_timeline.length === 0 ? (
            <p className="cb-empty-text" data-testid="public-experience-empty" style={{ opacity: 0.75, margin: 0 }}>
              No verified experience records available.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} data-testid="public-experience-list">
              {passport.experience_timeline.map((exp, index) => (
                <div
                  key={`${exp.company_name}-${index}`}
                  className="cb-public-exp-card"
                  data-testid={`public-exp-item-${index}`}
                  style={{
                    padding: '1rem',
                    borderRadius: 'var(--cb-radius-md, 8px)',
                    background: 'var(--cb-surface-card-subtle, rgba(255, 255, 255, 0.03))',
                    border: '1px solid var(--cb-border-subtle, rgba(255, 255, 255, 0.08))',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{exp.role_title}</h3>
                      <p style={{ margin: '0.2rem 0 0 0', opacity: 0.85, fontSize: '0.875rem' }}>
                        {exp.company_name} • {exp.employment_type}
                      </p>
                    </div>
                    <span className="cb-badge cb-badge-success" style={{ fontSize: '0.75rem' }}>
                      ✓ Verified Experience
                    </span>
                  </div>

                  <div style={{ marginTop: '0.5rem', fontSize: '0.8125rem', opacity: 0.75 }}>
                    {formatPublicDate(exp.start_date)} — {exp.is_current ? 'Present' : formatPublicDate(exp.end_date)}
                    {exp.verified_at && (
                      <> • Verified on {formatPublicDate(exp.verified_at)}</>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Featured Innovation Projects */}
        <section
          className="cb-card cb-public-projects-section"
          aria-labelledby="public-projects-title"
          data-testid="public-projects-section"
          style={{ padding: '1.5rem' }}
        >
          <h2 id="public-projects-title" className="cb-card-title" style={{ margin: '0 0 1rem 0', fontSize: '1.125rem' }}>
            🚀 Featured Innovation Projects
          </h2>

          {passport.featured_projects.length === 0 ? (
            <p className="cb-empty-text" data-testid="public-projects-empty" style={{ opacity: 0.75, margin: 0 }}>
              No public innovation projects featured on this passport.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} data-testid="public-projects-list">
              {passport.featured_projects.map((proj, index) => (
                <div
                  key={`${proj.title}-${index}`}
                  className="cb-public-proj-card"
                  data-testid={`public-proj-item-${index}`}
                  style={{
                    padding: '1.25rem',
                    borderRadius: 'var(--cb-radius-md, 8px)',
                    background: 'var(--cb-surface-card-subtle, rgba(255, 255, 255, 0.03))',
                    border: '1px solid var(--cb-border-subtle, rgba(255, 255, 255, 0.08))',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 600 }}>{proj.title}</h3>
                      {proj.tagline && (
                        <p style={{ margin: '0.2rem 0 0 0', opacity: 0.85, fontSize: '0.875rem' }}>
                          {proj.tagline}
                        </p>
                      )}
                    </div>

                    {proj.is_verified && (
                      <span className="cb-badge cb-badge-success" style={{ fontSize: '0.75rem' }}>
                        ✓ Evidence Verified
                      </span>
                    )}
                  </div>

                  <p style={{ margin: '0.75rem 0', fontSize: '0.875rem', lineHeight: 1.5, opacity: 0.9 }}>
                    {proj.description}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.8125rem' }}>
                    <div style={{ opacity: 0.75 }}>
                      Milestones: <strong>{proj.milestones_completed}</strong> / {proj.total_milestones} completed
                      {proj.verified_evidence_count > 0 && (
                        <> • <strong>{proj.verified_evidence_count}</strong> verified artifacts</>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {proj.repository_url && (
                        <a
                          href={proj.repository_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="cb-btn cb-btn-outline cb-btn-sm"
                          data-testid={`public-proj-repo-${index}`}
                        >
                          Code Repo ↗
                        </a>
                      )}
                      {proj.live_demo_url && (
                        <a
                          href={proj.live_demo_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="cb-btn cb-btn-primary cb-btn-sm"
                          data-testid={`public-proj-demo-${index}`}
                        >
                          Live Demo ↗
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Public Footer */}
      <footer
        style={{
          marginTop: '3rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid var(--cb-border-subtle, rgba(255, 255, 255, 0.1))',
          textAlign: 'center',
          fontSize: '0.8125rem',
          opacity: 0.7,
        }}
        data-testid="public-passport-footer"
      >
        <p style={{ margin: '0 0 0.5rem 0' }}>
          Powered by <strong>CareerBridge Verified Career Passport</strong>.
        </p>
        <p style={{ margin: 0 }}>
          All skills and experiences displayed are verified and authenticated through the CareerBridge platform.
        </p>
      </footer>
    </div>
  );
};
