/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    connectIntegration: vi.fn(),
    configureIntegration: vi.fn(),
    materializeCredential: vi.fn(),
    getHubHealth: vi.fn(),
    getErrors: vi.fn(),
    resolveError: vi.fn(),
    reauthIntegration: vi.fn(),
    disconnectIntegration: vi.fn(),
    pauseIntegration: vi.fn(),
    resumeIntegration: vi.fn(),
    runIntegrationSync: vi.fn(),
    getAuditLog: vi.fn(),
    getAuthHealth: vi.fn(),
    getAuthEscalations: vi.fn(),
    getConflicts: vi.fn(),
    getRefreshTimingPolicy: vi.fn(),
    getConnectorHealth: vi.fn(),
    setConnectorAuthState: vi.fn(),
    resolveAuthEscalation: vi.fn(),
    resolveConflict: vi.fn(),
    setRefreshTimingPolicy: vi.fn(),
  },
  shouldFallbackToLegacySync: (error: any) => {
    const status = Number(error?.status);
    return [400, 404, 405, 501].includes(status);
  },
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

describe('UnifiedSyncHub V8 health continuity', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(V8SyncApi.getIntegrations).mockResolvedValue({
      integrations: [],
      count: 0,
    } as any);
    vi.mocked(V8SyncApi.getConnectors).mockResolvedValue({
      connectors: [],
      count: 0,
    } as any);
    vi.mocked(V8SyncApi.getHubHealth).mockResolvedValue({
      summary: { total: 0, healthy: 0, degraded: 0, unhealthy: 0 },
    } as any);
    vi.mocked(V8SyncApi.getErrors).mockResolvedValue({
      errors: [],
      count: 0,
    } as any);
    vi.mocked(V8SyncApi.getAuditLog).mockResolvedValue({
      entries: [],
      count: 0,
    } as any);
    vi.mocked(V8SyncApi.getAuthHealth).mockResolvedValue({
      summary: { total: 2, healthy: 1, failing: 1, escalated: 0 },
    } as any);
    vi.mocked(V8SyncApi.getAuthEscalations).mockResolvedValue({
      escalations: [],
      count: 0,
    } as any);
    vi.mocked(V8SyncApi.getConflicts).mockResolvedValue({
      conflicts: [],
      count: 0,
    } as any);
    vi.mocked(V8SyncApi.getRefreshTimingPolicy).mockResolvedValue({ policy: null } as any);
    vi.mocked(V8MultiplayerApi.getWorkspaceMapping).mockResolvedValue({ mapping: null } as any);
    vi.mocked(V8MultiplayerApi.getRoomBinding).mockResolvedValue({ binding: null } as any);
    vi.mocked(V8MultiplayerApi.getRoomPresence).mockResolvedValue({ roomId: 'room-1', presence: [], count: 0 } as any);
    vi.mocked(V8MultiplayerApi.getRoomLocks).mockResolvedValue({ roomId: 'room-1', locks: [], count: 0 } as any);

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/sync-hub/connectors')) {
          return {
            ok: true,
            json: async () => ({ connectors: [] }),
          } as Response;
        }
        if (url.endsWith('/sync-hub/health')) {
          return {
            ok: true,
            json: async () => ({ summary: { total: 0, healthy: 0, degraded: 0, unhealthy: 0 } }),
          } as Response;
        }
        if (url.endsWith('/sync-hub/errors')) {
          return {
            ok: true,
            json: async () => ({ errors: [] }),
          } as Response;
        }
        if (url.endsWith('/sync-hub/audit-log')) {
          return {
            ok: true,
            json: async () => ({ entries: [] }),
          } as Response;
        }
        if (url.endsWith('/sync-hub/integrations')) {
          return {
            ok: true,
            json: async () => ({ integrations: [] }),
          } as Response;
        }
        return {
          ok: true,
          json: async () => ({}),
        } as Response;
      }),
    );
  });

  it('shows the empty connected-apps state and governed Sync Health summaries', async () => {
    render(<UnifiedSyncHub />);

    await waitFor(() => {
      expect(V8SyncApi.getIntegrations).toHaveBeenCalled();
      expect(V8SyncApi.getConnectors).toHaveBeenCalled();
      expect(V8SyncApi.getHubHealth).toHaveBeenCalled();
      expect(V8SyncApi.getErrors).toHaveBeenCalled();
      expect(V8SyncApi.getAuditLog).toHaveBeenCalled();
      expect(screen.getByText('Connect your first integration')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Sync Health/i }));

    await waitFor(() => {
      expect(screen.getByText('V8 Auth Health')).toBeInTheDocument();
    });

    expect(screen.getByText('Governed credentials')).toBeInTheDocument();
    expect(screen.getByText('V8 Active Auth Escalations')).toBeInTheDocument();
    expect(screen.getByText('No governed auth escalations are open.')).toBeInTheDocument();
    expect(screen.getByText('V8 Unresolved Sync Conflicts')).toBeInTheDocument();
    expect(screen.getByText('No governed sync conflicts are open.')).toBeInTheDocument();
  });

  it('renders governed multiplayer collaboration subsections on Sync Health', async () => {
    vi.mocked(V8MultiplayerApi.getWorkspaceMapping).mockResolvedValue({
      mapping: {
        mappingId: 'mapping-1',
        resourceType: 'workspace',
        roomGranularity: 'resource',
        embeddedIn: null,
        surfaceAware: true,
        organizationId: 'org-sync-1',
        createdAt: '2026-03-25T00:00:00Z',
      },
    } as any);
    vi.mocked(V8MultiplayerApi.getRoomBinding).mockResolvedValue({
      binding: {
        roomResourceType: 'workspace',
        roomResourceId: 'room-sync-1',
      },
    } as any);
    vi.mocked(V8MultiplayerApi.getRoomPresence).mockResolvedValue({
      roomId: 'room-sync-1',
      presence: [
        {
          surfacePresenceId: 'presence-1',
          userId: 'user-1',
          roomId: 'room-sync-1',
          activeSurface: 'workspace',
          presenceType: 'editor',
          cursorState: null,
          lastHeartbeat: '2026-03-25T00:00:00Z',
          organizationId: 'org-sync-1',
        },
      ],
      count: 1,
    } as any);
    vi.mocked(V8MultiplayerApi.getRoomLocks).mockResolvedValue({
      roomId: 'room-sync-1',
      locks: [
        {
          lockId: 'lock-1',
          organizationId: 'org-sync-1',
          lockType: 'edit',
          lockScope: 'document',
          holderId: 'user-1',
          holderClientId: 'client-1',
          roomId: 'room-sync-1',
          ttl: 120000,
          acquiredAt: '2026-03-25T00:00:00Z',
          releasedAt: null,
          releaseReason: null,
        },
      ],
      count: 1,
    } as any);

    render(<UnifiedSyncHub />);

    fireEvent.click(screen.getByRole('button', { name: /Sync Health/i }));

    await waitFor(() => {
      expect(screen.getByText('V8 Collaboration Substrate')).toBeInTheDocument();
    });

    expect(screen.getByText('V8 Workspace Presence')).toBeInTheDocument();
    expect(screen.getByText('Workspace room: room-sync-1')).toBeInTheDocument();
    expect(screen.getAllByText('user-1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('workspace').length).toBeGreaterThan(0);
    expect(screen.getByText('editor')).toBeInTheDocument();
    expect(screen.getByText('V8 Active Locks')).toBeInTheDocument();
    expect(screen.getByText('edit')).toBeInTheDocument();
    expect(screen.getByText('document')).toBeInTheDocument();
  });

  it('resolves sync errors through the governed V8 mutation before legacy fallback', async () => {
    vi.mocked(V8SyncApi.getErrors).mockResolvedValue({
      errors: [
        {
          id: 'err-1',
          integrationId: 'int-1',
          errorType: 'AUTH',
          errorMessage: 'Token expired',
          isRetryable: false,
          retryCount: 0,
          maxRetries: 3,
          createdAt: '2026-03-25T00:00:00Z',
        },
      ],
      count: 1,
    } as any);
    vi.mocked(V8SyncApi.resolveError).mockResolvedValue({ success: true } as any);

    render(<UnifiedSyncHub />);

    fireEvent.click(screen.getByRole('button', { name: /Sync Health/i }));

    await waitFor(() => {
      expect(screen.getByText('Token expired')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Resolve/i }));

    await waitFor(() => {
      expect(V8SyncApi.resolveError).toHaveBeenCalledWith('err-1');
    });

    expect(global.fetch).not.toHaveBeenCalledWith(
      '/api/sync-hub/errors/err-1/resolve',
      expect.anything(),
    );
  });

  it('uses governed V8 pause and resume mutations before legacy fallback', async () => {
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
          connector: null,
        },
      ],
      count: 1,
    } as any);
    vi.mocked(V8SyncApi.pauseIntegration).mockResolvedValue({ success: true } as any);
    vi.mocked(V8SyncApi.resumeIntegration).mockResolvedValue({ success: true } as any);

    render(<UnifiedSyncHub />);

    await waitFor(() => {
      expect(screen.getByText('Jira')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Pause'));

    await waitFor(() => {
      expect(V8SyncApi.pauseIntegration).toHaveBeenCalledWith('int-1');
    });

    expect(global.fetch).not.toHaveBeenCalledWith('/api/sync-hub/pause/int-1', expect.anything());

    fireEvent.click(screen.getByText('Jira').closest('div[class*="cursor-pointer"]') as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: /Resume/i }));

    await waitFor(() => {
      expect(V8SyncApi.resumeIntegration).toHaveBeenCalledWith('int-1');
    });

    expect(global.fetch).not.toHaveBeenCalledWith('/api/sync-hub/resume/int-1', expect.anything());
  });

  it('uses governed V8 reauth mutation before legacy fallback', async () => {
    const initialIntegrations = {
      integrations: [
        {
          id: 'int-1',
          connectorId: 'jira',
          name: 'Jira',
          category: 'project_management',
          status: 'requires_reauth',
          lastSyncAt: null,
          lastError: 'Token expired',
          health: 'degraded',
          errorRate: 0,
          unresolvedErrors: 0,
          lastRun: null,
          configuredFields: ['site_url', 'cloud_id'],
          onboardingStatus: null,
          connector: {
            id: 'jira',
            name: 'Jira',
            category: 'project_management',
            capabilities: ['issues'],
            authType: 'oauth2',
            configFields: ['site_url', 'cloud_id'],
          },
        },
      ],
      count: 1,
    };
    const updatedIntegrations = {
      integrations: [
        {
          id: 'int-1',
          connectorId: 'jira',
          name: 'Jira',
          category: 'project_management',
          status: 'pending',
          lastSyncAt: null,
          lastError: null,
          health: 'degraded',
          errorRate: 0,
          unresolvedErrors: 0,
          lastRun: null,
          configuredFields: ['site_url', 'cloud_id'],
          onboardingStatus: 'pending_external_auth',
          connector: {
            id: 'jira',
            name: 'Jira',
            category: 'project_management',
            capabilities: ['issues'],
            authType: 'oauth2',
            configFields: ['site_url', 'cloud_id'],
          },
        },
      ],
      count: 1,
    };
    vi.mocked(V8SyncApi.getIntegrations).mockResolvedValue(initialIntegrations as any);
    vi.mocked(V8SyncApi.reauthIntegration).mockResolvedValue({
      success: true,
      message: 'Re-authorization initiated',
      onboardingStatus: 'pending_external_auth',
    } as any);

    render(<UnifiedSyncHub />);

    await waitFor(() => {
      expect(screen.getByText('Jira')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Jira').closest('div[class*="cursor-pointer"]') as HTMLElement);
    vi.mocked(V8SyncApi.getIntegrations).mockResolvedValue(updatedIntegrations as any);
    fireEvent.click(screen.getByRole('button', { name: /Re-authorize/i }));

    await waitFor(() => {
      expect(V8SyncApi.reauthIntegration).toHaveBeenCalledWith('int-1');
    });

    expect(global.fetch).not.toHaveBeenCalledWith('/api/sync-hub/reauth/int-1', expect.anything());
    await waitFor(() => {
      expect(
        screen.getByText(
          'Required provider configuration is saved. Complete external auth before sync controls become available.',
        ),
      ).toBeInTheDocument();
    });
    expect(screen.getByText('Finish external auth to enable sync controls')).toBeInTheDocument();
  });

  it('uses governed V8 disconnect mutation before legacy fallback', async () => {
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
          connector: null,
        },
      ],
      count: 1,
    } as any);
    vi.mocked(V8SyncApi.disconnectIntegration).mockResolvedValue({ success: true } as any);

    render(<UnifiedSyncHub />);

    await waitFor(() => {
      expect(screen.getByText('Jira')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Jira').closest('div[class*="cursor-pointer"]') as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: /Disconnect/i }));

    await waitFor(() => {
      expect(V8SyncApi.disconnectIntegration).toHaveBeenCalledWith('int-1');
    });

    expect(global.fetch).not.toHaveBeenCalledWith('/api/sync-hub/disconnect/int-1', expect.anything());
  });

  it('uses governed V8 run-now mutation before legacy fallback', async () => {
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
          connector: null,
        },
      ],
      count: 1,
    } as any);
    vi.mocked(V8SyncApi.runIntegrationSync).mockResolvedValue({
      success: true,
      syncRun: {
        id: 'run-1',
        status: 'completed',
        recordsSynced: 12,
        duration: 345,
      },
      warnings: [],
    } as any);

    render(<UnifiedSyncHub />);

    await waitFor(() => {
      expect(screen.getByText('Jira')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Run now'));

    await waitFor(() => {
      expect(V8SyncApi.runIntegrationSync).toHaveBeenCalledWith('int-1');
    });

    expect(global.fetch).not.toHaveBeenCalledWith('/api/sync-hub/sync/int-1', expect.anything());
  });

  it('uses governed V8 connect initiation before legacy fallback and keeps onboarding honest', async () => {
    vi.mocked(V8SyncApi.getConnectors).mockResolvedValue({
      connectors: [
        {
          id: 'jira',
          name: 'Jira',
          category: 'project_management',
          capabilities: ['issues'],
          authType: 'oauth2',
          configFields: ['site_url', 'cloud_id'],
          isAvailable: true,
          isV2Ready: true,
          comingSoon: false,
        },
      ],
      count: 1,
    } as any);
    vi.mocked(V8SyncApi.connectIntegration).mockResolvedValue({
      integration: {
        id: 'int-1',
        connectorId: 'jira',
        name: 'Jira',
        category: 'project_management',
        status: 'pending',
        configuredFields: [],
        onboardingStatus: 'pending_external_auth_or_configuration',
        capabilities: ['issues'],
        authType: 'oauth2',
        configFields: ['site_url', 'cloud_id'],
        scopes: ['read:issues'],
      },
      onboardingStatus: 'pending_external_auth_or_configuration',
    } as any);

    render(<UnifiedSyncHub />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Connect your first integration/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Connect your first integration/i }));

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /^Connect$/i }).length).toBeGreaterThan(0);
    });

    expect(screen.getByText('site url')).toBeInTheDocument();
    expect(screen.getByText('cloud id')).toBeInTheDocument();

    const connectButtons = screen.getAllByRole('button', { name: /^Connect$/i });
    fireEvent.click(connectButtons[connectButtons.length - 1]);

    await waitFor(() => {
      expect(V8SyncApi.connectIntegration).toHaveBeenCalledWith('jira');
    });

    expect(global.fetch).not.toHaveBeenCalledWith('/api/sync-hub/connect', expect.anything());
  });

  it('keeps pending integrations honest until onboarding completes', async () => {
    vi.mocked(V8SyncApi.getIntegrations).mockResolvedValue({
      integrations: [
        {
          id: 'int-pending-1',
          connectorId: 'jira',
          name: 'Jira',
          category: 'project_management',
          status: 'pending',
          lastSyncAt: null,
          lastError: null,
          health: 'degraded',
          errorRate: 25,
          unresolvedErrors: 0,
          lastRun: null,
          configuredFields: [],
          onboardingStatus: 'pending_external_auth_or_configuration',
          connector: {
            id: 'jira',
            name: 'Jira',
            category: 'project_management',
            capabilities: ['issues'],
            authType: 'oauth2',
            configFields: ['site_url', 'cloud_id'],
          },
        },
      ],
      count: 1,
    } as any);

    render(<UnifiedSyncHub />);

    await waitFor(() => {
      expect(screen.getByText('Jira')).toBeInTheDocument();
    });

    const runNowIconButton = screen.getByTitle('Run now') as HTMLButtonElement;
    const pauseIconButton = screen.getByTitle('Pause') as HTMLButtonElement;
    expect(runNowIconButton).toBeDisabled();
    expect(pauseIconButton).toBeDisabled();

    fireEvent.click(screen.getByText('Jira'));

    await waitFor(() => {
      expect(screen.getByText('Connection setup still pending')).toBeInTheDocument();
    });

    expect(
      screen.getByText('Complete external auth or provider configuration before sync controls become available.'),
    ).toBeInTheDocument();
    expect(screen.getByText('site url')).toBeInTheDocument();
    expect(screen.getByText('cloud id')).toBeInTheDocument();
    expect(screen.getByText('Finish auth/config to enable sync controls')).toBeInTheDocument();
    screen.getAllByRole('button', { name: /Run now/i }).forEach((button) => {
      expect(button).toBeDisabled();
    });
    expect(screen.queryByRole('button', { name: /Resume/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Disconnect/i }));

    await waitFor(() => {
      expect(V8SyncApi.disconnectIntegration).toHaveBeenCalledWith('int-pending-1');
    });

    expect(V8SyncApi.runIntegrationSync).not.toHaveBeenCalled();
    expect(V8SyncApi.pauseIntegration).not.toHaveBeenCalled();
  });

  it('saves pending provider config through the governed V8 seam before auth completes', async () => {
    const initialIntegrations = {
      integrations: [
        {
          id: 'int-pending-2',
          connectorId: 'jira',
          name: 'Jira',
          category: 'project_management',
          status: 'pending',
          lastSyncAt: null,
          lastError: null,
          health: 'degraded',
          errorRate: 25,
          unresolvedErrors: 0,
          lastRun: null,
          configuredFields: [],
          onboardingStatus: 'pending_external_auth_or_configuration',
          connector: {
            id: 'jira',
            name: 'Jira',
            category: 'project_management',
            capabilities: ['issues'],
            authType: 'oauth2',
            configFields: ['site_url', 'cloud_id'],
          },
        },
      ],
      count: 1,
    };
    const updatedIntegrations = {
      integrations: [
        {
          id: 'int-pending-2',
          connectorId: 'jira',
          name: 'Jira',
          category: 'project_management',
          status: 'pending',
          lastSyncAt: null,
          lastError: null,
          health: 'degraded',
          errorRate: 25,
          unresolvedErrors: 0,
          lastRun: null,
          configuredFields: ['site_url', 'cloud_id'],
          onboardingStatus: 'pending_external_auth',
          connector: {
            id: 'jira',
            name: 'Jira',
            category: 'project_management',
            capabilities: ['issues'],
            authType: 'oauth2',
            configFields: ['site_url', 'cloud_id'],
          },
        },
      ],
      count: 1,
    };
    vi.mocked(V8SyncApi.getIntegrations).mockResolvedValue(initialIntegrations as any);
    vi.mocked(V8SyncApi.configureIntegration).mockResolvedValue({
      integration: {
        id: 'int-pending-2',
        connectorId: 'jira',
        status: 'pending',
        configuredFields: ['site_url', 'cloud_id'],
        onboardingStatus: 'pending_external_auth',
      },
      externalAuth: {
        callbackUrl: 'https://example.com/api/sync-hub/external-auth/callback?state=prepared',
        state: 'prepared',
        expiresAt: '2026-03-27T19:00:00.000Z',
      },
    } as any);

    render(<UnifiedSyncHub />);

    await waitFor(() => {
      expect(screen.getByText('Jira')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Jira').closest('div[class*="cursor-pointer"]') as HTMLElement);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Add provider config/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Add provider config/i }));
    fireEvent.change(screen.getByPlaceholderText('site url'), {
      target: { value: 'https://example.atlassian.net' },
    });
    fireEvent.change(screen.getByPlaceholderText('cloud id'), {
      target: { value: 'cloud-123' },
    });
    vi.mocked(V8SyncApi.getIntegrations).mockResolvedValue(updatedIntegrations as any);
    fireEvent.click(screen.getByRole('button', { name: /Save provider config/i }));

    await waitFor(() => {
      expect(V8SyncApi.configureIntegration).toHaveBeenCalledWith('int-pending-2', {
        config: { site_url: 'https://example.atlassian.net', cloud_id: 'cloud-123' },
      });
    });

    await waitFor(() => {
      expect(
        screen.getByText(
          'Required provider configuration is saved. Complete external auth before sync controls become available.',
        ),
      ).toBeInTheDocument();
    });

    expect(screen.getByText('site url saved')).toBeInTheDocument();
    expect(screen.getByText('cloud id saved')).toBeInTheDocument();
    expect(screen.getByText('{{configured}} of {{total}} required setup fields saved.')).toBeInTheDocument();
    expect(screen.getByText('Finish external auth to enable sync controls')).toBeInTheDocument();
    expect(screen.getByText('Governed external auth return is prepared')).toBeInTheDocument();
    expect(
      screen.getByText('https://example.com/api/sync-hub/external-auth/callback?state=prepared'),
    ).toBeInTheDocument();
  });

  it('shows callback-received pending verification honesty on the governed hub', async () => {
    vi.mocked(V8SyncApi.getIntegrations).mockResolvedValue({
      integrations: [
        {
          id: 'int-pending-3',
          connectorId: 'jira',
          name: 'Jira',
          category: 'project_management',
          status: 'pending',
          lastSyncAt: null,
          lastError: null,
          health: 'degraded',
          errorRate: 10,
          unresolvedErrors: 0,
          lastRun: null,
          configuredFields: ['site_url', 'cloud_id'],
          onboardingStatus: 'authorization_callback_received_pending_verification',
          connector: {
            id: 'jira',
            name: 'Jira',
            category: 'project_management',
            capabilities: ['issues'],
            authType: 'oauth2',
            configFields: ['site_url', 'cloud_id'],
          },
        },
      ],
      count: 1,
    } as any);

    render(<UnifiedSyncHub />);

    await waitFor(() => {
      expect(screen.getByText('Jira')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Jira'));

    await waitFor(() => {
      expect(
        screen.getByText(
          'The external authorization callback was received. Verification is still pending before sync controls become available.',
        ),
      ).toBeInTheDocument();
    });

    expect(screen.getByText('Verification still pending before sync controls unlock')).toBeInTheDocument();
  });

  it('promotes callback-received integrations to connected through governed verification completion', async () => {
    const pendingVerificationIntegrations = {
      integrations: [
        {
          id: 'int-pending-4',
          connectorId: 'jira',
          name: 'Jira',
          category: 'project_management',
          status: 'pending',
          lastSyncAt: null,
          lastError: null,
          health: 'degraded',
          errorRate: 10,
          unresolvedErrors: 0,
          lastRun: null,
          configuredFields: ['site_url', 'cloud_id'],
          onboardingStatus: 'authorization_callback_received_pending_verification',
          connector: {
            id: 'jira',
            name: 'Jira',
            category: 'project_management',
            capabilities: ['issues'],
            authType: 'oauth2',
            configFields: ['site_url', 'cloud_id'],
          },
        },
      ],
      count: 1,
    };
    const connectedIntegrations = {
      integrations: [
        {
          id: 'int-pending-4',
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
          configuredFields: ['site_url', 'cloud_id'],
          onboardingStatus: null,
          connector: {
            id: 'jira',
            name: 'Jira',
            category: 'project_management',
            capabilities: ['issues'],
            authType: 'oauth2',
            configFields: ['site_url', 'cloud_id'],
          },
        },
      ],
      count: 1,
    };

    vi.mocked(V8SyncApi.getIntegrations).mockResolvedValue(pendingVerificationIntegrations as any);
    vi.mocked(V8SyncApi.setConnectorAuthState).mockResolvedValue({
      record: {
        connectorId: 'jira',
        organizationId: 'org-sync-1',
        authState: 'healthy',
      },
    } as any);

    render(<UnifiedSyncHub />);

    await waitFor(() => {
      expect(screen.getByText('Jira')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Jira'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Mark verification complete/i })).toBeInTheDocument();
    });

    vi.mocked(V8SyncApi.getIntegrations).mockResolvedValue(connectedIntegrations as any);
    fireEvent.click(screen.getByRole('button', { name: /Mark verification complete/i }));

    await waitFor(() => {
      expect(V8SyncApi.setConnectorAuthState).toHaveBeenCalledWith(
        'jira',
        'healthy',
        'callback_verification_completed',
      );
    });

    await waitFor(() => {
      expect(screen.getByTitle('Run now')).not.toBeDisabled();
    });
  });

  it('records governed credential baseline on the active hub after verification completes', async () => {
    const connectedWithoutCredential = {
      integrations: [
        {
          id: 'int-connected-1',
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
          configuredFields: ['site_url', 'cloud_id'],
          onboardingStatus: null,
          credential: null,
          connector: {
            id: 'jira',
            name: 'Jira',
            category: 'project_management',
            capabilities: ['issues'],
            authType: 'oauth2',
            configFields: ['site_url', 'cloud_id'],
          },
        },
      ],
      count: 1,
    };
    const connectedWithCredential = {
      integrations: [
        {
          id: 'int-connected-1',
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
          configuredFields: ['site_url', 'cloud_id'],
          onboardingStatus: null,
          credential: {
            providerAccountId: 'acct-123',
            workspaceOrTenantId: 'tenant-456',
            scopesGranted: ['read:jira-work'],
            tokenExpiresAt: '2026-03-27T19:00:00.000Z',
            lastVerificationAt: '2026-03-27T18:00:00.000Z',
            lastRefreshAt: null,
            lastRefreshResult: null,
          },
          connector: {
            id: 'jira',
            name: 'Jira',
            category: 'project_management',
            capabilities: ['issues'],
            authType: 'oauth2',
            configFields: ['site_url', 'cloud_id'],
          },
        },
      ],
      count: 1,
    };

    vi.mocked(V8SyncApi.getIntegrations).mockResolvedValue(connectedWithoutCredential as any);
    vi.mocked(V8SyncApi.materializeCredential).mockResolvedValue({
      credential: {
        credentialId: 'cred-1',
        connectorId: 'jira',
        organizationId: 'org-sync-1',
        providerAccountId: 'acct-123',
        workspaceOrTenantId: 'tenant-456',
        scopesGranted: ['read:jira-work'],
        tokenExpiresAt: '2026-03-27T19:00:00.000Z',
        lastVerificationAt: '2026-03-27T18:00:00.000Z',
        lastRefreshAt: null,
        lastRefreshResult: null,
        createdAt: '2026-03-27T18:00:00.000Z',
        updatedAt: '2026-03-27T18:00:00.000Z',
      },
    } as any);

    render(<UnifiedSyncHub />);

    await waitFor(() => {
      expect(screen.getByText('Jira')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Jira'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Add governed credential/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Add governed credential/i }));
    fireEvent.change(screen.getByPlaceholderText('acct-123'), { target: { value: 'acct-123' } });
    fireEvent.change(screen.getByPlaceholderText('tenant-456'), { target: { value: 'tenant-456' } });
    fireEvent.change(screen.getByPlaceholderText('read:jira-work, write:jira-work'), {
      target: { value: 'read:jira-work' },
    });
    fireEvent.change(screen.getByPlaceholderText('2026-03-27T19:00:00.000Z'), {
      target: { value: '2026-03-27T19:00:00.000Z' },
    });

    vi.mocked(V8SyncApi.getIntegrations).mockResolvedValue(connectedWithCredential as any);
    fireEvent.click(screen.getByRole('button', { name: /Save governed credential/i }));

    await waitFor(() => {
      expect(V8SyncApi.materializeCredential).toHaveBeenCalledWith('int-connected-1', {
        providerAccountId: 'acct-123',
        workspaceOrTenantId: 'tenant-456',
        scopesGranted: ['read:jira-work'],
        tokenExpiresAt: '2026-03-27T19:00:00.000Z',
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Credential metadata is recorded for governed refresh and recovery readback.')).toBeInTheDocument();
    });

    expect(screen.getByText('acct-123')).toBeInTheDocument();
    expect(screen.getByText('tenant-456')).toBeInTheDocument();
    expect(screen.getByText('read:jira-work')).toBeInTheDocument();
  });
});
