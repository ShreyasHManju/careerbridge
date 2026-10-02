import React from 'react';
import { Link } from 'react-router-dom';
import { SparklesIcon, ArrowRightIcon } from './StudentDashboardIcons';

interface CareerInsightsCardProps {
  hasProjects?: boolean;
  hasExperiences?: boolean;
  hasSkills?: boolean;
}

export const CareerInsightsCard: React.FC<CareerInsightsCardProps> = ({
  hasProjects = false,
  hasExperiences = false,
  hasSkills = false,
}) => {
  return (
    <section className="cb-career-insights-section" aria-labelledby="career-insights-heading">
      <div className="cb-insights-card">
        <div className="cb-insights-header">
          <div className="cb-insights-title-row">
            <span className="cb-insights-icon-pill" aria-hidden="true">
              <SparklesIcon size={18} />
            </span>
            <h2 id="career-insights-heading" className="cb-insights-title">
              Career Insights & Guidance
            </h2>
          </div>
          <span className="cb-insights-status-badge">Future-Ready Intelligence</span>
        </div>

        <div className="cb-insights-body">
          <p className="cb-insights-description">
            Personalized career insights, skill-gap analysis, and tailored opportunity matching will activate as you build your profile, document skills, and record verified project artifacts.
          </p>

          <div className="cb-insights-readiness-checklist">
            <div className={`cb-checklist-item ${hasSkills ? 'cb-checked' : 'cb-pending'}`}>
              <span className="cb-checklist-bullet" aria-hidden="true">
                {hasSkills ? '✓' : '○'}
              </span>
              <span>Document technical & transferable skills</span>
            </div>
            <div className={`cb-checklist-item ${hasProjects ? 'cb-checked' : 'cb-pending'}`}>
              <span className="cb-checklist-bullet" aria-hidden="true">
                {hasProjects ? '✓' : '○'}
              </span>
              <span>Publish innovation project evidence</span>
            </div>
            <div className={`cb-checklist-item ${hasExperiences ? 'cb-checked' : 'cb-pending'}`}>
              <span className="cb-checklist-bullet" aria-hidden="true">
                {hasExperiences ? '✓' : '○'}
              </span>
              <span>Verify internship or leadership experiences</span>
            </div>
          </div>
        </div>

        <div className="cb-insights-footer">
          <Link to="/app/student/profile" className="cb-btn cb-btn-secondary cb-btn-sm cb-insights-action-btn">
            <span>Enhance Career Profile</span>
            <ArrowRightIcon size={14} />
          </Link>
        </div>
      </div>
    </section>
  );
};
