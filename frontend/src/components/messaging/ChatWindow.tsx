/**
 * ChatWindow Component
 * Renders the active conversation thread, real-time status pill,
 * message bubbles, and composer with character counter and HTTP fallback.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Conversation, Message, WebSocketConnectionState } from '@/types/messaging';
import { MessageBubble } from './MessageBubble';

interface ChatWindowProps {
  conversation: Conversation | null;
  messages: Message[];
  currentUserId: number | null;
  isLoadingMessages: boolean;
  error: string | null;
  onRetry: () => void;
  onSendMessage: (body: string) => Promise<void>;
  connectionState: WebSocketConnectionState;
  onBack?: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  conversation,
  messages,
  currentUserId,
  isLoadingMessages,
  error,
  onRetry,
  onSendMessage,
  connectionState,
  onBack,
}) => {
  const [inputText, setInputText] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on message updates
  useEffect(() => {
    if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = async () => {
    const trimmed = inputText.trim();
    if (!trimmed || isSending) return;

    if (trimmed.length > 5000) {
      setSendError('Message exceeds maximum 5,000 characters limit.');
      return;
    }

    setSendError(null);
    setIsSending(true);
    try {
      await onSendMessage(trimmed);
      setInputText('');
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setSendError(errorObj?.message || 'Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!conversation) {
    return (
      <main className="cb-chat-window cb-chat-window-empty" aria-label="Chat">
        <div className="cb-chat-placeholder" data-testid="no-conversation-selected">
          <div className="cb-chat-placeholder-icon">💬</div>
          <h3>Select a Conversation</h3>
          <p>Choose an existing thread or start a new message to begin communicating.</p>
        </div>
      </main>
    );
  }

  const participant = conversation.other_participant;
  const displayName = participant.full_name || participant.company_name || participant.email;

  const renderStatusBadge = () => {
    switch (connectionState) {
      case 'connected':
        return (
          <span
            className="cb-status-pill cb-status-connected"
            title="Real-time WebSocket connected"
            data-testid="ws-status-connected"
          >
            ⚡ Live
          </span>
        );
      case 'connecting':
      case 'reconnecting':
        return (
          <span
            className="cb-status-pill cb-status-reconnecting"
            title="Reconnecting real-time socket..."
            data-testid="ws-status-reconnecting"
          >
            🔄 Connecting...
          </span>
        );
      case 'error':
      case 'disconnected':
      default:
        return (
          <span
            className="cb-status-pill cb-status-offline"
            title="WebSocket offline. Messages will send via HTTP fallback."
            data-testid="ws-status-offline"
          >
            ☁️ HTTP Mode
          </span>
        );
    }
  };

  return (
    <main className="cb-chat-window" aria-label={`Chat with ${displayName}`}>
      {/* Header */}
      <div className="cb-chat-header">
        <div className="cb-chat-header-left">
          {onBack && (
            <button
              type="button"
              className="cb-btn cb-btn-link cb-chat-back-btn"
              onClick={onBack}
              aria-label="Back to conversations"
              data-testid="chat-back-btn"
            >
              ← Back
            </button>
          )}

          <div className="cb-chat-avatar">
            <span>{displayName.charAt(0).toUpperCase()}</span>
          </div>

          <div className="cb-chat-user-info">
            <h3 className="cb-chat-user-name">{displayName}</h3>
            <div className="cb-chat-user-meta">
              <span className={`cb-role-tag cb-role-${participant.role}`}>
                {participant.role}
              </span>
              {participant.company_name && (
                <span className="cb-chat-company-tag">{participant.company_name}</span>
              )}
            </div>
          </div>
        </div>

        <div className="cb-chat-header-right">{renderStatusBadge()}</div>
      </div>

      {/* Message Feed */}
      <div className="cb-chat-feed" role="log" aria-live="polite">
        {isLoadingMessages ? (
          <div className="cb-chat-loading" role="status" aria-live="polite">
            <div className="cb-spinner" aria-hidden="true" />
            <p>Loading messages...</p>
          </div>
        ) : error ? (
          <div className="cb-chat-error" role="alert">
            <p>{error}</p>
            <button
              type="button"
              className="cb-btn cb-btn-secondary cb-btn-sm"
              onClick={onRetry}
            >
              Retry
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div className="cb-chat-empty-thread" data-testid="chat-empty-thread">
            <p className="cb-empty-title">No messages yet</p>
            <p className="cb-empty-desc">
              Send the first message to start the conversation with {displayName}.
            </p>
          </div>
        ) : (
          <div className="cb-chat-messages-container">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isOwnMessage={msg.sender_id === currentUserId}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="cb-chat-composer-wrap">
        {sendError && (
          <div className="cb-alert cb-alert-danger cb-composer-error" role="alert">
            {sendError}
          </div>
        )}

        <div className="cb-chat-composer-box">
          <textarea
            ref={textareaRef}
            className="cb-textarea cb-chat-textarea"
            placeholder={`Message ${displayName}... (Press Enter to send, Shift+Enter for new line)`}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSending}
            rows={2}
            maxLength={5000}
            aria-label={`Write message to ${displayName}`}
            data-testid="chat-message-input"
          />

          <div className="cb-chat-composer-bottom">
            <span
              className={`cb-char-counter ${
                inputText.length > 4500 ? 'cb-char-warning' : ''
              }`}
            >
              {inputText.length} / 5000
            </span>

            <button
              type="button"
              className="cb-btn cb-btn-primary cb-btn-sm cb-chat-send-btn"
              onClick={handleSend}
              disabled={!inputText.trim() || isSending}
              aria-label="Send message"
              data-testid="chat-send-btn"
            >
              {isSending ? 'Sending...' : 'Send ✈️'}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
};
