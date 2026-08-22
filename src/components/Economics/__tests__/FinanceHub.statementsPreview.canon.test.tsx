/**
 * @vitest-environment jsdom
 *
 * FIN-UI-CANON-001 — Finance "Statements" list + preview, canon conformance.
 *
 * Authorities:
 *  - docs/ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md §7.2 — preview width
 *    comes ONLY from the component: "Zakaz sztywnej szerokosci na kontenerze
 *    preview: w-[420px], w-[360px], w-[460px] itp."; MUST be
 *    clamp(340px, 28%, 480px), separation gap-1.5, WITHOUT border-l.
 *  - docs/ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md §7.1/:268 — preview
 *    closed by default; single-click = select + preview; Esc = close.
 *  - docs/ui-standards/TRIADA_KANON.md §C3 (N-52) — entity properties belong in
 *    `StandardPreview.details.properties` (ArtifactPropertiesTable), never glued
 *    into the prose field via join('\n\n').
 *
 * The hub owns ~3.6k lines and five tabs; this suite pins ONLY the Statements
 * list+preview journey, with the data and selection hooks doubled so the
 * assertions are about canon composition rather than about the network.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const STATEMENT_ROW = {
  id: 'stmt-1',
  kind: 'statements',
  title: 'FY24 Statement Pack',
  status: 'DRAFT',
  currency: 'PLN',
  sourceStatementCount: 3,
  statementIds: ['a', 'b', 'c'],
  mappedLineCount: 12,
  totalLineCount: 20,
  readinessSummary: 'Needs mapping',
  completenessLabel: '60%',
  periodLabel: '2024',
  updatedAt: '2026-01-01T00:00:00.000Z',
  childStatements: [],
};

const loadStatements = vi.fn();
const onSelectRow = vi.fn();
const deselectRow = vi.fn();
const { apiPost } = vi.hoisted(() => ({ apiPost: vi.fn() }));
const { getFinanceArtifact } = vi.hoisted(() => ({ getFinanceArtifact: vi.fn() }));
const wizardIds = vi.hoisted(() => [] as string[]);

/** Selection is driven by the test so preview open/closed is deterministic. */
let selectedId: string | null = null;

// Policy/entitlement context is orthogonal to table+preview canon; double it so
// the assertions stay about layout composition, not about licensing.
vi.mock('@/contexts/AccessPolicyContext', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    usePolicySnapshot: () => ({
      snapshot: null,
      loading: false,
      error: null,
      refresh: vi.fn(),
      isActionBlocked: () => false,
      isFeatureBlocked: () => false,
      isApproachingLimit: () => false,
      isAtLimit: () => false,
    }),
    useIsDemo: () => false,
    useIsTrial: () => false,
  };
});

vi.mock('@/services/api', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, any>;
  return { ...actual, Api: { ...actual.Api, post: apiPost } };
});

vi.mock('@/services/api/financeV2.api', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, getFinanceArtifact };
});

vi.mock('@/hooks/useFinanceStatementPackWorkspaceV2Flag', () => ({
  useFinanceStatementPackWorkspaceV2Flag: () => ({ enabled: true }),
}));
vi.mock('@/hooks/useFinanceAnalysisWorkspaceFlag', () => ({
  useFinanceAnalysisWorkspaceFlag: () => ({ enabled: true }),
}));
vi.mock('../../Finance/shared/FinanceLegacyBridgeGate', () => ({
  FinanceLegacyBridgeGate: ({ children }: any) =>
    children({ artifactId: 'pack-artifact-1', businessVersionId: 'pack-bv-1' }),
}));
vi.mock('../../Finance/statementPackWorkspaceV2/StatementPackWorkspaceV2', () => ({
  StatementPackWorkspaceV2: ({ businessVersionId, onCreateNew }: any) => (
    <button
      type="button"
      data-testid="create-derived-analysis"
      onClick={() => onCreateNew('HISTORICAL_ANALYSIS', businessVersionId)}
    >
      Create related analysis
    </button>
  ),
}));
vi.mock('../../Finance/Analysis/AnalysisWorkspace', () => ({
  AnalysisWorkspace: ({ artifactId, businessVersionId }: any) => (
    <div data-testid="canonical-analysis-workspace">
      {artifactId}:{businessVersionId}
    </div>
  ),
}));
vi.mock('../../Finance/shared/FinanceWorkspaceUtilities', () => ({
  FinanceWorkspaceUtilities: () => null,
}));
vi.mock('../../Finance/FinancialStatementImportWizard', () => ({
  FinancialStatementImportWizard: ({ initialStatementId }: { initialStatementId?: string }) => {
    wizardIds.push(String(initialStatementId || ''));
    return <div data-testid="finance-statement-wizard">{initialStatementId}</div>;
  },
}));

