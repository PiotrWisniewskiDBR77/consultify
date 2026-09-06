/**
 * @vitest-environment jsdom
 *
 * 1.1-T1 (DEC-412) — CTA MENU 3 NALEŻY DO ZAKŁADKI.
 *
 * Uwaga właściciela 06.09: „We wszystkich funkcjach tego modułu jest ten sam
 * call to action [Dodaj narzędzie]. Więc nie mogę wygenerować ani insightu,
 * ani raportu, ani inicjatywy, bo nie mam w ogóle podpiętej funkcjonalności
 * w tym zakresie."
 *
 * Mutacja celowana: przywróć jedno `PrimaryCta` dla wszystkich zakładek —
 * pięć asercji etykiet pada naraz. Test sprawdza też, że CTA Insightów woła
 * REALNY endpoint (`Api.createToolInsight`), a nie toast „Wkrótce".
 *
 * Scaffold identyczny jak DiscoveryToolsHub.toolOutputsWiring.test.tsx.
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return { ...actual, useNavigate: () => navigateMock };
});

const getKnownToolsMock = vi.fn();
const listToolSessionsMock = vi.fn();
const getAssessmentReportsMock = vi.fn();
const listToolOutputsMock = vi.fn();
const reopenToolOutputMock = vi.fn();
const createToolInsightMock = vi.fn();

vi.mock('@/services/api', () => ({
  Api: {
    getKnownTools: (...args: unknown[]) => getKnownToolsMock(...args),
    getKnownTool: vi.fn().mockResolvedValue(null),
    getToolSession: vi.fn().mockResolvedValue(null),
    listToolSessions: (...args: unknown[]) => listToolSessionsMock(...args),
    listAssessments: vi.fn().mockResolvedValue({ items: [], total: 0, limit: 100, offset: 0 }),
    listAssessmentsLegacy: vi
      .fn()
      .mockResolvedValue({ items: [], total: 0, limit: 100, offset: 0 }),
    getAssessmentReports: (...args: unknown[]) => getAssessmentReportsMock(...args),
    get: vi.fn().mockResolvedValue({ reports: [], success: true, data: [] }),
    getUsers: vi.fn().mockResolvedValue([]),
    createToolSession: vi.fn(),
    suggestTools: vi.fn().mockResolvedValue({ suggestions: [] }),
    getInitiativesByStatus: vi.fn().mockResolvedValue([]),
    listToolOutputs: (...args: unknown[]) => listToolOutputsMock(...args),
    reopenToolOutput: (...args: unknown[]) => reopenToolOutputMock(...args),
    createToolInsight: (...args: unknown[]) => createToolInsightMock(...args),
  },
}));

vi.mock('react-hot-toast', () => {
  const fn = vi.fn();
  return { default: Object.assign(fn, { success: vi.fn(), error: vi.fn() }), toast: fn };
});

vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({
    currentProjectId: null,
    currentUser: { id: 'u1', role: 'ADMIN' },
    currentOrganization: { id: 'org-1' },
  }),
}));

vi.mock('@/store/useConversationStore', () => ({
  useConversationStore: (selector?: any) => {
    const state = { addMessage: vi.fn() };
    return selector ? selector(state) : state;
  },
}));

vi.mock('@/hooks/useOpenChatWithContext', () => ({
  useOpenChatWithContext: () => vi.fn().mockResolvedValue('conv-1'),
}));

vi.mock('@/contexts/HelpContext', () => ({
  useHelpSidePanel: () => ({
    setOpen: vi.fn(),
    setActiveTab: vi.fn(),
    setKnowledgeModuleIdOverride: vi.fn(),
  }),
  useHelp: () => ({ setOpen: vi.fn(), setActiveTab: vi.fn() }),
  HelpProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const standardTableMounts: any[] = [];
vi.mock('@/components/standard', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    StandardTable: (props: any) => {
      standardTableMounts.push(props);
      return (
        <div data-testid={`standard-table-stub-${props.persistKey || 'unknown'}`}>
          {(props.data || []).map((row: any) => (
            <div key={row.id} data-testid={`row-${row.id}`}>
              <span>{row.name}</span>
              <span data-testid={`row-${row.id}-kind`}>{row.outputKind}</span>
              {(props.rowActions?.(row) || []).flatMap((block: any) =>
                (block.actions || []).map((action: any) => (
                  <button
                    key={`${row.id}-${action.id}`}
                    data-testid={`row-${row.id}-action-${action.id}`}
                    disabled={!!action.disabled}
                    onClick={action.onClick}
                  >
                    {action.label}
                  </button>
                ))
              )}
            </div>
          ))}
        </div>
      );
    },
  };
});

import { DiscoveryToolsHub } from '@/components/Discovery/DiscoveryToolsHub';

function buildKnownTool(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'dynamic-swot',
    toolType: 'dynamic-swot',
    name: 'Dynamic SWOT',
    libraryCategory: 'operational',
    description: 'desc',
    whatYouGet: [],
    tags: [],
    icon: null,
    isLicensed: false,
    isActive: true,
    isComingSoon: false,
    sortOrder: 1,
    createdAt: null,
    ...overrides,
  };
}


const APPROVED_SESSION = {
  id: 'sess-1',
  name: 'SWOT — Q1',
  toolType: 'dynamic-swot',
  status: 'APPROVED',
  progress: 100,
  confidenceAvg: 4.5,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  createdBy: 'u1',
};

async function mountTab(tab: string) {
  render(
    <MemoryRouter initialEntries={['/discovery-tools']}>
      <DiscoveryToolsHub initialTab={tab as never} />
    </MemoryRouter>
  );
  return screen.findByTestId('tools-primary-cta');
}

describe('DiscoveryToolsHub — 1.1-T1: CTA Menu 3 per zakładka', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    getKnownToolsMock.mockResolvedValue({ items: [buildKnownTool()] });
    listToolSessionsMock.mockResolvedValue({
      items: [APPROVED_SESSION],
      total: 1,
      limit: 0,
      offset: 0,
    });
    getAssessmentReportsMock.mockResolvedValue([]);
    listToolOutputsMock.mockResolvedValue({ outputs: [] });
    createToolInsightMock.mockResolvedValue({
      output: { id: 'out-new', toolSessionId: 'sess-1', status: 'approved' },
    });
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it.each([
    ['library', 'Add tool'],
    ['sessions', 'New session'],
    ['outputs', 'New insight'],
    ['reports', 'New report'],
    ['initiatives', 'New initiative'],
  ])('zakładka %s ma własne CTA: "%s"', async (tab, label) => {
    const cta = await mountTab(tab);
    expect(cta).toHaveTextContent(label);
  });

  it('CTA Insightów wywołuje realny endpoint dla zatwierdzonej sesji bez insightu', async () => {
    const cta = await mountTab('outputs');
    cta.click();

    const pick = await screen.findByText('SWOT — Q1');
    (pick.closest('button') as HTMLButtonElement).click();

    await waitFor(() => {
      expect(createToolInsightMock).toHaveBeenCalledWith('sess-1');
    });
  });

  it('gdy nie ma zatwierdzonej sesji, CTA Insightów mówi prawdę zamiast toastu „Wkrótce"', async () => {
    listToolSessionsMock.mockResolvedValue({
      items: [{ ...APPROVED_SESSION, status: 'DRAFT' }],
      total: 1,
      limit: 0,
      offset: 0,
    });

    const cta = await mountTab('outputs');
    cta.click();

    expect(
      await screen.findByText(
        'Insights are created from approved sessions — approve a session in the Sessions tab.'
      )
    ).toBeInTheDocument();
    expect(createToolInsightMock).not.toHaveBeenCalled();
  });
});
