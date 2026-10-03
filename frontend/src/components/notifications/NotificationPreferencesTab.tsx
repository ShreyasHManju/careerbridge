import React from 'react';
import { NotificationPreference, NotificationFrequency } from '@/types/notification';

export interface NotificationPreferencesTabProps {
  preference: NotificationPreference | null;
  onFrequencyChange: (frequency: NotificationFrequency) => void;
  onEmailToggle: (enabled: boolean) => void;
  isSaving: boolean;
  successMessage?: string | null;
  errorMessage?: string | null;
  onRetry?: () => void;
}

export const NotificationPreferencesTab: React.FC<NotificationPreferencesTabProps> = ({
  preference,
  onFrequencyChange,
  onEmailToggle,
  isSaving,
  successMessage,
  errorMessage,
  onRetry,
}) => {
  return (
    <div className="cb-notification-preferences-panel" data-testid="preferences-panel">
      {errorMessage && (
        <div className="cb-notification-error" role="alert">
          <span>{errorMessage}</span>
          {onRetry && (
            <button
              type="button"
              className="cb-btn cb-btn-secondary cb-btn-xs"
              onClick={onRetry}
            >
              Retry
            </button>
          )}
        </div>
      )}

      {successMessage && (
        <div className="cb-alert cb-alert-success cb-notification-success-alert" role="status">
          {successMessage}
        </div>
      )}

      <div className="cb-pref-section">
        <h4 className="cb-pref-section-title">Delivery Frequency</h4>
        <p className="cb-pref-section-desc">
          Choose how often you receive status and update notifications.
        </p>

        <div className="cb-pref-options">
          <label className="cb-radio-label">
            <input
              type="radio"
              name="notification-frequency"
              value="instant"
              checked={preference?.frequency === 'instant'}
              onChange={() => onFrequencyChange('instant')}
              disabled={isSaving}
              data-testid="freq-instant-radio"
            />
            <div className="cb-radio-text">
              <span className="cb-radio-title">Instant Delivery</span>
              <span className="cb-radio-sub">Receive notifications immediately in real time.</span>
            </div>
          </label>

          <label className="cb-radio-label">
            <input
              type="radio"
              name="notification-frequency"
              value="digest"
              checked={preference?.frequency === 'digest'}
              onChange={() => onFrequencyChange('digest')}
              disabled={isSaving}
              data-testid="freq-digest-radio"
            />
            <div className="cb-radio-text">
              <span className="cb-radio-title">Daily Digest</span>
              <span className="cb-radio-sub">Consolidate periodic updates into a digest.</span>
            </div>
          </label>
        </div>
      </div>

      <div className="cb-pref-section">
        <h4 className="cb-pref-section-title">Email Notifications</h4>
        <p className="cb-pref-section-desc">
          Send transactional confirmation and status update emails.
        </p>
        <label className="cb-checkbox-wrapper cb-pref-email-toggle">
          <input
            type="checkbox"
            className="cb-checkbox"
            checked={preference?.email_notifications ?? true}
            onChange={(e) => onEmailToggle(e.target.checked)}
            disabled={isSaving}
            data-testid="email-notif-checkbox"
          />
          <span>Enable transactional email notifications</span>
        </label>
      </div>
    </div>
  );
};
