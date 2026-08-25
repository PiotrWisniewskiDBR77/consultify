import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import enTranslation from '../../../public/locales/en/translation.json';

// CollaborationPresence.tsx calls t('myWorkTable.collaborationPresence.locked') etc. with NO
// fallback argument (relies on public/locales/en/translation.json). The previous mock only
// resolved a string/defaultValue fallback, so calls with none returned the raw key, and the
// "N locked" / "Row: status" text assertions never matched. Resolve real English copy
// instead (same pattern as IdeaExportMenu.test.tsx), keeping `t` a stable identity.
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
    getRoomLocks: vi.fn(),
  },
}));

import { WorkspaceLockIndicator } from '@/components/MyWork/table/CollaborationPresence';
import { V8MultiplayerApi } from '@/services/api/v8/multiplayer';

describe('WorkspaceLockIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders governed workspace locks from the V8 room binding and lock bridge', async () => {
    vi.mocked(V8MultiplayerApi.getRoomBinding).mockResolvedValue({
      binding: {
        roomResourceType: 'workspace',
        roomResourceId: 'room-7',
      },
      resourceType: 'workspace',
      resourceId: 'org-1',
      parentResourceId: null,
    } as any);
    vi.mocked(V8MultiplayerApi.getRoomLocks).mockResolvedValue({
      roomId: 'room-7',
      count: 4,
      locks: [
        {
          lockId: 'lock-self',
          organizationId: 'org-1',
          lockType: 'optimistic_row',
          lockScope: 'task:123:status',
          holderId: 'user-self',
          holderClientId: 'client-1',
          roomId: 'room-7',
          ttl: 60000,
          acquiredAt: new Date().toISOString(),
          releasedAt: null,
          releaseReason: null,
        },
        {
          lockId: 'lock-1',
          organizationId: 'org-1',
          lockType: 'optimistic_row',
          lockScope: 'task:123:status',
          holderId: 'user-a',
          holderClientId: 'client-2',
          roomId: 'room-7',
          ttl: 60000,
          acquiredAt: new Date().toISOString(),
          releasedAt: null,
          releaseReason: null,
        },
        {
          lockId: 'lock-2',
          organizationId: 'org-1',
          lockType: 'exclusive_schema',
          lockScope: 'table:idea-1:columns',
          holderId: 'user-b',
          holderClientId: 'client-3',
          roomId: 'room-7',
          ttl: 60000,
          acquiredAt: new Date().toISOString(),
          releasedAt: null,
          releaseReason: null,
        },
        {
          lockId: 'lock-stale',
          organizationId: 'org-1',
          lockType: 'optimistic_section',
          lockScope: 'report:r-1:section-9',
          holderId: 'user-c',
          holderClientId: 'client-4',
          roomId: 'room-7',
          ttl: 1000,
          acquiredAt: new Date(Date.now() - 5000).toISOString(),
          releasedAt: null,
          releaseReason: null,
        },
      ],
    } as any);

    render(
      <WorkspaceLockIndicator
        workspaceId="org-1"
        currentUserId="user-self"
        enabled={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('2 locked')).toBeInTheDocument();
    });

    expect(V8MultiplayerApi.getRoomBinding).toHaveBeenCalledWith('workspace', 'org-1');
    expect(V8MultiplayerApi.getRoomLocks).toHaveBeenCalledWith('room-7');
    expect(screen.getByText('Row: status')).toBeInTheDocument();
    expect(screen.getByText('Schema: columns')).toBeInTheDocument();
    expect(screen.getByTitle('user-a • Row • task:123:status')).toBeInTheDocument();
    expect(screen.queryByText('Section: section-9')).not.toBeInTheDocument();
  });

  it('stays hidden when the governed workspace room has no active remote locks', async () => {
    vi.mocked(V8MultiplayerApi.getRoomBinding).mockResolvedValue({
      binding: {
        roomResourceType: 'workspace',
        roomResourceId: 'room-8',
      },
      resourceType: 'workspace',
      resourceId: 'org-1',
      parentResourceId: null,
    } as any);
    vi.mocked(V8MultiplayerApi.getRoomLocks).mockResolvedValue({
      roomId: 'room-8',
      count: 0,
      locks: [],
    } as any);

    const { container } = render(
      <WorkspaceLockIndicator
        workspaceId="org-1"
        currentUserId="user-self"
        enabled={true}
      />
    );

    await waitFor(() => {
      expect(V8MultiplayerApi.getRoomLocks).toHaveBeenCalledWith('room-8');
    });

    expect(container).toBeEmptyDOMElement();
  });
});
