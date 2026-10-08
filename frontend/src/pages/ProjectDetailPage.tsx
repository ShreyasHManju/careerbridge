import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import {
  createOrUpdateEvidenceVerification,
  createProjectEvidence,
  createProjectMilestone,
  deleteProject,
  deleteProjectEvidence,
  deleteProjectMilestone,
  getProjectById,
  getProjectEvidenceList,
  getProjectMilestones,
  updateProject,
  updateProjectEvidence,
  updateProjectMilestone,
} from '@/api/innovationProjects';
import {
  createExperienceFromVerifiedProject,
  getMyExperiences,
} from '@/api/experiences';
import {
  createProjectEvaluation,
  getProjectEvaluations,
  submitProjectEvaluation,
  updateProjectEvaluation,
  withdrawProjectEvaluation,
} from '@/api/projectEvaluations';
import {
  EvidenceVerificationCreate,
  InnovationProject,
  InnovationProjectUpdate,
  MilestoneStatus,
  ProjectEvidence,
  ProjectEvidenceCreate,
  ProjectEvidenceUpdate,
  ProjectMilestone,
  ProjectMilestoneCreate,
  ProjectMilestoneUpdate,
} from '@/types/innovationProject';
import {
  ProjectEvaluation,
  ProjectEvaluationCreate,
  ProjectEvaluationUpdate,
} from '@/types/projectEvaluation';
import { InnovationProjectForm } from '@/components/projects/InnovationProjectForm';
import { ProjectMilestoneProgress } from '@/components/projects/ProjectMilestoneProgress';
import { ProjectMilestoneList } from '@/components/projects/ProjectMilestoneList';
import { ProjectMilestoneModal } from '@/components/projects/ProjectMilestoneModal';
import { ProjectEvidenceList } from '@/components/projects/ProjectEvidenceList';
import { ProjectEvidenceModal } from '@/components/projects/ProjectEvidenceModal';
import { ProjectEvidenceVerificationModal } from '@/components/projects/ProjectEvidenceVerificationModal';
import { ProjectEvaluationList } from '@/components/evaluations/ProjectEvaluationList';
import { ProjectEvaluationModal } from '@/components/evaluations/ProjectEvaluationModal';

