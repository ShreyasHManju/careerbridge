import React, { useState, useEffect } from 'react';
import {
  Interview,
  InterviewStatus,
  InterviewType,
  InterviewUpdate,
} from '@/types/interview';
import { updateInterview } from '@/api/interviews';
import { ApiErrorResponse } from '@/types/api';

interface RescheduleInterviewModalProps {
  isOpen: boolean;
  interview: Interview | null;
  onClose: () => void;
  onSuccess?: (updatedInterview: Interview) => void;
}

const MAX_LOCATION_LENGTH = 500;
const MAX_NOTES_LENGTH = 2000;

export const RescheduleInterviewModal: React.FC<RescheduleInterviewModalProps> = ({
  isOpen,
  interview,
  onClose,
  onSuccess,
}) => {
  const [scheduledAt, setScheduledAt] = useState<string>('');
  const [durationMinutes, setDurationMinutes] = useState<number>(45);
  const [interviewType, setInterviewType] = useState<InterviewType>('online');
  const [locationOrLink, setLocationOrLink] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [status, setStatus] = useState<InterviewStatus>('scheduled');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && interview) {
      try {
        const d = new Date(interview.scheduled_at);
        const pad = (n: number) => n.toString().padStart(2, '0');
        const formatted = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
          d.getDate()
        )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        setScheduledAt(formatted);
      } catch {
        setScheduledAt('');
      }

      setDurationMinutes(interview.duration_minutes || 45);
      setInterviewType(interview.interview_type || 'online');
      setLocationOrLink(interview.location_or_link || '');
      setNotes(interview.notes || '');
      setStatus(interview.status || 'scheduled');
      setErrorMessage(null);
      setIsSuccess(false);
      setIsSubmitting(false);
    }
  }, [isOpen, interview]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !interview) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || isSuccess) return;

    if (!scheduledAt) {
      setErrorMessage('Please select a valid scheduled date and time.');
      return;
    }

    const dateObj = new Date(scheduledAt);
    if (isNaN(dateObj.getTime())) {
      setErrorMessage('Invalid date and time selected.');
      return;
    }

    if (!durationMinutes || durationMinutes < 1 || durationMinutes > 480) {
      setErrorMessage('Duration must be an integer between 1 and 480 minutes.');
      return;
    }

    if (locationOrLink.length > MAX_LOCATION_LENGTH) {
      setErrorMessage(`Location/Link cannot exceed ${MAX_LOCATION_LENGTH} characters.`);
      return;
    }

    if (notes.length > MAX_NOTES_LENGTH) {
      setErrorMessage(`Notes cannot exceed ${MAX_NOTES_LENGTH} characters.`);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload: InterviewUpdate = {
        scheduled_at: dateObj.toISOString(),
        duration_minutes: Number(durationMinutes),
        interview_type: interviewType,
        location_or_link: locationOrLink.trim() || undefined,
        notes: notes.trim() || undefined,
        status: status,
      };

      const updated = await updateInterview(interview.id, payload);

      setIsSuccess(true);
      if (onSuccess) {
        onSuccess(updated);
      }
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: unknown) {
      const apiError = err as ApiErrorResponse;
      const detailStr = typeof apiError?.detail === 'string' ? apiError.detail : null;
      let message =
        detailStr ||
        apiError?.message ||
        'Failed to update interview. Please check the inputs and try again.';

      if (apiError?.status === 409 || apiError?.error_code === 'RESOURCE_CONFLICT') {
        message =
          detailStr ||
          'Scheduling Conflict: Either the candidate or recruiter has another active interview during this time window.';
      }

      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="cb-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div
        className="cb-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reschedule-modal-title"
        data-testid="reschedule-interview-modal"
      >
        <div className="cb-modal-header">
          <h2 id="reschedule-modal-title" className="cb-modal-title">
            Reschedule / Edit Interview
          </h2>
          <button
            type="button"
            className="cb-modal-close-btn"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close edit interview dialog"
          >
            &times;
          </button>
        </div>

        {isSuccess ? (
          <div className="cb-modal-body">
            <div className="cb-alert cb-alert-success" role="status">
              <strong>Interview Updated!</strong> Changes have been saved successfully.
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="cb-modal-body" noValidate>
            <p className="cb-modal-subtitle">
              Updating interview for <strong>{interview.job_title || 'Position'}</strong>
              {interview.candidate_email ? ` with ${interview.candidate_email}` : ''}.
            </p>

            {errorMessage && (
              <div className="cb-alert cb-alert-danger" role="alert">
                {errorMessage}
              </div>
            )}

            {/* Scheduled Date & Time */}
            <div className="cb-form-group">
              <label htmlFor="reschedule-scheduled-at" className="cb-filter-label">
                Scheduled Date & Time <span className="cb-required-star">*</span>
              </label>
              <input
                id="reschedule-scheduled-at"
                type="datetime-local"
                className="cb-input"
                value={scheduledAt}
                onChange={(e) => {
                  setScheduledAt(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                disabled={isSubmitting}
                required
              />
            </div>

            {/* Duration and Type Row */}
            <div className="cb-form-row">
              <div className="cb-form-group cb-form-col">
                <label htmlFor="reschedule-duration" className="cb-filter-label">
                  Duration (Minutes) <span className="cb-required-star">*</span>
                </label>
                <input
                  id="reschedule-duration"
                  type="number"
                  className="cb-input"
                  min={1}
                  max={480}
                  value={durationMinutes}
                  onChange={(e) => {
                    setDurationMinutes(parseInt(e.target.value, 10) || 0);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  disabled={isSubmitting}
                  required
                />
              </div>

              <div className="cb-form-group cb-form-col">
                <label htmlFor="reschedule-type" className="cb-filter-label">
                  Interview Type
                </label>
                <select
                  id="reschedule-type"
                  className="cb-select"
                  value={interviewType}
                  onChange={(e) => setInterviewType(e.target.value as InterviewType)}
                  disabled={isSubmitting}
                >
                  <option value="online">💻 Online Video</option>
                  <option value="in_person">🏢 In-Person</option>
                  <option value="phone">📞 Phone Call</option>
                </select>
              </div>
            </div>

            {/* Status Selector */}
            <div className="cb-form-group">
              <label htmlFor="reschedule-status" className="cb-filter-label">
                Interview Status
              </label>
              <select
                id="reschedule-status"
                className="cb-select"
                value={status}
                onChange={(e) => setStatus(e.target.value as InterviewStatus)}
                disabled={isSubmitting}
              >
                <option value="scheduled">Scheduled</option>
                <option value="rescheduled">Rescheduled</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {/* Location or Link */}
            <div className="cb-form-group">
              <label htmlFor="reschedule-location" className="cb-filter-label">
                {interviewType === 'online'
                  ? 'Meeting Link / Video URL'
                  : interviewType === 'in_person'
                  ? 'Office / Room Location'
                  : 'Phone Number / Dial-in'}
              </label>
              <input
                id="reschedule-location"
                type="text"
                className="cb-input"
                placeholder="Meeting link or location details..."
                value={locationOrLink}
                onChange={(e) => setLocationOrLink(e.target.value)}
                disabled={isSubmitting}
                maxLength={MAX_LOCATION_LENGTH}
              />
            </div>

            {/* Recruiter Notes */}
            <div className="cb-form-group">
              <label htmlFor="reschedule-notes" className="cb-filter-label">
                Notes & Agenda
              </label>
              <textarea
                id="reschedule-notes"
                className="cb-textarea"
                rows={4}
                placeholder="Updated instructions or notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isSubmitting}
                maxLength={MAX_NOTES_LENGTH}
              />
              <div className="cb-char-counter">
                <span>
                  {notes.length} / {MAX_NOTES_LENGTH} characters
                </span>
              </div>
            </div>

            <div className="cb-modal-footer">
              <button
                type="button"
                onClick={onClose}
                className="cb-btn cb-btn-secondary"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="cb-btn cb-btn-primary"
                disabled={isSubmitting}
                data-testid="submit-update-interview-btn"
              >
                {isSubmitting ? 'Saving Changes...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
