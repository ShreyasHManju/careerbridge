/**
 * NewConversationModal Component
 * Accessible modal allowing users to initiate a new direct one-to-one conversation
 * with target user ID and optional initial message.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Conversation } from '@/types/messaging';
import * as messagingApi from '@/api/messaging';

interface NewConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (conversation: Conversation) => void;
  initialUserId?: number | null;
}

export const NewConversationModal: React.FC<NewConversationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialUserId = null,
}) => {
  const [targetUserId, setTargetUserId] = useState<string>(
    initialUserId ? String(initialUserId) : ''
  );
  const [initialMessage, setInitialMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const userIdInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialUserId) {
        setTargetUserId(String(initialUserId));
      }
      setError(null);
      setTimeout(() => {
        userIdInputRef.current?.focus();
      }, 50);
    } else {
      setTargetUserId('');
      setInitialMessage('');
      setError(null);
    }
  }, [isOpen, initialUserId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedId = parseInt(targetUserId, 10);
    if (isNaN(parsedId) || parsedId <= 0) {
      setError('Please enter a valid User ID (positive number).');
      return;
    }

    const trimmedMsg = initialMessage.trim();
    if (trimmedMsg.length > 5000) {
      setError('Initial message cannot exceed 5000 characters.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const conv = await messagingApi.createConversation({
        other_user_id: parsedId,
        initial_message: trimmedMsg || undefined,
      });
      onSuccess(conv);
      onClose();
    } catch (err: unknown) {
      const errorObj = err as { message?: string; detail?: string };
      setError(
        typeof errorObj?.detail === 'string'
          ? errorObj.detail
          : errorObj?.message || 'Failed to start conversation. Verify target User ID.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="cb-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-conv-modal-title"
      data-testid="new-conversation-modal"
    >
      <div className="cb-modal-container cb-modal-md">
        <div className="cb-modal-header">
          <h3 id="new-conv-modal-title" className="cb-modal-title">
            Start New Conversation
          </h3>
          <button
            type="button"
            className="cb-modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
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
              <label htmlFor="target-user-id" className="cb-label">
                Recipient User ID <span className="cb-required">*</span>
              </label>
              <input
                ref={userIdInputRef}
                id="target-user-id"
                type="number"
                min="1"
                className="cb-input"
                placeholder="e.g. 5"
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                required
                disabled={isSubmitting}
                data-testid="target-user-id-input"
              />
              <span className="cb-form-help">
                Enter the numerical User ID of the candidate or recruiter you wish to message.
              </span>
            </div>

            <div className="cb-form-group">
              <label htmlFor="initial-message" className="cb-label">
                Initial Message (Optional)
              </label>
              <textarea
                id="initial-message"
                className="cb-textarea"
                rows={3}
                placeholder="Write your opening message..."
                value={initialMessage}
                onChange={(e) => setInitialMessage(e.target.value)}
                maxLength={5000}
                disabled={isSubmitting}
                data-testid="initial-message-input"
              />
            </div>
          </div>

          <div className="cb-modal-footer">
            <button
              type="button"
              className="cb-btn cb-btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="cb-btn cb-btn-primary"
              disabled={isSubmitting || !targetUserId}
              data-testid="submit-new-conversation-btn"
            >
              {isSubmitting ? 'Starting...' : 'Start Chat'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
