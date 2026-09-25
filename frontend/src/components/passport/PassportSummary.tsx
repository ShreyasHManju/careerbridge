import React from 'react';
import { PassportSummary as PassportSummaryType } from '@/types/passport';

export interface PassportSummaryProps {
  summary: PassportSummaryType;
}

export const PassportSummary: React.FC<PassportSummaryProps> = ({ summary }) => {
  return (
    <section aria-label="Passport summary metrics" className="cb-passport-summary-section">
      <div className="cb-stats-bar cb-passport-stats" data-testid="passport-summary">
        <div className="cb-stat-pill" data-testid="stat-verified-experiences">
          <span className="cb-stat-num" data-testid="stat-count-experiences">
            {summary.verified_experiences_count}
          </span>
          <span className="cb-stat-lbl">Verified Experiences</span>
        </div>

        <div className="cb-stat-pill" data-testid="stat-public-projects">
          <span className="cb-stat-num" data-testid="stat-count-projects">
            {summary.public_projects_count}
          </span>
          <span className="cb-stat-lbl">Active Projects</span>
        </div>

        <div className="cb-stat-pill" data-testid="stat-canonical-skills">
          <span className="cb-stat-num" data-testid="stat-count-skills">
            {summary.canonical_skills_count}
          </span>
          <span className="cb-stat-lbl">Verified Skills</span>
        </div>

        <div className="cb-stat-pill" data-testid="stat-completed-milestones">
          <span className="cb-stat-num" data-testid="stat-count-milestones">
            {summary.completed_milestones_count}
          </span>
          <span className="cb-stat-lbl">Completed Milestones</span>
        </div>
      </div>
    </section>
  );
};
