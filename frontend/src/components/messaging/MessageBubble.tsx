/**
 * MessageBubble Component
 * Renders individual chat message with accessible sent/received alignment,
 * timestamps, read receipts, and strict plain-text rendering.
 */

import React from 'react';
import { Message } from '@/types/messaging';

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwnMessage,
}) => {
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const formattedTime = formatTime(message.created_at);

  return (
    <div
      className={`cb-message-bubble-wrapper ${
        isOwnMessage ? 'cb-msg-own' : 'cb-msg-other'
      }`}
      data-testid={`message-bubble-${message.id}`}
    >
      <div
        className={`cb-message-bubble ${
          isOwnMessage ? 'cb-msg-bubble-own' : 'cb-msg-bubble-other'
        }`}
      >
        {!isOwnMessage && message.sender_email && (
          <span className="cb-msg-sender-label">{message.sender_email}</span>
        )}

        {/* Plain text rendering for security */}
        <p className="cb-msg-body">{message.body}</p>

        <div className="cb-msg-meta">
          <time className="cb-msg-time" dateTime={message.created_at}>
            {formattedTime}
          </time>
          {isOwnMessage && (
            <span
              className={`cb-msg-read-status ${
                message.is_read ? 'cb-read-active' : 'cb-read-sent'
              }`}
              title={message.is_read ? 'Read by recipient' : 'Delivered'}
              aria-label={message.is_read ? 'Read' : 'Delivered'}
            >
              {message.is_read ? '✓✓ Read' : '✓ Sent'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
