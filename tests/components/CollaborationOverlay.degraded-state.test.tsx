/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

import { CollaborationOverlay } from '../../src/components/MyWork/mindmap/CollaborationOverlay';

class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];
  readyState = MockWebSocket.CLOSED;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(_url: string) {
    MockWebSocket.instances.push(this);
  }

  send() {}

  open() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.(new Event('open'));
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close'));
  }
}

describe('CollaborationOverlay degraded state', () => {
  beforeEach(() => {
    vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket);
    MockWebSocket.instances = [];
    localStorage.setItem('token', 'not-a-jwt');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('shows connecting state while collaboration websocket is joining', () => {
    render(
      <CollaborationOverlay
        ideaId="idea-1"
        currentUserId="user-1"
        currentUserName="Alice"
        selectedNodeIds={[]}
      />
    );

    expect(screen.getByText('Connecting collaboration')).toBeInTheDocument();
    expect(screen.getByText('Establishing session')).toBeInTheDocument();
  });

  it('shows reconnecting single-user mode after the websocket drops', async () => {
    render(
      <CollaborationOverlay
        ideaId="idea-1"
        currentUserId="user-1"
        currentUserName="Alice"
        selectedNodeIds={[]}
      />
    );

    const socket = MockWebSocket.instances[0];
    expect(socket).toBeDefined();

    await act(async () => {
      socket.open();
      socket.close();
    });

    await waitFor(() => {
      expect(screen.getByText('Reconnecting collaboration')).toBeInTheDocument();
    });
    expect(screen.getByText('Single-user mode')).toBeInTheDocument();
  });
});
