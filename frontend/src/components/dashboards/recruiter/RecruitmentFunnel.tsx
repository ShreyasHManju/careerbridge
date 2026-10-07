import React from 'react';
import { Link } from 'react-router-dom';
import { RecruiterDashboard } from '@/types/dashboard';
import { ArrowRightIcon } from './RecruiterDashboardIcons';

interface RecruitmentFunnelProps {
  dashboard: RecruiterDashboard;
}

export const RecruitmentFunnel: React.FC<RecruitmentFunnelProps> = ({ dashboard }) => {
  const totalApps = dashboard.total_applications;
  const reviewedApps = totalApps - dashboard.applications_awaiting_review;
  const reviewRate = totalApps > 0 ? Math.round((reviewedApps / totalApps) * 100) : 0;
  const shortlistRate = totalApps > 0 ? Math.round((dashboard.shortlisted_candidates / totalApps) * 100) : 0;
  const interviewRate = totalApps > 0 ? Math.round((dashboard.scheduled_interviews / totalApps) * 100) : 0;
  const offersExtended = dashboard.offers_extended ?? 0;
  const offersAccepted = dashboard.offers_accepted ?? 0;
  const offerRate = totalApps > 0 ? Math.round((offersExtended / totalApps) * 100) : 0;
  const hireRate = totalApps > 0 ? Math.round((offersAccepted / totalApps) * 100) : 0;

  return (
    <section
      className="cb-dashboard-funnel-section cb-recruiter-funnel-card"
      aria-labelledby="recruiter-funnel-heading"
      data-testid="recruiter-funnel-section"
    >
      <div className="cb-funnel-header">
        <div className="cb-funnel-title-group">
          <h2 id="recruiter-funnel-heading" className="cb-funnel-title">
            Candidate Conversion & Pipeline Funnel
          </h2>
          <p className="cb-funnel-subtitle">
            Real-time progression of candidates across your hiring stages.
          </p>
        </div>
        <Link to="/app/recruiter/jobs" className="cb-btn cb-btn-secondary cb-btn-sm cb-funnel-manage-btn">
          <span>Manage Postings</span>
          <ArrowRightIcon size={14} aria-hidden={true} />
        </Link>
      </div>

      {totalApps === 0 ? (
        <div className="cb-funnel-empty-state">
          <p className="cb-funnel-empty-text">
            No applications received yet. As candidates apply to your active listings, your hiring conversion funnel will populate automatically.
          </p>
        </div>
      ) : (
        <div className="cb-funnel-body">
          {/* Conversion Metrics Summary */}
          <div className="cb-conversion-stats-grid">
            <div className="cb-conversion-card cb-conversion-card-neutral">
              <span className="cb-conversion-label">Evaluation Rate</span>
              <span className="cb-conversion-value">{reviewRate}%</span>
              <span className="cb-conversion-subtext">
                {reviewedApps} of {totalApps} evaluated
              </span>
            </div>

            <div className="cb-conversion-card cb-conversion-card-primary">
              <span className="cb-conversion-label">Shortlist Rate</span>
              <span className="cb-conversion-value">{shortlistRate}%</span>
              <span className="cb-conversion-subtext">
                {dashboard.shortlisted_candidates} candidates shortlisted
              </span>
            </div>

            <div className="cb-conversion-card cb-conversion-card-success">
              <span className="cb-conversion-label">Interview Scheduling Rate</span>
              <span className="cb-conversion-value">{interviewRate}%</span>
              <span className="cb-conversion-subtext">
                {dashboard.scheduled_interviews} rounds coordinated
              </span>
            </div>
          </div>

          {/* Visual Funnel Bars */}
          <div className="cb-funnel-bars-container">
            {/* Stage 1: Received */}
            <div className="cb-funnel-bar-item">
              <div className="cb-funnel-bar-meta">
                <span className="cb-funnel-stage-name">1. Received Applications</span>
                <strong className="cb-funnel-stage-metric">{totalApps} (100%)</strong>
              </div>
              <div className="cb-funnel-track" role="progressbar" aria-valuenow={100} aria-valuemin={0} aria-valuemax={100}>
                <div className="cb-funnel-fill cb-funnel-fill-received" style={{ width: '100%' }} />
              </div>
            </div>

            {/* Stage 2: Under Review */}
            <div className="cb-funnel-bar-item">
              <div className="cb-funnel-bar-meta">
                <span className="cb-funnel-stage-name">2. Under Review / Evaluated</span>
                <strong className="cb-funnel-stage-metric">{reviewedApps} ({reviewRate}%)</strong>
              </div>
              <div className="cb-funnel-track" role="progressbar" aria-valuenow={reviewRate} aria-valuemin={0} aria-valuemax={100}>
                <div className="cb-funnel-fill cb-funnel-fill-review" style={{ width: `${reviewRate}%` }} />
              </div>
            </div>

            {/* Stage 3: Shortlisted */}
            <div className="cb-funnel-bar-item">
              <div className="cb-funnel-bar-meta">
                <span className="cb-funnel-stage-name">3. Shortlisted Candidates</span>
                <strong className="cb-funnel-stage-metric">{dashboard.shortlisted_candidates} ({shortlistRate}%)</strong>
              </div>
              <div className="cb-funnel-track" role="progressbar" aria-valuenow={shortlistRate} aria-valuemin={0} aria-valuemax={100}>
                <div className="cb-funnel-fill cb-funnel-fill-shortlisted" style={{ width: `${shortlistRate}%` }} />
              </div>
            </div>

            {/* Stage 4: Technical Interviews */}
            <div className="cb-funnel-bar-item">
              <div className="cb-funnel-bar-meta">
                <span className="cb-funnel-stage-name">4. Scheduled Technical Interviews</span>
                <strong className="cb-funnel-stage-metric">{dashboard.scheduled_interviews} ({interviewRate}%)</strong>
              </div>
              <div className="cb-funnel-track" role="progressbar" aria-valuenow={interviewRate} aria-valuemin={0} aria-valuemax={100}>
                <div className="cb-funnel-fill cb-funnel-fill-interview" style={{ width: `${interviewRate}%` }} />
              </div>
            </div>

            {/* Stage 5: Offers Extended */}
            <div className="cb-funnel-bar-item">
              <div className="cb-funnel-bar-meta">
                <span className="cb-funnel-stage-name">5. Offers Extended</span>
                <strong className="cb-funnel-stage-metric">{offersExtended} ({offerRate}%)</strong>
              </div>
              <div className="cb-funnel-track" role="progressbar" aria-valuenow={offerRate} aria-valuemin={0} aria-valuemax={100}>
                <div className="cb-funnel-fill cb-funnel-fill-shortlisted" style={{ width: `${offerRate}%` }} />
              </div>
            </div>

            {/* Stage 6: Accepted Hires */}
            <div className="cb-funnel-bar-item">
              <div className="cb-funnel-bar-meta">
                <span className="cb-funnel-stage-name">6. Accepted Hires</span>
                <strong className="cb-funnel-stage-metric">{offersAccepted} ({hireRate}%)</strong>
              </div>
              <div className="cb-funnel-track" role="progressbar" aria-valuenow={hireRate} aria-valuemin={0} aria-valuemax={100}>
                <div className="cb-funnel-fill cb-funnel-fill-success" style={{ width: `${hireRate}%` }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
