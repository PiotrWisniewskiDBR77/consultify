/**
 * AuditsMethodHub — pięć powierzchni (Library/Processes/Outputs/Reports/
 * Initiatives), `?tab=` jako źródło prawdy.
 *
 * Mockuje `../auditsMethodApi` NA POZIOMIE MODUŁU (kształt serwera:
 * `ListResult<T>` z `{items, total}`) — nie `window.fetch`. Router jest
 * PRAWDZIWY (`MemoryRouter` + `useSearchParams`), bo dokładnie to jest pod
 * testem: URL musi przetrwać reload/wstecz/dalej/deep-link.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | { defaultValue?: string }) => {
      if (typeof fallback === 'string') return fallback;
      if (fallback && typeof fallback === 'object' && fallback.defaultValue) return fallback.defaultValue;
      return key;
    },
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('react-hot-toast', () => {
  const fn = vi.fn();
  return { default: Object.assign(fn, { success: vi.fn(), error: vi.fn(), loading: vi.fn(() => 'toast-id') }) };
});

vi.mock('../auditsMethodApi', async () => {
  const actual = await vi.importActual<typeof import('../auditsMethodApi')>('../auditsMethodApi');
  return {
    ...actual,
    listPacks: vi.fn(),
    listPrograms: vi.fn(),
    listOutputs: vi.fn(),
    listReports: vi.fn(),
    listProposals: vi.fn(),
    createProgram: vi.fn(),
    getPack: vi.fn(),
    getProgram: vi.fn(),
    getProgramCoverage: vi.fn(),
    getProgramLifecycle: vi.fn(),
    listProgramCriteria: vi.fn(),
  };
});

import {
  AUDIT_START_COMMAND_NAMESPACE,
  AuditsMethodHub,
  auditStartFingerprint,
  claimAuditStart,
} from '../AuditsMethodHub';
import {
  clearPersistentCommandId,
  persistentCommandId,
} from '@/services/initiatives-execution/persistentCommandId';
import {
  getProgram,
  getProgramCoverage,
  getProgramLifecycle,
  listProgramCriteria,
  listOutputs,
  listPacks,
  listPrograms,
  listProposals,
  listReports,
  type AuditPackSummary,
  type AuditProgramSummary,
} from '../auditsMethodApi';

const mockedListPacks = vi.mocked(listPacks);
const mockedListPrograms = vi.mocked(listPrograms);
const mockedListOutputs = vi.mocked(listOutputs);
const mockedListReports = vi.mocked(listReports);
const mockedListProposals = vi.mocked(listProposals);
const mockedGetProgram = vi.mocked(getProgram);
const mockedGetProgramCoverage = vi.mocked(getProgramCoverage);
const mockedGetProgramLifecycle = vi.mocked(getProgramLifecycle);
const mockedListProgramCriteria = vi.mocked(listProgramCriteria);

const packs: AuditPackSummary[] = [
  {
    id: 'pack-1',
    packKey: 'iso-19011',
    version: 2,
    title: 'ISO 19011 Audit Pack',
    summary: null,
    sourceId: 'src-1',
    sourceTitle: 'ISO 19011:2018',
    sourceVersion: '2018',
    sourceType: 'LICENSED_STANDARD',
    verificationStatus: 'VERIFIED',
    publicationStatus: 'published',
    requiredRoles: [],
    criteriaCount: 42,
    updatedAt: '2026-08-01',
  },
  {
    id: 'pack-2',
    packKey: 'client-qms',
    version: 1,
    title: 'Client QMS Procedure',
    summary: null,
    sourceId: 'src-2',
    sourceTitle: 'Client QMS v3',
    sourceVersion: '3',
    sourceType: 'INTERNAL_PROCEDURE',
    verificationStatus: 'VERIFIED',
    publicationStatus: 'published',
    requiredRoles: [],
    criteriaCount: 10,
    updatedAt: '2026-08-02',
  },
  {
    id: 'pack-3',
    packKey: 'demo-pack',
    version: 1,
    title: 'Demonstration Pack',
    summary: null,
    sourceId: null,
    sourceTitle: null,
    sourceVersion: null,
    sourceType: 'DEMONSTRATION',
    verificationStatus: 'UNVERIFIED',
    publicationStatus: 'draft',
    requiredRoles: [],
    criteriaCount: 3,
    updatedAt: '2026-08-03',
  },
];

const programs: AuditProgramSummary[] = [
  {
    id: 'prog-1',
    name: 'Q3 Compliance Audit',
    packId: 'pack-1',
    packTitle: 'ISO 19011 Audit Pack',
    packVersion: 2,
    lifecycleState: 'fieldwork',
    applicableCriteria: 10,
    concludedCriteria: 4,
    openFindings: 2,
    leadAuditorId: 'u1',
    leadAuditorName: 'Ada Lovelace',
    plannedStart: '2026-08-01',
    plannedEnd: '2026-09-01',
    updatedAt: '2026-08-05',
  },
];

function setupApiMocks() {
  mockedListPacks.mockResolvedValue({ items: packs, total: packs.length });
  mockedListPrograms.mockResolvedValue({ items: programs, total: programs.length });
  mockedListOutputs.mockResolvedValue({ items: [], total: 0 });
  mockedListReports.mockResolvedValue({ items: [], total: 0 });
  mockedListProposals.mockResolvedValue({ items: [], total: 0 });
  mockedGetProgram.mockResolvedValue({
    ...programs[0], objective: null, scopeText: null, projectId: null, members: [],
  });
  mockedGetProgramCoverage.mockResolvedValue({
    applicableCriteria: 10, concludedCriteria: 4, insufficientEvidenceCriteria: 1,
  });
  mockedGetProgramLifecycle.mockResolvedValue({ state: 'fieldwork', allowed: [] });
  mockedListProgramCriteria.mockResolvedValue([
    {
      id: 'criterion-1', programId: 'prog-1', parentId: null, ordinal: 1,
      refCode: 'INT-01', title: 'Customer complaint intake', applicable: true,
      conformityStatus: 'not_tested', workStatus: 'open', evidenceCount: 2,
      findingCount: 1, children: [],
    },
  ]);
}

const LocationProbe: React.FC = () => {
  const location = useLocation();
  return <div data-testid="location-probe">{location.pathname + location.search}</div>;
};

function renderHub(initialEntries: string[] = ['/audit-programs/method']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <LocationProbe />
      <AuditsMethodHub />
    </MemoryRouter>
  );
}

describe('AuditsMethodHub', () => {
  it('synchronously rejects a duplicate Start dispatch for the same pack', () => {
    const inFlight = new Set<string>();
    expect(claimAuditStart(inFlight, 'pack-1')).toBe(true);
    expect(claimAuditStart(inFlight, 'pack-1')).toBe(false);
    expect(claimAuditStart(inFlight, 'pack-2')).toBe(true);
  });

  it('retains the Start key across remount/reload and rotates only after confirmed success', () => {
    const fingerprint = auditStartFingerprint('org-1', 'user-1', 'pack-1');
    clearPersistentCommandId(AUDIT_START_COMMAND_NAMESPACE, fingerprint);
    const firstMountKey = persistentCommandId(AUDIT_START_COMMAND_NAMESPACE, fingerprint);
    // A new component instance after reload has no refs, but reads the same session command.
    const remountedKey = persistentCommandId(AUDIT_START_COMMAND_NAMESPACE, fingerprint);
    expect(remountedKey).toBe(firstMountKey);
    // Production clears only after exact create→readback→list success.
    clearPersistentCommandId(AUDIT_START_COMMAND_NAMESPACE, fingerprint);
    const nextIntentKey = persistentCommandId(AUDIT_START_COMMAND_NAMESPACE, fingerprint);
    expect(nextIntentKey).not.toBe(firstMountKey);
    clearPersistentCommandId(AUDIT_START_COMMAND_NAMESPACE, fingerprint);
  });

  it('renders exactly five tabs in the required order — second tab reads "Sessions", not "Processes"', async () => {
    setupApiMocks();
    renderHub();
    await waitFor(() => expect(mockedListPacks).toHaveBeenCalled());

    const tabButtons = ['Library', 'Sessions', 'Outputs', 'Reports', 'Initiatives'].map((label) =>
      screen.getByRole('tab', { name: label })
    );
    expect(tabButtons).toHaveLength(5);
    // Order in the DOM must match the required Library·Sessions·Outputs·Reports·Initiatives order.
    const allTabs = screen.getAllByRole('tab').map((b) => b.textContent);
    expect(allTabs).toEqual(['Library', 'Sessions', 'Outputs', 'Reports', 'Initiatives']);
    // "Processes" must not leak anywhere as a tab label.
    expect(screen.queryByRole('tab', { name: 'Processes' })).toBeNull();
  });

  it('defaults to Library when ?tab= is absent', async () => {
    setupApiMocks();
    renderHub(['/audit-programs/method']);
    await waitFor(() => expect(screen.getByText('ISO 19011 Audit Pack')).toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByTestId('location-probe').textContent).toContain('tab=library')
    );
  });

  it('opens Outputs when ?tab=outputs is in the URL', async () => {
    setupApiMocks();
    renderHub(['/audit-programs/method?tab=outputs']);
    await waitFor(() => expect(mockedListOutputs).toHaveBeenCalled());
    expect(screen.getByText('No Outputs yet')).toBeInTheDocument();
  });

  it('falls back to Processes for an unknown ?tab= value', async () => {
    setupApiMocks();
    renderHub(['/audit-programs/method?tab=bogus']);
    await waitFor(() => expect(screen.getByText('Q3 Compliance Audit')).toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByTestId('location-probe').textContent).toContain('tab=processes')
    );
  });

  it('writes the active tab into the URL when a tab is clicked', async () => {
    setupApiMocks();
    renderHub(['/audit-programs/method']);
    await waitFor(() => expect(screen.getByText('ISO 19011 Audit Pack')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('tab', { name: 'Reports' }));

    await waitFor(() =>
      expect(screen.getByTestId('location-probe').textContent).toContain('tab=reports')
    );
    await waitFor(() => expect(mockedListReports).toHaveBeenCalled());
  });

  it('renders a real StandardTable element on the default Library tab', async () => {
    setupApiMocks();
    const { container } = renderHub();
    await waitFor(() => expect(container.querySelector('table')).toBeInTheDocument());
  });

  it('renders a real StandardTable element on the Sessions tab — `?tab=processes` still works, only the label changed', async () => {
    setupApiMocks();
    renderHub(['/audit-programs/method?tab=processes']);
    await waitFor(() => expect(screen.getByText('Q3 Compliance Audit')).toBeInTheDocument());
    expect(document.querySelector('table')).toBeInTheDocument();
    expect(screen.getByTestId('location-probe').textContent).toContain('tab=processes');
    expect(screen.getByRole('tab', { name: 'Sessions', selected: true })).toBeInTheDocument();
  });

  it('opens a canonical criterion workspace from the selected program', async () => {
    setupApiMocks();
    renderHub(['/audit-programs?tab=processes']);
    await waitFor(() => expect(screen.getByText('Q3 Compliance Audit')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Q3 Compliance Audit'));
    await waitFor(() => expect(screen.getByText(/Customer complaint intake/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('link', { name: /INT-01.*Customer complaint intake/i }));
    await waitFor(() =>
      expect(screen.getByTestId('location-probe')).toHaveTextContent(
        '/audit-programs/prog-1/criteria/criterion-1'
      )
    );
  });

  it('keeps the program preview mounted when canonical detail omits optional members', async () => {
    setupApiMocks();
    mockedGetProgram.mockResolvedValue({
      ...programs[0],
      objective: null,
      scopeText: null,
      projectId: null,
    } as Awaited<ReturnType<typeof getProgram>>);
    renderHub(['/audit-programs?tab=processes']);
    fireEvent.click(await screen.findByText('Q3 Compliance Audit'));
    expect(await screen.findByText(/Customer complaint intake/)).toBeInTheDocument();
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });

  it('cold-opens the program preview from the canonical programId query deep link', async () => {
    setupApiMocks();
    renderHub(['/audit-programs?tab=processes&programId=prog-1']);
    expect(await screen.findByText(/Customer complaint intake/)).toBeInTheDocument();
    expect(mockedGetProgram).toHaveBeenCalledWith('prog-1');
  });

  it('shows an ErrorState with retry when the Library API call fails', async () => {
    mockedListPacks.mockRejectedValue(new Error('boom'));
    mockedListPrograms.mockResolvedValue({ items: [], total: 0 });
    mockedListOutputs.mockResolvedValue({ items: [], total: 0 });
    mockedListReports.mockResolvedValue({ items: [], total: 0 });
    mockedListProposals.mockResolvedValue({ items: [], total: 0 });

    renderHub();
    await waitFor(() => expect(screen.getByText('boom')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /try again|retry/i })).toBeInTheDocument();
  });

  it('shows the honest Outputs EmptyState explaining why the list is empty', async () => {
    setupApiMocks();
    renderHub(['/audit-programs/method?tab=outputs']);
    await waitFor(() => expect(screen.getByText('No Outputs yet')).toBeInTheDocument());
    expect(screen.getByText(/created automatically when an audit program is finalized/i)).toBeInTheDocument();
  });

  describe('Library — single-axis Menu 3 (DEC-2026-08-25-66)', () => {
    // Piotr, werdykt partii D (2026-08-25): the previous two stacked chip
    // rows (source type + verification) read as "a fourth menu" — Menu 3
    // now carries exactly ONE chip track (verification), the same
    // `chips`/`activeChip`/`onChipChange` mechanism Sessions already uses.
    // `sourceType` remains filterable through the table's own column-header
    // filter (`AuditLibraryTab`'s `filterable`/`filterOptions` on that
    // column) — unaffected by this change.
    it('renders exactly one chip row (verification), with visible zero counts, and no source-type chips', async () => {
      setupApiMocks();
      renderHub();
      await waitFor(() => expect(screen.getByText('ISO 19011 Audit Pack')).toBeInTheDocument());

      expect(screen.getByTestId('standard-chip-VERIFIED')).toBeInTheDocument();
      // A value with zero packs still shows its chip with a "0".
      const evidenceMissingChip = screen.getByTestId('standard-chip-EVIDENCE_MISSING');
      expect(within(evidenceMissingChip).getByText('0')).toBeInTheDocument();

      // The old source-type chip row is gone — no chip for a source-type
      // value exists anywhere in Menu 3.
      expect(screen.queryByTestId('standard-chip-DEMONSTRATION')).toBeNull();
      expect(screen.queryByTestId('standard-chip-LICENSED_STANDARD')).toBeNull();
      expect(screen.queryByTestId('audits-library-source-type-chip-all')).toBeNull();
      expect(screen.queryByTestId('audits-library-verification-chip-all')).toBeNull();
    });

    it('selecting a verification chip narrows the list to that single axis', async () => {
      setupApiMocks();
      renderHub();
      await waitFor(() => expect(screen.getByText('ISO 19011 Audit Pack')).toBeInTheDocument());

      // Two packs are VERIFIED (ISO + Client QMS); the DEMONSTRATION pack is UNVERIFIED.
      fireEvent.click(screen.getByTestId('standard-chip-VERIFIED'));
      await waitFor(() => {
        expect(screen.getByText('ISO 19011 Audit Pack')).toBeInTheDocument();
        expect(screen.getByText('Client QMS Procedure')).toBeInTheDocument();
        expect(screen.queryByText('Demonstration Pack')).toBeNull();
      });
      expect(screen.getByTestId('standard-chip-VERIFIED')).toHaveAttribute('aria-pressed', 'true');
    });

    it('the Library verification chip row does not appear on the Sessions (processes) tab', async () => {
      setupApiMocks();
      renderHub(['/audit-programs/method?tab=processes']);
      await waitFor(() => expect(screen.getByText('Q3 Compliance Audit')).toBeInTheDocument());
      expect(screen.queryByTestId('standard-chip-VERIFIED')).toBeNull();
      expect(screen.queryByTestId('standard-chip-EVIDENCE_MISSING')).toBeNull();
      // Sessions keeps its own single-axis lifecycle chip row, unaffected.
      expect(screen.getByTestId('standard-chip-fieldwork')).toBeInTheDocument();
    });
  });
});
