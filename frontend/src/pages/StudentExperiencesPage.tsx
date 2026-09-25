import React, { useEffect, useState } from 'react';
import {
  createExperience,
  deleteExperience,
  getMyExperiences,
  requestExperienceVerification,
  updateExperience,
} from '@/api/experiences';
import {
  ExperienceRecord,
  ExperienceRecordCreate,
  ExperienceRecordUpdate,
} from '@/types/experience';
import { ExperienceList } from '@/components/experiences/ExperienceList';
import { ExperienceForm } from '@/components/experiences/ExperienceForm';

export const StudentExperiencesPage: React.FC = () => {
  const [experiences, setExperiences] = useState<ExperienceRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingExperience, setEditingExperience] = useState<ExperienceRecord | null>(null);
  const [deletingExperience, setDeletingExperience] = useState<ExperienceRecord | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const fetchExperiences = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await getMyExperiences();
      setExperiences(resp.items || []);
    } catch (err: any) {
      setError(
        err?.message ||
        err?.detail ||
        'Failed to load your experience records. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExperiences();
  }, []);

  const handleOpenCreateModal = () => {
    setEditingExperience(null);
    setIsModalOpen(true);
    setFeedback(null);
  };

  const handleOpenEditModal = (exp: ExperienceRecord) => {
    setEditingExperience(exp);
    setIsModalOpen(true);
    setFeedback(null);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingExperience(null);
  };

  const handleSaveExperience = async (
    payload: ExperienceRecordCreate | ExperienceRecordUpdate
  ) => {
    setIsSaving(true);
    try {
      if (editingExperience) {
        const updated = await updateExperience(
          editingExperience.id,
          payload as ExperienceRecordUpdate
        );
        setExperiences((prev) =>
          prev.map((item) => (item.id === updated.id ? updated : item))
        );
        setFeedback({
          type: 'success',
          message: `Experience "${updated.title}" updated successfully.`,
        });
      } else {
        const created = await createExperience(payload as ExperienceRecordCreate);
        setExperiences((prev) => [created, ...prev]);
        setFeedback({
          type: 'success',
          message: `Experience "${created.title}" added to your profile.`,
        });
      }
      setIsModalOpen(false);
      setEditingExperience(null);
    } catch (err: any) {
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingExperience) return;
    try {
      await deleteExperience(deletingExperience.id);
      setExperiences((prev) => prev.filter((e) => e.id !== deletingExperience.id));
      setFeedback({
        type: 'success',
        message: `Experience "${deletingExperience.title}" was deleted.`,
      });
      setDeletingExperience(null);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || err?.detail || 'Failed to delete experience record.',
      });
    }
  };

  const handleRequestVerification = async (exp: ExperienceRecord) => {
    setActionLoadingId(exp.id);
    setFeedback(null);
    try {
      const updated = await requestExperienceVerification(exp.id);
      setExperiences((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
      setFeedback({
        type: 'success',
        message: `Verification request submitted for "${updated.title}".`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message:
          err?.message ||
          err?.detail ||
          'Failed to submit verification request. Please try again.',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filter and search
  const filteredExperiences = experiences.filter((e) => {
    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'claimed_or_draft'
        ? e.status === 'claimed' || e.status === 'draft'
        : e.status === statusFilter;

    const term = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !term ||
      e.title.toLowerCase().includes(term) ||
      (e.organization_name && e.organization_name.toLowerCase().includes(term)) ||
      (e.skills && e.skills.toLowerCase().includes(term)) ||
      (e.description && e.description.toLowerCase().includes(term));

    return matchesStatus && matchesSearch;
  });

  const verifiedCount = experiences.filter((e) => e.status === 'verified').length;
  const pendingCount = experiences.filter(
    (e) => e.status === 'pending_verification'
  ).length;
  const claimedCount = experiences.filter(
    (e) => e.status === 'claimed' || e.status === 'draft'
  ).length;
  const rejectedCount = experiences.filter((e) => e.status === 'rejected').length;

  return (
    <div className="cb-page cb-student-experiences-page" data-testid="student-experiences-page">
      <div className="cb-page-header cb-experiences-header">
        <div>
          <h1 className="cb-page-title">Verified Experience</h1>
          <p className="cb-page-subtitle">
            Record internships, research, work experience, and achievements to build your verified credential profile.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreateModal}
          className="cb-btn cb-btn-primary"
          id="btn-create-experience"
          data-testid="add-experience-btn"
        >
          + Add Experience
        </button>
      </div>

      {feedback && (
        <div
          className={`cb-alert ${
            feedback.type === 'success' ? 'cb-alert-success' : 'cb-alert-danger'
          }`}
          role="status"
          data-testid="page-feedback"
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
          <span className="cb-stat-num">{experiences.length}</span>
          <span className="cb-stat-lbl">Total Records</span>
        </div>
        <div className="cb-stat-pill">
          <span className="cb-stat-num">{verifiedCount}</span>
          <span className="cb-stat-lbl">Verified</span>
        </div>
        <div className="cb-stat-pill">
          <span className="cb-stat-num">{pendingCount}</span>
          <span className="cb-stat-lbl">Pending Review</span>
        </div>
        <div className="cb-stat-pill">
          <span className="cb-stat-num">{claimedCount}</span>
          <span className="cb-stat-lbl">Claimed</span>
        </div>
        {rejectedCount > 0 && (
          <div className="cb-stat-pill">
            <span className="cb-stat-num" style={{ color: 'var(--cb-danger)' }}>
              {rejectedCount}
            </span>
            <span className="cb-stat-lbl">Needs Attention</span>
          </div>
        )}
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="cb-toolbar">
        <div className="cb-tabs" role="tablist" aria-label="Experience status filter">
          <button
            type="button"
            className={`cb-tab ${statusFilter === 'all' ? 'cb-tab-active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            All ({experiences.length})
          </button>
          <button
            type="button"
            className={`cb-tab ${statusFilter === 'verified' ? 'cb-tab-active' : ''}`}
            onClick={() => setStatusFilter('verified')}
          >
            Verified ({verifiedCount})
          </button>
          <button
            type="button"
            className={`cb-tab ${statusFilter === 'pending_verification' ? 'cb-tab-active' : ''}`}
            onClick={() => setStatusFilter('pending_verification')}
          >
            Pending ({pendingCount})
          </button>
          <button
            type="button"
            className={`cb-tab ${statusFilter === 'claimed_or_draft' ? 'cb-tab-active' : ''}`}
            onClick={() => setStatusFilter('claimed_or_draft')}
          >
            Claimed ({claimedCount})
          </button>
          {rejectedCount > 0 && (
            <button
              type="button"
              className={`cb-tab ${statusFilter === 'rejected' ? 'cb-tab-active' : ''}`}
              onClick={() => setStatusFilter('rejected')}
            >
              Rejected ({rejectedCount})
            </button>
          )}
        </div>

        <div className="cb-search-input-wrap">
          <input
            type="text"
            className="cb-input cb-search-input"
            placeholder="Search roles, companies, or skills..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Search experience records"
          />
        </div>
      </div>

      {/* Experience List Content */}
      <ExperienceList
        experiences={filteredExperiences}
        isLoading={loading}
        error={error}
        onRetry={fetchExperiences}
        isOwner={true}
        onEdit={handleOpenEditModal}
        onDelete={(exp) => setDeletingExperience(exp)}
        onRequestVerification={handleRequestVerification}
        isLoadingAction={Boolean(actionLoadingId)}
        emptyTitle={
          searchTerm || statusFilter !== 'all'
            ? 'No Matching Experiences'
            : 'No Experience Records Found'
        }
        emptyMessage={
          searchTerm || statusFilter !== 'all'
            ? 'No experience records match your filter criteria.'
            : 'You have not added any experience records yet. Add your internships, projects, and work experience to request formal verification.'
        }
      />

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="cb-modal-overlay" role="dialog" aria-modal="true">
          <div className="cb-modal cb-modal-lg">
            <div className="cb-modal-header" style={{ justifyContent: 'flex-end', borderBottom: 'none', paddingBottom: 0 }}>
              <button
                type="button"
                className="cb-modal-close"
                onClick={handleCloseModal}
                disabled={isSaving}
                aria-label="Close modal"
              >
                &times;
              </button>
            </div>
            <div className="cb-modal-body" style={{ paddingTop: 0 }}>
              <ExperienceForm
                initialData={editingExperience}
                onSubmit={handleSaveExperience}
                onCancel={handleCloseModal}
                isLoading={isSaving}
              />
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingExperience && (
        <div className="cb-modal-overlay" role="alertdialog" aria-modal="true">
          <div className="cb-modal cb-modal-sm">
            <div className="cb-modal-header">
              <h2>Confirm Experience Deletion</h2>
              <button
                type="button"
                className="cb-modal-close"
                onClick={() => setDeletingExperience(null)}
                aria-label="Close dialog"
              >
                &times;
              </button>
            </div>
            <div className="cb-modal-body">
              <p>
                Are you sure you want to delete{' '}
                <strong>"{deletingExperience.title}"</strong>? This action cannot be undone.
              </p>
            </div>
            <div className="cb-modal-footer">
              <button
                type="button"
                className="cb-btn cb-btn-secondary"
                onClick={() => setDeletingExperience(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="cb-btn cb-btn-danger"
                onClick={handleConfirmDelete}
                data-testid="confirm-delete-experience-btn"
              >
                Delete Experience
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
