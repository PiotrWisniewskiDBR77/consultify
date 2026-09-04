/**
 * @vitest-environment jsdom
 *
 * KONTRAKT DYŻURU 344: realny ToolDocumentView musi zamontować kafle faz w
 * gałęzi strategicznej. Deskryptor bez konsumenta nie spełnia tego kontraktu.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getToolSessionMock = vi.fn();
const testLanguage = vi.hoisted(() => ({ value: 'en' }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue || key,
    i18n: { language: testLanguage.value, changeLanguage: vi.fn() },
    ready: true,
  }),
  Trans: ({ children }: any) => children,
  I18nextProvider: ({ children }: any) => children,
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), {
    custom: vi.fn(),
    dismiss: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  }),
}));

vi.mock('@/services/api', () => ({
  Api: {
    getToolSession: (...args: unknown[]) => getToolSessionMock(...args),
    updateToolSession: vi.fn().mockResolvedValue({ id: 'sess-day344' }),
    getUsers: vi.fn().mockResolvedValue([]),
    getLinkGraphBacklinks: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({
    currentOrganization: { id: 'org-day344', name: 'Day 344' },
    currentProjectId: null,
    isChatCollapsed: true,
    toggleChatCollapse: vi.fn(),
    activeChatMessages: [],
  }),
}));

vi.mock('@/store/useConversationStore', () => ({
  useConversationStore: () => ({ updateWorkspaceFromView: vi.fn() }),
}));

vi.mock('@/hooks/usePresentationMode', () => ({
  usePresentationMode: () => ({ mode: 'n', setMode: vi.fn(), isN: true, isC: false }),
}));

vi.mock('@/hooks/discovery/useToolAI', () => ({
  useToolAI: () => ({
    isStreaming: false,
    streamedContent: '',
    error: null,
    sendMessage: vi.fn(),
    requestSuggestions: vi.fn(),
    generateCorrelations: vi.fn(),
    generateSummary: vi.fn(),
    generateFullSession: vi.fn(),
    runPhaseAiAction: vi.fn(),
    rethinkCard: vi.fn(),
    abortStream: vi.fn(),
    phaseAiActions: [],
    activeAiActionId: null,
    missionSuggestion: null,
    applyMissionSuggestion: vi.fn(),
    dismissMissionSuggestion: vi.fn(),
    getStepOpeningQuestion: vi.fn(),
  }),
}));

vi.mock('@/utils/pdfExport', () => ({ exportToPDF: vi.fn() }));
vi.mock('@/components/DiscoveryTools/ToolCanvas', () => ({
  ToolCanvas: ({ stepDefinition }: any) => (
    <div data-testid="phase-canvas">{stepDefinition?.id}</div>
  ),
}));
vi.mock('@/components/DiscoveryTools/tools/DynamicSWOT/TeresaSwotProposals', () => ({
  TeresaSwotProposals: () => null,
}));

vi.mock('@/components/shared/NModeLayout', () => ({
  NModeShell: ({ sections = [], activeSection, onSectionChange, loading }: any) => {
    if (loading) return <div data-testid="nmode-shell-loading" />;
    const active = sections.find((section: any) => section.id === activeSection);
    return (
      <div>
        {sections.map((section: any) => (
          <button
            key={section.id}
            data-testid={`nmode-section-${section.id}`}
            onClick={() => onSectionChange(section.id)}
          >
            {section.id}
          </button>
        ))}
        <main>{active?.component}</main>
      </div>
    );
  },
}));

import { ToolDocumentView } from '@/components/DiscoveryTools/ToolDocumentView';
import { useToolStore } from '@/store/useToolStore';

const session = {
  id: 'sess-day344',
  name: 'Dynamic SWOT — Day 344',
  toolType: 'dynamic-swot',
  status: 'DRAFT',
  createdAt: '2026-09-04T10:00:00.000Z',
  updatedAt: '2026-09-04T10:00:00.000Z',
  completionPercent: 40,
  answers: { items: [] },
  generatedInitiatives: [],
  decisions: [],
  permissions: {},
};

describe('Dynamic SWOT phase overview — reachable DOM contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testLanguage.value = 'en';
    useToolStore.setState({ currentSession: null, currentStep: 1, savedSessions: [] } as any);
    getToolSessionMock.mockResolvedValue(session);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    useToolStore.setState({ currentSession: null, currentStep: 1, savedSessions: [] } as any);
  });

  it.each([
    ['false', ['mission', 'input', 'swot', 'insights', 'outputs']],
    [
      'true',
      ['mission', 'input', 'swot', 'insights', 'recommendations', 'outputs', 'review'],
    ],
  ])('renders the SSOT phase tiles when the seven-stage flag is %s', async (flag, phaseIds) => {
    vi.stubEnv('VITE_VF1_DYNAMIC_SWOT_SEVEN_STAGES', flag);
    render(<ToolDocumentView toolType="dynamic-swot" sessionId="sess-day344" onBack={vi.fn()} />);

    await waitFor(() => expect(getToolSessionMock).toHaveBeenCalledWith('sess-day344'));
    const tiles = await screen.findAllByTestId('dynamic-swot-phase-tile');

    expect(tiles.map((tile) => tile.getAttribute('data-phase-id'))).toEqual(phaseIds);
  });

  it('switches the real active phase when a tile is clicked', async () => {
    vi.stubEnv('VITE_VF1_DYNAMIC_SWOT_SEVEN_STAGES', 'true');
    render(<ToolDocumentView toolType="dynamic-swot" sessionId="sess-day344" onBack={vi.fn()} />);

    const outputTile = (await screen.findAllByTestId('dynamic-swot-phase-tile')).find(
      (tile) => tile.getAttribute('data-phase-id') === 'outputs'
    );
    expect(outputTile).toBeTruthy();
    fireEvent.click(outputTile as HTMLElement);

    await waitFor(() => expect(outputTile).toHaveAttribute('aria-current', 'step'));
    expect(screen.getByTestId('phase-canvas')).toHaveTextContent('outputs');
  });

  it('renders the computed session readiness through a reachable DOM handle', async () => {
    vi.stubEnv('VITE_VF1_DYNAMIC_SWOT_SEVEN_STAGES', 'false');
    render(<ToolDocumentView toolType="dynamic-swot" sessionId="sess-day344" onBack={vi.fn()} />);

    const badge = await screen.findByTestId('dynamic-swot-readiness-badge');
    expect(badge).toHaveTextContent(/Blocked by gaps|Decision-ready|Needs refinement/);
    expect(screen.getByTestId('dynamic-swot-phase-overview')).toContainElement(badge);
  });

  it('renders Polish phase labels by their SSOT names', async () => {
    testLanguage.value = 'pl';
    vi.stubEnv('VITE_VF1_DYNAMIC_SWOT_SEVEN_STAGES', 'false');
    render(<ToolDocumentView toolType="dynamic-swot" sessionId="sess-day344" onBack={vi.fn()} />);

    const tiles = await screen.findAllByTestId('dynamic-swot-phase-tile');
    expect(tiles.map((tile) => tile.textContent)).toEqual([
      expect.stringContaining('Misja i kontekst'),
      expect.stringContaining('Wejście i eksploracja'),
      expect.stringContaining('Budowa SWOT'),
      expect.stringContaining('Synteza i napięcia'),
      expect.stringContaining('Wyniki i działania'),
    ]);
  });

  it('keeps the active tile neutral, focus-visible, and inside the flexible grid', async () => {
    vi.stubEnv('VITE_VF1_DYNAMIC_SWOT_SEVEN_STAGES', 'true');
    render(<ToolDocumentView toolType="dynamic-swot" sessionId="sess-day344" onBack={vi.fn()} />);

    const tiles = await screen.findAllByTestId('dynamic-swot-phase-tile');
    const active = tiles.find((tile) => tile.getAttribute('aria-current') === 'step');
    const grid = tiles[0]?.parentElement;

    expect(tiles).toHaveLength(7);
    expect(grid).toHaveClass('grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))]');
    expect(active).toHaveClass('c-focus', 'border-slate-400', 'bg-slate-100');
    expect(active?.className).not.toMatch(/primary-|crimson-|c-accent/);
  });
});
