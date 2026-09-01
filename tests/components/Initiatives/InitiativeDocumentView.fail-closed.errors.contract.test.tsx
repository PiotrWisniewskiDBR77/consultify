/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';


vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({
    isChatCollapsed: false,
    toggleChatCollapse: vi.fn(),
    setCurrentView: vi.fn(),
    setMyWorkIntent: vi.fn(),
    currentUser: { id: 'u-1', name: 'Tester' },
    // ★ 2026-09-01 („jedna Teresa"): karta publikuje kontekst i komendy do
    // JEDNEGO okna Teresy zamiast renderować własny czat, więc czyta z uiSlice
    // te dwa settery (i sprząta `chatContextActions` przy odmontowaniu).
    // Bez nich atrapa store'u wywracała odmontowanie widoku.
    setChatSystemPrompt: vi.fn(),
    setChatContextActions: vi.fn(),
  }),
}));

vi.mock('@/store/useConversationStore', () => ({
  useConversationStore: () => ({
    updateWorkspaceFromView: vi.fn(),
  }),
}));

vi.mock('@/hooks/usePresentationMode', () => ({
  usePresentationMode: () => ({ presentationMode: 'n', setPresentationMode: vi.fn() }),
}));

vi.mock('@/services/api/v8/planning', () => ({
  V8PlanningApi: {
    getInitiative: vi.fn(async () => {
      throw {
        data: { code: 'EXECUTION_INITIATIVES_READ_FAILED', error: 'internal secret should not leak' },
        message: 'internal secret should not leak',
      };
    }),
  },
}));

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(async () => []),
    getInitiativeById: vi.fn(async () => {
      throw new Error('fallback internal secret');
    }),
    getLinkGraphBacklinks: vi.fn(async () => []),
    getLinkGraphForwardLinks: vi.fn(async () => []),
    post: vi.fn(async () => ({})),
    put: vi.fn(async () => ({})),
    delete: vi.fn(async () => ({})),
  },
}));

import { InitiativeDocumentView } from '@/components/Initiatives/InitiativeDocumentView';

describe('InitiativeDocumentView fail-closed load error contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows safe mapped load error with alert role and code', async () => {
    render(<InitiativeDocumentView initiativeId="11111111-1111-4111-8111-111111111111" />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Failed to load initiative card.');
    expect(alert).toHaveTextContent('Failed to load initiative');
    expect(alert.textContent || '').not.toContain('internal secret should not leak');
  });
});

