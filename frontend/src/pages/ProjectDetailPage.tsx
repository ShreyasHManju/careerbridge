import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import {
  deleteProject,
  getProjectById,
  updateProject,
} from '@/api/innovationProjects';
import {
  InnovationProject,
  InnovationProjectUpdate,
} from '@/types/innovationProject';
import { InnovationProjectForm } from '@/components/projects/InnovationProjectForm';

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

        <div className="cb-detail-footer">
          <span className="cb-timestamp">
            Created: {new Date(project.created_at).toLocaleDateString()}
          </span>
          <span className="cb-timestamp">
            Updated: {new Date(project.updated_at).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Edit Modal */}
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

      {/* Delete Confirmation Modal */}
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
    </div>
  );
};
