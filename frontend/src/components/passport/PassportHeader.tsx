import React from 'react';
import { PassportIdentity } from '@/types/passport';

export interface PassportHeaderProps {
  identity: PassportIdentity;
  isOwner?: boolean;
}

export const PassportHeader: React.FC<PassportHeaderProps> = ({ identity, isOwner }) => {
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

  return (
    <header className="cb-card cb-passport-header" data-testid="passport-header">
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

        <div className="cb-passport-identity-details">
          <div className="cb-passport-title-row">
            <h1 className="cb-passport-name" data-testid="passport-student-name">
              {identity.full_name || identity.email}
            </h1>
            {identity.is_verified && (
              <span
                className="cb-badge cb-badge-success"
                data-testid="passport-verified-badge"
                title="Account verified"
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
            <p className="cb-passport-academic" data-testid="passport-academic-info">
              {academicInfo}
            </p>
          )}

          {identity.bio && (
            <p className="cb-passport-bio" data-testid="passport-bio">
              {identity.bio}
            </p>
          )}

          <div className="cb-passport-links" data-testid="passport-links">
            {identity.github_url && (
              <a
                href={identity.github_url}
                target="_blank"
                rel="noopener noreferrer"
                className="cb-btn cb-btn-outline cb-btn-sm"
                aria-label={`GitHub profile of ${identity.full_name || 'student'}`}
                data-testid="passport-github-link"
              >
                GitHub
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
                LinkedIn
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
                Portfolio
              </a>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
