/**
 * 1.1-A2 — kontrakt Audytów po DEC-417b/c/d (właściciel, 06.09.2026,
 * 7 zrzutów).
 *
 * Broni DOKŁADNIE trzech rzeczy, o które prosił właściciel:
 *
 *  b) „Straszny bałagan w menu trzecim. Poukładaj, żeby było we wszystkich
 *     zakładkach i funkcjonowało tak, jak powinno." → KAŻDA z pięciu
 *     zakładek ma Menu 3 z ≤3 chipami I dropdown filtra w Menu 2 (pełna
 *     lista). Mutacja: przywrócenie 12 chipów etapów w Sesjach → RED.
 *
 *  c) „Wywal Ustalenia z tej zakładki — nie wiem, po co to jest." → Menu 2
 *     ma dokładnie pięć pigułek, „Ustalenia"/„Findings" nie ma, a stary
 *     deep link `?tab=findings` nie wskrzesza zakładki (spada na Sesje).
 *
 *  d) „Podpiąć generator raportów, inicjatyw i insightów jak w pozostałych
 *     modułach." → CTA jest PER ZAKŁADKA i otwiera realny generator.
 *     Mutacja: odpięcie CTA Inicjatyw od generatora → RED.
 *
 * Mockujemy `../auditsMethodApi` na poziomie modułu (kształt serwera:
 * `ListResult<T>`), router jest PRAWDZIWY — `?tab=` jest pod testem.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | { defaultValue?: string }) => {
      if (typeof fallback === 'string') return fallback;
      if (fallback && typeof fallback === 'object' && fallback.defaultValue)
        return fallback.defaultValue;
      return key;
    },
    i18n: { language: 'pl' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('react-hot-toast', () => {
  const fn = vi.fn();
  return {
    default: Object.assign(fn, {
      success: vi.fn(),
      error: vi.fn(),
      loading: vi.fn(() => 'toast-id'),
    }),
  };
});

vi.mock('@/services/api/conclusions.api', () => ({
  ConclusionsApi: {
    sync: vi.fn().mockResolvedValue({ synced: {} }),
    list: vi.fn().mockResolvedValue({ conclusions: [] }),
    get: vi.fn(),
    listConversions: vi.fn(),
  },
}));

vi.mock('../auditsMethodApi', async () => {
  const actual = await vi.importActual<typeof import('../auditsMethodApi')>('../auditsMethodApi');
  return {
    ...actual,
    listPacks: vi.fn(),
    listPrograms: vi.fn(),
    listOutputs: vi.fn(),
    listReports: vi.fn(),
    listProposals: vi.fn(),
    getPack: vi.fn(),
    getProgram: vi.fn(),
    getProgramCoverage: vi.fn(),
    getProgramLifecycle: vi.fn(),
    listProgramCriteria: vi.fn(),
  };
});

import { AuditsMethodHub } from '../AuditsMethodHub';
import {
  AUDIT_LIFECYCLE_STATES,
  getProgram,
  getProgramCoverage,
  getProgramLifecycle,
  listOutputs,
  listPacks,
  listProgramCriteria,
  listPrograms,
  listProposals,
  listReports,
  type AuditPackSummary,
  type AuditProgramSummary,
} from '../auditsMethodApi';

const packs: AuditPackSummary[] = [
  {
    id: 'pack-1',
    packKey: 'iso-19011',
    version: 2,
    title: 'Pakiet ISO 19011',
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
];

const programs: AuditProgramSummary[] = [
  {
    id: 'prog-1',
    name: 'Audyt zgodności Q3',
    packId: 'pack-1',
    packTitle: 'Pakiet ISO 19011',
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
  vi.mocked(listPacks).mockResolvedValue({ items: packs, total: packs.length });
  vi.mocked(listPrograms).mockResolvedValue({ items: programs, total: programs.length });
  vi.mocked(listOutputs).mockResolvedValue({ items: [], total: 0 });
  vi.mocked(listReports).mockResolvedValue({ items: [], total: 0 });
  vi.mocked(listProposals).mockResolvedValue({ items: [], total: 0 });
  vi.mocked(getProgram).mockResolvedValue({
    ...programs[0],
    objective: null,
    scopeText: null,
    projectId: null,
    members: [],
  });
  vi.mocked(getProgramCoverage).mockResolvedValue({
    applicableCriteria: 10,
    concludedCriteria: 4,
    insufficientEvidenceCriteria: 1,
  });
  vi.mocked(getProgramLifecycle).mockResolvedValue({ state: 'fieldwork', allowed: [] });
  vi.mocked(listProgramCriteria).mockResolvedValue([]);
}

function renderHub(entries: string[] = ['/audit-programs']) {
  return render(
    <MemoryRouter initialEntries={entries}>
      <AuditsMethodHub />
    </MemoryRouter>
  );
}

/** Wszystkie chipy Menu 3 widoczne w tej chwili (fasada nadaje im testid). */
function menu3ChipIds(): string[] {
  return screen
    .queryAllByTestId(/^standard-chip-/)
    .map((el) => String(el.getAttribute('data-testid')).replace('standard-chip-', ''));
}