vi.mock('../hooks/useFinanceData', () => ({
  useFinanceData: () => ({
    statements: [STATEMENT_ROW],
    models: [],
    analyses: [],
    valuations: [],
    budgets: [],
    loadingTab: false,
    loadError: null,
    loadStatements,
    loadModels: vi.fn(),
    loadAnalyses: vi.fn(),
    loadValuations: vi.fn(),
    loadBudgets: vi.fn(),
    rowsForActiveTab: [STATEMENT_ROW],
    filteredRows: [STATEMENT_ROW],
    statusCounts: {},
  }),
}));

vi.mock('../hooks/useFinanceSelection', () => ({
  useFinanceSelection: () => ({
    selectedId,
    selectedItem: selectedId ? STATEMENT_ROW : null,
    statementPreviewDetail: null,
    statementPreviewRatios: null,
    modelPreviewDetail: null,
    predictionValidations: null,
    analysisPreviewRatios: null,
    budgetPreviewScenarios: null,
    valuationPreviewResults: null,
    valuationPreviewDetail: null,
    getBudgetRawId: (id: string) => id,
    loadModelPreview: vi.fn(),
    loadPredictionPreview: vi.fn(),
    loadBudgetPreviewScenarios: vi.fn(),
    loadAnalysisPreviewRatios: vi.fn(),
    loadValuationPreviewResults: vi.fn(),
    onSelectRow,
    deselectRow,
  }),
}));

import { FinanceHub } from '../FinanceHub';

