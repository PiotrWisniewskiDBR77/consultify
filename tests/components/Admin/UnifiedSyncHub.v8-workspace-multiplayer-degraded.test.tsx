/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: any) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

vi.mock('react-hot-toast', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
    i18n: { language: 'en' },
  }),
  initReactI18next: {
    type: '3rdParty',
    init: () => {},
  },
}));

vi.mock('../../../src/services/api', () => ({
  API_URL: '/api',
  getHeaders: () => ({ Authorization: 'Bearer test' }),
}));

vi.mock('../../../src/services/funnelAnalytics', () => ({
  trackFunnelEvent: vi.fn(),
}));

vi.mock('../../../src/store/useAppStore', () => ({
  useAppStore: () => ({
    currentOrganization: { id: 'org-sync-1' },
  }),
}));

vi.mock('../../../src/services/api/v8/sync', () => ({
  V8SyncApi: {
    getIntegrations: vi.fn(),
    getConnectors: vi.fn(),
    getHubHealth: vi.fn(),
    getErrors: vi.fn(),
    getAuditLog: vi.fn(),
    getAuthHealth: vi.fn(),
    getAuthEscalations: vi.fn(),
    getConflicts: vi.fn(),
    getRuns: vi.fn(),
    getRefreshTimingPolicy: vi.fn(),
    getWorkflowPolicy: vi.fn(),
    setWorkflowPolicy: vi.fn(),
  },
  shouldFallbackToLegacySync: () => false,
}));

vi.mock('../../../src/services/api/v8/multiplayer', () => ({
  V8MultiplayerApi: {
    getWorkspaceMapping: vi.fn(),
    getRoomBinding: vi.fn(),
    getRoomPresence: vi.fn(),
    getRoomLocks: vi.fn(),
  },
}));

import { UnifiedSyncHub } from '../../../src/components/Admin/UnifiedSyncHub';
import { V8MultiplayerApi } from '../../../src/services/api/v8/multiplayer';
import { V8SyncApi } from '../../../src/services/api/v8/sync';

describe('UnifiedSyncHub V8 workspace degraded states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({}) }) as Response)
    );

    vi.mocked(V8SyncApi.getIntegrations).mockResolvedValue({ integrations: [], count: 0 } as any);
    vi.mocked(V8SyncApi.getConnectors).mockResolvedValue({ connectors: [], count: 0 } as any);
    vi.mocked(V8SyncApi.getHubHealth).mockResolvedValue({
      summary: { total: 0, healthy: 0, degraded: 0, unhealthy: 0 },
    } as any);
    vi.mocked(V8SyncApi.getErrors).mockResolvedValue({ errors: [], count: 0 } as any);
    vi.mocked(V8SyncApi.getAuditLog).mockResolvedValue({ entries: [], count: 0 } as any);
    vi.mocked(V8SyncApi.getAuthHealth).mockResolvedValue({
      summary: { total: 0, healthy: 0, failing: 0, escalated: 0 },
    } as any);
    vi.mocked(V8SyncApi.getAuthEscalations).mockResolvedValue({ escalations: [], count: 0 } as any);
    vi.mocked(V8SyncApi.getConflicts).mockResolvedValue({ conflicts: [], count: 0 } as any);
    vi.mocked(V8SyncApi.getRuns).mockResolvedValue({ runs: [], total: 0 } as any);
    vi.mocked(V8SyncApi.getRefreshTimingPolicy).mockResolvedValue({ policy: null } as any);
    vi.mocked(V8SyncApi.getWorkflowPolicy).mockResolvedValue({
      integrationId: 'int-1',
      workflowPolicy: 'active',
      reason: null,
      setBy: null,
      setAt: null,
      isPaused: false,
    } as any);
    vi.mocked(V8SyncApi.setWorkflowPolicy).mockResolvedValue({
      success: true,
      policy: 'active',
      isPaused: false,
    } as any);
    vi.mocked(V8MultiplayerApi.getWorkspaceMapping).mockResolvedValue({ mapping: null } as any);
  });

  it('shows degraded presence message when presence bridge read fails', async () => {
    vi.mocked(V8MultiplayerApi.getRoomBinding).mockResolvedValue({
      binding: { roomResourceType: 'workspace', roomResourceId: 'room-1' },
    } as any);
    vi.mocked(V8MultiplayerApi.getRoomPresence).mockRejectedValue(new Error('presence down'));
    vi.mocked(V8MultiplayerApi.getRoomLocks).mockResolvedValue({
      roomId: 'room-1',
      locks: [],
      count: 0,
    } as any);

    render(<UnifiedSyncHub />);
    fireEvent.click(screen.getByRole('button', { name: /Sync Health/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Workspace presence unavailable. Presence bridge read failed.')
      ).toBeInTheDocument();
    });
  });

  it('keeps healthy empty copy when bridges return empty arrays', async () => {
    vi.mocked(V8MultiplayerApi.getRoomBinding).mockResolvedValue({
      binding: { roomResourceType: 'workspace', roomResourceId: 'room-1' },
    } as any);
    vi.mocked(V8MultiplayerApi.getRoomPresence).mockResolvedValue({
      roomId: 'room-1',
      presence: [],
      count: 0,
    } as any);
    vi.mocked(V8MultiplayerApi.getRoomLocks).mockResolvedValue({
      roomId: 'room-1',
      locks: [],
      count: 0,
    } as any);

    render(<UnifiedSyncHub />);
    fireEvent.click(screen.getByRole('button', { name: /Sync Health/i }));

    await waitFor(() => {
      expect(screen.getByText('No governed workspace presence is active.')).toBeInTheDocument();
    });
    expect(
      screen.queryByText('Workspace presence unavailable. Presence bridge read failed.')
    ).not.toBeInTheDocument();
  });

  it('shows workflow policy gate section for connected integration drawer', async () => {
    vi.mocked(V8SyncApi.getIntegrations).mockResolvedValue({
      integrations: [
        {
          id: 'int-1',
          connectorId: 'jira',
          name: 'Jira',
          category: 'project_management',
          status: 'connected',
          lastSyncAt: null,
          lastError: null,
          health: 'healthy',
          errorRate: 0,
          unresolvedErrors: 0,
          lastRun: null,
          configuredFields: [],
          onboardingStatus: null,
          credential: null,
          connector: {
            id: 'jira',
            name: 'Jira',
            category: 'project_management',
            capabilities: ['issues'],
            authType: 'oauth2',
            configFields: [],
          },
        },
      ],
      count: 1,
    } as any);
    render(<UnifiedSyncHub />);

    await waitFor(() => {
      expect(screen.getByText('Jira')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Jira').closest('div[class*="cursor-pointer"]') as HTMLElement);

    await waitFor(() => {
      expect(screen.getByText('Workflow policy gate')).toBeInTheDocument();
    });
  });
});
