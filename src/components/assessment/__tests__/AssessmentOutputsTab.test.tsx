/**
 * @vitest-environment jsdom
 *
 * P0D — AssessmentOutputsTab reads the method-core kernel
 * (`listOutputs`/`getOutput`), NOT the legacy `/api/artifacts` registry.
 * Covers: StandardTable rendering, current/superseded distinction,
 * snapshot-not-session-state on open, lineage hand-off, empty/error/
 * forbidden states, and canonical sibling-surface navigation.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  listOutputs: vi.fn(),
  getOutput: vi.fn(),
  listReports: vi.fn(),
  getReportSnapshot: vi.fn(),
  listInitiativeDrafts: vi.fn(),
  getInitiativeDraft: vi.fn(),
  getSessionLineage: vi.fn(),
}));

vi.mock('@/method-core/api/methodCoreApi', async () => {
  const actual = await vi.importActual<typeof import('@/method-core/api/methodCoreApi')>(
    '@/method-core/api/methodCoreApi'
  );
  return {
    ...actual,
    listOutputs: hoisted.listOutputs,
    getOutput: hoisted.getOutput,
    listReports: hoisted.listReports,
    getReportSnapshot: hoisted.getReportSnapshot,
    listInitiativeDrafts: hoisted.listInitiativeDrafts,
    getInitiativeDraft: hoisted.getInitiativeDraft,
    getSessionLineage: hoisted.getSessionLineage,
  };
});

// D-73 v3 (DEC-680): the Conclusions layer feeds BOTH the conclusion rows
// (`ConclusionsApi.list` → pobierzWnioskiOceny) and the DETAILS record fetched
// on open (`ConclusionsApi.get`). Mocked so the real component can be exercised
// against a real-shaped Conclusion without a backend.
const conclusionsHoisted = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
}));

vi.mock('@/services/api/conclusions.api', async () => {
  const actual = await vi.importActual<typeof import('@/services/api/conclusions.api')>(
    '@/services/api/conclusions.api'
  );
  return {
    ...actual,
    ConclusionsApi: {
      ...actual.ConclusionsApi,
      list: conclusionsHoisted.list,
      get: conclusionsHoisted.get,
    },
  };
});

import { MethodCoreApiError } from '@/method-core/api/methodCoreApi';

import { AssessmentOutputsTab } from '../AssessmentOutputsTab';

// `AssessmentOutputsTab` embeds `JedenPrawyPanel`, which (K5, d1270acba2) calls
// `useJedenPanel()`/`useLocation()` unconditionally — render without a Router
// throws "useLocation() may be used only in the context of a <Router>"
// regardless of any prop here (ZNALEZISKO, 1.1-K6).
function renderTab(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

function outputRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'out-1',
    organizationId: 'org-1',
    sessionId: 'sess-1',
    module: 'assessment',
    methodPackId: 'drd',
    methodPackVersion: '2.0',
    outputVersion: 1,
    revisionOfOutputId: null,
    scope: 'Digital Readiness — Area A',
    limitationsCount: 1,
    findingsCount: 3,
    contentHash: 'abcdef1234567890',
    frozenAt: '2026-08-10T10:00:00.000Z',
    createdAt: '2026-08-10T10:00:00.000Z',
    demoBypassActive: false,
    isSuperseded: null,
    supersededByOutputId: null,
    ...overrides,
  };
}

function outputDetail(overrides: Record<string, unknown> = {}) {
  return {
    output: {
      id: 'out-1',
      organizationId: 'org-1',
      sessionId: 'sess-1',
      module: 'assessment',
      methodPackId: 'drd',
      methodPackVersion: '2.0',
      outputVersion: 1,
      scope: 'Digital Readiness — Area A',
      current: {},
      target: {},
      gap: {},
      limitations: ['Sample size limited to 3 interviews'],
      findings: [{ id: 'f1' }, { id: 'f2' }, { id: 'f3' }],
      contentHash: 'abcdef1234567890',
      frozenAt: '2026-08-10T10:00:00.000Z',
    },
    superseded: false,
    supersededByOutputId: null,
    ...overrides,
  };
}

// D-73 v3 (DEC-680): a real-shaped Conclusion record, exactly as
// `ConclusionsApi.get` returns it. The DETAILS panel must read THESE fields —
// a conclusion carries no session/method-pack/findings/content-hash, which is
// why the kernel-shaped properties all rendered "—" before the fix.
function conclusionRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'concl-1',
    organizationId: 'org-1',
    projectId: null,
    title: 'Quality and Compliance Maturity — assessment report',
    statement: 'Compliance maturity is partial and needs a remediation owner.',
    sourceModule: 'assessment',
    sourceArtifactRefs: [
      { type: 'assessment_report', id: 'rep-1', title: 'DRD report' },
    ],
    sourcePackId: null,
    confidenceLevel: 'high',
    limits: 'Sample limited to 3 interviews',
    evidenceRefs: [
      { type: 'assessment_report', ref: 'rep-1#exec' },
      { type: 'assessment_report', ref: 'rep-1#gap' },
    ],
    recommendedNextAction: null,
    status: 'needs_review',
    ownerId: null,
    reviewerId: null,
    sponsorId: null,
    createdBy: 'user-1',
    createdAt: '2026-09-15T10:00:00.000Z',
    updatedAt: '2026-09-16T10:00:00.000Z',
    ...overrides,
  };
}

describe('AssessmentOutputsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.getOutput.mockResolvedValue(outputDetail());
    hoisted.listReports.mockResolvedValue([]);
    hoisted.listInitiativeDrafts.mockResolvedValue([]);
    conclusionsHoisted.list.mockResolvedValue({ conclusions: [] });
  });

  it('renders the kernel Outputs list via StandardTable, not the legacy artifacts registry', async () => {
    hoisted.listOutputs.mockResolvedValue({ outputs: [outputRow()], total: 1 });

    renderTab(<AssessmentOutputsTab />);

    expect(await screen.findByText('Digital Readiness — Area A')).toBeInTheDocument();
    expect(hoisted.listOutputs).toHaveBeenCalledTimes(1);
  });

  it('reports the count back to the parent via onCountChange', async () => {
    hoisted.listOutputs.mockResolvedValue({
      outputs: [outputRow(), outputRow({ id: 'out-2' })],
      total: 2,
    });
    const onCountChange = vi.fn();

    renderTab(<AssessmentOutputsTab onCountChange={onCountChange} />);

    await waitFor(() => {
      expect(onCountChange).toHaveBeenCalledWith(2);
    });
  });

  it('excludes Method Core outputs owned by Tools or Audits from the Assessment surface', async () => {
    hoisted.listOutputs.mockResolvedValue({
      outputs: [
        outputRow(),
        outputRow({ id: 'tool-output', module: 'tools', scope: 'Tool output' }),
        outputRow({ id: 'audit-output', module: 'audits', scope: 'Audit output' }),
      ],
      total: 3,
    });
    const onCountChange = vi.fn();

    renderTab(<AssessmentOutputsTab onCountChange={onCountChange} />);

    expect(await screen.findByText('Digital Readiness — Area A')).toBeInTheDocument();
    expect(screen.queryByText('Tool output')).not.toBeInTheDocument();
    expect(screen.queryByText('Audit output')).not.toBeInTheDocument();
    expect(onCountChange).toHaveBeenCalledWith(1);
  });

  it('visually distinguishes a current Output from a superseded one', async () => {
    hoisted.listOutputs.mockResolvedValue({
      outputs: [
        outputRow({ id: 'out-1', outputVersion: 1, isSuperseded: true, scope: 'Old revision' }),
        outputRow({
          id: 'out-2',
          outputVersion: 2,
          isSuperseded: false,
          revisionOfOutputId: 'out-1',
          scope: 'New revision',
        }),
      ],
      total: 2,
    });

    renderTab(<AssessmentOutputsTab />);

    await screen.findByText('Old revision');
    expect(screen.getByText('Superseded')).toBeInTheDocument();
    expect(screen.getByText('Current')).toBeInTheDocument();
  });

  it('derives superseded status from revisionOfOutputId links when the list row omits isSuperseded', async () => {
    hoisted.listOutputs.mockResolvedValue({
      outputs: [
        outputRow({ id: 'out-1', outputVersion: 1, isSuperseded: null, scope: 'Older' }),
        outputRow({
          id: 'out-2',
          outputVersion: 2,
          isSuperseded: null,
          revisionOfOutputId: 'out-1',
          scope: 'Newer',
        }),
      ],
      total: 2,
    });

    renderTab(<AssessmentOutputsTab />);

    await screen.findByText('Older');
    expect(screen.getByText('Superseded')).toBeInTheDocument();
    expect(screen.getByText('Current')).toBeInTheDocument();
  });

  it('opening a row fetches the immutable server snapshot (getOutput) rather than deriving from session state', async () => {
    hoisted.listOutputs.mockResolvedValue({ outputs: [outputRow()], total: 1 });
    const user = userEvent.setup();

    renderTab(<AssessmentOutputsTab />);
    await screen.findByText('Digital Readiness — Area A');

    await user.click(screen.getByText('Digital Readiness — Area A'));

    await waitFor(() => {
      expect(hoisted.getOutput).toHaveBeenCalledWith('out-1');
    });
    // Findings count in the preview comes from the FETCHED detail (3 findings),
    // proving the properties table is driven by the server snapshot.
    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  it('shows an honest empty state with an explanation when there are no Outputs', async () => {
    hoisted.listOutputs.mockResolvedValue({ outputs: [], total: 0 });

    renderTab(<AssessmentOutputsTab />);

    expect(await screen.findByText('No insights yet')).toBeInTheDocument();
    expect(
      screen.getByText('Insights frozen from a completed assessment session will appear here.')
    ).toBeInTheDocument();
  });

  it('shows an error state with retry when the Outputs list fails to load', async () => {
    hoisted.listOutputs.mockRejectedValueOnce(new Error('network down'));
    const user = userEvent.setup();

    renderTab(<AssessmentOutputsTab />);

    expect(
      await screen.findByText('Failed to load Insights. Please try again.')
    ).toBeInTheDocument();

    hoisted.listOutputs.mockResolvedValueOnce({ outputs: [outputRow()], total: 1 });
    // Accessible name is "Try again" (i18n `common.retry`), not "Retry" — the
    // EmptyState error CTA was deliberately moved off a hardcoded English
    // "Retry" label onto this translated copy (see R09-1 in
    // AssessmentOutputsTab.tsx's module doc comment); the selector below was
    // never updated to match, which is why this assertion — not the retry
    // affordance itself — was the actual reason this test stayed red.
    await user.click(screen.getByRole('button', { name: /try again/i }));

    await waitFor(() => {
      expect(screen.getByText('Digital Readiness — Area A')).toBeInTheDocument();
    });
  });

  it('shows a distinct "no access" state (not just an empty list) on a 403', async () => {
    hoisted.listOutputs.mockRejectedValueOnce(new MethodCoreApiError('Forbidden', 403, {}));

    renderTab(<AssessmentOutputsTab />);

    expect(await screen.findByText('No access to Insights')).toBeInTheDocument();
    expect(screen.queryByText('No insights yet')).not.toBeInTheDocument();
  });

  it('hands Reports navigation to the canonical parent surface instead of rendering a duplicate menu', async () => {
    hoisted.listOutputs.mockResolvedValue({ outputs: [outputRow()], total: 1 });
    const onNavigate = vi.fn();
    const user = userEvent.setup();

    renderTab(<AssessmentOutputsTab onNavigate={onNavigate} />);
    await user.click(await screen.findByText('Digital Readiness — Area A'));
    await screen.findByText('3'); // preview loaded

    const reportsRelation = screen.getByRole('button', { name: 'Reports' });
    await user.click(reportsRelation);

    expect(onNavigate).toHaveBeenCalledWith('reports');
    expect(hoisted.listReports).not.toHaveBeenCalled();
  });

  it('"View lineage" swaps the aside for ArtifactLineagePanel, fetching the session lineage', async () => {
    hoisted.listOutputs.mockResolvedValue({ outputs: [outputRow()], total: 1 });
    hoisted.getSessionLineage.mockResolvedValue({
      session: { id: 'sess-1', label: 'Session sess-1' },
      outputs: [],
      reports: [],
      presentations: [],
      initiativeDrafts: [],
    });
    const user = userEvent.setup();

    renderTab(<AssessmentOutputsTab />);
    await user.click(await screen.findByText('Digital Readiness — Area A'));
    await screen.findByText('3');

    await user.click(screen.getByRole('button', { name: 'View lineage' }));

    await waitFor(() => {
      expect(hoisted.getSessionLineage).toHaveBeenCalledWith('sess-1');
    });
    expect(await screen.findByText('Lineage')).toBeInTheDocument();
  });

  it('DEC-397b (1.1-K6): zamknij X → klik wiersza PONOWNIE otwiera panel (MUTACJA: usuń jedenPanel.otworz() w onRowClick → RED)', async () => {
    hoisted.listOutputs.mockResolvedValue({ outputs: [outputRow()], total: 1 });
    const user = userEvent.setup();

    const { container } = renderTab(<AssessmentOutputsTab />);

    await user.click(await screen.findByText('Digital Readiness — Area A'));
    await waitFor(() => {
      expect(container.querySelectorAll('[data-right-panel]')).toHaveLength(1);
    });

    const closeButton = within(
      container.querySelector('[data-right-panel]') as HTMLElement
    ).getByRole('button', { name: /close/i });
    await user.click(closeButton);
    await waitFor(() => {
      expect(container.querySelector('[data-right-panel]')).toBeNull();
    });

    // DEC-397b (właściciel, 06.09.2026 15:47): pojedynczy klik wiersza jest
    // realna zmiana zaznaczenia — PONOWNIE otwiera panel mimo wcześniejszego X.
    await user.click(await screen.findByText('Digital Readiness — Area A'));
    await waitFor(() => {
      expect(container.querySelectorAll('[data-right-panel]')).toHaveLength(1);
    });
  });

  it('D-73 v3 (DEC-680): TYPE and VERSION columns keep a fixed width ≥ the 160px status floor, so the badge never truncates (MUTACJA: przywróć starą szerokość 132px/160px bez dataType → RED)', async () => {
    hoisted.listOutputs.mockResolvedValue({ outputs: [outputRow()], total: 1 });

    const { container } = renderTab(<AssessmentOutputsTab />);
    await screen.findByText('Digital Readiness — Area A');

    const typTh = container.querySelector<HTMLElement>('th[data-column-id="typWiersza"]');
    const versionTh = container.querySelector<HTMLElement>('th[data-column-id="outputVersion"]');
    expect(typTh).not.toBeNull();
    expect(versionTh).not.toBeNull();
    // `getColumnTypeFloor` gives a status column a 160px floor; the declared
    // width must be ≥160 for that floor to survive preview-open compression.
    expect(typTh!.style.minWidth).toBe('160px');
    expect(versionTh!.style.minWidth).toBe('160px');
  });

  it('D-73 v3 (DEC-680): opening a conclusion row fetches ITS record (ConclusionsApi.get) and DETAILS reads 6 real fields, never 6× "—" (MUTACJA: cofnij gałąź wniosku w efekcie otwarcia → RED)', async () => {
    const record = conclusionRecord();
    hoisted.listOutputs.mockResolvedValue({ outputs: [], total: 0 });
    conclusionsHoisted.list.mockResolvedValue({ conclusions: [record] });
    conclusionsHoisted.get.mockResolvedValue({
      conclusion: record,
      sourcePack: null,
      conversions: [],
    });
    const user = userEvent.setup();

    const { container } = renderTab(<AssessmentOutputsTab />);
    await user.click(
      await screen.findByText('Quality and Compliance Maturity — assessment report')
    );

    await waitFor(() => {
      expect(conclusionsHoisted.get).toHaveBeenCalledWith('concl-1');
    });

    const panel = await waitFor(() => {
      const p = container.querySelector('[data-right-panel]') as HTMLElement | null;
      expect(p).not.toBeNull();
      return p!;
    });

    // The 6 DETAILS properties read the real Conclusion record. Values may
    // appear twice (status chip in the panel header + the Property/Value row),
    // so assert presence via getAllByText.
    await waitFor(() => {
      expect(within(panel).getAllByText('Needs review').length).toBeGreaterThan(0);
    });
    expect(within(panel).getAllByText('Assessment').length).toBeGreaterThan(0);
    expect(within(panel).getAllByText('High').length).toBeGreaterThan(0);
    expect(within(panel).getAllByText('2').length).toBeGreaterThan(0);
    expect(within(panel).getAllByText('15/09/2026').length).toBeGreaterThan(0);
    expect(within(panel).getAllByText('16/09/2026').length).toBeGreaterThan(0);
    // No property cell falls back to the "—" placeholder.
    expect(within(panel).queryAllByText('—')).toHaveLength(0);
  });
});
