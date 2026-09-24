import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import {
  createProjectMilestone,
  deleteProject,
  deleteProjectMilestone,
  getProjectById,
  getProjectMilestones,
  updateProject,
  updateProjectMilestone,
} from '@/api/innovationProjects';
import {
  InnovationProject,
  InnovationProjectUpdate,
  MilestoneStatus,
  ProjectMilestone,
  ProjectMilestoneCreate,
  ProjectMilestoneUpdate,
} from '@/types/innovationProject';
import { InnovationProjectForm } from '@/components/projects/InnovationProjectForm';
import { ProjectMilestoneProgress } from '@/components/projects/ProjectMilestoneProgress';
import { ProjectMilestoneList } from '@/components/projects/ProjectMilestoneList';
import { ProjectMilestoneModal } from '@/components/projects/ProjectMilestoneModal';

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
      await fetchMilestones(data.id);
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
    </div>
  );
};
