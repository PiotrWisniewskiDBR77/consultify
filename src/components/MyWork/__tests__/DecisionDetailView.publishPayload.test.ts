import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createDecision } = vi.hoisted(() => ({ createDecision: vi.fn() }));

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: vi.fn() },
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
    i18n: {
      language: 'en',
      getFixedT: () => (_key: string, fallback?: string) => fallback || _key,
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
    currentProjectId: null,
    emitMyWorkEvent: vi.fn(),
    currentUser: { id: 'user-1' },
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
  NModeHeader: ({ title, onTitleChange }: any) =>
    React.createElement('input', {
      'aria-label': 'Decision title',
      value: title,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => onTitleChange(event.target.value),
    }),
}));
vi.mock('@/components/shared/NModeLayout/NModeCardManager', () => ({
  SectionsManagerMenu: () => null,
}));
vi.mock('@/components/shared/RequiredProjectPicker', () => ({
  RequiredProjectPicker: ({ value, onChange }: any) =>
    React.createElement(
      'select',
      {
        'aria-label': 'Project',
        value,
        onChange: (event: React.ChangeEvent<HTMLSelectElement>) => onChange(event.target.value),
      },
      React.createElement('option', { value: '' }, 'Select a project'),
      React.createElement('option', { value: 'project-1' }, 'Real project')
    ),
}));
vi.mock('../../../services/api', () => ({
  Api: new Proxy(
    { createDecision },
    {
      get(target, property) {
        if (property === 'createDecision') return target.createDecision;
        return vi.fn(async () => (property === 'getUsers' ? [] : {}));
      },
    }
  ),
  API_URL: '/api',
  getHeaders: () => ({}),
}));

import { aggregateDecisionImpact, DecisionDetailView } from '../DecisionDetailView';

describe('DecisionDetailView publish payload', () => {
  beforeEach(() => {
    createDecision.mockReset();
    createDecision.mockResolvedValue({ id: 'decision-1' });
  });

  it.each([
    [{ scope: 'low', schedule: 'low', cost: 'low', quality: 'low' }, 'low'],
    [{ scope: 'low', schedule: 'medium', cost: 'low', quality: 'low' }, 'medium'],
    [{ scope: 'medium', schedule: 'low', cost: 'high', quality: 'low' }, 'high'],
  ] as const)('maps dimensional editor state to the canonical API enum', (impact, expected) => {
    expect(aggregateDecisionImpact(impact)).toBe(expected);
  });

  it('suppresses autosave until a project is explicitly selected, then posts exact context', async () => {
    render(React.createElement(DecisionDetailView, { decisionId: null, onClose: vi.fn() }));
    fireEvent.change(await screen.findByLabelText('Decision title'), {
      target: { value: 'Context-bound decision' },
    });
    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect(createDecision).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Project'), { target: { value: 'project-1' } });
    await waitFor(() => expect(createDecision).toHaveBeenCalled(), { timeout: 2500 });
    expect(createDecision).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'project-1', impact: 'medium' })
    );
  });
});
