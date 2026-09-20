import React, { useState, useEffect } from 'react';
import { Interview, InterviewCreate, InterviewType } from '@/types/interview';
import { scheduleInterview } from '@/api/interviews';
import { ApiErrorResponse } from '@/types/api';

interface ScheduleInterviewModalProps {
  isOpen: boolean;
  applicationId: number;
  candidateEmail?: string | null;
  jobTitle?: string | null;
  companyName?: string | null;
  onClose: () => void;
  onSuccess?: (interview: Interview) => void;
}

const MAX_LOCATION_LENGTH = 500;
const MAX_NOTES_LENGTH = 2000;

export const ScheduleInterviewModal: React.FC<ScheduleInterviewModalProps> = ({
  isOpen,
  applicationId,
  candidateEmail,
  jobTitle,
  companyName,
  onClose,
  onSuccess,
}) => {
  const [scheduledAt, setScheduledAt] = useState<string>('');
  const [durationMinutes, setDurationMinutes] = useState<number>(45);
  const [interviewType, setInterviewType] = useState<InterviewType>('online');
  const [locationOrLink, setLocationOrLink] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  // Set default scheduled time to tomorrow at 10:00 AM local time
  useEffect(() => {
    if (isOpen) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);

      // Format as YYYY-MM-DDTHH:mm for datetime-local input
      const pad = (n: number) => n.toString().padStart(2, '0');
      const formatted = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(
        tomorrow.getDate()
      )}T${pad(tomorrow.getHours())}:${pad(tomorrow.getMinutes())}`;

      setScheduledAt(formatted);
      setDurationMinutes(45);
      setInterviewType('online');
      setLocationOrLink('');
      setNotes('');
      setErrorMessage(null);
      setIsSuccess(false);
      setIsSubmitting(false);
    }
  }, [isOpen, applicationId]);

  // Handle Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || isSuccess) return;

    // Client-side validations
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
      const payload: InterviewCreate = {
        scheduled_at: dateObj.toISOString(),
        duration_minutes: Number(durationMinutes),
        interview_type: interviewType,
        location_or_link: locationOrLink.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      const interview = await scheduleInterview(applicationId, payload);

      setIsSuccess(true);
      if (onSuccess) {
        onSuccess(interview);
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
        'Failed to schedule interview. Please check the inputs and try again.';

      if (apiError?.status === 409 || apiError?.error_code === 'RESOURCE_CONFLICT') {
        message =
          detailStr ||
          'Scheduling Conflict: Either the candidate or recruiter has another interview during this time window.';
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
        aria-labelledby="schedule-modal-title"
        data-testid="schedule-interview-modal"
      >
        <div className="cb-modal-header">
          <h2 id="schedule-modal-title" className="cb-modal-title">
            Schedule Interview
          </h2>
          <button
            type="button"
            className="cb-modal-close-btn"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close schedule interview dialog"
          >
            &times;
          </button>
        </div>

        {isSuccess ? (
          <div className="cb-modal-body">
            <div className="cb-alert cb-alert-success" role="status">
              <strong>Interview Scheduled!</strong> The candidate has been notified via
              in-app notification and email.
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="cb-modal-body" noValidate>
            <p className="cb-modal-subtitle">
              Scheduling for <strong>{jobTitle || `Application #${applicationId}`}</strong>
              {candidateEmail ? ` with candidate ${candidateEmail}` : ''}
              {companyName ? ` at ${companyName}` : ''}.
            </p>

            {errorMessage && (
              <div className="cb-alert cb-alert-danger" role="alert">
                {errorMessage}
              </div>
            )}

            {/* Scheduled Date & Time */}
            <div className="cb-form-group">
              <label htmlFor="interview-scheduled-at" className="cb-filter-label">
                Scheduled Date & Time <span className="cb-required-star">*</span>
              </label>
              <input
                id="interview-scheduled-at"
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
                <label htmlFor="interview-duration" className="cb-filter-label">
                  Duration (Minutes) <span className="cb-required-star">*</span>
                </label>
                <input
                  id="interview-duration"
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
                <label htmlFor="interview-type" className="cb-filter-label">
                  Interview Type
                </label>
                <select
                  id="interview-type"
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

            {/* Location or Link */}
            <div className="cb-form-group">
              <label htmlFor="interview-location" className="cb-filter-label">
                {interviewType === 'online'
                  ? 'Meeting Link / Video URL (Optional)'
                  : interviewType === 'in_person'
                  ? 'Office / Room Location (Optional)'
                  : 'Phone Number / Dial-in (Optional)'}
              </label>
              <input
                id="interview-location"
                type="text"
                className="cb-input"
                placeholder={
                  interviewType === 'online'
                    ? 'https://meet.google.com/abc-defg-hij'
                    : interviewType === 'in_person'
                    ? 'Building 4, 2nd Floor, Room 204'
                    : '+1 (555) 123-4567'
                }
                value={locationOrLink}
                onChange={(e) => setLocationOrLink(e.target.value)}
                disabled={isSubmitting}
                maxLength={MAX_LOCATION_LENGTH}
              />
            </div>

            {/* Recruiter Notes */}
            <div className="cb-form-group">
              <label htmlFor="interview-notes" className="cb-filter-label">
                Notes & Agenda for Candidate (Optional)
              </label>
              <textarea
                id="interview-notes"
                className="cb-textarea"
                rows={4}
                placeholder="Share interview format, topics to prepare, or required materials..."
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
                data-testid="submit-schedule-interview-btn"
              >
                {isSubmitting ? 'Scheduling Interview...' : 'Schedule Interview'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
