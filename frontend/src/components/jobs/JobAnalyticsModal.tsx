import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { JobPosting } from '@/types/job';
import { Application } from '@/types/application';

interface JobAnalyticsModalProps {
  isOpen: boolean;
  job: JobPosting | null;
  applications: Application[];
  onClose: () => void;
}

export const JobAnalyticsModal: React.FC<JobAnalyticsModalProps> = ({
  isOpen,
  job,
  applications,
  onClose,
}) => {
  // Handle keyboard Escape key dismissal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !job) {
    return null;
  }

  // Filter applications specifically for this job posting
  const jobApplications = applications.filter((app) => app.job_posting_id === job.id);
  const totalApps = jobApplications.length;

  const appliedCount = jobApplications.filter((a) => a.status === 'applied').length;
  const reviewingCount = jobApplications.filter((a) => a.status === 'reviewing').length;
  const shortlistedCount = jobApplications.filter((a) => a.status === 'shortlisted').length;
  const acceptedCount = jobApplications.filter((a) => a.status === 'accepted').length;
  const rejectedCount = jobApplications.filter((a) => a.status === 'rejected').length;

  // Funnel calculations
  const reviewedCount = totalApps - appliedCount;
  const reviewRate = totalApps > 0 ? Math.round((reviewedCount / totalApps) * 100) : 0;
  const shortlistRate = totalApps > 0 ? Math.round((shortlistedCount / totalApps) * 100) : 0;
  const acceptanceRate = totalApps > 0 ? Math.round((acceptedCount / totalApps) * 100) : 0;

  const formatSalary = (): string => {
    if (job.salary_min != null && job.salary_max != null) {
      return `$${job.salary_min.toLocaleString()} - $${job.salary_max.toLocaleString()}`;
    }
    if (job.salary_min != null) {
      return `From $${job.salary_min.toLocaleString()}`;
    }
    if (job.salary_max != null) {
      return `Up to $${job.salary_max.toLocaleString()}`;
    }
    return 'Not specified';
  };

  const formatDate = (dateString?: string | null): string => {
    if (!dateString) return 'None set';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const skillsList =
    job.structured_skills && job.structured_skills.length > 0
      ? job.structured_skills.map((s) => s.name)
      : job.skills
      ? job.skills.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

  return (
    <div
      className="cb-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      data-testid="job-analytics-modal-backdrop"
    >
      <div
        className="cb-modal-dialog cb-job-analytics-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-analytics-title"
        data-testid="job-analytics-modal"
        style={{ maxWidth: '750px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Modal Header */}
        <div className="cb-modal-header" style={{ borderBottom: '1px solid var(--cb-border, #e2e8f0)', paddingBottom: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span
                className={`cb-badge ${job.is_active ? 'cb-badge-active' : 'cb-badge-inactive'}`}
                style={{
                  backgroundColor: job.is_active ? '#ecfdf5' : '#f1f5f9',
                  color: job.is_active ? '#059669' : '#64748b',
                  border: `1px solid ${job.is_active ? '#a7f3d0' : '#cbd5e1'}`,
                  fontWeight: 600,
                  fontSize: '0.75rem',
                }}
              >
                {job.is_active ? 'Active Listing' : 'Inactive / Closed'}
              </span>
              <span className={`cb-badge cb-badge-opp cb-badge-${job.opportunity_type}`}>
                {job.opportunity_type === 'internship' ? 'Internship' : 'Job'}
              </span>
              <span className="cb-badge cb-badge-emp">
                {job.employment_type === 'full_time'
                  ? 'Full-time'
                  : job.employment_type === 'part_time'
                  ? 'Part-time'
                  : 'Contract'}
              </span>
            </div>
            <h2 id="job-analytics-title" className="cb-modal-title" style={{ fontSize: '1.35rem', margin: 0 }}>
              {job.title} — Analytics & Funnel
            </h2>
            <p style={{ margin: '0.25rem 0 0', color: 'var(--cb-text-muted, #64748b)', fontSize: '0.9rem' }}>
              {job.company_name} {job.location ? `• ${job.location}` : ''} {job.is_remote ? '• (Remote)' : ''}
            </p>
          </div>
          <button
            type="button"
            className="cb-modal-close-btn"
            onClick={onClose}
            aria-label="Close analytics modal"
            data-testid="close-job-analytics-btn"
          >
            &times;
          </button>
        </div>

        {/* Modal Body */}
        <div className="cb-modal-body" style={{ padding: '1.25rem 0' }}>
          {/* Top Metrics Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '0.75rem',
              marginBottom: '1.5rem',
            }}
          >
            <div
              className="cb-stat-card"
              style={{ padding: '0.85rem', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}
              data-testid="analytics-total-apps"
            >
              <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                Total Applicants
              </span>
              <span style={{ display: 'block', fontSize: '1.6rem', fontWeight: 700, color: '#0f172a' }}>
                {totalApps}
              </span>
            </div>

            <div
              className="cb-stat-card"
              style={{ padding: '0.85rem', textAlign: 'center', background: '#fefce8', borderRadius: '8px', border: '1px solid #fef08a' }}
              data-testid="analytics-awaiting-review"
            >
              <span style={{ display: 'block', fontSize: '0.75rem', color: '#854d0e', fontWeight: 600, textTransform: 'uppercase' }}>
                Awaiting Review
              </span>
              <span style={{ display: 'block', fontSize: '1.6rem', fontWeight: 700, color: '#ca8a04' }}>
                {appliedCount}
              </span>
            </div>

            <div
              className="cb-stat-card"
              style={{ padding: '0.85rem', textAlign: 'center', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}
              data-testid="analytics-shortlisted"
            >
              <span style={{ display: 'block', fontSize: '0.75rem', color: '#1e40af', fontWeight: 600, textTransform: 'uppercase' }}>
                Shortlisted
              </span>
              <span style={{ display: 'block', fontSize: '1.6rem', fontWeight: 700, color: '#2563eb' }}>
                {shortlistedCount}
              </span>
            </div>

            <div
              className="cb-stat-card"
              style={{ padding: '0.85rem', textAlign: 'center', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}
              data-testid="analytics-accepted"
            >
              <span style={{ display: 'block', fontSize: '0.75rem', color: '#166534', fontWeight: 600, textTransform: 'uppercase' }}>
                Accepted
              </span>
              <span style={{ display: 'block', fontSize: '1.6rem', fontWeight: 700, color: '#16a34a' }}>
                {acceptedCount}
              </span>
            </div>

            <div
              className="cb-stat-card"
              style={{ padding: '0.85rem', textAlign: 'center', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}
              data-testid="analytics-rejected"
            >
              <span style={{ display: 'block', fontSize: '0.75rem', color: '#991b1b', fontWeight: 600, textTransform: 'uppercase' }}>
                Rejected
              </span>
              <span style={{ display: 'block', fontSize: '1.6rem', fontWeight: 700, color: '#dc2626' }}>
                {rejectedCount}
              </span>
            </div>
          </div>

          {/* Funnel Progress & Breakdown */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '1.25rem',
              marginBottom: '1.5rem',
            }}
          >
            <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem', color: '#0f172a' }}>
              Candidate Hiring Funnel
            </h3>

            {totalApps === 0 ? (
              <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
                No candidate applications have been submitted for this posting yet. Share the listing or review job requirements to boost discoverability.
              </p>
            ) : (
              <div>
                {/* Visual conversion bars */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                      <span style={{ fontWeight: 500 }}>Applied (Initial Inflow)</span>
                      <span style={{ fontWeight: 600 }}>{totalApps} candidates (100%)</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: '100%', height: '100%', background: '#64748b' }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                      <span style={{ fontWeight: 500 }}>Reviewed (Under Active Evaluation)</span>
                      <span style={{ fontWeight: 600 }}>
                        {reviewedCount} candidates ({reviewRate}%) • {reviewingCount} actively reviewing
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${reviewRate}%`, height: '100%', background: '#ca8a04' }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                      <span style={{ fontWeight: 500 }}>Shortlisted for Interviews</span>
                      <span style={{ fontWeight: 600 }}>
                        {shortlistedCount} candidates ({shortlistRate}%)
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${shortlistRate}%`, height: '100%', background: '#2563eb' }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                      <span style={{ fontWeight: 500 }}>Final Hired / Accepted</span>
                      <span style={{ fontWeight: 600 }}>
                        {acceptedCount} candidates ({acceptanceRate}%)
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${acceptanceRate}%`, height: '100%', background: '#16a34a' }} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Job Specifications Summary */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '1.25rem',
            }}
          >
            <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.75rem', color: '#0f172a' }}>
              Posting Specifications & Terms
            </h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '0.75rem',
                fontSize: '0.875rem',
              }}
            >
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>COMPENSATION</span>
                <strong>{formatSalary()}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>APPLICATION DEADLINE</span>
                <strong>{formatDate(job.application_deadline)}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>POSTED DATE</span>
                <strong>{formatDate(job.created_at)}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>MINIMUM QUALIFICATION</span>
                <strong>{job.minimum_qualification || 'Not specified'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>EXPERIENCE REQUIRED</span>
                <strong>{job.experience_required || 'Not specified'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>LOCATION / WORK MODE</span>
                <strong>{job.location || 'Unspecified'} {job.is_remote ? '(Remote)' : ''}</strong>
              </div>
            </div>

            {skillsList.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', marginBottom: '0.35rem' }}>
                  REQUIRED SKILLS
                </span>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  {skillsList.map((skill, idx) => (
                    <span
                      key={idx}
                      className="cb-skill-tag"
                      style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div
          className="cb-modal-footer"
          style={{
            borderTop: '1px solid var(--cb-border, #e2e8f0)',
            paddingTop: '1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="cb-btn cb-btn-secondary"
            data-testid="close-analytics-footer-btn"
          >
            Close
          </button>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Link
              to={`/app/jobs/${job.id}`}
              className="cb-btn cb-btn-secondary"
              onClick={onClose}
            >
              View Public Page
            </Link>
            <Link
              to="/app/recruiter/applications"
              className="cb-btn cb-btn-primary"
              onClick={onClose}
              data-testid="analytics-review-apps-btn"
            >
              Review All Candidates ({totalApps}) →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
