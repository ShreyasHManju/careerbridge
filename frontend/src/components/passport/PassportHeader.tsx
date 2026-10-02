import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { PassportIdentity } from '@/types/passport';

export interface PassportHeaderProps {
  identity: PassportIdentity;
  isOwner?: boolean;
}

export const PassportHeader: React.FC<PassportHeaderProps> = ({ identity, isOwner }) => {
  const [copiedToast, setCopiedToast] = useState<boolean>(false);

  const initials = identity.full_name
    ? identity.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : identity.email.substring(0, 2).toUpperCase();

  const academicInfo = [
    identity.degree,
    identity.branch,
    identity.college,
    identity.graduation_year ? `Class of ${identity.graduation_year}` : null,
  ]
    .filter(Boolean)
    .join(' • ');

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2500);
    }
  };

  return (
    <header className="cb-card cb-passport-header" data-testid="passport-header">
      {copiedToast && (
        <div
          className="cb-alert cb-alert-success"
          role="status"
          style={{ marginBottom: '1rem', padding: '0.5rem 1rem' }}
          data-testid="passport-copy-toast"
        >
          <span>✓ Profile link copied to clipboard!</span>
        </div>
      )}

      <div className="cb-passport-header-content">
        <div className="cb-passport-avatar-wrapper">
          {identity.profile_image_url ? (
            <img
              src={identity.profile_image_url}
              alt={identity.full_name ? `${identity.full_name}'s profile photo` : 'Student profile photo'}
              className="cb-passport-avatar"
              data-testid="passport-avatar-img"
            />
          ) : (
            <div
              className="cb-passport-avatar-placeholder"
              aria-label="Student initials avatar"
              data-testid="passport-avatar-placeholder"
            >
              {initials}
            </div>
          )}
        </div>

        <div className="cb-passport-identity-details" style={{ width: '100%' }}>
          <div
            className="cb-passport-title-row"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h1 className="cb-passport-name" data-testid="passport-student-name" style={{ margin: 0 }}>
                  {identity.full_name || identity.email}
                </h1>
                {identity.is_verified && (
                  <span
                    className="cb-badge cb-badge-success"
                    data-testid="passport-verified-badge"
                    title="Account verified by CareerBridge"
                  >
                    ✓ Verified Student
                  </span>
                )}
                {isOwner && (
                  <span
                    className="cb-badge cb-badge-info"
                    data-testid="passport-owner-badge"
                  >
                    Your Passport
                  </span>
                )}
              </div>

              {academicInfo && (
                <p className="cb-passport-academic" data-testid="passport-academic-info" style={{ marginTop: '0.25rem' }}>
                  {academicInfo}
                </p>
              )}
            </div>

            {/* Recruiter / Visitor CTAs */}
            <div className="cb-passport-header-actions" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="cb-btn cb-btn-secondary cb-btn-sm"
                onClick={handleCopyLink}
                data-testid="passport-share-btn"
                title="Copy public link to this student passport"
              >
                📋 Share Profile
              </button>

              {!isOwner ? (
                <Link
                  to="/app/messages"
                  className="cb-btn cb-btn-primary cb-btn-sm"
                  data-testid="passport-message-btn"
                >
                  💬 Message Candidate
                </Link>
              ) : (
                <Link
                  to="/app/student/profile"
                  className="cb-btn cb-btn-primary cb-btn-sm"
                  data-testid="passport-edit-profile-btn"
                >
                  ✏️ Edit Profile
                </Link>
              )}
            </div>
          </div>

          {identity.bio && (
            <p className="cb-passport-bio" data-testid="passport-bio" style={{ marginTop: '0.75rem' }}>
              {identity.bio}
            </p>
          )}

          <div className="cb-passport-links" data-testid="passport-links" style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {identity.github_url && (
              <a
                href={identity.github_url}
                target="_blank"
                rel="noopener noreferrer"
                className="cb-btn cb-btn-outline cb-btn-sm"
                aria-label={`GitHub profile of ${identity.full_name || 'student'}`}
                data-testid="passport-github-link"
              >
                GitHub ↗
              </a>
            )}
            {identity.linkedin_url && (
              <a
                href={identity.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="cb-btn cb-btn-outline cb-btn-sm"
                aria-label={`LinkedIn profile of ${identity.full_name || 'student'}`}
                data-testid="passport-linkedin-link"
              >
                LinkedIn ↗
              </a>
            )}
            {identity.portfolio_url && (
              <a
                href={identity.portfolio_url}
                target="_blank"
                rel="noopener noreferrer"
                className="cb-btn cb-btn-outline cb-btn-sm"
                aria-label={`Portfolio website of ${identity.full_name || 'student'}`}
                data-testid="passport-portfolio-link"
              >
                Portfolio ↗
              </a>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