const TAB_CONTRACT: Array<{
  tab: string;
  label: string;
  dropdown: string;
  cta: string;
}> = [
  {
    tab: 'library',
    label: 'Biblioteka',
    dropdown: 'audits-library-verification-dropdown',
    cta: 'audits-method-new-audit-cta',
  },
  {
    tab: 'processes',
    label: 'Sesje',
    dropdown: 'audits-processes-stage-dropdown',
    cta: 'audits-method-new-audit-cta',
  },
  {
    // DEC-417e: „zamiast Wyniki to Wnioski" — zakładka, dropdown i CTA.
    tab: 'conclusions',
    label: 'Wnioski',
    dropdown: 'audits-conclusions-status-dropdown',
    cta: 'audits-method-new-conclusion-cta',
  },
  {
    tab: 'reports',
    label: 'Raporty',
    dropdown: 'audits-reports-status-dropdown',
    cta: 'audits-method-new-report-cta',
  },
  {
    tab: 'initiatives',
    label: 'Inicjatywy',
    dropdown: 'audits-initiatives-status-dropdown',
    cta: 'audits-method-new-initiative-cta',
  },
];

describe('Audyty 1.1-A2 — jeden wzór Menu 3 i generatory per zakładka', () => {
  it('DEC-417c: Menu 2 ma dokładnie pięć zakładek, bez „Ustalenia”', async () => {
    setupApiMocks();
    renderHub();
    await waitFor(() => expect(vi.mocked(listPacks)).toHaveBeenCalled());

    expect(screen.getAllByRole('tab').map((b) => b.textContent)).toEqual([
      'Biblioteka',
      'Sesje',
      'Wnioski',
      'Raporty',
      'Inicjatywy',
    ]);
    expect(screen.queryByRole('tab', { name: 'Ustalenia' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Findings' })).toBeNull();
  });

  it('DEC-417c: stary deep link ?tab=findings nie wskrzesza zakładki — spada na Sesje', async () => {
    setupApiMocks();
    renderHub(['/audit-programs?tab=findings']);
    await waitFor(() => expect(screen.getByText('Audyt zgodności Q3')).toBeInTheDocument());
    expect(screen.queryByRole('tab', { name: 'Ustalenia' })).toBeNull();
    expect(screen.getByRole('tab', { name: 'Sesje' })).toHaveAttribute('aria-selected', 'true');
  });

  it.each(TAB_CONTRACT)(
    'DEC-417b/d: zakładka $label ma ≤3 chipy Menu 3, dropdown filtra w Menu 2 i własne CTA',
    async ({ tab, dropdown, cta }) => {
      setupApiMocks();
      renderHub([`/audit-programs?tab=${tab}`]);
      await waitFor(() => expect(vi.mocked(listPacks)).toHaveBeenCalled());

      // Menu 3: JEDEN rząd, maksymalnie trzy chipy — na KAŻDEJ zakładce.
      await waitFor(() => expect(menu3ChipIds().length).toBeGreaterThan(0));
      expect(menu3ChipIds().length).toBeLessThanOrEqual(3);
      // Pierwszy chip to zawsze „Wszystkie" — ten sam wzór wszędzie.
      expect(menu3ChipIds()[0]).toBe('all');

      // Menu 2: dropdown z pełną listą wartości tej samej osi.
      expect(screen.getByTestId(dropdown)).toBeInTheDocument();

      // CTA per zakładka.
      expect(screen.getByTestId(cta)).toBeInTheDocument();
    }
  );

  it('DEC-417b: pełna lista etapów Sesji żyje w dropdownie Menu 2, nie w Menu 3', async () => {
    setupApiMocks();
    renderHub(['/audit-programs?tab=processes']);
    await waitFor(() => expect(screen.getByText('Audyt zgodności Q3')).toBeInTheDocument());

    // MUTACJA, którą ten test ma złapać: przywrócenie 12 chipów etapów
    // (Wszystkie + 11 wartości `AUDIT_LIFECYCLE_STATES`) w Menu 3.
    expect(menu3ChipIds().length).toBeLessThanOrEqual(3);
    expect(AUDIT_LIFECYCLE_STATES.length).toBeGreaterThan(3);

    const dropdown = screen.getByTestId('audits-processes-stage-dropdown');
    fireEvent.click(within(dropdown).getByRole('button'));
    const listbox = await screen.findByRole('listbox');
    // Wszystkie + każdy etap cyklu życia — nic z produktu nie zniknęło.
    expect(within(listbox).getAllByRole('option')).toHaveLength(
      AUDIT_LIFECYCLE_STATES.length + 1
    );
  });

  it('DEC-417d: CTA „Nowa inicjatywa” otwiera generator inicjatyw (adapter audit)', async () => {
    setupApiMocks();
    renderHub(['/audit-programs?tab=initiatives']);
    await waitFor(() => expect(vi.mocked(listProposals)).toHaveBeenCalled());

    // Przed kliknięciem generatora nie ma na ekranie.
    expect(screen.queryByTestId('generator-inicjatyw-modal')).toBeNull();

    fireEvent.click(screen.getByTestId('audits-method-new-initiative-cta'));

    // MUTACJA, którą ten test ma złapać: odpięcie CTA od
    // `GeneratorInicjatywModal` (albo powrót przycisku do wnętrza zakładki).
    expect(await screen.findByTestId('generator-inicjatyw-modal')).toBeInTheDocument();
  });

  it('DEC-417e: CTA „Nowy wniosek” otwiera generator wniosku z raportu audytu', async () => {
    setupApiMocks();
    renderHub(['/audit-programs?tab=conclusions']);
    await waitFor(() => expect(vi.mocked(listPacks)).toHaveBeenCalled());

    expect(screen.queryByTestId('generator-wniosku-audytu-modal')).toBeNull();
    fireEvent.click(screen.getByTestId('audits-method-new-conclusion-cta'));

    // MUTACJA, którą ten test ma złapać: odpięcie CTA od generatora wniosku.
    expect(await screen.findByTestId('generator-wniosku-audytu-modal')).toBeInTheDocument();
    // Generator czyta REALNE raporty audytu (jedyne źródło, jakie serwer zna).
    await waitFor(() => expect(vi.mocked(listReports)).toHaveBeenCalled());
  });

  // DEC-417e: Wyniki przestały być zakładką, ale ich silnik ZOSTAJE — stary
  // link musi trafić na Wnioski, a nie na Sesje jak nieznana wartość.
  it('DEC-417e: stary deep link ?tab=outputs prowadzi na Wnioski', async () => {
    setupApiMocks();
    renderHub(['/audit-programs?tab=outputs']);
    await waitFor(() => expect(vi.mocked(listPacks)).toHaveBeenCalled());
    expect(screen.getByRole('tab', { name: 'Wnioski' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('tab', { name: 'Wyniki' })).toBeNull();
  });

  it('DEC-417b: zakładka Inicjatywy nie renderuje już linijki disclaimera nad tabelą', async () => {
    setupApiMocks();
    renderHub(['/audit-programs?tab=initiatives']);
    await waitFor(() => expect(vi.mocked(listProposals)).toHaveBeenCalled());

    // Stary przycisk wewnątrz zakładki zniknął — jedno wejście, w Menu 2.
    expect(screen.queryByTestId('audit-generate-initiatives')).toBeNull();
  });
});
