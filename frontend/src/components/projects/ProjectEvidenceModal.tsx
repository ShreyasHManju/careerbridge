import React, { useEffect, useState } from 'react';
import {
  EvidenceType,
  ProjectEvidence,
  ProjectEvidenceCreate,
  ProjectEvidenceUpdate,
  ProjectMilestone,
} from '@/types/innovationProject';

interface ProjectEvidenceModalProps {
  isOpen: boolean;
  initialData?: ProjectEvidence | null;
  milestones?: ProjectMilestone[];
  onSubmit: (payload: ProjectEvidenceCreate | ProjectEvidenceUpdate) => Promise<void>;
  onClose: () => void;
  isLoading?: boolean;
}

export const ProjectEvidenceModal: React.FC<ProjectEvidenceModalProps> = ({
  isOpen,
  initialData,
  milestones = [],
  onSubmit,
  onClose,
  isLoading = false,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [evidenceType, setEvidenceType] = useState<EvidenceType>('link');
  const [url, setUrl] = useState('');
  const [milestoneId, setMilestoneId] = useState<number | ''>('');
  const [error, setError] = useState<string | null>(null);

  const isEditMode = !!initialData;

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setDescription(initialData.description || '');
      setEvidenceType(initialData.evidence_type);
      setUrl(initialData.url);
      setMilestoneId(initialData.milestone_id ?? '');
    } else {
      setTitle('');
      setDescription('');
      setEvidenceType('link');
      setUrl('');
      setMilestoneId('');
    }
    setError(null);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle || trimmedTitle.length < 2) {
      setError('Title must be at least 2 characters long.');
      return;
    }
    if (trimmedTitle.length > 150) {
      setError('Title cannot exceed 150 characters.');
      return;
    }

    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setError('URL is required.');
      return;
    }
    if (
      !trimmedUrl.startsWith('http://') &&
      !trimmedUrl.startsWith('https://') &&
      !trimmedUrl.startsWith('ipfs://') &&
      !trimmedUrl.startsWith('ftp://') &&
      !trimmedUrl.startsWith('file://')
    ) {
      setError('URL must start with a valid URI scheme (e.g. https://, http://).');
      return;
    }

    const payload: ProjectEvidenceCreate = {
      title: trimmedTitle,
      description: description.trim() ? description.trim() : null,
      evidence_type: evidenceType,
      url: trimmedUrl,
      milestone_id: milestoneId !== '' ? Number(milestoneId) : null,
    };

    try {
      await onSubmit(payload);
      onClose();
    } catch (err: any) {
      setError(
        err.response?.data?.detail || err.message || 'Failed to save evidence artifact.'
      );
    }
  };

  return (
    <div
      className="cb-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="evidence-modal-title"
    >
      <div className="cb-modal cb-modal-md">
        <div className="cb-modal-header">
          <h3 id="evidence-modal-title">
            {isEditMode ? 'Edit Evidence Artifact' : 'Attach Evidence Artifact'}
          </h3>
          <button
            type="button"
            className="cb-modal-close"
            onClick={onClose}
            disabled={isLoading}
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="cb-modal-form">
          <div className="cb-modal-body">
            {error && (
              <div className="cb-alert cb-alert-danger" role="alert">
                {error}
              </div>
            )}

            <div className="cb-form-group">
              <label htmlFor="evidence-title" className="cb-form-label">
                Evidence Title <span className="cb-required">*</span>
              </label>
              <input
                id="evidence-title"
                type="text"
                className="cb-form-input"
                placeholder="e.g., GitHub Monorepo, Live Demo Video, Circuit Schematics"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={150}
                required
                disabled={isLoading}
              />
            </div>

            <div className="cb-form-row">
              <div className="cb-form-group cb-form-col">
                <label htmlFor="evidence-type" className="cb-form-label">
                  Artifact Category
                </label>
                <select
                  id="evidence-type"
                  className="cb-form-select"
                  value={evidenceType}
                  onChange={(e) => setEvidenceType(e.target.value as EvidenceType)}
                  disabled={isLoading}
                >
                  <option value="repository">📂 Repository</option>
                  <option value="demo">🚀 Live Demo</option>
                  <option value="document">📄 Document / PDF</option>
                  <option value="image">🖼️ Image / Screenshot</option>
                  <option value="video">🎥 Video Recording</option>
                  <option value="presentation">📊 Slide Deck / Presentation</option>
                  <option value="link">🔗 Web Link</option>
                  <option value="other">📌 Other Evidence</option>
                </select>
              </div>

              <div className="cb-form-group cb-form-col">
                <label htmlFor="evidence-milestone" className="cb-form-label">
                  Attach to Milestone (Optional)
                </label>
                <select
                  id="evidence-milestone"
                  className="cb-form-select"
                  value={milestoneId}
                  onChange={(e) =>
                    setMilestoneId(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  disabled={isLoading}
                >
                  <option value="">-- Project-Level Artifact (None) --</option>
                  {milestones.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="cb-form-group">
              <label htmlFor="evidence-url" className="cb-form-label">
                Artifact URL / Link <span className="cb-required">*</span>
              </label>
              <input
                id="evidence-url"
                type="text"
                className="cb-form-input"
                placeholder="https://github.com/org/repo or https://example.com/demo"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                maxLength={500}
                required
                disabled={isLoading}
              />
            </div>

            <div className="cb-form-group">
              <label htmlFor="evidence-desc" className="cb-form-label">
                Description & Technical Context
              </label>
              <textarea
                id="evidence-desc"
                className="cb-form-textarea"
                rows={3}
                placeholder="Explain what this artifact proves and how to review it..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="cb-modal-footer">
            <button
              type="button"
              className="cb-btn cb-btn-secondary"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="cb-btn cb-btn-primary"
              disabled={isLoading}
            >
              {isLoading
                ? 'Saving...'
                : isEditMode
                ? 'Update Artifact'
                : 'Attach Evidence'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
