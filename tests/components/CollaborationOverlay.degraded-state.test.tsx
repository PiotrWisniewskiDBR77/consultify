/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
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
  readyState = MockWebSocket.CLOSED;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(_url: string) {}

  send() {}

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close'));
  }
}

describe('CollaborationOverlay degraded state', () => {
  beforeEach(() => {
    vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket);
    localStorage.setItem('token', 'not-a-jwt');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('shows degraded single-user mode when realtime is not connected', () => {
    render(
      <CollaborationOverlay
        ideaId="idea-1"
        currentUserId="user-1"
        currentUserName="Alice"
        selectedNodeIds={[]}
      />
    );

    expect(screen.getByText('Connection degraded')).toBeInTheDocument();
    expect(screen.getByText('Single-user mode')).toBeInTheDocument();
  });
});
