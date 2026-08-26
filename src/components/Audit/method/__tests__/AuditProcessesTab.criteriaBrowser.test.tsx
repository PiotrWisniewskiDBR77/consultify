/**
 * AuditProcessesTab — full-screen criteria browser drill-down (expert panel
 * gap pack, 2026-08-26, item 2): the only entry point into a criterion used
 * to be a 208px mock list inside the preview pane, unusable for a real
 * 100-300-criterion audit. This is the "View all" drill-down replacing it
 * with a `StandardTable` (search + status filter + pager) — reusing the
 * SAME `listProgramCriteria` call the preview mini-list already makes.
 *
 * Behind `ff_auditsScaleAndPolish` (default OFF, fail-closed).
 *
 * Navigation is asserted via a mocked `useNavigate` (established pattern in
 * this codebase, e.g. `ProfileSettings.smoke.test.tsx`) rather than reading
 * back `useLocation` through a real `MemoryRouter` — the latter does not
 * reliably flush `navigate()` calls issued imperatively (outside `<Link>`)
 * in this React 19 + react-router-dom v7 + jsdom combination; `<Link>` clicks
 * and `useSearchParams` writes DO flush (see the sibling
 * `AuditsMethodHub.test.tsx` tests), so the app's real click-driven
 * navigation is unaffected — this is a test-harness limitation, not a
 * product bug (confirmed with a minimal repro before writing this workaround).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../auditsMethodApi', async () => {
  const actual = await vi.importActual<typeof import('../auditsMethodApi')>('../auditsMethodApi');
  return {
    ...actual,
    getProgram: vi.fn(),
    getProgramCoverage: vi.fn(),
    getProgramLifecycle: vi.fn(),
    listProgramCriteria: vi.fn(),
    transitionProgram: vi.fn(),
  };
});

import { AuditProcessesTab } from '../tabs/AuditProcessesTab';
import {
  type AuditCriterionSummary,
  type AuditProgramSummary,
  getProgram,
  getProgramCoverage,
  getProgramLifecycle,
  listProgramCriteria,
} from '../auditsMethodApi';

const mockedGetProgram = vi.mocked(getProgram);
const mockedGetProgramCoverage = vi.mocked(getProgramCoverage);
const mockedGetProgramLifecycle = vi.mocked(getProgramLifecycle);
const mockedListProgramCriteria = vi.mocked(listProgramCriteria);

const program: AuditProgramSummary = {
  id: 'prog-1',
  name: 'Q3 Compliance Audit',
  packId: 'pack-1',
  packTitle: 'Client QMS Procedure',
  packVersion: 1,
  lifecycleState: 'fieldwork',
  applicableCriteria: 3,
  concludedCriteria: 1,
  openFindings: 2,
  leadAuditorId: 'u1',
  leadAuditorName: 'Ada Lovelace',
  plannedStart: '2026-08-01',
  plannedEnd: '2026-09-01',
  updatedAt: '2026-08-05',
};

function criterion(overrides: Partial<AuditCriterionSummary>): AuditCriterionSummary {
  return {
    id: 'c-1',
    programId: 'prog-1',
    parentId: null,
    ordinal: 1,
    refCode: 'INT-01',
    title: 'Customer complaint intake',
    applicable: true,
    conformityStatus: 'not_tested',
    workStatus: 'open',
    evidenceCount: 2,
    findingCount: 1,
    children: [],
    ...overrides,
  };
}

const criteria: AuditCriterionSummary[] = [
  criterion({ id: 'c-1', refCode: 'INT-01', title: 'Customer complaint intake', workStatus: 'open' }),
  criterion({ id: 'c-2', refCode: 'INT-02', title: 'Supplier requalification cadence', workStatus: 'concluded' }),
  criterion({ id: 'c-3', refCode: 'INT-03', title: 'Warehouse temperature log retention', workStatus: 'tested' }),
];

function setupApiMocks() {
  mockedGetProgram.mockResolvedValue({
    ...program, objective: null, scopeText: null, projectId: null, members: [],
  });
  mockedGetProgramCoverage.mockResolvedValue({
    applicableCriteria: 3, concludedCriteria: 1, insufficientEvidenceCriteria: 0,
  });
  mockedGetProgramLifecycle.mockResolvedValue({ state: 'fieldwork', allowed: [] });
  mockedListProgramCriteria.mockResolvedValue(criteria);
}

function renderTab() {
  return render(
    <MemoryRouter initialEntries={['/audit-programs/method']}>
      <AuditProcessesTab
        programs={[program]}
        loading={false}
        error={null}
        onRetry={() => {}}
        isPolish={true}
        onProgramChanged={() => {}}
      />
    </MemoryRouter>
  );
}

describe('AuditProcessesTab — criteria browser drill-down (ff_auditsScaleAndPolish)', () => {
  afterEach(() => {
    window.localStorage.removeItem('ff.audits_scale_and_polish');
    mockNavigate.mockClear();
  });

  it('flag OFF (default): no "View all" entry point, mini-list unchanged', async () => {
    setupApiMocks();
    renderTab();
    fireEvent.click(await screen.findByText('Q3 Compliance Audit'));
    await waitFor(() => expect(screen.getByText(/Customer complaint intake/)).toBeInTheDocument());
    expect(screen.queryByTestId('open-criteria-browser')).toBeNull();
  });

  it('flag ON: "View all" opens a full-screen StandardTable with search + status filter, and rows navigate to the workspace', async () => {
    window.localStorage.setItem('ff.audits_scale_and_polish', '1');
    setupApiMocks();
    renderTab();

    fireEvent.click(await screen.findByText('Q3 Compliance Audit'));
    const openBrowser = await screen.findByTestId('open-criteria-browser');
    expect(openBrowser).toHaveTextContent('3');
    fireEvent.click(openBrowser);

    // Full-screen browser: back button, search box, all 3 criteria visible.
    expect(await screen.findByTestId('criteria-browser-back')).toBeInTheDocument();
    expect(screen.getByTestId('criteria-browser-search')).toBeInTheDocument();
    expect(screen.getByText('Customer complaint intake')).toBeInTheDocument();
    expect(screen.getByText('Supplier requalification cadence')).toBeInTheDocument();
    expect(screen.getByText('Warehouse temperature log retention')).toBeInTheDocument();

    // Search narrows the list (client-side, over the already-loaded data).
    fireEvent.change(screen.getByTestId('criteria-browser-search'), {
      target: { value: 'warehouse' },
    });
    await waitFor(() =>
      expect(screen.queryByText('Customer complaint intake')).toBeNull()
    );
    expect(screen.getByText('Warehouse temperature log retention')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('criteria-browser-search'), { target: { value: '' } });

    // Clicking a row navigates to the canonical criterion workspace route.
    fireEvent.click(await screen.findByText('Customer complaint intake'));
    expect(mockNavigate).toHaveBeenCalledWith('/audit-programs/prog-1/criteria/c-1');
  });

  it('R2(b): the workStatus column filter matches rows on later pages, not just the current page', async () => {
    window.localStorage.setItem('ff.audits_scale_and_polish', '1');
    // PAGE_SIZE inside AuditCriteriaBrowser is 25 — 25 "open" rows fill page 1
    // exactly, and 3 "concluded" rows only exist on page 2. Before the R2(b)
    // fix, the column filter ran on `paged` (page 1 only) and could never
    // find them.
    const manyCriteria: AuditCriterionSummary[] = [
      ...Array.from({ length: 25 }, (_, i) =>
        criterion({ id: `open-${i}`, refCode: `OPEN-${i}`, title: `Open item ${i}`, workStatus: 'open' })
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        criterion({
          id: `concluded-${i}`,
          refCode: `CONC-${i}`,
          title: `Concluded item ${i}`,
          workStatus: 'concluded',
        })
      ),
    ];
    mockedGetProgram.mockResolvedValue({
      ...program, objective: null, scopeText: null, projectId: null, members: [],
    });
    mockedGetProgramCoverage.mockResolvedValue({
      applicableCriteria: 28, concludedCriteria: 3, insufficientEvidenceCriteria: 0,
    });
    mockedGetProgramLifecycle.mockResolvedValue({ state: 'fieldwork', allowed: [] });
    mockedListProgramCriteria.mockResolvedValue(manyCriteria);
    renderTab();

    fireEvent.click(await screen.findByText('Q3 Compliance Audit'));
    fireEvent.click(await screen.findByTestId('open-criteria-browser'));
    await screen.findByTestId('criteria-browser-back');

    // Page 1 (all "open") is visible; the concluded rows are off-screen on page 2.
    expect(screen.getByText('Open item 0')).toBeInTheDocument();
    expect(screen.queryByText('Concluded item 0')).toBeNull();

    // Open the (only) column filter — `workStatus` is the sole `filterable`
    // column in this table, so any "Filter…" trigger is it.
    const filterTrigger = screen.getAllByRole('button').find((btn) => /^filter/i.test(btn.getAttribute('aria-label') || ''));
    expect(filterTrigger).toBeTruthy();
    fireEvent.click(filterTrigger!);
    const concludedOption = screen.getByRole('checkbox', { name: /Zakończone wnioskiem|Concluded/i });
    fireEvent.click(concludedOption);
    // The panel's checkbox change is staged locally — it only reaches
    // `onFilterChange` once "Apply" is clicked (`FilterDropdown.handleApply`).
    fireEvent.click(screen.getByRole('button', { name: /apply|zastosuj/i }));

    // The filter must search the FULL 28-row set, not just the 25 already on page 1.
    await waitFor(() => expect(screen.getByText('Concluded item 0')).toBeInTheDocument());
    expect(screen.getByText('Concluded item 1')).toBeInTheDocument();
    expect(screen.getByText('Concluded item 2')).toBeInTheDocument();
    expect(screen.queryByText('Open item 0')).toBeNull();
  });

  it('flag ON: back button returns to the sessions table', async () => {
    window.localStorage.setItem('ff.audits_scale_and_polish', '1');
    setupApiMocks();
    renderTab();
    fireEvent.click(await screen.findByText('Q3 Compliance Audit'));
    fireEvent.click(await screen.findByTestId('open-criteria-browser'));
    expect(await screen.findByTestId('criteria-browser-back')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('criteria-browser-back'));
    await waitFor(() => expect(screen.queryByTestId('criteria-browser-back')).toBeNull());
    expect(screen.getByTestId('open-criteria-browser')).toBeInTheDocument();
  });
});
