import React, { useEffect, useState } from 'react';
import {
  MilestoneStatus,
  ProjectMilestone,
  ProjectMilestoneCreate,
  ProjectMilestoneUpdate,
} from '@/types/innovationProject';

interface ProjectMilestoneModalProps {
  isOpen: boolean;
  initialData?: ProjectMilestone | null;
  onSubmit: (payload: ProjectMilestoneCreate | ProjectMilestoneUpdate) => Promise<void>;
  onClose: () => void;
  isLoading?: boolean;
}

export const ProjectMilestoneModal: React.FC<ProjectMilestoneModalProps> = ({
  isOpen,
  initialData,
  onSubmit,
  onClose,
  isLoading = false,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<MilestoneStatus>('todo');
  const [displayOrder, setDisplayOrder] = useState<number>(0);
  const [dueDate, setDueDate] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const isEditMode = !!initialData;

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setDescription(initialData.description || '');
      setStatus(initialData.status);
      setDisplayOrder(initialData.display_order);
      setDueDate(
        initialData.due_date ? initialData.due_date.split('T')[0] : ''
      );
    } else {
      setTitle('');
      setDescription('');
      setStatus('todo');
      setDisplayOrder(0);
      setDueDate('');
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

    if (displayOrder < 0 || isNaN(displayOrder)) {
      setError('Display order must be a non-negative integer.');
      return;
    }

    const payload: ProjectMilestoneCreate = {
      title: trimmedTitle,
      description: description.trim() ? description.trim() : null,
      status,
      display_order: Number(displayOrder),
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
    };

    try {
      await onSubmit(payload);
      onClose();
    } catch (err: any) {
      setError(
        err.response?.data?.detail || err.message || 'Failed to save milestone.'
      );
    }
  };

  return (
    <div
      className="cb-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="milestone-modal-title"
    >
      <div className="cb-modal cb-modal-md">
        <div className="cb-modal-header">
          <h3 id="milestone-modal-title">
            {isEditMode ? 'Edit Project Milestone' : 'Add New Milestone'}
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
              <label htmlFor="milestone-title" className="cb-form-label">
                Milestone Title <span className="cb-required">*</span>
              </label>
              <input
                id="milestone-title"
                type="text"
                className="cb-form-input"
                placeholder="e.g., Complete ROS2 Navigation Node Architecture"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={150}
                required
                disabled={isLoading}
              />
            </div>

            <div className="cb-form-group">
              <label htmlFor="milestone-desc" className="cb-form-label">
                Deliverables & Description
              </label>
              <textarea
                id="milestone-desc"
                className="cb-form-textarea"
                rows={3}
                placeholder="Details on what deliverables or artifacts mark this milestone as complete..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
                disabled={isLoading}
              />
            </div>

            <div className="cb-form-row">
              <div className="cb-form-group cb-form-col">
                <label htmlFor="milestone-status" className="cb-form-label">
                  Execution Status
                </label>
                <select
                  id="milestone-status"
                  className="cb-form-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as MilestoneStatus)}
                  disabled={isLoading}
                >
                  <option value="todo">To do</option>
                  <option value="in_progress">In progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div className="cb-form-group cb-form-col">
                <label htmlFor="milestone-order" className="cb-form-label">
                  Display Order
                </label>
                <input
                  id="milestone-order"
                  type="number"
                  min="0"
                  className="cb-form-input"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(parseInt(e.target.value, 10) || 0)}
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="cb-form-group">
              <label htmlFor="milestone-due-date" className="cb-form-label">
                Target Due Date
              </label>
              <input
                id="milestone-due-date"
                type="date"
                className="cb-form-input"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
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
                ? 'Update Milestone'
                : 'Add Milestone'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
