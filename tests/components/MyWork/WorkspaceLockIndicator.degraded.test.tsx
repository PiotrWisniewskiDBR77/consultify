import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  initReactI18next: {
    type: '3rdParty',
    init: () => undefined,
  },
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (_key: string, fallback?: any) => (typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key)),
  }),
}));

vi.mock('@/services/api/v8/multiplayer', () => ({
  V8MultiplayerApi: {
    getRoomBinding: vi.fn(),
    getRoomLocks: vi.fn(),
  },
}));

import { WorkspaceLockIndicator } from '@/components/MyWork/table/CollaborationPresence';
import { V8MultiplayerApi } from '@/services/api/v8/multiplayer';

describe('WorkspaceLockIndicator degraded state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows degraded lock state when workspace lock bridge fails', async () => {
    vi.mocked(V8MultiplayerApi.getRoomBinding).mockRejectedValue(new Error('room-binding-offline'));

    render(
      <WorkspaceLockIndicator
        workspaceId="org-1"
        currentUserId="user-self"
        enabled={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Workspace locks unavailable')).toBeInTheDocument();
    });
  });
});
