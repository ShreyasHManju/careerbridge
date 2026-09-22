/**
 * Custom WebSocket Hook for Real-Time Conversation Synchronization
 *
 * Capabilities:
 * 1. Automatic connection with authentication token from tokenStorage.
 * 2. Exponential backoff reconnection strategy (1s, 2s, 4s, 8s, 16s, 30s max).
 * 3. 30-second ping heartbeat to prevent gateway timeouts.
 * 4. Safe event parsing (new_message, messages_read, message_read, pong, error).
 * 5. Clean teardown and timer disposal on unmount or conversation switch.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { tokenStorage } from '@/utils/tokenStorage';
import {
  Message,
  WebSocketConnectionState,
  WebSocketEvent,
  WSMessagesReadEvent,
  WSMessageReadEvent,
  WSErrorEvent,
} from '@/types/messaging';

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000];
const HEARTBEAT_INTERVAL = 30000;

export function getWebSocketUrl(conversationId: number, token: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const envApi = import.meta.env.VITE_API_URL;
  if (envApi && typeof envApi === 'string' && envApi.startsWith('http')) {
    const url = new URL(envApi);
    const wsProto = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProto}//${url.host}/api/v1/ws/conversations/${conversationId}?token=${encodeURIComponent(token)}`;
  }
  // In development Vite dev server running on 5173
  if (window.location.port === '5173') {
    return `${protocol}//localhost:8000/api/v1/ws/conversations/${conversationId}?token=${encodeURIComponent(token)}`;
  }
  return `${protocol}//${window.location.host}/api/v1/ws/conversations/${conversationId}?token=${encodeURIComponent(token)}`;
}

interface UseWebSocketOptions {
  conversationId: number | null;
  onNewMessage?: (message: Message) => void;
  onMessagesRead?: (event: WSMessagesReadEvent) => void;
  onMessageRead?: (event: WSMessageReadEvent) => void;
  onError?: (event: WSErrorEvent) => void;
  enabled?: boolean;
}

export function useWebSocket({
  conversationId,
  onNewMessage,
  onMessagesRead,
  onMessageRead,
  onError,
  enabled = true,
}: UseWebSocketOptions) {
  const [connectionState, setConnectionState] = useState<WebSocketConnectionState>('disconnected');

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef<number>(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isManuallyClosedRef = useRef<boolean>(false);

  // Store latest callbacks in refs to avoid reconnection loops on callback changes
  const onNewMessageRef = useRef(onNewMessage);
  const onMessagesReadRef = useRef(onMessagesRead);
  const onMessageReadRef = useRef(onMessageRead);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onNewMessageRef.current = onNewMessage;
    onMessagesReadRef.current = onMessagesRead;
    onMessageReadRef.current = onMessageRead;
    onErrorRef.current = onError;
  });

  const clearTimers = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!conversationId || !enabled) {
      return;
    }

    const token = tokenStorage.getToken();
    if (!token) {
      setConnectionState('error');
      return;
    }

    clearTimers();
    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch {
        // Ignore close errors
      }
      socketRef.current = null;
    }

    const url = getWebSocketUrl(conversationId, token);
    setConnectionState(reconnectAttemptRef.current > 0 ? 'reconnecting' : 'connecting');

    try {
      const ws = new WebSocket(url);
      socketRef.current = ws;

      ws.onopen = () => {
        setConnectionState('connected');
        reconnectAttemptRef.current = 0;
        isManuallyClosedRef.current = false;

        // Start heartbeat ping
        heartbeatTimerRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, HEARTBEAT_INTERVAL);
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const payload = JSON.parse(event.data) as WebSocketEvent;
          if (payload.type === 'new_message' && onNewMessageRef.current) {
            onNewMessageRef.current(payload.message);
          } else if (payload.type === 'messages_read' && onMessagesReadRef.current) {
            onMessagesReadRef.current(payload);
          } else if (payload.type === 'message_read' && onMessageReadRef.current) {
            onMessageReadRef.current(payload);
          } else if (payload.type === 'error' && onErrorRef.current) {
            onErrorRef.current(payload);
          }
        } catch {
          // Ignore non-JSON or malformed incoming packets
        }
      };

      ws.onerror = () => {
        setConnectionState('error');
      };

      ws.onclose = (event: CloseEvent) => {
        clearTimers();
        socketRef.current = null;

        if (isManuallyClosedRef.current) {
          setConnectionState('disconnected');
          return;
        }

        // If closed due to policy violation (e.g. 1008 auth/authz fail), do not spam reconnect
        if (event.code === 1008) {
          setConnectionState('error');
          return;
        }

        // Schedule reconnection with exponential backoff
        setConnectionState('reconnecting');
        const delayIndex = Math.min(reconnectAttemptRef.current, RECONNECT_DELAYS.length - 1);
        const delay = RECONNECT_DELAYS[delayIndex];
        reconnectAttemptRef.current += 1;

        reconnectTimerRef.current = setTimeout(() => {
          connect();
        }, delay);
      };
    } catch {
      setConnectionState('error');
    }
  }, [conversationId, enabled, clearTimers]);

  const disconnect = useCallback(() => {
    isManuallyClosedRef.current = true;
    clearTimers();
    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch {
        // Ignore close error
      }
      socketRef.current = null;
    }
    setConnectionState('disconnected');
  }, [clearTimers]);

  const sendMessage = useCallback((body: string): boolean => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'message', body }));
      return true;
    }
    return false;
  }, []);

  const markRead = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'read' }));
    }
  }, []);

  // Effect: Connect when conversationId or enabled changes, clean up when unmounting
  useEffect(() => {
    reconnectAttemptRef.current = 0;
    isManuallyClosedRef.current = false;

    if (conversationId && enabled) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [conversationId, enabled, connect, disconnect]);

  return {
    connectionState,
    sendMessage,
    markRead,
    reconnect: connect,
    disconnect,
  };
}