export const ProjectDetailPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [project, setProject] = useState<InnovationProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Milestone Integration State
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [milestoneStats, setMilestoneStats] = useState<{
    total: number;
    completed: number;
    progressPercentage: number;
  }>({ total: 0, completed: 0, progressPercentage: 0 });
  const [milestonesLoading, setMilestonesLoading] = useState(false);
  const [milestonesError, setMilestonesError] = useState<string | null>(null);

  const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<ProjectMilestone | null>(null);
  const [isMilestoneSaving, setIsMilestoneSaving] = useState(false);
  const [deletingMilestone, setDeletingMilestone] = useState<ProjectMilestone | null>(null);
  const [isMilestoneDeleting, setIsMilestoneDeleting] = useState(false);

  // Evidence Integration State (Milestone R5)
  const [evidenceList, setEvidenceList] = useState<ProjectEvidence[]>([]);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false);
  const [editingEvidence, setEditingEvidence] = useState<ProjectEvidence | null>(null);
  const [isEvidenceSaving, setIsEvidenceSaving] = useState(false);
  const [deletingEvidence, setDeletingEvidence] = useState<ProjectEvidence | null>(null);
  const [isEvidenceDeleting, setIsEvidenceDeleting] = useState(false);

  // Evidence Verification State (Milestone R6)
  const [verifyingEvidence, setVerifyingEvidence] = useState<ProjectEvidence | null>(null);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [isVerificationSaving, setIsVerificationSaving] = useState(false);

  // Recruiter Evaluation State (Phase 30C)
  const [evaluations, setEvaluations] = useState<ProjectEvaluation[]>([]);
  const [evaluationsLoading, setEvaluationsLoading] = useState(false);
  const [evaluationsError, setEvaluationsError] = useState<string | null>(null);
  const [isEvaluationModalOpen, setIsEvaluationModalOpen] = useState(false);
  const [editingEvaluation, setEditingEvaluation] = useState<ProjectEvaluation | null>(null);
  const [isEvaluationSaving, setIsEvaluationSaving] = useState(false);

  // Passport Credentialization State (Phase 32)
  const [isCredentialing, setIsCredentialing] = useState(false);
  const [credentialError, setCredentialError] = useState<string | null>(null);
  const [credentialSuccess, setCredentialSuccess] = useState<string | null>(null);
  const [isCredentialed, setIsCredentialed] = useState(false);

  const checkExistingCredential = async (pId: number) => {
    if (user?.role === 'student') {
      try {
        const resp = await getMyExperiences();
        const found = (resp.items || []).some((e) => e.innovation_project_id === pId);
        if (found) {
          setIsCredentialed(true);
        }
      } catch {
        // Silently ignore non-blocking credential check
      }
    }
  };

  const fetchMilestones = async (pId: number) => {
    setMilestonesLoading(true);
    setMilestonesError(null);
    try {
      const res = await getProjectMilestones(pId);
      setMilestones(res.items);
      setMilestoneStats({
        total: res.total,
        completed: res.completed,
        progressPercentage: res.progress_percentage,
      });
    } catch (err: any) {
      setMilestonesError(
        err.response?.data?.detail || err.message || 'Failed to load milestones.'
      );
    } finally {
      setMilestonesLoading(false);
    }
  };

  const fetchEvidence = async (pId: number) => {
    setEvidenceLoading(true);
    setEvidenceError(null);
    try {
      const res = await getProjectEvidenceList(pId);
      setEvidenceList(res.items);
    } catch (err: any) {
      setEvidenceError(
        err.response?.data?.detail || err.message || 'Failed to load evidence artifacts.'
      );
    } finally {
      setEvidenceLoading(false);
    }
  };

  const fetchEvaluations = async (pId: number) => {
    setEvaluationsLoading(true);
    setEvaluationsError(null);
    try {
      const res = await getProjectEvaluations(pId);
      setEvaluations(Array.isArray(res) ? res : (res as any)?.items || []);
    } catch (err: any) {
      setEvaluationsError(
        err.response?.data?.detail || err.message || 'Failed to load evaluations.'
      );
    } finally {
      setEvaluationsLoading(false);
    }
  };

  const fetchProject = async () => {
    if (!projectId || isNaN(Number(projectId))) {
      setError('Invalid project ID.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await getProjectById(Number(projectId));
      setProject(data);
      await Promise.all([
        fetchMilestones(data.id),
        fetchEvidence(data.id),
        fetchEvaluations(data.id),
        checkExistingCredential(data.id),
      ]);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setError('Innovation project not found or you do not have permission to view it.');
      } else {
        setError(err.response?.data?.detail || err.message || 'Failed to load project.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProject();
  }, [projectId]);

  const isOwner = user && project && user.id === project.student_id;

  const handleUpdate = async (payload: InnovationProjectUpdate) => {
    if (!project) return;
    setIsSaving(true);
    try {
      const updated = await updateProject(project.id, payload);
      setProject(updated);
      setIsEditModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!project) return;
    try {
      await deleteProject(project.id);
      navigate('/app/projects');
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete project.');
    }
  };

  const handleSaveMilestone = async (
    payload: ProjectMilestoneCreate | ProjectMilestoneUpdate
  ) => {
    if (!project) return;
    setIsMilestoneSaving(true);
    try {
      if (editingMilestone) {
        await updateProjectMilestone(project.id, editingMilestone.id, payload);
      } else {
        await createProjectMilestone(project.id, payload as ProjectMilestoneCreate);
      }
      await fetchMilestones(project.id);
      setIsMilestoneModalOpen(false);
      setEditingMilestone(null);
    } finally {
      setIsMilestoneSaving(false);
    }
  };

  const handleToggleMilestoneStatus = async (
    milestone: ProjectMilestone,
    newStatus: MilestoneStatus
  ) => {
    if (!project || !isOwner) return;
    try {
      await updateProjectMilestone(project.id, milestone.id, { status: newStatus });
      await fetchMilestones(project.id);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update milestone status.');
    }
  };

  const handleDeleteMilestone = async () => {
    if (!project || !deletingMilestone) return;
    setIsMilestoneDeleting(true);
    try {
      await deleteProjectMilestone(project.id, deletingMilestone.id);
      await fetchMilestones(project.id);
      setDeletingMilestone(null);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete milestone.');
    } finally {
      setIsMilestoneDeleting(false);
    }
  };

  const handleSaveEvidence = async (
    payload: ProjectEvidenceCreate | ProjectEvidenceUpdate
  ) => {
    if (!project) return;
    setIsEvidenceSaving(true);
    try {
      if (editingEvidence) {
        await updateProjectEvidence(project.id, editingEvidence.id, payload);
      } else {
        await createProjectEvidence(project.id, payload as ProjectEvidenceCreate);
      }
      await fetchEvidence(project.id);
      setIsEvidenceModalOpen(false);
      setEditingEvidence(null);
    } finally {
      setIsEvidenceSaving(false);
    }
  };

  const handleDeleteEvidence = async () => {
    if (!project || !deletingEvidence) return;
    setIsEvidenceDeleting(true);
    try {
      await deleteProjectEvidence(project.id, deletingEvidence.id);
      await fetchEvidence(project.id);
      setDeletingEvidence(null);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete evidence artifact.');
    } finally {
      setIsEvidenceDeleting(false);
    }
  };

  const handleSaveVerification = async (payload: EvidenceVerificationCreate) => {
    if (!project || !verifyingEvidence) return;
    setIsVerificationSaving(true);
    try {
      await createOrUpdateEvidenceVerification(project.id, verifyingEvidence.id, payload);
      await fetchEvidence(project.id);
      setIsVerificationModalOpen(false);
      setVerifyingEvidence(null);
    } finally {
      setIsVerificationSaving(false);
    }
  };

  const handleSaveEvaluation = async (
    payload: ProjectEvaluationCreate,
    submitImmediately = false
  ) => {
    if (!project) return;
    setIsEvaluationSaving(true);
    try {
      let savedEval: ProjectEvaluation;
      if (editingEvaluation) {
        savedEval = await updateProjectEvaluation(
          editingEvaluation.id,
          payload as ProjectEvaluationUpdate
        );
      } else {
        savedEval = await createProjectEvaluation(project.id, payload);
      }
      if (submitImmediately && savedEval.status === 'draft') {
        await submitProjectEvaluation(savedEval.id);
      }
      await fetchEvaluations(project.id);
      setIsEvaluationModalOpen(false);
      setEditingEvaluation(null);
    } finally {
      setIsEvaluationSaving(false);
    }
  };

  const handleSubmitEvaluation = async (evaluationId: number) => {
    if (!project) return;
    try {
      await submitProjectEvaluation(evaluationId);
      await fetchEvaluations(project.id);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to submit evaluation.');
    }
  };

  const handleWithdrawEvaluation = async (evaluationId: number) => {
    if (!project) return;
    if (!window.confirm('Are you sure you want to withdraw this evaluation?')) return;
    try {
      await withdrawProjectEvaluation(evaluationId);
      await fetchEvaluations(project.id);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to withdraw evaluation.');
    }
  };

  const hasVerifiedEvidence = evidenceList.some(
    (ev) =>
      ev.verification &&
      (ev.verification.status === 'verified' ||
        (ev.verification.status as any) === 'VERIFIED')
  );

  const handleCredentializeProject = async () => {
    if (!project || isCredentialing || isCredentialed) return;
    setIsCredentialing(true);
    setCredentialError(null);
    setCredentialSuccess(null);
    try {
      await createExperienceFromVerifiedProject(project.id);
      setIsCredentialed(true);
      setCredentialSuccess(
        'Project successfully credentialed to your Experience Passport!'
      );
    } catch (err: any) {
      const detail =
        err.response?.data?.detail ||
        err.message ||
        'Failed to credentialize project to Experience Passport.';
      setCredentialError(detail);
      if (
        typeof detail === 'string' &&
        detail.toLowerCase().includes('already exists')
      ) {
        setIsCredentialed(true);
      }
    } finally {
      setIsCredentialing(false);
    }
  };


  if (loading) {
    return (
      <div className="cb-page cb-project-detail-page">
        <div className="cb-loading-state" data-testid="detail-loading">
          <div className="cb-spinner" />
          <p>Loading project details...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="cb-page cb-project-detail-page">
        <div className="cb-error-state" data-testid="detail-error">
          <h2>Project Unavailable</h2>
          <p className="cb-error-text">{error || 'Project not found.'}</p>
          <Link to="/app/projects" className="cb-btn cb-btn-secondary">
            &larr; Back to Projects
          </Link>
        </div>
      </div>
    );
  }

  const displaySkills =
    project.structured_skills && project.structured_skills.length > 0
      ? project.structured_skills.map((s) => s.name)
      : project.skills
      ? project.skills.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

  return (
    <div className="cb-page cb-project-detail-page" data-testid="project-detail-view">
      <div className="cb-detail-breadcrumb">
        <Link to="/app/projects" className="cb-breadcrumb-link">
          &larr; All Projects
        </Link>
      </div>

      <div className="cb-card cb-detail-card">
        <div className="cb-detail-header">
          <div className="cb-detail-title-block">
            <h1 className="cb-detail-title">{project.title}</h1>
            {project.owner_name && (
              <p className="cb-detail-subtitle">Created by {project.owner_name}</p>
            )}
            <div className="cb-project-badges">
              <span className={`cb-badge cb-badge-type cb-badge-type-${project.project_type}`}>
                {project.project_type.toUpperCase()}
              </span>
              <span className={`cb-badge cb-badge-status cb-badge-status-${project.status}`}>
                {project.status.toUpperCase()}
              </span>
              <span
                className={`cb-badge cb-badge-visibility ${
                  project.visibility === 'public' ? 'cb-badge-public' : 'cb-badge-private'
                }`}
              >
                {project.visibility === 'public' ? '🌐 Public Project' : '🔒 Private Project'}
              </span>
            </div>
          </div>

          {isOwner && (
            <div className="cb-detail-owner-actions">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="cb-btn cb-btn-secondary"
                aria-label="Edit project"
              >
                Edit Project
              </button>
              <button
                type="button"
                onClick={() => setIsDeleting(true)}
                className="cb-btn cb-btn-danger"
                aria-label="Delete project"
              >
                Delete
              </button>
            </div>
          )}
        </div>

        {/* Experience Passport Credentialization Banner (Phase 32) */}
        {isOwner && user?.role === 'student' && (
          <>
            {isCredentialed ? (
              <div
                className="cb-passport-credential-banner cb-credentialed"
                data-testid="project-credentialed-banner"
                style={{
                  margin: '1rem 0',
                  padding: '1rem 1.25rem',
                  background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.08), rgba(16, 185, 129, 0.12))',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  borderRadius: 'var(--cb-radius, 8px)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
              >
                <div>
                  <strong
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      color: '#15803d',
                      fontSize: '0.9375rem',
                    }}
                  >
                    <span>✓</span> Credentialed in Experience Passport
                  </strong>
                  <p
                    style={{
                      margin: '0.25rem 0 0 0',
                      fontSize: '0.8125rem',
                      color: '#334155',
                    }}
                  >
                    This project and its verified evidence are formalized into your verified Experience Passport and skill compilation.
                  </p>
                </div>
                <Link
                  to="/app/passport"
                  className="cb-btn cb-btn-secondary cb-btn-sm"
                  data-testid="view-passport-link"
                >
                  View Experience Passport &rarr;
                </Link>
              </div>
            ) : hasVerifiedEvidence ? (
              <div
                className="cb-passport-credential-banner cb-credential-action"
                data-testid="project-credentialize-cta-banner"
                style={{
                  margin: '1rem 0',
                  padding: '1rem 1.25rem',
                  background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.06), rgba(99, 102, 241, 0.08))',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: 'var(--cb-radius, 8px)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
              >
                <div style={{ flex: 1, minWidth: '240px' }}>
                  <strong
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      color: '#1d4ed8',
                      fontSize: '0.9375rem',
                    }}
                  >
                    <span>🛡️</span> Verified Evidence Available
                  </strong>
                  <p
                    style={{
                      margin: '0.25rem 0 0 0',
                      fontSize: '0.8125rem',
                      color: '#334155',
                    }}
                  >
                    This project has verified milestone evidence. Add it as a verified credential to your Experience Passport to boost your opportunity matching.
                  </p>
                  {credentialError && (
                    <div
                      className="cb-alert cb-alert-danger"
                      role="alert"
                      style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', fontSize: '0.8125rem' }}
                    >
                      {credentialError}
                    </div>
                  )}
                  {credentialSuccess && (
                    <div
                      className="cb-alert cb-alert-success"
                      role="status"
                      style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', fontSize: '0.8125rem' }}
                    >
                      {credentialSuccess}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="cb-btn cb-btn-primary cb-btn-sm"
                  onClick={handleCredentializeProject}
                  disabled={isCredentialing}
                  data-testid="add-to-passport-btn"
                >
                  {isCredentialing ? 'Adding to Experience Passport...' : 'Add to Experience Passport'}
                </button>
              </div>
            ) : null}
          </>
        )}

        {project.short_description && (
          <div className="cb-detail-section cb-detail-lead">
            <p>{project.short_description}</p>
          </div>
        )}

        <div className="cb-detail-section">
          <h3>Project Description & Architecture</h3>
          <div className="cb-detail-body-text">
            {project.description.split('\n').map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </div>

        {displaySkills.length > 0 && (
          <div className="cb-detail-section">
            <h3>Technologies & Structured Skills</h3>
            <div className="cb-project-skills" aria-label="Structured Skills">
              {displaySkills.map((skillName, idx) => (
                <span key={idx} className="cb-skill-tag">
                  {skillName}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="cb-detail-section cb-detail-links-section">
          <h3>Project Artifacts & Links</h3>
          <div className="cb-detail-links">
            {project.repository_url ? (
              <a
                href={project.repository_url}
                target="_blank"
                rel="noopener noreferrer"
                className="cb-btn cb-btn-outline"
              >
                📂 View Source Repository
              </a>
            ) : (
              <span className="cb-text-muted">No repository URL provided</span>
            )}

            {project.live_demo_url ? (
              <a
                href={project.live_demo_url}
                target="_blank"
                rel="noopener noreferrer"
                className="cb-btn cb-btn-primary"
              >
                🚀 Open Live Demo / Website
              </a>
            ) : (
              <span className="cb-text-muted">No live demo URL provided</span>
            )}
          </div>
        </div>

        {/* Execution Milestones & Progress Section */}
        <div
          className="cb-detail-section cb-detail-milestones-section"
          data-testid="project-milestones-section"
        >
          <div className="cb-detail-section-header">
            <div className="cb-section-title-wrap">
              <h3>Execution Milestones & Progress</h3>
              <p className="cb-section-subtitle">
                Track verified development goals, deliverables, and execution timelines.
              </p>
            </div>
            {isOwner && (
              <button
                type="button"
                className="cb-btn cb-btn-primary cb-btn-sm"
                onClick={() => {
                  setEditingMilestone(null);
                  setIsMilestoneModalOpen(true);
                }}
                aria-label="Add Milestone"
              >
                + Add Milestone
              </button>
            )}
          </div>

          {milestonesLoading ? (
            <div className="cb-milestones-loading" data-testid="milestones-loading">
              <div className="cb-spinner" />
              <p>Loading project milestones...</p>
            </div>
          ) : milestonesError ? (
            <div className="cb-milestones-error" data-testid="milestones-error">
              <p className="cb-error-text">{milestonesError}</p>
              <button
                type="button"
                className="cb-btn cb-btn-secondary cb-btn-sm"
                onClick={() => fetchMilestones(project.id)}
              >
                Retry Loading Milestones
              </button>
            </div>
          ) : (
            <>
              <ProjectMilestoneProgress
                total={milestoneStats.total}
                completed={milestoneStats.completed}
                progressPercentage={milestoneStats.progressPercentage}
              />
              <ProjectMilestoneList
                milestones={milestones}
                isOwner={!!isOwner}
                onAddMilestone={() => {
                  setEditingMilestone(null);
                  setIsMilestoneModalOpen(true);
                }}
                onEditMilestone={(m) => {
                  setEditingMilestone(m);
                  setIsMilestoneModalOpen(true);
                }}
                onDeleteMilestone={(m) => {
                  setDeletingMilestone(m);
                }}
                onToggleStatus={handleToggleMilestoneStatus}
              />
            </>
          )}
        </div>

        {/* Project Evidence & Artifacts Section (Milestone R5) */}
        <div
          className="cb-detail-section cb-detail-evidence-section"
          data-testid="project-evidence-section"
        >
          <div className="cb-detail-section-header">
            <div className="cb-section-title-wrap">
              <h3>Tangible Evidence & Artifacts ({evidenceList.length})</h3>
              <p className="cb-section-subtitle">
                Inspect proof of execution including source code, live demos, diagrams, and documentation.
              </p>
            </div>
            {isOwner && (
              <button
                type="button"
                className="cb-btn cb-btn-primary cb-btn-sm"
                onClick={() => {
                  setEditingEvidence(null);
                  setIsEvidenceModalOpen(true);
                }}
                aria-label="Attach Evidence"
              >
                + Attach Evidence
              </button>
            )}
          </div>

          {evidenceLoading ? (
            <div className="cb-evidence-loading" data-testid="evidence-loading">
              <div className="cb-spinner" />
              <p>Loading evidence artifacts...</p>
            </div>
          ) : evidenceError ? (
            <div className="cb-evidence-error" data-testid="evidence-error">
              <p className="cb-error-text">{evidenceError}</p>
              <button
                type="button"
                className="cb-btn cb-btn-secondary cb-btn-sm"
                onClick={() => fetchEvidence(project.id)}
              >
                Retry Loading Evidence
              </button>
            </div>
          ) : (
            <ProjectEvidenceList
              evidenceList={evidenceList}
              milestones={milestones}
              isOwner={!!isOwner}
              isAdmin={user?.role === 'admin'}
              onAddEvidence={() => {
                setEditingEvidence(null);
                setIsEvidenceModalOpen(true);
              }}
              onEditEvidence={(item) => {
                setEditingEvidence(item);
                setIsEvidenceModalOpen(true);
              }}
              onDeleteEvidence={(item) => {
                setDeletingEvidence(item);
              }}
              onVerifyEvidence={(item) => {
                setVerifyingEvidence(item);
                setIsVerificationModalOpen(true);
              }}
            />
          )}
        </div>

        {/* Recruiter Project Evaluations Section (Phase 30C) */}
        <div
          className="cb-detail-section cb-detail-evaluations-section"
          data-testid="project-evaluations-section"
        >
          <div className="cb-detail-section-header">
            <div className="cb-section-title-wrap">
              <h3>Recruiter Evaluations ({evaluations.length})</h3>
              <p className="cb-section-subtitle">
                Structured technical assessments, skill proficiencies, and hiring recommendations from verified recruiters.
              </p>
            </div>
            {user?.role === 'recruiter' && !isOwner && (
              <button
                type="button"
                className="cb-btn cb-btn-primary cb-btn-sm"
                onClick={() => {
                  const existing = evaluations.find((e) => e.recruiter_id === user?.id);
                  setEditingEvaluation(existing || null);
                  setIsEvaluationModalOpen(true);
                }}
                data-testid="evaluate-project-btn"
              >
                {evaluations.some((e) => e.recruiter_id === user?.id && e.status === 'draft')
                  ? '✏️ Edit Draft Evaluation'
                  : '⭐ Evaluate Project'}
              </button>
            )}
          </div>

          <ProjectEvaluationList
            evaluations={evaluations}
            currentUserId={user?.id}
            userRole={user?.role}
            isLoading={evaluationsLoading}
            error={evaluationsError}
            onRetry={() => fetchEvaluations(project.id)}
            onEdit={(ev) => {
              setEditingEvaluation(ev);
              setIsEvaluationModalOpen(true);
            }}
            onSubmitDraft={handleSubmitEvaluation}
            onWithdraw={handleWithdrawEvaluation}
          />
        </div>

        <div className="cb-detail-footer">
          <span className="cb-timestamp">
            Created: {new Date(project.created_at).toLocaleDateString()}
          </span>
          <span className="cb-timestamp">
            Updated: {new Date(project.updated_at).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Edit Project Modal */}
      {isEditModalOpen && (
        <div className="cb-modal-overlay" role="dialog" aria-modal="true">
          <div className="cb-modal cb-modal-lg">
            <div className="cb-modal-header">
              <h2>Edit Innovation Project</h2>
              <button
                type="button"
                className="cb-modal-close"
                onClick={() => setIsEditModalOpen(false)}
                disabled={isSaving}
              >
                &times;
              </button>
            </div>
            <div className="cb-modal-body">
              <InnovationProjectForm
                initialData={project}
                onSubmit={handleUpdate}
                onCancel={() => setIsEditModalOpen(false)}
                isLoading={isSaving}
              />
            </div>
          </div>
        </div>
      )}

      {/* Delete Project Confirmation Modal */}
      {isDeleting && (
        <div className="cb-modal-overlay" role="alertdialog" aria-modal="true">
          <div className="cb-modal cb-modal-sm">
            <div className="cb-modal-header">
              <h2>Confirm Deletion</h2>
              <button
                type="button"
                className="cb-modal-close"
                onClick={() => setIsDeleting(false)}
              >
                &times;
              </button>
            </div>
            <div className="cb-modal-body">
              <p>
                Are you sure you want to delete <strong>"{project.title}"</strong>?
              </p>
            </div>
            <div className="cb-modal-footer">
              <button
                type="button"
                className="cb-btn cb-btn-secondary"
                onClick={() => setIsDeleting(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="cb-btn cb-btn-danger"
                onClick={handleDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Milestone Modal (Create / Edit) */}
      <ProjectMilestoneModal
        isOpen={isMilestoneModalOpen}
        initialData={editingMilestone}
        onSubmit={handleSaveMilestone}
        onClose={() => {
          setIsMilestoneModalOpen(false);
          setEditingMilestone(null);
        }}
        isLoading={isMilestoneSaving}
      />

      {/* Milestone Deletion Confirmation Dialog */}
      {deletingMilestone && (
        <div className="cb-modal-overlay" role="alertdialog" aria-modal="true">
          <div className="cb-modal cb-modal-sm">
            <div className="cb-modal-header">
              <h2>Confirm Milestone Deletion</h2>
              <button
                type="button"
                className="cb-modal-close"
                onClick={() => setDeletingMilestone(null)}
                disabled={isMilestoneDeleting}
              >
                &times;
              </button>
            </div>
            <div className="cb-modal-body">
              <p>
                Are you sure you want to delete milestone{' '}
                <strong>"{deletingMilestone.title}"</strong>?
              </p>
            </div>
            <div className="cb-modal-footer">
              <button
                type="button"
                className="cb-btn cb-btn-secondary"
                onClick={() => setDeletingMilestone(null)}
                disabled={isMilestoneDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="cb-btn cb-btn-danger"
                onClick={handleDeleteMilestone}
                disabled={isMilestoneDeleting}
              >
                {isMilestoneDeleting ? 'Deleting...' : 'Delete Milestone'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Evidence Modal (Create / Edit) */}
      <ProjectEvidenceModal
        isOpen={isEvidenceModalOpen}
        initialData={editingEvidence}
        milestones={milestones}
        onSubmit={handleSaveEvidence}
        onClose={() => {
          setIsEvidenceModalOpen(false);
          setEditingEvidence(null);
        }}
        isLoading={isEvidenceSaving}
      />

      {/* Evidence Deletion Confirmation Dialog */}
      {deletingEvidence && (
        <div className="cb-modal-overlay" role="alertdialog" aria-modal="true">
          <div className="cb-modal cb-modal-sm">
            <div className="cb-modal-header">
              <h2>Confirm Evidence Deletion</h2>
              <button
                type="button"
                className="cb-modal-close"
                onClick={() => setDeletingEvidence(null)}
                disabled={isEvidenceDeleting}
              >
                &times;
              </button>
            </div>
            <div className="cb-modal-body">
              <p>
                Are you sure you want to remove evidence artifact{' '}
                <strong>"{deletingEvidence.title}"</strong>?
              </p>
            </div>
            <div className="cb-modal-footer">
              <button
                type="button"
                className="cb-btn cb-btn-secondary"
                onClick={() => setDeletingEvidence(null)}
                disabled={isEvidenceDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="cb-btn cb-btn-danger"
                onClick={handleDeleteEvidence}
                disabled={isEvidenceDeleting}
              >
                {isEvidenceDeleting ? 'Deleting...' : 'Delete Artifact'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Evidence Verification Modal (Milestone R6) */}
      <ProjectEvidenceVerificationModal
        isOpen={isVerificationModalOpen}
        evidence={verifyingEvidence}
        onSubmit={handleSaveVerification}
        onClose={() => {
          setIsVerificationModalOpen(false);
          setVerifyingEvidence(null);
        }}
        isLoading={isVerificationSaving}
      />

      {/* Recruiter Project Evaluation Modal (Phase 30C) */}
      <ProjectEvaluationModal
        isOpen={isEvaluationModalOpen}
        project={project}
        existingEvaluation={editingEvaluation}
        onSave={handleSaveEvaluation}
        onClose={() => {
          setIsEvaluationModalOpen(false);
          setEditingEvaluation(null);
        }}
        isLoading={isEvaluationSaving}
      />
    </div>
  );
};
