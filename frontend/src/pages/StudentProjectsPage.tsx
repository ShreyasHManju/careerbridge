import React, { useEffect, useState } from 'react';
import {
  createProject,
  deleteProject,
  getMyProjects,
  updateProject,
} from '@/api/innovationProjects';
import {
  InnovationProject,
  InnovationProjectCreate,
  InnovationProjectUpdate,
} from '@/types/innovationProject';
import { InnovationProjectCard } from '@/components/projects/InnovationProjectCard';
import { InnovationProjectForm } from '@/components/projects/InnovationProjectForm';

export const StudentProjectsPage: React.FC = () => {
  const [projects, setProjects] = useState<InnovationProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<InnovationProject | null>(null);
  const [deletingProject, setDeletingProject] = useState<InnovationProject | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMyProjects();
      setProjects(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to load innovation projects.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleOpenCreateModal = () => {
    setEditingProject(null);
    setIsModalOpen(true);
    setFeedback(null);
  };

  const handleOpenEditModal = (proj: InnovationProject) => {
    setEditingProject(proj);
    setIsModalOpen(true);
    setFeedback(null);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProject(null);
  };

  const handleSaveProject = async (
    payload: InnovationProjectCreate | InnovationProjectUpdate
  ) => {
    setIsSaving(true);
    try {
      if (editingProject) {
        const updated = await updateProject(editingProject.id, payload as InnovationProjectUpdate);
        setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        setFeedback({ type: 'success', message: `Project "${updated.title}" updated successfully.` });
      } else {
        const created = await createProject(payload as InnovationProjectCreate);
        setProjects((prev) => [created, ...prev]);
        setFeedback({ type: 'success', message: `Project "${created.title}" published successfully.` });
      }
      setIsModalOpen(false);
      setEditingProject(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingProject) return;
    try {
      await deleteProject(deletingProject.id);
      setProjects((prev) => prev.filter((p) => p.id !== deletingProject.id));
      setFeedback({
        type: 'success',
        message: `Project "${deletingProject.title}" has been deleted.`,
      });
      setDeletingProject(null);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.detail || 'Failed to delete project.',
      });
    }
  };

  // Filter projects
  const filteredProjects = projects.filter((p) => {
    const matchesStatus =
      statusFilter === 'all' ? true : p.status === statusFilter;
    const matchesSearch =
      !searchTerm.trim() ||
      p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.skills && p.skills.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const activeCount = projects.filter((p) => p.status === 'active').length;
  const draftCount = projects.filter((p) => p.status === 'draft').length;
  const archivedCount = projects.filter((p) => p.status === 'archived').length;

  return (
    <div className="cb-page cb-student-projects-page">
      <div className="cb-page-header cb-projects-header">
        <div>
          <h1 className="cb-page-title">Innovation Projects</h1>
          <p className="cb-page-subtitle">
            Showcase your real-world builds, research, and technical achievements to recruiters.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreateModal}
          className="cb-btn cb-btn-primary"
          id="btn-create-project"
        >
          + New Project
        </button>
      </div>

      {feedback && (
        <div
          className={`cb-alert ${
            feedback.type === 'success' ? 'cb-alert-success' : 'cb-alert-danger'
          }`}
          role="status"
        >
          {feedback.message}
          <button
            type="button"
            className="cb-alert-close"
            onClick={() => setFeedback(null)}
            aria-label="Close notification"
          >
            &times;
          </button>
        </div>
      )}

      {/* Metrics Bar */}
      <div className="cb-stats-bar">
        <div className="cb-stat-pill">
          <span className="cb-stat-num">{projects.length}</span>
          <span className="cb-stat-lbl">Total Projects</span>
        </div>
        <div className="cb-stat-pill">
          <span className="cb-stat-num">{activeCount}</span>
          <span className="cb-stat-lbl">Active & Public</span>
        </div>
        <div className="cb-stat-pill">
          <span className="cb-stat-num">{draftCount}</span>
          <span className="cb-stat-lbl">Drafts</span>
        </div>
        <div className="cb-stat-pill">
          <span className="cb-stat-num">{archivedCount}</span>
          <span className="cb-stat-lbl">Archived</span>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="cb-toolbar">
        <div className="cb-tabs" role="tablist">
          <button
            type="button"
            className={`cb-tab ${statusFilter === 'all' ? 'cb-tab-active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            All ({projects.length})
          </button>
          <button
            type="button"
            className={`cb-tab ${statusFilter === 'active' ? 'cb-tab-active' : ''}`}
            onClick={() => setStatusFilter('active')}
          >
            Active ({activeCount})
          </button>
          <button
            type="button"
            className={`cb-tab ${statusFilter === 'draft' ? 'cb-tab-active' : ''}`}
            onClick={() => setStatusFilter('draft')}
          >
            Drafts ({draftCount})
          </button>
          <button
            type="button"
            className={`cb-tab ${statusFilter === 'archived' ? 'cb-tab-active' : ''}`}
            onClick={() => setStatusFilter('archived')}
          >
            Archived ({archivedCount})
          </button>
        </div>

        <div className="cb-search-input-wrap">
          <input
            type="text"
            className="cb-input cb-search-input"
            placeholder="Search your projects or skills..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Content States */}
      {loading ? (
        <div className="cb-loading-state" data-testid="loading-state">
          <div className="cb-spinner" />
          <p>Loading your project portfolio...</p>
        </div>
      ) : error ? (
        <div className="cb-error-state" data-testid="error-state">
          <p className="cb-error-text">{error}</p>
          <button
            type="button"
            onClick={fetchProjects}
            className="cb-btn cb-btn-secondary cb-btn-sm"
          >
            Retry
          </button>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="cb-empty-state" data-testid="empty-state">
          <div className="cb-empty-icon">🚀</div>
          <h2>No Innovation Projects Found</h2>
          <p>
            {searchTerm || statusFilter !== 'all'
              ? 'No projects matched your search criteria.'
              : 'You have not created any projects yet. Start building your verified portfolio today!'}
          </p>
          {!searchTerm && statusFilter === 'all' && (
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="cb-btn cb-btn-primary"
            >
              Create Your First Project
            </button>
          )}
        </div>
      ) : (
        <div className="cb-project-grid" data-testid="projects-grid">
          {filteredProjects.map((project) => (
            <InnovationProjectCard
              key={project.id}
              project={project}
              isOwner
              onEdit={handleOpenEditModal}
              onDelete={(proj) => setDeletingProject(proj)}
            />
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="cb-modal-overlay" role="dialog" aria-modal="true">
          <div className="cb-modal cb-modal-lg">
            <div className="cb-modal-header">
              <h2>{editingProject ? 'Edit Innovation Project' : 'Create Innovation Project'}</h2>
              <button
                type="button"
                className="cb-modal-close"
                onClick={handleCloseModal}
                disabled={isSaving}
              >
                &times;
              </button>
            </div>
            <div className="cb-modal-body">
              <InnovationProjectForm
                initialData={editingProject}
                onSubmit={handleSaveProject}
                onCancel={handleCloseModal}
                isLoading={isSaving}
              />
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingProject && (
        <div className="cb-modal-overlay" role="alertdialog" aria-modal="true">
          <div className="cb-modal cb-modal-sm">
            <div className="cb-modal-header">
              <h2>Confirm Project Deletion</h2>
              <button
                type="button"
                className="cb-modal-close"
                onClick={() => setDeletingProject(null)}
              >
                &times;
              </button>
            </div>
            <div className="cb-modal-body">
              <p>
                Are you sure you want to permanently delete{' '}
                <strong>"{deletingProject.title}"</strong>? This action cannot be undone.
              </p>
            </div>
            <div className="cb-modal-footer">
              <button
                type="button"
                className="cb-btn cb-btn-secondary"
                onClick={() => setDeletingProject(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="cb-btn cb-btn-danger"
                onClick={handleConfirmDelete}
              >
                Delete Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
