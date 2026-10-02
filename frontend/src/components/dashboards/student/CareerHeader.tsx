import React from 'react';
import { RefreshIcon, ShieldCheckIcon } from './StudentDashboardIcons';
import { PassportIdentity } from '@/types/passport';
import { User } from '@/types/auth';

interface CareerHeaderProps {
  user: User | null;
  identity?: PassportIdentity | null;
  onRefresh: () => void;
  isLoading?: boolean;
}

export const CareerHeader: React.FC<CareerHeaderProps> = ({
  user,
  identity,
  onRefresh,
  isLoading = false,
}) => {
  const displayName =
    identity?.full_name?.trim() ||
    user?.email?.split('@')[0] ||
    'Student';

  // Calculate qualitative profile readiness from real data
  const profileFieldsFilled = [
    Boolean(identity?.full_name),
    Boolean(identity?.degree || identity?.branch),
    Boolean(identity?.college),
    Boolean(identity?.bio),
  ].filter(Boolean).length;

  const getReadinessLabel = () => {
    if (profileFieldsFilled >= 4) return 'Comprehensive Profile';
    if (profileFieldsFilled >= 2) return 'Profile In Progress';
    return 'Profile Initialized';
  };

  return (
    <header className="cb-career-header" aria-labelledby="student-dashboard-heading">
      <div className="cb-career-header-main">
        <div className="cb-career-header-info">
          <div className="cb-career-header-greeting-row">
            <h1 id="student-dashboard-heading" className="cb-page-title cb-career-greeting">
              Student Dashboard <span className="cb-greeting-divider" aria-hidden="true">•</span> <span className="cb-greeting-sub">Welcome, <span className="cb-career-name">{displayName}</span></span>
            </h1>
            {user?.is_verified && (
              <span className="cb-verified-badge" title="Verified Account">
                <ShieldCheckIcon size={16} /> Verified
              </span>
            )}
          </div>
          <p className="cb-career-subhead">
            Build your career, one verified milestone at a time.
          </p>
          <div className="cb-career-readiness-pill">
            <span className="cb-career-readiness-dot" aria-hidden="true" />
            <span className="cb-career-readiness-text">Readiness: {getReadinessLabel()}</span>
          </div>
        </div>

        <div className="cb-career-header-actions">
          <button
            type="button"
            onClick={onRefresh}
            className="cb-btn cb-btn-secondary cb-btn-sm cb-refresh-btn"
            title="Refresh dashboard metrics"
            data-testid="refresh-student-dashboard-btn"
            disabled={isLoading}
          >
            <RefreshIcon size={14} className={isLoading ? 'cb-spin' : ''} />
            <span>↻ Refresh</span>
          </button>
        </div>
      </div>
    </header>
  );
};
