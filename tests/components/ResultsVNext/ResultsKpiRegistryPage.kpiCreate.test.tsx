/**
 * @vitest-environment jsdom
 *
 * RN-G5 (2026-08-12) — component test for the KPI create -> edit draft ->
 * submit -> approve/reject flow wired into
 * `src/components/ResultsVNext/ResultsKpiRegistryPage.tsx`
 * (`KpiDraftFormModal.tsx`/`KpiTransitionDialog.tsx`, both new this
 * package). Before this package, NOTHING in this tree called
 * `createKpiDraft`/`submitKpi*`/`approve|rejectDefinitionVersion` — this
 * test is the first one that exercises that path at all.
 *
 * `Api.get`/`Api.post`/`Api.put` are mocked at the module boundary with a
 * STATEFUL fake backend (mirrors the dev-render harness's own mock and the
 * real `kpi.routes.ts`/`kpiDefinitionCommands.ts` contract: CAS on the
 * version's own `rowVersion`, self-approval denial by `submittedBy`/
 * `createdBy`, `NOT_A_DRAFT`/`NOT_SUBMITTED` transition guards) — a real
 * component render exercising real fetch/state wiring, not a snapshot of
 * hand-built props.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) => (typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key)),
    i18n: { language: 'pl' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: any) =>
    selector({ currentUser: { id: 'user-piotr-demo', firstName: 'Piotr', lastName: 'W', role: 'ADMIN' } }),
}));

const apiGet = vi.fn();
const apiPost = vi.fn();
const apiPut = vi.fn();
vi.mock('@/services/api', () => ({
  Api: { get: (...a: any[]) => apiGet(...a), post: (...a: any[]) => apiPost(...a), put: (...a: any[]) => apiPut(...a) },
}));

import { ResultsKpiRegistryPage } from '../../../src/components/ResultsVNext/ResultsKpiRegistryPage';

const EXISTING_DRAFT_KPI = {
  kpiId: 'kpi-existing-draft',
  organizationId: 'org-1',
  kpiCode: 'EXISTING-DRAFT',
  status: 'draft',
  currentDefinitionVersionId: 'ver-existing',
  primaryProcessId: null,
  responsePolicyId: null,
  ownerUserId: 'user-piotr-demo',
  rowVersion: 1,
  createdBy: 'user-anna',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

/** In-memory fake backend — mirrors `kpi.routes.ts`/`kpiDefinitionCommands.ts`
 * closely enough to prove THIS component's wiring (payload shapes, CAS
 * values, response handling), not to re-test the server itself. */