const renderHub = (url = '/finance?tab=statements') => {
  // FinanceHub reaches react-query through its lane/entitlement hooks.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[url]}>
        <FinanceHub />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

beforeEach(() => {
  selectedId = null;
  loadStatements.mockClear();
  onSelectRow.mockClear();
  deselectRow.mockClear();
  apiPost.mockReset();
  wizardIds.length = 0;
});

describe('FinanceHub — Statements list+preview canon (FIN-UI-CANON-001)', () => {
  it('round-trips the generated Statement recovery URL into the wizard exact id', async () => {
    const generatedUrl = '/finance?tab=statements&statementId=statement-current';
    renderHub(generatedUrl);
    await waitFor(() => expect(screen.getByTestId('finance-statement-wizard')).toBeInTheDocument());
    expect(screen.getByTestId('finance-statement-wizard')).toHaveTextContent('statement-current');
    expect(wizardIds).toContain('statement-current');
  });

  it('renders the statements list surface', async () => {
    renderHub();
    await waitFor(() => {
      expect(screen.getByText(STATEMENT_ROW.title)).toBeInTheDocument();
    });
  });

  it('preview is CLOSED by default (canon §7.1: domyslnie zamkniety)', async () => {
    renderHub();
    await waitFor(() => expect(screen.getByText(STATEMENT_ROW.title)).toBeInTheDocument());

    // With nothing selected there must be no preview surface at all.
    expect(document.querySelector('[data-testid="standard-preview"]')).toBeNull();
  });

  it('single click on a row selects it (canon §7.1: single-click = select + preview)', async () => {
    renderHub();
    const cell = await screen.findByText(STATEMENT_ROW.title);
    const row = cell.closest('tr');
    expect(row).not.toBeNull();

    fireEvent.click(row as HTMLElement);
    await waitFor(() => expect(onSelectRow).toHaveBeenCalled());
  });

  describe('with a row selected', () => {
    beforeEach(() => {
      selectedId = STATEMENT_ROW.id;
    });

    it('does NOT wrap the preview in a hard-coded width (canon §7.2 MUST)', async () => {
      const { container } = renderHub();
      await waitFor(() =>
        expect(screen.getAllByText(STATEMENT_ROW.title).length).toBeGreaterThan(0)
      );

      // "Zakaz sztywnej szerokosci na kontenerze preview" — the screen must not
      // pin the preview pane; the width belongs to the shared component.
      const hardWidth = container.querySelectorAll(
        '[class*="w-[400px]"],[class*="w-[420px]"],[class*="w-[360px]"],[class*="w-[460px]"]'
      );
      expect(hardWidth.length).toBe(0);
    });

    it('renders entity properties as a properties table, not glued prose (TRIADA §C3 / N-52)', async () => {
      renderHub();
      await waitFor(() =>
        expect(screen.getAllByText(STATEMENT_ROW.title).length).toBeGreaterThan(0)
      );

      // Each property is its own labelled row, rendered by ArtifactPropertiesTable
      // (the label also exists as a column header, hence getAllByText).
      await waitFor(() => expect(screen.getAllByText('Currency').length).toBeGreaterThan(0));
      expect(screen.getAllByText('PLN').length).toBeGreaterThan(0);
      expect(screen.getByText('12 / 20')).toBeInTheDocument();

      // ...and never a single blob with the label baked into the value.
      expect(screen.queryByText(/Currency:\s*PLN/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Mapped lines:\s*12 \/ 20/)).not.toBeInTheDocument();
    });

    it('renders EXACTLY ONE preview shell — one title, one close control', async () => {
      renderHub();
      await waitFor(() =>
        expect(screen.getAllByText(STATEMENT_ROW.title).length).toBeGreaterThan(0)
      );

      // TableWithPreviewLayout already wraps renderPreview in its own
      // PreviewPaneShell (title + close). Nesting a second, non-embedded
      // StandardPreview inside it duplicates the whole chrome.
      expect(document.querySelectorAll('[data-preview-pane]').length).toBe(1);

      const closeControls = screen.getAllByRole('button', { name: /close|zamknij/i });
      expect(closeControls.length).toBe(1);

      // The row cell carries the title once, the single preview header once.
      expect(screen.getAllByText(STATEMENT_ROW.title).length).toBe(2);
    });

    it('Esc calls deselect EXACTLY once (no duplicate Escape listeners)', async () => {
      renderHub();
      await waitFor(() =>
        expect(screen.getAllByText(STATEMENT_ROW.title).length).toBeGreaterThan(0)
      );

      fireEvent.keyDown(document, { key: 'Escape' });
      await waitFor(() => expect(deselectRow).toHaveBeenCalled());
      expect(deselectRow).toHaveBeenCalledTimes(1);
    });

    it('Esc closes the preview (canon §7.1: Esc = zamknij)', async () => {
      renderHub();
      await waitFor(() =>
        expect(screen.getAllByText(STATEMENT_ROW.title).length).toBeGreaterThan(0)
      );

      fireEvent.keyDown(document, { key: 'Escape' });
      await waitFor(() => expect(deselectRow).toHaveBeenCalled());
    });
  });

  it('creates a canonical Analysis with source lineage and mounts server-returned stable IDs', async () => {
    apiPost.mockResolvedValue({
      artifactId: 'analysis-artifact-1',
      businessVersionId: 'analysis-bv-1',
      workingRevisionId: 'analysis-wr-1',
      edgeId: 'lineage-edge-1',
    });
    getFinanceArtifact.mockResolvedValue({
      artifactId: 'analysis-artifact-1',
      artifactType: 'HISTORICAL_ANALYSIS',
      naturalKey: 'FY24 Analysis',
      currentBusinessVersion: {
        businessVersionId: 'analysis-bv-1',
        status: 'DRAFT',
        freshness: 'NEVER_COMPUTED',
        version: 1,
      },
    });
    renderHub();
    const row = (await screen.findAllByText(STATEMENT_ROW.title))
      .map((node) => node.closest('tr'))
      .find(Boolean);
    expect(row).not.toBeNull();
    fireEvent.doubleClick(row as HTMLElement);

    fireEvent.click(await screen.findByTestId('create-derived-analysis'));
    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith('/v8/finance-v2/versions/pack-bv-1/derived-analysis', {
        idempotencyKey: expect.any(String),
      })
    );
    expect(await screen.findByTestId('canonical-analysis-workspace')).toHaveTextContent(
      'analysis-artifact-1:analysis-bv-1'
    );
  });
});
