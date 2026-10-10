import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Application, ApplicationStatus } from '@/types/application';
import { JobPosting } from '@/types/job';
import { PassportResponse, PassportProjectItem } from '@/types/passport';
import { Interview } from '@/types/interview';
import { InnovationProject, ProjectType, ProjectStatus, ProjectVisibility } from '@/types/innovationProject';
import { ProjectEvaluation, ProjectEvaluationCreate, ProjectEvaluationUpdate } from '@/types/projectEvaluation';
import { getStudentPassport } from '@/api/passport';
import { getRecruiterInterviews, cancelInterview, updateInterview } from '@/api/interviews';
import {
  createProjectEvaluation,
  updateProjectEvaluation,
  submitProjectEvaluation,
  getProjectEvaluations,
} from '@/api/projectEvaluations';
import { ApplicationStatusBadge } from './ApplicationStatusBadge';
import { InterviewStatusBadge } from '@/components/interviews/InterviewStatusBadge';
import { ProjectEvaluationModal } from '@/components/evaluations/ProjectEvaluationModal';
import { ScheduleInterviewModal } from '@/components/interviews/ScheduleInterviewModal';
import { RescheduleInterviewModal } from '@/components/interviews/RescheduleInterviewModal';
import { ApiErrorResponse } from '@/types/api';
import { CandidateEvaluationPanel } from './CandidateEvaluationPanel';

interface CandidateReviewModalProps {
  isOpen: boolean;
  application: Application | null;
  job?: JobPosting | null;
  onClose: () => void;
  onStatusChange: (applicationId: number, newStatus: ApplicationStatus) => Promise<void>;
  onScheduleInterview?: (application: Application, job: JobPosting | null) => void;
  isUpdating?: boolean;
}

type ReviewTab = 'application' | 'skills' | 'projects' | 'interviews' | 'evaluation';

const PIPELINE_STEPS: { key: string; label: string }[] = [
  { key: 'applied', label: 'Applied' },
  { key: 'reviewing', label: 'Reviewing' },
  { key: 'shortlisted', label: 'Shortlisted' },
  { key: 'interview_scheduled', label: 'Interview Scheduled' },
  { key: 'accepted', label: 'Accepted' },
];

const formatDateTime = (isoString: string): string => {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
};

const formatDateOnly = (isoString: string): string => {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return isoString;
  }
};

