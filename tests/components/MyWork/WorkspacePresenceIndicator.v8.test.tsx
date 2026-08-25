import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import enTranslation from '../../../public/locales/en/translation.json';

// CollaborationPresence.tsx calls t('myWorkTable.collaborationPresence.online') etc. with NO
// fallback argument (relies on public/locales/en/translation.json). The previous mock only
// resolved a string/defaultValue fallback, so calls with none returned the raw key, and the
// "N online" text assertion never matched. Resolve real English copy instead (same pattern
// as IdeaExportMenu.test.tsx), keeping `t` a stable identity.
function resolveTranslation(key: string, options?: Record<string, unknown>): string {
  const value = key
    .split('.')
    .reduce<unknown>(
      (acc, segment) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[segment] : undefined),
      enTranslation
    );
  const template = typeof value === 'string' ? value : key;
  if (!options) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_match, name) =>
    Object.prototype.hasOwnProperty.call(options, name) ? String(options[name]) : `{{${name}}}`
  );
}
const t = (key: string, options?: Record<string, unknown>) => resolveTranslation(key, options);

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t,
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('@/services/api/v8/multiplayer', () => ({
  V8MultiplayerApi: {
    getRoomBinding: vi.fn(),
    getRoomPresence: vi.fn(),
  },
}));

import { WorkspacePresenceIndicator } from '@/components/MyWork/table/CollaborationPresence';
import { V8MultiplayerApi } from '@/services/api/v8/multiplayer';

describe('WorkspacePresenceIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders governed workspace presence from the V8 room binding and presence bridge', async () => {
    vi.mocked(V8MultiplayerApi.getRoomBinding).mockResolvedValue({
      binding: {
        roomResourceType: 'workspace',
        roomResourceId: 'room-1',
      },
      resourceType: 'workspace',
      resourceId: 'org-1',
      parentResourceId: null,
    } as any);
    vi.mocked(V8MultiplayerApi.getRoomPresence).mockResolvedValue({
      roomId: 'room-1',
      count: 2,
      presence: [
        {
          surfacePresenceId: 'presence-self',
          userId: 'user-self',
          roomId: 'room-1',
          activeSurface: 'idea_table',
          presenceType: 'active',
          cursorState: null,
          lastHeartbeat: new Date().toISOString(),
          organizationId: 'org-1',
        },
        {
          surfacePresenceId: 'presence-other',
          userId: 'user-other',
          roomId: 'room-1',
          activeSurface: 'idea_table',
          presenceType: 'typing',
          cursorState: null,
          lastHeartbeat: new Date().toISOString(),
          organizationId: 'org-1',
        },
      ],
    } as any);

    render(
      <WorkspacePresenceIndicator
        workspaceId="org-1"
        currentUserId="user-self"
        enabled={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('1 online')).toBeInTheDocument();
    });

    expect(V8MultiplayerApi.getRoomBinding).toHaveBeenCalledWith('workspace', 'org-1');
    expect(V8MultiplayerApi.getRoomPresence).toHaveBeenCalledWith('room-1');
    expect(screen.getByTitle('user-other (typing…)')).toBeInTheDocument();
    expect(screen.queryByTitle('user-self')).not.toBeInTheDocument();
  });

  it('stays hidden when the governed workspace room has no active remote presence', async () => {
    vi.mocked(V8MultiplayerApi.getRoomBinding).mockResolvedValue({
      binding: {
        roomResourceType: 'workspace',
        roomResourceId: 'room-2',
      },
      resourceType: 'workspace',
      resourceId: 'org-1',
      parentResourceId: null,
    } as any);
    vi.mocked(V8MultiplayerApi.getRoomPresence).mockResolvedValue({
      roomId: 'room-2',
      count: 0,
      presence: [],
    } as any);

    const { container } = render(
      <WorkspacePresenceIndicator
        workspaceId="org-1"
        currentUserId="user-self"
        enabled={true}
      />
    );

    await waitFor(() => {
      expect(V8MultiplayerApi.getRoomPresence).toHaveBeenCalledWith('room-2');
    });

    expect(container).toBeEmptyDOMElement();
  });
});
