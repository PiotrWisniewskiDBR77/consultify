import { cleanup, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { session } = vi.hoisted(() => ({
  session: { user: { id: 'user-a', organizationId: 'org-1' } },
}));

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: vi.fn() },
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
    i18n: {
      language: 'en',
      getFixedT: () => (key: string, fallback?: unknown) =>
        typeof fallback === 'string' ? fallback : key,
    },
  }),
}));
vi.mock('@/hooks/useDemoSession', () => ({ useDemoSession: () => ({ isDemo: false }) }));
vi.mock('@/hooks/useCloudIntegrations', () => ({
  useCloudIntegrations: () => ({
    connectedProviderIds: [],
    openFilePicker: vi.fn(),
    isPickerOpen: false,
    activeProvider: null,
    closeFilePicker: vi.fn(),
    selectFile: vi.fn(),
    isImplemented: false,
  }),
}));
vi.mock('@/hooks/useOpenChatWithContext', () => ({ useOpenChatWithContext: () => vi.fn() }));
vi.mock('@/hooks/usePresentationMode', () => ({
  usePresentationMode: () => ({ mode: 'n', setMode: vi.fn() }),
}));
vi.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => false }));
vi.mock('@/hooks/useAccordionSections', () => ({
  useAccordionSections: () => ({ toggleSection: vi.fn(), isExpanded: () => true }),
}));
vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({
    isChatCollapsed: false,
    toggleChatCollapse: vi.fn(),
    setChatKickoffMessage: vi.fn(),
    currentProjectId: 'project-1',
    emitMyWorkEvent: vi.fn(),
    currentUser: session.user,
  }),
}));
vi.mock('@/store/useConversationStore', () => ({
  useConversationStore: () => ({ updateWorkspaceFromView: vi.fn() }),
}));
vi.mock('@/components/shared/NModeLayout/useCardLayout', () => ({
  useCardLayout: () => ({ applyToSections: (sections: unknown) => sections }),
}));
vi.mock('@/components/shared/NModeLayout/useCardAIAnalysis', () => ({
  useCardAIAnalysis: () => ({ analyze: vi.fn(), isAnalyzing: false, result: null, clear: vi.fn() }),
}));
vi.mock('@/components/shared/NModeLayout/NModeHeader', () => ({
  NModeHeader: ({ title }: { title: string }) => React.createElement('div', null, title),
}));
vi.mock('@/components/shared/NModeLayout/NModeCardManager', () => ({
  SectionsManagerMenu: () => null,
}));
vi.mock('@/components/shared/RequiredProjectPicker', () => ({ RequiredProjectPicker: () => null }));
vi.mock('@/components/shared/CapabilityGate', () => ({
  CapabilityGate: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));
vi.mock('../../../services/api', () => ({
  Api: new Proxy(
    {},
    {
      get: (_target, property) => {
        if (property === 'get')
          return vi.fn(async (path: string) =>
            path.includes('/detail')
              ? {
                  data: {
                    id: 'decision-1',
                    title: 'Owner isolation',
                    status: 'pending',
                    projectId: 'project-1',
                  },
                }
              : path.includes('/object-attachments/')
                ? { data: { data: [] } }
                : { stakeholders: [] }
          );
        if (property === 'getDecisionHistory') return vi.fn(async () => []);
        return vi.fn(async () => []);
      },
    }
  ),
  API_URL: '/api',
  getHeaders: () => ({}),
}));

import { DecisionDetailView } from '../DecisionDetailView';

describe('day173 decision enhancement owner isolation', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => cleanup());

  it('does not claim or delete an owner-unknown legacy entry when another user opens the decision', async () => {
    const legacyKey = 'consultify-decision-enhancements:decision-1';
    const legacyValue = JSON.stringify({
      schemaVersion: 1,
      savedAt: '2026-08-30T10:00:00.000Z',
      description: 'user A note',
    });
    window.localStorage.setItem(legacyKey, legacyValue);

    session.user = { id: 'user-b', organizationId: 'org-1' };
    render(React.createElement(DecisionDetailView, { decisionId: 'decision-1', onClose: vi.fn() }));

    await screen.findByText('Owner isolation');
    await waitFor(() => expect(window.localStorage.getItem(legacyKey)).toBe(legacyValue));
    const userBValue = window.localStorage.getItem(
      'consultify-decision-enhancements:org-1:user-b:decision-1'
    );
    expect(userBValue === null || !userBValue.includes('user A note')).toBe(true);
  });
});