export const CandidateReviewModal: React.FC<CandidateReviewModalProps> = ({
  isOpen,
  application,
  job,
  onClose,
  onStatusChange,
  onScheduleInterview,
  isUpdating = false,
}) => {
  const [activeTab, setActiveTab] = useState<ReviewTab>('application');
  const [passport, setPassport] = useState<PassportResponse | null>(null);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [dataError, setDataError] = useState<string | null>(null);

  const [currentStatus, setCurrentStatus] = useState<ApplicationStatus>(
    application?.status || 'applied'
  );
  const [isMutatingStatus, setIsMutatingStatus] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [showRejectConfirm, setShowRejectConfirm] = useState<boolean>(false);

  // Direct Project Evaluation modal state
  const [evaluatingProject, setEvaluatingProject] = useState<PassportProjectItem | null>(null);
  const [editingEvaluation, setEditingEvaluation] = useState<ProjectEvaluation | null>(null);
  const [isEvaluationModalOpen, setIsEvaluationModalOpen] = useState<boolean>(false);
  const [isEvaluationSaving, setIsEvaluationSaving] = useState<boolean>(false);

  // Direct Interview management modal state
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState<boolean>(false);
  const [reschedulingInterview, setReschedulingInterview] = useState<Interview | null>(null);
  const [isInterviewMutating, setIsInterviewMutating] = useState<boolean>(false);

  // Load Passport & Interview history for candidate
  const loadCandidateData = useCallback(async (studentId: number, appId: number) => {
    setIsLoadingData(true);
    setDataError(null);
    try {
      const [passportData, allInterviews] = await Promise.all([
        getStudentPassport(studentId).catch((err) => {
          const apiErr = err as ApiErrorResponse;
          setDataError(
            typeof apiErr?.detail === 'string'
              ? apiErr.detail
              : apiErr?.message || 'Failed to load candidate Experience Passport.'
          );
          return null;
        }),
        getRecruiterInterviews().catch(() => [] as Interview[]),
      ]);

      if (passportData) {
        setPassport(passportData);
      }
      // Filter interviews specifically matching this application or student
      const matchedInterviews = (allInterviews || []).filter(
        (i) => i.application_id === appId || i.student_id === studentId
      );
      setInterviews(matchedInterviews);
    } catch (err) {
      const apiErr = err as ApiErrorResponse;
      setDataError(apiErr?.message || 'Failed to load candidate information.');
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && application) {
      setActiveTab('application');
      setCurrentStatus(application.status);
      setActionError(null);
      setActionSuccess(null);
      setShowRejectConfirm(false);
      setEvaluatingProject(null);
      setEditingEvaluation(null);
      setIsEvaluationModalOpen(false);
      setIsScheduleModalOpen(false);
      setReschedulingInterview(null);
      loadCandidateData(application.student_id, application.id);
    } else {
      setPassport(null);
      setInterviews([]);
    }
  }, [isOpen, application, loadCandidateData]);

  // Handle Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (isEvaluationModalOpen) {
          setIsEvaluationModalOpen(false);
          setEvaluatingProject(null);
          setEditingEvaluation(null);
        } else if (isScheduleModalOpen) {
          setIsScheduleModalOpen(false);
        } else if (reschedulingInterview) {
          setReschedulingInterview(null);
        } else if (showRejectConfirm) {
          setShowRejectConfirm(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isEvaluationModalOpen, isScheduleModalOpen, reschedulingInterview, showRejectConfirm, onClose]);

  if (!isOpen || !application) return null;

  const candidateIdentity = passport?.identity;
  const candidateName = candidateIdentity?.full_name || `Candidate #${application.student_id}`;
  const candidateEmail = candidateIdentity?.email || 'Student Applicant';
  const jobTitle = job?.title || `Job Opportunity #${application.job_posting_id}`;
  const companyName = job?.company_name || 'Your Organization';

  const handleStatusTransition = async (newStatus: ApplicationStatus) => {
    if (isMutatingStatus || isUpdating) return;
    setIsMutatingStatus(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await onStatusChange(application.id, newStatus);
      setCurrentStatus(newStatus);
      setActionSuccess(`Application status successfully updated to "${newStatus}".`);
      setShowRejectConfirm(false);
    } catch (err) {
      const apiErr = err as ApiErrorResponse;
      setActionError(apiErr?.message || 'Failed to update application status.');
    } finally {
      setIsMutatingStatus(false);
    }
  };

  const handleScheduleClick = () => {
    setIsScheduleModalOpen(true);
    if (onScheduleInterview && application) {
      // Optional callback hook for parent components if needed
    }
  };

  const handleScheduleSuccess = async (newInterview: Interview) => {
    setIsScheduleModalOpen(false);
    setActionSuccess(`Interview scheduled successfully for ${formatDateTime(newInterview.scheduled_at)}.`);
    if (application) {
      await loadCandidateData(application.student_id, application.id);
    }
  };

  const handleRescheduleSuccess = async (updated: Interview) => {
    setReschedulingInterview(null);
    setActionSuccess(`Interview rescheduled successfully to ${formatDateTime(updated.scheduled_at)}.`);
    if (application) {
      await loadCandidateData(application.student_id, application.id);
    }
  };

  const handleCancelInterview = async (interviewId: number) => {
    setIsInterviewMutating(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await cancelInterview(interviewId);
      setActionSuccess('Interview cancelled successfully.');
      if (application) {
        await loadCandidateData(application.student_id, application.id);
      }
    } catch (err) {
      const apiErr = err as ApiErrorResponse;
      setActionError(apiErr?.message || 'Failed to cancel interview.');
    } finally {
      setIsInterviewMutating(false);
    }
  };

  const handleCompleteInterview = async (interviewId: number) => {
    setIsInterviewMutating(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await updateInterview(interviewId, { status: 'completed' });
      setActionSuccess('Interview marked as completed.');
      if (application) {
        await loadCandidateData(application.student_id, application.id);
      }
    } catch (err) {
      const apiErr = err as ApiErrorResponse;
      setActionError(apiErr?.message || 'Failed to update interview.');
    } finally {
      setIsInterviewMutating(false);
    }
  };

  const handleOpenEvaluateProject = async (proj: PassportProjectItem) => {
    setEvaluatingProject(proj);
    setEditingEvaluation(null);
    setIsEvaluationModalOpen(true);
    try {
      const evals = await getProjectEvaluations(proj.id);
      if (evals && evals.length > 0) {
        setEditingEvaluation(evals[0]);
      }
    } catch {
      // Form opens cleanly if no existing evaluations
    }
  };

  const handleSaveEvaluation = async (
    payload: ProjectEvaluationCreate,
    submitImmediately = false
  ) => {
    if (!evaluatingProject) return;
    setIsEvaluationSaving(true);
    setActionError(null);
    try {
      let savedEval: ProjectEvaluation;
      if (editingEvaluation) {
        savedEval = await updateProjectEvaluation(
          editingEvaluation.id,
          payload as ProjectEvaluationUpdate
        );
      } else {
        savedEval = await createProjectEvaluation(evaluatingProject.id, payload);
      }
      if (submitImmediately && savedEval.status === 'draft') {
        await submitProjectEvaluation(savedEval.id);
      }
      setActionSuccess(
        submitImmediately
          ? `Project evaluation for "${evaluatingProject.title}" submitted successfully!`
          : `Project evaluation for "${evaluatingProject.title}" saved as draft.`
      );
      setIsEvaluationModalOpen(false);
      setEvaluatingProject(null);
      setEditingEvaluation(null);
      if (application) {
        await loadCandidateData(application.student_id, application.id);
      }
    } catch (err) {
      const apiErr = err as ApiErrorResponse;
      setActionError(apiErr?.message || 'Failed to save project evaluation.');
      throw err;
    } finally {
      setIsEvaluationSaving(false);
    }
  };

  // Convert evaluating project to InnovationProject shape for ProjectEvaluationModal
  const evaluatingInnovationProject: InnovationProject | null = evaluatingProject
    ? {
        id: evaluatingProject.id,
        student_id: application.student_id,
        title: evaluatingProject.title,
        slug: evaluatingProject.slug || '',
        short_description: evaluatingProject.short_description || null,
        description: evaluatingProject.description,
        project_type: (evaluatingProject.project_type || 'software') as ProjectType,
        status: (evaluatingProject.status || 'active') as ProjectStatus,
        visibility: (evaluatingProject.visibility || 'public') as ProjectVisibility,
        repository_url: evaluatingProject.repository_url || null,
        live_demo_url: evaluatingProject.live_demo_url || null,
        skills: evaluatingProject.skills || null,
        structured_skills: evaluatingProject.structured_skills || [],
        created_at: '',
        updated_at: '',
      }
    : null;

  // Determine active pipeline index
  const getPipelineIndex = (status: ApplicationStatus, hasInterview: boolean): number => {
    if (status === 'accepted') return 4;
    if (status === 'rejected') return -1; // special case
    if (hasInterview) return 3;
    if (status === 'shortlisted') return 2;
    if (status === 'reviewing') return 1;
    return 0;
  };

  const hasScheduledInterview = interviews.some(
    (i) => i.status === 'scheduled' || i.status === 'rescheduled'
  );
  const currentPipelineIdx = getPipelineIndex(currentStatus, hasScheduledInterview);

  return (
    <div className="cb-modal-backdrop" role="presentation">
      <div
        className="cb-modal cb-modal-xl cb-candidate-review-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="candidate-review-title"
        data-testid={`candidate-review-modal-${application.id}`}
      >
        {/* MODAL HEADER */}
        <header className="cb-modal-header cb-candidate-review-header">
          <div className="cb-candidate-header-profile">
            <div className="cb-candidate-avatar-wrapper">
              {candidateIdentity?.profile_image_url ? (
                <img
                  src={candidateIdentity.profile_image_url}
                  alt={candidateName}
                  className="cb-candidate-avatar-img"
                />
              ) : (
                <div className="cb-candidate-avatar-fallback">
                  {candidateName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <div className="cb-candidate-header-meta">
              <div className="cb-candidate-title-row">
                <h2 id="candidate-review-title" className="cb-candidate-name">
                  {candidateName}
                </h2>
                {candidateIdentity?.is_verified && (
                  <span className="cb-verified-badge" title="Verified Candidate Account">
                    ✓ Verified
                  </span>
                )}
                <ApplicationStatusBadge status={application.status} />
              </div>

              <div className="cb-candidate-subtitle-row">
                <span className="cb-candidate-email">✉️ {candidateEmail}</span>
                {candidateIdentity?.college && (
                  <span className="cb-candidate-academic">
                    🏛️ {candidateIdentity.college}
                    {candidateIdentity.degree ? ` • ${candidateIdentity.degree}` : ''}
                    {candidateIdentity.graduation_year ? ` ('${candidateIdentity.graduation_year.toString().slice(-2)})` : ''}
                  </span>
                )}
              </div>

              <div className="cb-candidate-job-banner">
                <span className="cb-candidate-applied-label">Applied for:</span>
                <strong className="cb-candidate-job-name">{jobTitle}</strong>
                <span className="cb-candidate-company-name">({companyName})</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="cb-modal-close"
            onClick={onClose}
            aria-label="Close candidate review"
            data-testid="close-candidate-review-modal"
          >
            ×
          </button>
        </header>

        {/* FEEDBACK ALERTS */}
        {actionSuccess && (
          <div className="cb-alert cb-alert-success cb-modal-alert" role="status" data-testid="review-action-success">
            {actionSuccess}
          </div>
        )}
        {actionError && (
          <div className="cb-alert cb-alert-danger cb-modal-alert" role="alert" data-testid="review-action-error">
            {actionError}
          </div>
        )}

        {/* HIRING PIPELINE PROGRESS */}
        <div className="cb-pipeline-tracker" data-testid="candidate-pipeline-tracker">
          {application.status === 'rejected' ? (
            <div className="cb-pipeline-rejected-banner">
              <span className="cb-pipeline-rejected-icon">🚫</span>
              <span>Application has been marked as <strong>Rejected</strong></span>
            </div>
          ) : (
            <ol className="cb-pipeline-steps">
              {PIPELINE_STEPS.map((step, idx) => {
                const isPassed = idx < currentPipelineIdx;
                const isCurrent = idx === currentPipelineIdx;
                return (
                  <li
                    key={step.key}
                    className={`cb-pipeline-step ${isPassed ? 'cb-step-passed' : ''} ${isCurrent ? 'cb-step-current' : ''}`}
                  >
                    <span className="cb-step-bubble">{isPassed ? '✓' : idx + 1}</span>
                    <span className="cb-step-label">{step.label}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {/* TABS NAVIGATION */}
        <nav className="cb-review-tabs-bar" role="tablist" aria-label="Candidate review tabs">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'application'}
            className={`cb-review-tab ${activeTab === 'application' ? 'active' : ''}`}
            onClick={() => setActiveTab('application')}
            data-testid="tab-application"
          >
            📄 Application & Cover Note
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'skills'}
            className={`cb-review-tab ${activeTab === 'skills' ? 'active' : ''}`}
            onClick={() => setActiveTab('skills')}
            data-testid="tab-skills"
          >
            🎯 Skills & Experience {passport?.skills?.length ? `(${passport.skills.length})` : ''}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'projects'}
            className={`cb-review-tab ${activeTab === 'projects' ? 'active' : ''}`}
            onClick={() => setActiveTab('projects')}
            data-testid="tab-projects"
          >
            🚀 Projects & Evidence {passport?.projects?.length ? `(${passport.projects.length})` : ''}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'interviews'}
            className={`cb-review-tab ${activeTab === 'interviews' ? 'active' : ''}`}
            onClick={() => setActiveTab('interviews')}
            data-testid="tab-interviews"
          >
            📅 Interviews {interviews.length ? `(${interviews.length})` : ''}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'evaluation'}
            className={`cb-review-tab ${activeTab === 'evaluation' ? 'active' : ''}`}
            onClick={() => setActiveTab('evaluation')}
            data-testid="tab-candidate-evaluation"
          >
            ⭐ Scorecard
          </button>
        </nav>

        {/* MODAL BODY */}
        <div className="cb-modal-body cb-candidate-review-body">
          {isLoadingData ? (
            <div className="cb-loading-container" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
              <div className="cb-spinner" />
              <p style={{ marginTop: '0.75rem', color: '#64748b' }}>
                Loading candidate Experience Passport and background...
              </p>
            </div>
          ) : dataError ? (
            <div className="cb-alert cb-alert-danger" role="alert">
              <span>{dataError}</span>
            </div>
          ) : (
            <>
              {/* TAB A: APPLICATION & COVER NOTE */}
              {activeTab === 'application' && (
                <div className="cb-review-section" data-testid="section-application">
                  <div className="cb-review-summary-grid">
                    <div className="cb-summary-item">
                      <span className="cb-summary-label">Applied Date</span>
                      <strong className="cb-summary-value">{formatDateOnly(application.created_at)}</strong>
                    </div>
                    <div className="cb-summary-item">
                      <span className="cb-summary-label">Application Status</span>
                      <div className="cb-summary-value" style={{ marginTop: '0.25rem' }}>
                        <ApplicationStatusBadge status={application.status} />
                      </div>
                    </div>
                    <div className="cb-summary-item">
                      <span className="cb-summary-label">Opportunity Type</span>
                      <strong className="cb-summary-value">
                        {job?.opportunity_type ? job.opportunity_type.toUpperCase() : 'JOB'}
                      </strong>
                    </div>
                    <div className="cb-summary-item">
                      <span className="cb-summary-label">Location / Mode</span>
                      <strong className="cb-summary-value">
                        {job?.is_remote ? '🌐 Remote' : job?.location || 'On-site'}
                      </strong>
                    </div>
                  </div>

                  {/* Candidate Bio / Overview if present */}
                  {candidateIdentity?.bio && (
                    <div className="cb-card-inner-box" style={{ marginTop: '1.25rem' }}>
                      <h4 className="cb-inner-box-title">Candidate Profile Bio</h4>
                      <p style={{ fontSize: '0.875rem', color: '#334155', lineHeight: 1.6, margin: 0 }}>
                        {candidateIdentity.bio}
                      </p>
                    </div>
                  )}

                  {/* Cover Note Section */}
                  <div className="cb-card-inner-box" style={{ marginTop: '1.25rem' }}>
                    <h4 className="cb-inner-box-title">Candidate Cover Message</h4>
                    {application.cover_message ? (
                      <p
                        className="cb-cover-message-text"
                        style={{ whiteSpace: 'pre-line', color: '#1e293b', fontSize: '0.9375rem', lineHeight: 1.6 }}
                      >
                        {application.cover_message}
                      </p>
                    ) : (
                      <p style={{ fontStyle: 'italic', color: '#94a3b8', margin: 0 }}>
                        No cover message was submitted with this application.
                      </p>
                    )}
                  </div>

                  {/* Relevant Job Information */}
                  {job && (
                    <div className="cb-card-inner-box" style={{ marginTop: '1.25rem' }}>
                      <h4 className="cb-inner-box-title">Applied Job Opportunity Details</h4>
                      {job.description && (
                        <p style={{ fontSize: '0.875rem', color: '#334155', lineHeight: 1.6, margin: '0 0 0.75rem 0' }}>
                          {job.description}
                        </p>
                      )}
                      <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.8125rem', color: '#64748b' }}>
                        {job.minimum_qualification && (
                          <span>🎓 Qualification: <strong>{job.minimum_qualification}</strong></span>
                        )}
                        {job.experience_required && (
                          <span>⏳ Experience: <strong>{job.experience_required}</strong></span>
                        )}
                        {job.skills && (
                          <span>🎯 Required Skills: <strong>{job.skills}</strong></span>
                        )}
                        {job.salary_min && job.salary_max && (
                          <span>💰 Salary: <strong>${job.salary_min.toLocaleString()} – ${job.salary_max.toLocaleString()}</strong></span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Candidate Links Row */}
                  {(candidateIdentity?.github_url || candidateIdentity?.linkedin_url || candidateIdentity?.portfolio_url) && (
                    <div className="cb-card-inner-box" style={{ marginTop: '1.25rem' }}>
                      <h4 className="cb-inner-box-title">Candidate Web Links & Portfolio</h4>
                      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        {candidateIdentity.github_url && (
                          <a
                            href={candidateIdentity.github_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="cb-btn cb-btn-outline cb-btn-sm"
                          >
                            💻 GitHub Profile ↗
                          </a>
                        )}
                        {candidateIdentity.linkedin_url && (
                          <a
                            href={candidateIdentity.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="cb-btn cb-btn-outline cb-btn-sm"
                          >
                            🔗 LinkedIn Profile ↗
                          </a>
                        )}
                        {candidateIdentity.portfolio_url && (
                          <a
                            href={candidateIdentity.portfolio_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="cb-btn cb-btn-outline cb-btn-sm"
                          >
                            🌐 Portfolio Website ↗
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB B: SKILLS & EXPERIENCE */}
              {activeTab === 'skills' && (
                <div className="cb-review-section" data-testid="section-skills">
                  {/* Verified Skills */}
                  <div className="cb-card-inner-box">
                    <h4 className="cb-inner-box-title">
                      Verified Skills {passport?.skills?.length ? `(${passport.skills.length})` : ''}
                    </h4>
                    {passport?.skills && passport.skills.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                        {passport.skills.map((skill) => (
                          <span
                            key={skill.id}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              background: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              fontSize: '0.8125rem',
                              fontWeight: 600,
                              color: '#1e293b',
                            }}
                          >
                            <span>✓</span> {skill.name}
                            {skill.sources && skill.sources.length > 0 && (
                              <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 400 }}>
                                ({skill.sources.join(', ')})
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: 0 }}>
                        No verified skills on record yet.
                      </p>
                    )}
                  </div>

                  {/* Verified Experiences */}
                  <div className="cb-card-inner-box" style={{ marginTop: '1.25rem' }}>
                    <h4 className="cb-inner-box-title">
                      Verified Experiences {passport?.verified_experiences?.length ? `(${passport.verified_experiences.length})` : ''}
                    </h4>
                    {passport?.verified_experiences && passport.verified_experiences.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
                        {passport.verified_experiences.map((exp) => (
                          <div
                            key={exp.id}
                            style={{
                              padding: '1rem',
                              background: '#f8fafc',
                              borderRadius: '8px',
                              border: '1px solid #e2e8f0',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div>
                                <strong style={{ fontSize: '0.9375rem', color: '#0f172a' }}>{exp.title}</strong>
                                <span style={{ display: 'block', fontSize: '0.8125rem', color: '#475569' }}>
                                  {exp.organization_name || 'Organization'} • {exp.experience_type}
                                </span>
                              </div>
                              <span
                                style={{
                                  fontSize: '0.75rem',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  background: '#dcfce7',
                                  color: '#166534',
                                  fontWeight: 600,
                                }}
                              >
                                ✓ {exp.status}
                              </span>
                            </div>
                            <p style={{ fontSize: '0.875rem', color: '#334155', margin: '0.5rem 0 0 0', lineHeight: 1.5 }}>
                              {exp.description}
                            </p>
                            <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>
                              📅 {exp.start_date} – {exp.is_current ? 'Present' : exp.end_date || 'N/A'}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: 0 }}>
                        No verified experience records added yet.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* TAB C: PROJECTS & EVIDENCE */}
              {activeTab === 'projects' && (
                <div className="cb-review-section" data-testid="section-projects">
                  {passport?.projects && passport.projects.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      {passport.projects.map((proj) => (
                        <div
                          key={proj.id}
                          className="cb-card-inner-box"
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <h4 style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a', margin: '0 0 0.25rem 0' }}>
                                {proj.title}
                              </h4>
                              <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>
                                {proj.project_type} • {proj.status}
                              </span>
                            </div>
                            {proj.average_evaluation_score && (
                              <span
                                style={{
                                  fontSize: '0.8125rem',
                                  fontWeight: 700,
                                  background: '#eff6ff',
                                  color: '#1d4ed8',
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #bfdbfe',
                                }}
                              >
                                ⭐ Score: {proj.average_evaluation_score}/5
                              </span>
                            )}
                          </div>

                          <p style={{ fontSize: '0.875rem', color: '#334155', margin: '0.75rem 0', lineHeight: 1.5 }}>
                            {proj.description}
                          </p>

                          {/* Milestones & Progress */}
                          <div style={{ margin: '0.75rem 0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', marginBottom: '4px' }}>
                              <span>Milestone Progress ({proj.completed_milestones}/{proj.total_milestones})</span>
                              <span>{Math.round(proj.progress_percentage)}%</span>
                            </div>
                            <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${proj.progress_percentage}%`, height: '100%', background: '#3b82f6' }} />
                            </div>
                          </div>

                          {/* Verified Evidence Links */}
                          {proj.verified_evidence && proj.verified_evidence.length > 0 && (
                            <div style={{ marginTop: '0.75rem', padding: '0.625rem 0.75rem', background: '#f8fafc', borderRadius: '6px' }}>
                              <strong style={{ fontSize: '0.8125rem', color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                                📎 Verified Evidence Links ({proj.verified_evidence.length})
                              </strong>
                              <ul style={{ margin: '0.25rem 0 0 1.25rem', padding: 0, fontSize: '0.8125rem', color: '#2563eb' }}>
                                {proj.verified_evidence.map((ev) => (
                                  <li key={ev.id}>
                                    <a href={ev.url} target="_blank" rel="noopener noreferrer">
                                      {ev.title || ev.url} ↗
                                    </a>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Recruiter / Faculty Evaluations */}
                          {proj.evaluations && proj.evaluations.length > 0 && (
                            <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f0fdf4', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                              <strong style={{ fontSize: '0.8125rem', color: '#166534', display: 'block', marginBottom: '0.375rem' }}>
                                🏆 Evaluator Review & Scores ({proj.evaluations.length})
                              </strong>
                              {proj.evaluations.map((ev) => (
                                <div key={ev.id} style={{ fontSize: '0.8125rem', color: '#14532d', marginTop: '0.25rem' }}>
                                  <span>
                                    <strong>{ev.recruiter_name || ev.recruiter_company || 'Evaluator'}:</strong>{' '}
                                    {ev.strengths || ev.recommendation || 'Evaluated'} •{' '}
                                    <strong>Score: {ev.overall_score || 0}/10</strong>
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Evidence & Project Links */}
                          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                            <button
                              type="button"
                              className="cb-btn cb-btn-primary cb-btn-sm"
                              onClick={() => handleOpenEvaluateProject(proj)}
                              data-testid={`evaluate-project-btn-${proj.id}`}
                            >
                              ⭐ Evaluate Project
                            </button>
                            {proj.repository_url && (
                              <a
                                href={proj.repository_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="cb-btn cb-btn-outline cb-btn-sm"
                              >
                                📦 Repository ↗
                              </a>
                            )}
                            {proj.live_demo_url && (
                              <a
                                href={proj.live_demo_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="cb-btn cb-btn-outline cb-btn-sm"
                              >
                                🚀 Live Demo ↗
                              </a>
                            )}
                            <Link
                              to={`/app/projects/${proj.id}`}
                              className="cb-btn cb-btn-secondary cb-btn-sm"
                              target="_blank"
                            >
                              🔍 View Project Details
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="cb-card-inner-box" style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                      <p style={{ color: '#94a3b8', margin: 0 }}>
                        Candidate has not published any innovation projects yet.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB D: INTERVIEWS */}
              {activeTab === 'interviews' && (
                <div className="cb-review-section" data-testid="section-interviews">
                  {interviews.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#1e293b' }}>
                          Interview History & Rounds ({interviews.length})
                        </h4>
                        <button
                          type="button"
                          className="cb-btn cb-btn-primary cb-btn-sm"
                          onClick={handleScheduleClick}
                          data-testid="schedule-interview-tab-btn"
                        >
                          + Schedule Interview
                        </button>
                      </div>

                      {interviews.map((item) => {
                        const isActionable =
                          item.status === 'scheduled' || item.status === 'rescheduled';
                        return (
                          <div
                            key={item.id}
                            style={{
                              padding: '1.25rem',
                              background: '#ffffff',
                              borderRadius: '10px',
                              border: '1px solid #e2e8f0',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                            }}
                            data-testid={`candidate-interview-item-${item.id}`}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                              <strong style={{ fontSize: '0.9375rem', color: '#0f172a' }}>
                                📅 {formatDateTime(item.scheduled_at)}
                              </strong>
                              <InterviewStatusBadge status={item.status} />
                            </div>

                            <div style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '0.5rem' }}>
                              <span>⏱️ Duration: {item.duration_minutes} minutes</span> •{' '}
                              <span>Format: {(item.interview_type || 'online').toUpperCase()}</span>
                            </div>

                            {item.location_or_link && (
                              <div style={{ fontSize: '0.8125rem', color: '#2563eb', margin: '0.5rem 0' }}>
                                {item.location_or_link.startsWith('http') ? (
                                  <a
                                    href={item.location_or_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="cb-btn cb-btn-outline-primary cb-btn-sm"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', marginTop: '0.25rem' }}
                                  >
                                    🔗 Join Meeting Room ↗
                                  </a>
                                ) : (
                                  <span>📍 Location: {item.location_or_link}</span>
                                )}
                              </div>
                            )}

                            {item.notes && (
                              <p style={{ fontSize: '0.875rem', color: '#334155', background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', margin: '0.5rem 0 0 0' }}>
                                📝 {item.notes}
                              </p>
                            )}

                            {/* Interview Management Action Controls */}
                            {isActionable && (
                              <div
                                style={{
                                  display: 'flex',
                                  gap: '0.5rem',
                                  flexWrap: 'wrap',
                                  marginTop: '0.75rem',
                                  paddingTop: '0.75rem',
                                  borderTop: '1px solid #f1f5f9',
                                }}
                              >
                                <button
                                  type="button"
                                  className="cb-btn cb-btn-secondary cb-btn-xs"
                                  onClick={() => setReschedulingInterview(item)}
                                  disabled={isInterviewMutating}
                                  data-testid={`reschedule-interview-btn-${item.id}`}
                                >
                                  ✏️ Reschedule
                                </button>
                                <button
                                  type="button"
                                  className="cb-btn cb-btn-outline-success cb-btn-xs"
                                  onClick={() => handleCompleteInterview(item.id)}
                                  disabled={isInterviewMutating}
                                  data-testid={`complete-interview-btn-${item.id}`}
                                >
                                  ✓ Mark Completed
                                </button>
                                <button
                                  type="button"
                                  className="cb-btn cb-btn-outline-danger cb-btn-xs"
                                  onClick={() => handleCancelInterview(item.id)}
                                  disabled={isInterviewMutating}
                                  data-testid={`cancel-interview-btn-${item.id}`}
                                >
                                  ✕ Cancel Interview
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="cb-card-inner-box" style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
                      <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>📅</span>
                      <h4 style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a', margin: '0 0 0.5rem 0' }}>
                        No Interviews Scheduled Yet
                      </h4>
                      <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1.25rem' }}>
                        Schedule a live video or in-person technical screening round with this candidate.
                      </p>
                      <button
                        type="button"
                        className="cb-btn cb-btn-primary cb-btn-sm"
                        onClick={handleScheduleClick}
                        data-testid="schedule-interview-empty-btn"
                      >
                        📅 Schedule Interview Now
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB E: CANDIDATE SCORECARD */}
              {activeTab === 'evaluation' && (
                <CandidateEvaluationPanel applicationId={application.id} />
              )}
            </>
          )}
        </div>

        {/* REJECTION CONFIRMATION BANNER */}
        {showRejectConfirm && (
          <div
            className="cb-rejection-confirm-banner"
            data-testid="rejection-confirm-banner"
            style={{
              background: '#fef2f2',
              borderTop: '1px solid #fecaca',
              padding: '1rem 1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
            }}
          >
            <div>
              <strong style={{ color: '#991b1b', fontSize: '0.875rem', display: 'block' }}>
                Confirm Candidate Rejection
              </strong>
              <span style={{ fontSize: '0.8125rem', color: '#b91c1c' }}>
                This will update the application status to "Rejected" and dispatch an email update to the applicant.
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="cb-btn cb-btn-danger cb-btn-sm"
                onClick={() => handleStatusTransition('rejected')}
                disabled={isMutatingStatus}
                data-testid="confirm-reject-btn"
              >
                {isMutatingStatus ? 'Rejecting...' : 'Yes, Reject Application'}
              </button>
              <button
                type="button"
                className="cb-btn cb-btn-secondary cb-btn-sm"
                onClick={() => setShowRejectConfirm(false)}
                disabled={isMutatingStatus}
                data-testid="cancel-reject-btn"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* FOOTER ACTIONS */}
        <footer className="cb-modal-footer cb-candidate-review-footer">
          <div className="cb-review-footer-left">
            <Link
              to={`/app/recruiter/passport/${application.student_id}`}
              className="cb-btn cb-btn-outline-primary cb-btn-sm"
              target="_blank"
              data-testid="open-full-passport-btn"
            >
              🎓 Full Passport ↗
            </Link>
            <Link
              to={`/app/messages?recipientId=${application.student_id}`}
              className="cb-btn cb-btn-secondary cb-btn-sm"
              data-testid="review-message-candidate-btn"
            >
              💬 Message Candidate
            </Link>
          </div>

          <div className="cb-review-footer-actions">
            {/* Quick Status Transitions */}
            {currentStatus !== 'reviewing' && currentStatus !== 'rejected' && currentStatus !== 'accepted' && (
              <button
                type="button"
                className="cb-btn cb-btn-secondary cb-btn-sm"
                onClick={() => handleStatusTransition('reviewing')}
                disabled={isMutatingStatus || isUpdating}
                data-testid="action-mark-reviewing-btn"
              >
                Mark Reviewing
              </button>
            )}

            {currentStatus !== 'shortlisted' && currentStatus !== 'rejected' && currentStatus !== 'accepted' && (
              <button
                type="button"
                className="cb-btn cb-btn-outline-success cb-btn-sm"
                onClick={() => handleStatusTransition('shortlisted')}
                disabled={isMutatingStatus || isUpdating}
                data-testid="action-shortlist-btn"
              >
                ⭐ Shortlist
              </button>
            )}

            {currentStatus !== 'rejected' && (
              <button
                type="button"
                className="cb-btn cb-btn-primary cb-btn-sm"
                onClick={handleScheduleClick}
                data-testid="action-schedule-interview-btn"
              >
                📅 Schedule Interview
              </button>
            )}

            {currentStatus !== 'accepted' && currentStatus !== 'rejected' && (
              <button
                type="button"
                className="cb-btn cb-btn-success cb-btn-sm"
                onClick={() => handleStatusTransition('accepted')}
                disabled={isMutatingStatus || isUpdating}
                data-testid="action-accept-btn"
              >
                ✅ Accept
              </button>
            )}

            {currentStatus !== 'rejected' && currentStatus !== 'accepted' && (
              <button
                type="button"
                className="cb-btn cb-btn-outline-danger cb-btn-sm"
                onClick={() => setShowRejectConfirm(true)}
                disabled={isMutatingStatus || isUpdating || showRejectConfirm}
                data-testid="action-reject-btn"
              >
                ❌ Reject
              </button>
            )}

            <button
              type="button"
              className="cb-btn cb-btn-secondary cb-btn-sm"
              onClick={onClose}
              data-testid="close-review-footer-btn"
            >
              Close
            </button>
          </div>
        </footer>
      </div>

      {/* Direct Project Evaluation Modal */}
      {isEvaluationModalOpen && evaluatingInnovationProject && (
        <ProjectEvaluationModal
          isOpen={isEvaluationModalOpen}
          project={evaluatingInnovationProject}
          existingEvaluation={editingEvaluation}
          onSave={handleSaveEvaluation}
          onClose={() => {
            setIsEvaluationModalOpen(false);
            setEvaluatingProject(null);
            setEditingEvaluation(null);
          }}
          isLoading={isEvaluationSaving}
        />
      )}

      {/* Direct Interview Scheduling Modal */}
      {isScheduleModalOpen && (
        <ScheduleInterviewModal
          isOpen={isScheduleModalOpen}
          applicationId={application.id}
          candidateEmail={candidateEmail}
          jobTitle={jobTitle}
          companyName={companyName}
          onClose={() => setIsScheduleModalOpen(false)}
          onSuccess={handleScheduleSuccess}
        />
      )}

      {/* Direct Interview Rescheduling Modal */}
      {reschedulingInterview && (
        <RescheduleInterviewModal
          isOpen={Boolean(reschedulingInterview)}
          interview={reschedulingInterview}
          onClose={() => setReschedulingInterview(null)}
          onSuccess={handleRescheduleSuccess}
        />
      )}
    </div>
  );
};
