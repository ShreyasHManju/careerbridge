/**
 * Unit Tests for useWebSocket Hook (Phase F-09)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWebSocket } from '../useWebSocket';
import { tokenStorage } from '@/utils/tokenStorage';

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  readyState: number = WebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  sentData: string[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sentData.push(data);
  }

  close(code: number = 1000, reason: string = 'Normal') {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code, reason }));
    }
  }

  // Helper trigger methods
  triggerOpen() {
    this.readyState = WebSocket.OPEN;
    if (this.onopen) {
      this.onopen();
    }
  }

  triggerMessage(data: unknown) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
    }
  }
}

describe('useWebSocket Hook', () => {
  const originalWebSocket = global.WebSocket;

  beforeEach(() => {
    vi.useFakeTimers();
    MockWebSocket.instances = [];
    global.WebSocket = MockWebSocket as unknown as typeof WebSocket;
    vi.spyOn(tokenStorage, 'getToken').mockReturnValue('mock-jwt-token-123');
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    global.WebSocket = originalWebSocket;
    vi.restoreAllMocks();
  });

  it('connects with jwt token query param when conversationId is provided', () => {
    const { result } = renderHook(() =>
      useWebSocket({
        conversationId: 42,
        enabled: true,
      })
    );

    expect(result.current.connectionState).toBe('connecting');
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0].url).toContain('/api/v1/ws/conversations/42?token=mock-jwt-token-123');
  });

  it('transitions connectionState to connected upon WebSocket open', () => {
    const { result } = renderHook(() =>
      useWebSocket({
        conversationId: 42,
        enabled: true,
      })
    );

    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.triggerOpen();
    });

    expect(result.current.connectionState).toBe('connected');
  });

  it('dispatches periodic ping heartbeats every 30 seconds', () => {
    renderHook(() =>
      useWebSocket({
        conversationId: 42,
        enabled: true,
      })
    );

    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.triggerOpen();
    });

    // Advance 30 seconds
    act(() => {
      vi.advanceTimersByTime(30000);
    });

    expect(ws.sentData).toContain(JSON.stringify({ type: 'ping' }));
  });

  it('dispatches onNewMessage callback when new_message event arrives', () => {
    const onNewMessageSpy = vi.fn();

    renderHook(() =>
      useWebSocket({
        conversationId: 42,
        onNewMessage: onNewMessageSpy,
        enabled: true,
      })
    );

    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.triggerOpen();
    });

    const mockMsg = {
      id: 99,
      conversation_id: 42,
      sender_id: 2,
      body: 'Hello from real-time socket!',
      is_read: false,
      created_at: '2026-09-20T12:00:00Z',
      updated_at: '2026-09-20T12:00:00Z',
    };

    act(() => {
      ws.triggerMessage({
        type: 'new_message',
        message: mockMsg,
      });
    });

    expect(onNewMessageSpy).toHaveBeenCalledWith(mockMsg);
  });

  it('dispatches onMessagesRead callback when messages_read event arrives', () => {
    const onMessagesReadSpy = vi.fn();

    renderHook(() =>
      useWebSocket({
        conversationId: 42,
        onMessagesRead: onMessagesReadSpy,
        enabled: true,
      })
    );

    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.triggerOpen();
    });

    const readPayload = {
      type: 'messages_read',
      conversation_id: 42,
      reader_id: 5,
      marked_read_count: 3,
      read_at: '2026-09-20T12:05:00Z',
    };

    act(() => {
      ws.triggerMessage(readPayload);
    });

    expect(onMessagesReadSpy).toHaveBeenCalledWith(readPayload);
  });

  it('schedules reconnection with exponential backoff on unexpected close', () => {
    const { result } = renderHook(() =>
      useWebSocket({
        conversationId: 42,
        enabled: true,
      })
    );

    const ws1 = MockWebSocket.instances[0];
    act(() => {
      ws1.triggerOpen();
    });
    expect(result.current.connectionState).toBe('connected');

    // Simulate unexpected drop
    act(() => {
      ws1.close(1006, 'Abnormal closure');
    });

    expect(result.current.connectionState).toBe('reconnecting');

    // Advance 1s (first backoff delay)
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Should create a new WebSocket instance
    expect(MockWebSocket.instances).toHaveLength(2);
  });

  it('does NOT reconnect when socket is closed with policy violation (code 1008)', () => {
    const { result } = renderHook(() =>
      useWebSocket({
        conversationId: 42,
        enabled: true,
      })
    );

    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.close(1008, 'Unauthorized participant');
    });

    expect(result.current.connectionState).toBe('error');

    // Advance timers
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // No new connection created
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it('cleanly closes socket and clears timers on unmount', () => {
    const { unmount } = renderHook(() =>
      useWebSocket({
        conversationId: 42,
        enabled: true,
      })
    );

    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.triggerOpen();
    });

    unmount();

    expect(ws.readyState).toBe(WebSocket.CLOSED);
  });
});