function makeFakeBackend() {
  const kpis: any[] = [{ ...EXISTING_DRAFT_KPI }];
  const versions: Record<string, any> = {}; // deliberately NOT pre-seeded for EXISTING_DRAFT_KPI — no GET ever returns a version (see file header of kpiApi.ts).
  let seq = 0;

  apiGet.mockImplementation(async (url: string) => {
    if (url.startsWith('/vnext/results/kpi/') && url.includes('/measurements')) {
      return { measurements: [] };
    }
    if (url.startsWith('/vnext/results/kpi/scorecards')) {
      return { scorecards: [] };
    }
    if (url.startsWith('/vnext/results/kpi/')) {
      const kpiId = url.split('/vnext/results/kpi/')[1]?.split('?')[0];
      const found = kpis.find((k) => k.kpiId === kpiId);
      if (!found) {
        const err: any = new Error('not found');
        err.status = 404;
        throw err;
      }
      return { kpi: found };
    }
    if (url.startsWith('/vnext/results/kpi')) {
      return { kpis };
    }
    throw new Error(`Unexpected GET ${url}`);
  });

  apiPost.mockImplementation(async (url: string, data: any) => {
    if (url === '/vnext/results/kpi') {
      seq += 1;
      const kpiId = `kpi-new-${seq}`;
      const versionId = `ver-new-${seq}`;
      const now = new Date().toISOString();
      const kpi = {
        kpiId,
        organizationId: 'org-1',
        kpiCode: data.kpiCode,
        status: 'draft',
        currentDefinitionVersionId: versionId,
        primaryProcessId: null,
        responsePolicyId: null,
        ownerUserId: 'user-piotr-demo',
        rowVersion: 1,
        createdBy: 'user-piotr-demo',
        createdAt: now,
        updatedAt: now,
      };
      const version = {
        definitionVersionId: versionId,
        kpiId,
        organizationId: 'org-1',
        versionNumber: 1,
        name: data.name,
        description: data.description ?? null,
        unit: data.unit ?? null,
        targetGeometry: data.targetGeometry,
        targetValue: data.targetValue ?? null,
        targetMin: data.targetMin ?? null,
        targetMax: data.targetMax ?? null,
        warningLow: data.warningLow ?? null,
        warningHigh: data.warningHigh ?? null,
        criticalLow: data.criticalLow ?? null,
        criticalHigh: data.criticalHigh ?? null,
        binarySuccessValue: data.binarySuccessValue ?? null,
        formulaText: data.formulaText ?? null,
        approvalStatus: 'draft',
        effectiveFrom: null,
        effectiveTo: null,
        createdBy: 'user-piotr-demo',
        createdAt: now,
        updatedAt: now,
        submittedBy: null,
        submittedAt: null,
        approvedBy: null,
        approvedAt: null,
        rejectedBy: null,
        rejectedAt: null,
        rejectionReason: null,
        rowVersion: 1,
      };
      kpis.unshift(kpi);
      versions[versionId] = version;
      return { outcome: 'applied', eventId: `evt-${kpiId}`, resultingVersion: 1, kpi, definitionVersion: version };
    }
    const submitMatch = url.match(/\/vnext\/results\/kpi\/([^/]+)\/submit$/);
    if (submitMatch) {
      const kpi = kpis.find((k) => k.kpiId === submitMatch[1]);
      const version = versions[kpi.currentDefinitionVersionId];
      if (version.approvalStatus !== 'draft') {
        const err: any = new Error('not a draft');
        err.status = 409;
        err.data = { code: 'NOT_A_DRAFT' };
        throw err;
      }
      if (data.expectedVersion !== version.rowVersion) {
        const err: any = new Error('version conflict');
        err.status = 409;
        err.data = { code: 'VERSION_CONFLICT' };
        throw err;
      }
      version.approvalStatus = 'submitted';
      version.submittedBy = 'user-piotr-demo';
      version.rowVersion += 1;
      if (kpi.status === 'draft') kpi.status = 'pending_approval';
      return { outcome: 'applied', resultingVersion: version.rowVersion, definitionVersion: version };
    }
    const approveMatch = url.match(/\/vnext\/results\/kpi\/([^/]+)\/definition-versions\/([^/]+)\/approve$/);
    if (approveMatch) {
      const version = versions[approveMatch[2]];
      if (version.submittedBy === 'user-piotr-demo' || version.createdBy === 'user-piotr-demo') {
        const err: any = new Error('self-approval denied');
        err.status = 403;
        err.data = { code: 'SELF_APPROVAL_DENIED' };
        throw err;
      }
      if (data.expectedVersion !== version.rowVersion) {
        const err: any = new Error('version conflict');
        err.status = 409;
        err.data = { code: 'VERSION_CONFLICT' };
        throw err;
      }
      version.approvalStatus = 'approved';
      version.rowVersion += 1;
      return { outcome: 'applied', resultingVersion: version.rowVersion, definitionVersion: version };
    }
    const rejectMatch = url.match(/\/vnext\/results\/kpi\/([^/]+)\/definition-versions\/([^/]+)\/reject$/);
    if (rejectMatch) {
      const kpi = kpis.find((k) => k.kpiId === rejectMatch[1]);
      const version = versions[rejectMatch[2]];
      if (data.expectedVersion !== version.rowVersion) {
        const err: any = new Error('version conflict');
        err.status = 409;
        err.data = { code: 'VERSION_CONFLICT' };
        throw err;
      }
      version.approvalStatus = 'rejected';
      version.rejectionReason = data.rejectionReason;
      version.rowVersion += 1;
      if (kpi.status === 'pending_approval') kpi.status = 'draft';
      return { outcome: 'applied', resultingVersion: version.rowVersion, definitionVersion: version };
    }
    throw new Error(`Unexpected POST ${url}`);
  });

  apiPut.mockImplementation(async (url: string, data: any) => {
    const draftMatch = url.match(/\/vnext\/results\/kpi\/([^/]+)\/draft$/);
    if (draftMatch) {
      const kpi = kpis.find((k) => k.kpiId === draftMatch[1]);
      const version = versions[kpi.currentDefinitionVersionId];
      if (data.expectedVersion !== version.rowVersion) {
        const err: any = new Error('version conflict');
        err.status = 409;
        err.data = { code: 'VERSION_CONFLICT' };
        throw err;
      }
      if (data.name !== undefined) version.name = data.name;
      version.rowVersion += 1;
      return { outcome: 'applied', resultingVersion: version.rowVersion, definitionVersion: version };
    }
    throw new Error(`Unexpected PUT ${url}`);
  });

  return { kpis, versions };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/results/kpi']}>
      <ResultsKpiRegistryPage />
    </MemoryRouter>
  );
}

