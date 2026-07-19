import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// CollaborationPresence.tsx calls t() for the degraded-lock banner copy with
// NO fallback argument — relies on real locale resources (public/locales/en/
// translation.json). The naive mock has no access to those resources, so it
// must special-case the key asserted on below rather than echo the raw i18n
// key (component-drift note, T1/fala1).
const I18N_KEY_OVERRIDES: Record<string, string> = {
  'myWorkTable.collaborationPresence.workspaceLocksUnavailable': 'Workspace locks unavailable',
};

vi.mock('react-i18next', () => ({
  initReactI18next: {
    type: '3rdParty',
    init: () => undefined,
  },
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (_key: string, fallback?: any) =>
      typeof fallback === 'string'
        ? fallback
        : (fallback?.defaultValue ?? I18N_KEY_OVERRIDES[_key] ?? _key),
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
