import React from 'react';
import { Link } from 'react-router-dom';
import { RecruiterDashboard } from '@/types/dashboard';
import {
  ClockIcon,
  CalendarIcon,
  BriefcaseIcon,
  UsersIcon,
  UserCheckIcon,
  ArrowRightIcon,
  AlertCircleIcon,
  SparklesIcon,
} from './RecruiterDashboardIcons';

interface HiringActionCenterProps {
  dashboard: RecruiterDashboard;
}

export const HiringActionCenter: React.FC<HiringActionCenterProps> = ({ dashboard }) => {
  const {
    active_internships,
    total_applications,
    applications_awaiting_review,
    shortlisted_candidates,
    scheduled_interviews,
  } = dashboard;

  return (
    <div className="cb-hiring-action-center">
      {/* Review Queue Spotlight Alert */}
      {applications_awaiting_review > 0 && (
        <div
          className="cb-alert cb-alert-info cb-dashboard-alert cb-recruiter-spotlight-card"
          role="status"
          data-testid="review-queue-spotlight"
        >
          <div className="cb-alert-content-with-action">
            <div className="cb-spotlight-message-group">
              <span className="cb-spotlight-icon-wrap" aria-hidden="true">
                <AlertCircleIcon size={20} />
              </span>
              <div>
                <strong>Action Required:</strong> You have{' '}
                <strong className="cb-spotlight-highlight">{applications_awaiting_review}</strong> candidate{' '}
                {applications_awaiting_review === 1 ? 'application' : 'applications'} awaiting initial review.
              </div>
            </div>
            <Link
              to="/app/recruiter/applications"
              className="cb-btn cb-btn-primary cb-btn-sm cb-spotlight-cta"
              data-testid="triage-review-queue-btn"
            >
              <span>Review Candidates</span>
              <ArrowRightIcon size={14} aria-hidden={true} />
            </Link>
          </div>
        </div>
      )}

      {/* Five Canonical Metric Cards */}
      <section aria-labelledby="recruiter-metrics-heading">
        <h2 id="recruiter-metrics-heading" className="cb-sr-only">
          Recruitment Funnel Metrics
        </h2>
        <div className="cb-stat-grid cb-recruiter-stat-grid">
          {/* 1. Active Internships */}
          <Link
            to="/app/recruiter/jobs"
            className="cb-stat-card cb-stat-success cb-stat-card-link"
            data-testid="metric-active-internships"
            aria-label="View active published postings"
          >
            <div className="cb-stat-card-top">
              <span className="cb-stat-label">Active Internships</span>
              <span className="cb-stat-icon-badge cb-stat-icon-success" aria-hidden="true">
                <BriefcaseIcon size={16} />
              </span>
            </div>
            <span className="cb-stat-value">{active_internships}</span>
            <span className="cb-stat-desc">Published open postings</span>
          </Link>

          {/* 2. Total Applications */}
          <Link
            to="/app/recruiter/applications"
            className="cb-stat-card cb-stat-card-link"
            data-testid="metric-total-applications"
            aria-label="View all received candidate submissions"
          >
            <div className="cb-stat-card-top">
              <span className="cb-stat-label">Total Applications</span>
              <span className="cb-stat-icon-badge cb-stat-icon-default" aria-hidden="true">
                <UsersIcon size={16} />
              </span>
            </div>
            <span className="cb-stat-value">{total_applications}</span>
            <span className="cb-stat-desc">Received candidate submissions</span>
          </Link>

          {/* 3. Applications Awaiting Review */}
          <Link
            to="/app/recruiter/applications?status=applied"
            className="cb-stat-card cb-stat-warning cb-stat-card-link"
            data-testid="metric-applications-awaiting-review"
            aria-label="View candidate submissions awaiting review"
          >
            <div className="cb-stat-card-top">
              <span className="cb-stat-label">Awaiting Review</span>
              <span className="cb-stat-icon-badge cb-stat-icon-warning" aria-hidden="true">
                <ClockIcon size={16} />
              </span>
            </div>
            <span className="cb-stat-value">{applications_awaiting_review}</span>
            <span className="cb-stat-desc">Pending initial evaluation</span>
          </Link>

          {/* 4. Shortlisted Candidates */}
          <Link
            to="/app/recruiter/applications?status=shortlisted"
            className="cb-stat-card cb-stat-info cb-stat-card-link"
            data-testid="metric-shortlisted-candidates"
            aria-label="View shortlisted candidates"
          >
            <div className="cb-stat-card-top">
              <span className="cb-stat-label">Shortlisted Candidates</span>
              <span className="cb-stat-icon-badge cb-stat-icon-info" aria-hidden="true">
                <UserCheckIcon size={16} />
              </span>
            </div>
            <span className="cb-stat-value">{shortlisted_candidates}</span>
            <span className="cb-stat-desc">Qualified for next rounds</span>
          </Link>

          {/* 5. Scheduled Interviews */}
          <Link
            to="/app/recruiter/interviews"
            className="cb-stat-card cb-stat-primary cb-stat-card-link"
            data-testid="metric-scheduled-interviews"
            aria-label="View scheduled upcoming interview rounds"
          >
            <div className="cb-stat-card-top">
              <span className="cb-stat-label">Scheduled Interviews</span>
              <span className="cb-stat-icon-badge cb-stat-icon-primary" aria-hidden="true">
                <CalendarIcon size={16} />
              </span>
            </div>
            <span className="cb-stat-value">{scheduled_interviews}</span>
            <span className="cb-stat-desc">Active upcoming rounds</span>
          </Link>

          {/* 6. Offers Extended */}
          <Link
            to="/app/recruiter/applications?status=offered"
            className="cb-stat-card cb-stat-card-link"
            data-testid="metric-offers-extended"
            aria-label="View extended candidate offers"
          >
            <div className="cb-stat-card-top">
              <span className="cb-stat-label">Offers Extended</span>
              <span className="cb-stat-icon-badge cb-stat-icon-default" aria-hidden="true">
                <BriefcaseIcon size={16} />
              </span>
            </div>
            <span className="cb-stat-value">{dashboard.offers_extended ?? 0}</span>
            <span className="cb-stat-desc">Official candidate offers</span>
          </Link>

          {/* 7. Offers Accepted (Hires) */}
          <Link
            to="/app/recruiter/applications?status=accepted"
            className="cb-stat-card cb-stat-success cb-stat-card-link"
            data-testid="metric-offers-accepted"
            aria-label="View accepted offers and hires"
          >
            <div className="cb-stat-card-top">
              <span className="cb-stat-label">Offers Accepted</span>
              <span className="cb-stat-icon-badge cb-stat-icon-success" aria-hidden="true">
                <UserCheckIcon size={16} />
              </span>
            </div>
            <span className="cb-stat-value">{dashboard.offers_accepted ?? 0}</span>
            <span className="cb-stat-desc">Successful candidate hires</span>
          </Link>

          {/* 8. Pending Offer Decisions */}
          <Link
            to="/app/recruiter/applications?status=offered"
            className="cb-stat-card cb-stat-warning cb-stat-card-link"
            data-testid="metric-pending-offer-decisions"
            aria-label="View offers awaiting candidate decision"
          >
            <div className="cb-stat-card-top">
              <span className="cb-stat-label">Pending Decisions</span>
              <span className="cb-stat-icon-badge cb-stat-icon-warning" aria-hidden="true">
                <ClockIcon size={16} />
              </span>
            </div>
            <span className="cb-stat-value">{dashboard.pending_offer_decisions ?? 0}</span>
            <span className="cb-stat-desc">Awaiting student decision</span>
          </Link>

          {/* 9. Evaluations Completed */}
          <Link
            to="/app/recruiter/applications"
            className="cb-stat-card cb-stat-info cb-stat-card-link"
            data-testid="metric-evaluations-completed"
            aria-label="View completed candidate evaluations"
          >
            <div className="cb-stat-card-top">
              <span className="cb-stat-label">Evaluations Done</span>
              <span className="cb-stat-icon-badge cb-stat-icon-info" aria-hidden="true">
                <UsersIcon size={16} />
              </span>
            </div>
            <span className="cb-stat-value">{dashboard.evaluations_completed ?? 0}</span>
            <span className="cb-stat-desc">Scorecards submitted</span>
          </Link>

          {/* 10. Hire Conversion Rate */}
          <div className="cb-stat-card cb-stat-primary" data-testid="metric-hire-conversion-rate">
            <div className="cb-stat-card-top">
              <span className="cb-stat-label">Hire Conversion</span>
              <span className="cb-stat-icon-badge cb-stat-icon-primary" aria-hidden="true">
                <SparklesIcon size={16} />
              </span>
            </div>
            <span className="cb-stat-value">{(dashboard.hire_conversion_rate ?? 0).toFixed(1)}%</span>
            <span className="cb-stat-desc">Applications to hires</span>
          </div>
        </div>
      </section>

      {/* Prioritized Operational Hiring Actions */}
      <section className="cb-priority-actions-section" aria-labelledby="priority-actions-heading">
        <div className="cb-section-header-compact">
          <h2 id="priority-actions-heading" className="cb-section-title-sm">
            Recommended Hiring Actions
          </h2>
          <span className="cb-section-hint">Prioritized operational steps based on live candidate queue</span>
        </div>

        <div className="cb-action-cards-deck">
          {/* Action 1: Triage Pending Candidates */}
          <div className="cb-priority-action-card">
            <div className="cb-priority-action-badge cb-badge-urgent">
              {applications_awaiting_review > 0 ? 'Action Required' : 'Up to Date'}
            </div>
            <div className="cb-priority-action-content">
              <h3 className="cb-priority-action-title">Candidate Evaluation Queue</h3>
              <p className="cb-priority-action-desc">
                {applications_awaiting_review > 0
                  ? `${applications_awaiting_review} unreviewed ${
                      applications_awaiting_review === 1 ? 'applicant needs' : 'applicants need'
                    } portfolio, project rubric, and resume evaluation.`
                  : 'All candidate submissions have been reviewed. Ready for new applications.'}
              </p>
            </div>
            <Link
              to={applications_awaiting_review > 0 ? '/app/recruiter/applications?status=applied' : '/app/recruiter/applications'}
              className="cb-priority-action-btn"
            >
              <span>{applications_awaiting_review > 0 ? 'Triage Queue' : 'View Applications'}</span>
              <ArrowRightIcon size={14} aria-hidden={true} />
            </Link>
          </div>

          {/* Action 2: Coordinate Scheduled Interviews */}
          <div className="cb-priority-action-card">
            <div className="cb-priority-action-badge cb-badge-neutral">
              {scheduled_interviews > 0 ? `${scheduled_interviews} Active` : 'No Scheduled Rounds'}
            </div>
            <div className="cb-priority-action-content">
              <h3 className="cb-priority-action-title">Technical Interview Operations</h3>
              <p className="cb-priority-action-desc">
                {scheduled_interviews > 0
                  ? `Review meeting links, notes, and preparation for ${scheduled_interviews} scheduled technical ${
                      scheduled_interviews === 1 ? 'round' : 'rounds'
                    }.`
                  : 'Coordinate with shortlisted candidates to schedule initial screening and technical interviews.'}
              </p>
            </div>
            <Link to="/app/recruiter/interviews" className="cb-priority-action-btn">
              <span>Interview Schedule</span>
              <ArrowRightIcon size={14} aria-hidden={true} />
            </Link>
          </div>

          {/* Action 3: Sourcing & Active Opportunities */}
          <div className="cb-priority-action-card">
            <div className="cb-priority-action-badge cb-badge-highlight">
              <SparklesIcon size={12} aria-hidden={true} />
              <span>Talent Sourcing</span>
            </div>
            <div className="cb-priority-action-content">
              <h3 className="cb-priority-action-title">Verified Talent Discovery</h3>
              <p className="cb-priority-action-desc">
                Discover pre-verified candidates with Experience Passports, validated skills, and public GitHub projects.
              </p>
            </div>
            <Link to="/app/recruiter/candidates" className="cb-priority-action-btn">
              <span>Search Talent</span>
              <ArrowRightIcon size={14} aria-hidden={true} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
