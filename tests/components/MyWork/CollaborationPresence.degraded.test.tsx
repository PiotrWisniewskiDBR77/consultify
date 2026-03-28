import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (_key: string, fallback?: string) => fallback || _key,
  }),
}));

vi.mock('@/services/api', () => ({
  Api: {
    broadcastIdeaPresence: vi.fn().mockResolvedValue({ ok: true }),
    getIdeaPresence: vi.fn(),
  },
}));

import { CollaborationPresence } from '@/components/MyWork/table/CollaborationPresence';
import { Api } from '@/services/api';

describe('CollaborationPresence degraded state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows degraded readback when the legacy presence poll fails', async () => {
    vi.mocked(Api.getIdeaPresence).mockRejectedValue(new Error('presence offline'));

    render(
      <CollaborationPresence
        ideaId="idea-1"
        currentUserId="user-self"
        currentUserName="Alice"
        enabled={true}
        renderIndicator={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Presence degraded')).toBeInTheDocument();
    });
  });
});