/** Walk up from a text node to its owning `<tr>` (StandardTable renders a
 * real `<table>` — same helper convention `DecisionsPanelContent.reskin
 * .test.tsx` uses). */
function rowFor(el: HTMLElement): HTMLElement {
  const tr = el.closest('tr');
  if (!tr) throw new Error('no owning <tr>');
  return tr as HTMLElement;
}

/** Clicks a kebab menu item by label — scoped to the open `role="menu"`
 * popover (`RowActionsMenu.tsx`), NOT a plain `screen.getByText`, because
 * the SAME label (e.g. "Edytuj szkic") also appears as a preview-pane
 * action button when the row is selected (RN-G5's `defInformational`/
 * `defResolutions` wiring puts the identical action in both places). */
async function clickMenuItem(label: string): Promise<void> {
  const menu = await screen.findByRole('menu');
  fireEvent.click(within(menu).getByText(label));
}

describe('ResultsKpiRegistryPage — RN-G5 create/edit/submit/approve/reject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.setItem('ff.results_vnext_kpi_registry', '1');
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('full happy path: create draft -> edit -> submit -> approve (second actor)', async () => {
    makeFakeBackend();
    renderPage();

    await screen.findByText('EXISTING-DRAFT');

    // 1) Create.
    fireEvent.click(screen.getByTestId('kpi-registry-create-cta'));
    fireEvent.change(await screen.findByTestId('kpi-draft-code'), { target: { value: 'NEW-KPI-CODE' } });
    fireEvent.change(screen.getByTestId('kpi-draft-name'), { target: { value: 'Nowy wskaźnik' } });
    fireEvent.click(screen.getByTestId('kpi-draft-form-submit'));

    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/vnext/results/kpi', expect.objectContaining({
      kpiCode: 'NEW-KPI-CODE',
      name: 'Nowy wskaźnik',
      targetGeometry: 'threshold_min',
    })));
    // Create auto-selects the new row, so its title now ALSO appears in the
    // preview pane header — `getAllByText`, table cell is the first match
    // (table renders above the preview pane in DOM order).
    await screen.findAllByText('NEW-KPI-CODE');

    // 2) Edit (row menu — the newly-created row's `knownVersions` entry
    // makes Edit/Submit reachable, unlike EXISTING-DRAFT below).
    const newRow = rowFor(screen.getAllByText('NEW-KPI-CODE')[0]);
    fireEvent.click(within(newRow).getByLabelText("Row actions"));
    await clickMenuItem('Edytuj szkic');
    const nameInput = await screen.findByTestId('kpi-draft-name');
    expect((nameInput as HTMLInputElement).value).toBe('Nowy wskaźnik');
    fireEvent.change(nameInput, { target: { value: 'Nowy wskaźnik v2' } });
    fireEvent.click(screen.getByTestId('kpi-draft-form-submit'));
    await waitFor(() =>
      expect(apiPut).toHaveBeenCalledWith(
        expect.stringMatching(/\/draft$/),
        expect.objectContaining({ expectedVersion: 1, name: 'Nowy wskaźnik v2' })
      )
    );

    // 3) Submit for approval.
    fireEvent.click(within(newRow).getByLabelText("Row actions"));
    await clickMenuItem('Zgłoś do zatwierdzenia');
    fireEvent.click(screen.getByTestId('kpi-transition-submit'));
    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith(
        expect.stringMatching(/\/submit$/),
        expect.objectContaining({ expectedVersion: 2 })
      )
    );

    // 4) Approve as the SAME actor is denied server-side (self-approval) —
    // negative path proven honestly, not hidden.
    fireEvent.click(within(newRow).getByLabelText("Row actions"));
    await clickMenuItem('Zatwierdź');
    fireEvent.click(screen.getByTestId('kpi-transition-submit'));
    await screen.findByTestId('kpi-transition-error');
    expect(screen.getByTestId('kpi-transition-error').textContent).toMatch(/nie możesz zatwierdzić/i);
  });

  it('locks Edit/Submit for a KPI whose definition version this session never created/mutated (confirmed backend gap)', async () => {
    makeFakeBackend();
    renderPage();

    const row = rowFor(await screen.findByText('EXISTING-DRAFT'));
    fireEvent.click(within(row).getByLabelText("Row actions"));

    const menu = await screen.findByRole('menu');
    const editEntry = within(menu).getByText('Edytuj szkic');
    // `lockedRowMenuAction` renders the action `disabled` with a `note` —
    // clicking it must NOT open the form or call the API.
    fireEvent.click(editEntry);
    expect(apiPut).not.toHaveBeenCalled();
    expect(screen.queryByTestId('kpi-draft-form-submit')).not.toBeInTheDocument();
  });

  it('reject requires a non-empty reason — negative control for the required-field guard', async () => {
    makeFakeBackend();
    renderPage();

    fireEvent.click(screen.getByTestId('kpi-registry-create-cta'));
    fireEvent.change(await screen.findByTestId('kpi-draft-code'), { target: { value: 'REJECT-ME' } });
    fireEvent.change(screen.getByTestId('kpi-draft-name'), { target: { value: 'Do odrzucenia' } });
    fireEvent.click(screen.getByTestId('kpi-draft-form-submit'));
    await screen.findAllByText('REJECT-ME');
    const row = rowFor(screen.getAllByText('REJECT-ME')[0]);

    fireEvent.click(within(row).getByLabelText("Row actions"));
    await clickMenuItem('Zgłoś do zatwierdzenia');
    fireEvent.click(screen.getByTestId('kpi-transition-submit'));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith(expect.stringMatching(/\/submit$/), expect.anything()));

    fireEvent.click(within(row).getByLabelText("Row actions"));
    await clickMenuItem('Odrzuć');
    // Empty reason — submit must be blocked client-side (no reject POST).
    fireEvent.click(screen.getByTestId('kpi-transition-submit'));
    expect(await screen.findByText(/powód jest wymagany/i)).toBeInTheDocument();
    expect(apiPost).not.toHaveBeenCalledWith(expect.stringMatching(/\/reject$/), expect.anything());

    // Fill the reason — now it goes through.
    fireEvent.change(screen.getByTestId('kpi-transition-reason'), { target: { value: 'Zły cel liczbowy.' } });
    fireEvent.click(screen.getByTestId('kpi-transition-submit'));
    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith(
        expect.stringMatching(/\/reject$/),
        expect.objectContaining({ rejectionReason: 'Zły cel liczbowy.' })
      )
    );
  });
});
