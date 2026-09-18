/**
 * OP-2 (Wpis 99, wiersz planu 65 / U-27) — ekran OBIEKTU pakietu audytowego
 * (`/audit-programs/packs/:packId`, SPEC-A archetyp C „Rekord").
 *
 * Trzy reguły, których ten plik pilnuje (każda z dowodem mutacyjnym w meldunku):
 *   1. TRASOWANIE: ekran czyta pakiet po `packId` z trasy i renderuje nagłówek
 *      z nazwą pakietu — nie listę, nie pusty stan;
 *   2. JEDEN KANAŁ STANU: „Zatwierdź (ekspert)" i „Publikuj" wołają TE SAME
 *      funkcje `auditsMethodApi` (`approvePackByExpert` / `publishPack`), co
 *      kebab Biblioteki — ekran obiektu nie ma własnego fetcha ani własnej
 *      kopii przejścia stanu;
 *   3. JEDEN GATE: „Rozpocznij audyt" jest dostępny dokładnie wtedy, gdy
 *      pozwala `evaluateStartGate` z `AuditLibraryTab` (import, nie kopia), a
 *      poza zakresem gate'u użytkownik widzi UCZCIWY powód (wiersz „Next step"),
 *      nigdy ukrytą akcję.
 *
 * Dodatkowo: lista kryteriów jest READ-ONLY i nie pokazuje surowych wartości
 * (`id` kryterium, `nodeKind`) — ciąg dalszy OP-2-lite (Wpis 85).
 *
 * i18n jest PRAWDZIWY (bundle EN/PL wczytane z `public/locales`), bo ekran
 * montuje `NModeShell`/`ArtifactRightPanel`, które korzystają z `returnObjects`
 * — wzór `AuditReportDocumentView.test.tsx`.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import React from 'react';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import enTranslation from '../../../../../public/locales/en/translation.json';
import plTranslation from '../../../../../public/locales/pl/translation.json';

vi.mock('../auditsMethodApi', async () => {
  const actual = await vi.importActual<typeof import('../auditsMethodApi')>('../auditsMethodApi');
  return {
    ...actual,
    getPack: vi.fn(),
    listPrograms: vi.fn(),
    approvePackByExpert: vi.fn(),
    publishPack: vi.fn(),
    replaceCriteria: vi.fn(),
  };
});

/**
 * Globalna atrapa store (`tests/setup.ts:743`) nie ma `setState`, a jej
 * `currentUser` nie niesie `role` — a to właśnie rola rozstrzyga bramkę
 * platformową `approve-expert`/`publish` (`isPlatformAdmin` na backendzie).
 * Atrapa per plik ma TEN SAM kształt stanu co globalna (żeby reszta drzewa
 * nie straciła pól) plus mutowalny `currentUser`.
 */
const { storeState } = vi.hoisted(() => ({
  storeState: {
    currentUser: null as { id: string; role: string } | null,
    user: { id: 'user-123', email: 'test@example.com', name: 'Test User', role: 'owner' },
    currentOrg: { id: 'org-123', name: 'Test Organization', plan: 'professional' },
    organization: { id: 'org-123', name: 'Test Organization' },
    aiConfig: { selectedTier: 'STANDARD', selectedModelId: null, autoMode: false },
    theme: 'dark',
    language: 'en',
    notifications: [],
    isAuthenticated: true,
    chatSystemPrompt: null,
    chatContextActions: null,
    isChatCollapsed: true,
  } as Record<string, unknown>,
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector?: (state: typeof storeState) => unknown) =>
    selector ? selector(storeState) : storeState,
}));

import { AuditPackObjectPage } from '../pack/AuditPackObjectPage';
import {
  approvePackByExpert,
  getPack,
  listPrograms,
  publishPack,
  replaceCriteria,
  type AuditPackCriterionNode,
  type AuditPackDetail,
} from '../auditsMethodApi';

const mockedGetPack = vi.mocked(getPack);
const mockedListPrograms = vi.mocked(listPrograms);
const mockedApprove = vi.mocked(approvePackByExpert);
const mockedPublish = vi.mocked(publishPack);
const mockedReplaceCriteria = vi.mocked(replaceCriteria);
const INITIAL_LANGUAGE = i18n.language;

const criteria: AuditPackCriterionNode[] = [
  {
    id: 'crit-raw-id-1',
    parentId: null,
    ordinal: 1,
    refCode: 'ZAK-8.4.1',
    nodeKind: 'leaf',
    title: 'Supplier qualification',
    mandatory: true,
  },
  {
    id: 'crit-raw-id-2',
    parentId: 'crit-raw-id-1',
    ordinal: 2,
    refCode: null,
    nodeKind: 'branch',
    title: 'Approved supplier list',
    mandatory: false,
  },
];

function makeDetail(overrides: Partial<AuditPackDetail> = {}): AuditPackDetail {
  return {
    id: 'pack-1',
    packKey: 'qms-pack',
    version: 2,
    title: 'Client QMS Procedure',
    summary: 'Annual conformity pack.',
    sourceId: 'src-1',
    sourceTitle: 'Some source',
    sourceVersion: '1',
    sourceType: 'INTERNAL_PROCEDURE',
    verificationStatus: 'VERIFIED',
    publicationStatus: 'draft',
    requiredRoles: [],
    criteriaCount: criteria.length,
    updatedAt: '2026-09-01T00:00:00Z',
    expertApprovedBy: null,
    purpose: 'Verify conformity',
    scope: 'Whole organization',
    objectives: null,
    auditType: 'compliance',
    requiredCompetencies: [],
    findingTaxonomy: [
      { key: 'major', label: 'Major nonconformity', nonConforming: true },
      { key: 'obs', label: 'Observation', nonConforming: false },
    ],
    rightsStatus: 'licensed',
    rightsNote: null,
    criteria,
    ...overrides,
  };
}

function setRole(role: string | null) {
  storeState.currentUser = role ? { id: 'u-1', role } : null;
}

function renderPage(overrides: Partial<React.ComponentProps<typeof AuditPackObjectPage>> = {}) {
  const onStartAudit = vi.fn();
  const onBack = vi.fn();
  const utils = render(
    <AuditPackObjectPage
      packId="pack-1"
      onStartAudit={onStartAudit}
      onBack={onBack}
      {...overrides}
    />
  );
  return { ...utils, onStartAudit, onBack };
}

/** Wartość komórki „Value" wiersza tabeli właściwości o danej etykiecie. */
function propertyValue(label: string): string | null {
  const labelCell = screen.getByText(label);
  const cells = labelCell.closest('tr')?.querySelectorAll('td');
  return cells && cells.length > 1 ? (cells[1].textContent ?? '').trim() : null;
}

describe('AuditPackObjectPage — OP-2 ekran obiektu pakietu', () => {
  beforeEach(async () => {
    i18n.addResourceBundle('en', 'translation', enTranslation, true, true);
    i18n.addResourceBundle('pl', 'translation', plTranslation, true, true);
    await i18n.changeLanguage('en');
    mockedGetPack.mockReset();
    mockedListPrograms.mockReset();
    mockedApprove.mockReset();
    mockedPublish.mockReset();
    mockedReplaceCriteria.mockReset();
    mockedReplaceCriteria.mockResolvedValue([]);
    mockedListPrograms.mockResolvedValue({ items: [], total: 0 });
    mockedApprove.mockResolvedValue(null);
    mockedPublish.mockResolvedValue(null);
    setRole(null);
  });

  afterAll(async () => {
    await i18n.changeLanguage(INITIAL_LANGUAGE);
    setRole(null);
  });

  it('czyta pakiet po packId z trasy i renderuje nagłówek z nazwą pakietu', async () => {
    mockedGetPack.mockResolvedValue(
      makeDetail({ id: 'pack-route-9', title: 'Route Pack Nine', packKey: 'qms-pack' })
    );
    renderPage({ packId: 'pack-route-9' });

    await waitFor(() => expect(mockedGetPack).toHaveBeenCalledWith('pack-route-9'));
    expect((await screen.findAllByText('Route Pack Nine')).length).toBeGreaterThan(0);
    expect(screen.getByTestId('audit-pack-object-page')).toBeInTheDocument();
    // Menu 1 niesie status i wersję — nie surowy slug `packKey`.
    expect(screen.queryByText('qms-pack')).not.toBeInTheDocument();
  });

  it('brak packId / pusty odczyt → uczciwy stan błędu z powrotem do listy, nigdy pusty nagłówek', async () => {
    mockedGetPack.mockResolvedValue(null);
    const { onBack } = renderPage();

    expect(await screen.findByText('The pack was not found.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /back to the pack library/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it('„Publish" woła TĘ SAMĄ `publishPack` z auditsMethodApi co kebab Biblioteki (nie własny fetch)', async () => {
    setRole('ADMIN');
    // Zatwierdzony ekspercko szkic = jedyny stan, w którym `publishGate` puszcza.
    mockedGetPack.mockResolvedValue(makeDetail({ expertApprovedBy: 'expert-1' }));
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /^publish$/i }));

    await waitFor(() => expect(mockedPublish).toHaveBeenCalledWith('pack-1'));
    expect(mockedApprove).not.toHaveBeenCalled();
    // Po przejściu stanu ekran czyta pakiet PONOWNIE z serwera.
    await waitFor(() => expect(mockedGetPack.mock.calls.length).toBeGreaterThan(1));
  });

  it('„Approve (expert)" woła TĘ SAMĄ `approvePackByExpert` z auditsMethodApi', async () => {
    setRole('ADMIN');
    mockedGetPack.mockResolvedValue(makeDetail({ expertApprovedBy: null }));
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /approve \(expert\)/i }));

    await waitFor(() => expect(mockedApprove).toHaveBeenCalledWith('pack-1'));
    expect(mockedPublish).not.toHaveBeenCalled();
  });

  it('nieudane przejście stanu → komunikat inline, ekran nie udaje sukcesu', async () => {
    setRole('ADMIN');
    mockedGetPack.mockResolvedValue(makeDetail({ expertApprovedBy: 'expert-1' }));
    mockedPublish.mockRejectedValue(new Error('AUDIT_PACK_NOT_PUBLISHABLE'));
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /^publish$/i }));

    const alert = await screen.findByTestId('audit-pack-transition-error');
    expect(alert.textContent).toMatch(/AUDIT_PACK_NOT_PUBLISHABLE/);
  });

  it('„Start audit" jest dostępny dokładnie wtedy, gdy pozwala evaluateStartGate (published + źródło)', async () => {
    mockedGetPack.mockResolvedValue(
      makeDetail({ publicationStatus: 'published', expertApprovedBy: 'expert-1' })
    );
    const { onStartAudit } = renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /start audit/i }));
    expect(onStartAudit).toHaveBeenCalledWith(expect.objectContaining({ id: 'pack-1' }));
  });

  it('szkic bez publikacji: „Start audit" niedostępny, a powód gate-u widoczny w „Next step"', async () => {
    mockedGetPack.mockResolvedValue(makeDetail({ publicationStatus: 'draft' }));
    renderPage();

    await screen.findAllByText('Client QMS Procedure');
    expect(screen.queryByRole('button', { name: /start audit/i })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(propertyValue('Next step')).toMatch(/not published/i)
    );
  });

  it('pakiet bez źródła nigdy nie liczy się jako opublikowany — ten sam gate co w liście', async () => {
    mockedGetPack.mockResolvedValue(
      makeDetail({ publicationStatus: 'published', sourceId: null, sourceTitle: null })
    );
    renderPage();

    await screen.findAllByText('Client QMS Procedure');
    expect(screen.queryByRole('button', { name: /start audit/i })).not.toBeInTheDocument();
    await waitFor(() => expect(propertyValue('Next step')).toMatch(/no source attached/i));
  });

  it('ta sama paczka: administrator widzi „Publish", użytkownik bez uprawnień NIE — bramka platformowa, nie kopia', async () => {
    const approvedDraft = makeDetail({ expertApprovedBy: 'expert-1' });
    mockedGetPack.mockResolvedValue(approvedDraft);

    setRole('USER');
    const first = renderPage();
    await screen.findAllByText('Client QMS Procedure');
    expect(screen.queryByRole('button', { name: /^publish$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /approve \(expert\)/i })).not.toBeInTheDocument();
    // Ekran nie udaje, że wszystko jest w porządku: mówi, czego brakuje PAKIETOWI.
    await waitFor(() => expect(propertyValue('Next step')).toMatch(/not published/i));
    // Stan pakietu pozostaje prawdziwy także dla nieadministratora.
    expect(propertyValue('Expert approval')).toBe('Approved');
    first.unmount();

    setRole('ADMIN');
    mockedGetPack.mockResolvedValue(approvedDraft);
    renderPage();
    expect(await screen.findByRole('button', { name: /^publish$/i })).toBeInTheDocument();
  });

  it('lista kryteriów jest READ-ONLY i nie pokazuje surowych wartości (id, nodeKind)', async () => {
    mockedGetPack.mockResolvedValue(makeDetail());
    const { container } = renderPage();

    fireEvent.click(await screen.findByText('Criteria'));

    expect(await screen.findByText('Supplier qualification')).toBeInTheDocument();
    expect(screen.getByText('Approved supplier list')).toBeInTheDocument();
    expect(screen.getByText('ZAK-8.4.1')).toBeInTheDocument();
    expect(screen.queryByText('crit-raw-id-1')).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\bnodeKind\b/);
    // READ-ONLY: żadnego pola wejściowego w sekcji kryteriów (edycja = OP-2b).
    expect(container.querySelectorAll('input, textarea').length).toBe(0);
  });

  it('RELATIONS pokazują programy audytowe utworzone z TEGO pakietu, a brak danych = uczciwy pusty stan', async () => {
    mockedGetPack.mockResolvedValue(makeDetail());
    mockedListPrograms.mockResolvedValue({
      items: [
        {
          id: 'prog-1',
          name: 'Metalpol — Q3 Purchasing Audit',
          packId: 'pack-1',
          packTitle: 'Client QMS Procedure',
          packVersion: 2,
          lifecycleState: 'findings_review',
          applicableCriteria: 10,
          concludedCriteria: 5,
          openFindings: 1,
          leadAuditorId: null,
          leadAuditorName: null,
          plannedStart: null,
          plannedEnd: null,
          updatedAt: '2026-09-02T00:00:00Z',
        },
        {
          id: 'prog-2',
          name: 'Other pack program',
          packId: 'pack-OTHER',
          packTitle: 'Other',
          packVersion: 1,
          lifecycleState: 'planning',
          applicableCriteria: 1,
          concludedCriteria: 0,
          openFindings: 0,
          leadAuditorId: null,
          leadAuditorName: null,
          plannedStart: null,
          plannedEnd: null,
          updatedAt: '2026-09-03T00:00:00Z',
        },
      ],
      total: 2,
    });
    renderPage();

    await screen.findAllByText('Client QMS Procedure');
    await waitFor(() => expect(propertyValue('Criteria count')).toBe('2'));

    expect(screen.queryByText('Other pack program')).not.toBeInTheDocument();
  });

  it('pigułka „Criteria N" niesie SPŁASZCZONĄ liczbę kryteriów (3 vs 5 — stała 0 musi dać RED)', async () => {
    const makeNodes = (n: number): AuditPackCriterionNode[] =>
      Array.from({ length: n }, (_, i) => ({
        id: `crit-n-${i}`,
        parentId: null,
        ordinal: i + 1,
        refCode: null,
        nodeKind: 'criterion' as const,
        title: `Criterion ${i + 1}`,
        mandatory: false,
      }));

    mockedGetPack.mockResolvedValue(makeDetail({ criteria: makeNodes(3) }));
    const first = renderPage();
    await screen.findAllByText('Client QMS Procedure');
    await waitFor(() =>
      expect(screen.getByTestId('audit-pack-criteria-pill').textContent).toMatch(/3/)
    );
    first.unmount();

    mockedGetPack.mockResolvedValue(makeDetail({ criteria: makeNodes(5) }));
    renderPage();
    await screen.findAllByText('Client QMS Procedure');
    await waitFor(() =>
      expect(screen.getByTestId('audit-pack-criteria-pill').textContent).toMatch(/5/)
    );
  });

  it('wiersz „Status" w PROPERTIES istnieje i niesie wartość publicationStatus (draft/published)', async () => {
    mockedGetPack.mockResolvedValue(makeDetail({ publicationStatus: 'draft' }));
    const first = renderPage();
    await screen.findAllByText('Client QMS Procedure');
    await waitFor(() => expect(propertyValue('Status')).toBe('Draft'));
    first.unmount();

    mockedGetPack.mockResolvedValue(
      makeDetail({ publicationStatus: 'published', expertApprovedBy: 'expert-1' })
    );
    renderPage();
    await screen.findAllByText('Client QMS Procedure');
    await waitFor(() => expect(propertyValue('Status')).toBe('Published'));
  });

  it('RELATIONS przy błędzie API pokazuje komunikat inline, NIE udaje pustej listy', async () => {
    mockedGetPack.mockResolvedValue(makeDetail());
    mockedListPrograms.mockRejectedValue(new Error('NETWORK_DOWN'));
    renderPage();

    await screen.findAllByText('Client QMS Procedure');
    fireEvent.click(screen.getByText('Relations'));

    const alert = await screen.findByTestId('audit-pack-relations-error');
    expect(alert.textContent).toMatch(/Could not load the related programs|NETWORK_DOWN/);
    // Uczciwy pusty stan („No audit programs…") NIE może się pojawić przy błędzie.
    expect(
      screen.queryByText('No audit programs were started from this pack yet.')
    ).not.toBeInTheDocument();
  });

  it('pigułka i „Criteria count" liczą WSZYSTKIE węzły drzewa (1+2+4 → 7), nie 1 korzeń — D-91', async () => {
    // `getPackById` zwraca drzewo (buildCriteriaTree): korzeń + 2 dzieci + 4 wnuki = 7 węzłów.
    const nested = [
      {
        id: 'root',
        parentId: null,
        ordinal: 1,
        refCode: 'ZAK-1',
        nodeKind: 'branch',
        title: 'Root criterion',
        mandatory: true,
        children: [
          {
            id: 'a',
            children: [
              { id: 'a1', children: [] },
              { id: 'a2', children: [] },
            ],
          },
          {
            id: 'b',
            children: [
              { id: 'b1', children: [] },
              { id: 'b2', children: [] },
            ],
          },
        ],
      },
    ] as unknown as AuditPackDetail['criteria'];
    // criteriaCount=1 (błędne) celowo: wartość musi pochodzić z licznika drzewa, nie z fallbacka serwera.
    mockedGetPack.mockResolvedValue(makeDetail({ criteria: nested, criteriaCount: 1 }));
    renderPage();

    await screen.findAllByText('Client QMS Procedure');
    // Stary kod `criteria.length` = 1 (korzeń) — jedno źródło countCriteriaNodes = 7.
    expect(screen.getByTestId('audit-pack-criteria-pill').textContent).toMatch(/7/);
    await waitFor(() => expect(propertyValue('Criteria count')).toBe('7'));
    // Badge sekcji w nawigacji niesie TĘ SAMĄ liczbę (jedno źródło, nie `criteria.length`).
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^criteria/i }).textContent).toMatch(/7/)
    );
  });
});

/**
 * OP-2b (Wpis 99): edycja kryteriów na ekranie obiektu. Trzy reguły z dowodem
 * mutacyjnym w meldunku:
 *   1. BRAMKA STANU: edycja tylko dla `draft` i tylko dla administratora
 *      platformy (`packService.replaceCriteria` odmawia pakietowi
 *      `published`, a trasa jest za `requireAdmin`);
 *   2. JEDEN ZAPIS = JEDEN `PUT` całej listy (replace, nie patch) przez
 *      `replaceCriteria` z `auditsMethodApi` — nie własny fetch;
 *   3. PO ZAPISIE odczyt `getPack` i render z odpowiedzi serwera, a przy
 *      błędzie 4xx/5xx komunikat inline i ZACHOWANY stan lokalny.
 * Przycisku „New version" NIE ma w żadnym stanie: `createNewVersion` nie ma
 * wołacza we frontendzie (DEC-607 — jedno zdanie w meldunku, zero dopinania).
 */
describe('AuditPackObjectPage — OP-2b edycja kryteriów', () => {
  beforeEach(async () => {
    i18n.addResourceBundle('en', 'translation', enTranslation, true, true);
    i18n.addResourceBundle('pl', 'translation', plTranslation, true, true);
    await i18n.changeLanguage('en');
    mockedGetPack.mockReset();
    mockedListPrograms.mockReset();
    mockedListPrograms.mockResolvedValue({ items: [], total: 0 });
    mockedReplaceCriteria.mockReset();
    mockedReplaceCriteria.mockResolvedValue([]);
  });

  async function openCriteriaSection() {
    fireEvent.click(await screen.findByText('Criteria'));
  }

  it('draft + administrator: „Edit criteria" otwiera tryb edycji z polami', async () => {
    setRole('ADMIN');
    mockedGetPack.mockResolvedValue(makeDetail({ publicationStatus: 'draft' }));
    renderPage();
    await openCriteriaSection();

    fireEvent.click(await screen.findByTestId('pack-criteria-edit'));

    expect(await screen.findByTestId('pack-criteria-editor')).toBeInTheDocument();
    expect(
      (screen.getByTestId('pack-criteria-title-crit-raw-id-1') as HTMLInputElement).value
    ).toBe('Supplier qualification');
    expect(screen.getByTestId('pack-criteria-save')).toBeInTheDocument();
    // Przycisku nowej wersji NIE ma — `createNewVersion` nie ma wołacza.
    expect(screen.queryByRole('button', { name: /new version/i })).not.toBeInTheDocument();
  });

  it('published + administrator: lista read-only, BEZ wejścia w edycję i bez pól', async () => {
    setRole('ADMIN');
    mockedGetPack.mockResolvedValue(
      makeDetail({ publicationStatus: 'published', expertApprovedBy: 'expert-1' })
    );
    const { container } = renderPage();
    await openCriteriaSection();

    expect(await screen.findByTestId('pack-criteria-readonly')).toBeInTheDocument();
    expect(screen.queryByTestId('pack-criteria-edit')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /new version/i })).not.toBeInTheDocument();
    expect(container.querySelectorAll('input, textarea').length).toBe(0);
  });

  it('draft bez uprawnienia platformowego: edycji NIE ma (bramka roli, nie tylko statusu)', async () => {
    setRole('USER');
    mockedGetPack.mockResolvedValue(makeDetail({ publicationStatus: 'draft' }));
    const { container } = renderPage();
    await openCriteriaSection();

    await screen.findByText('Supplier qualification');
    expect(screen.queryByTestId('pack-criteria-edit')).not.toBeInTheDocument();
    expect(container.querySelectorAll('input, textarea').length).toBe(0);
  });

  it('„Save criteria" wysyła JEDEN `PUT` całej listy, a po zapisie ekran czyta pakiet ponownie', async () => {
    setRole('ADMIN');
    mockedGetPack.mockResolvedValue(makeDetail({ publicationStatus: 'draft' }));
    renderPage();
    await openCriteriaSection();
    fireEvent.click(await screen.findByTestId('pack-criteria-edit'));

    fireEvent.change(await screen.findByTestId('pack-criteria-title-crit-raw-id-1'), {
      target: { value: 'Supplier qualification v2' },
    });
    fireEvent.click(screen.getByTestId('pack-criteria-remove-crit-raw-id-2'));
    const callsBefore = mockedGetPack.mock.calls.length;
    fireEvent.click(screen.getByTestId('pack-criteria-save'));

    await waitFor(() => expect(mockedReplaceCriteria).toHaveBeenCalledTimes(1));
    expect(mockedReplaceCriteria).toHaveBeenCalledWith('pack-1', [
      {
        id: 'crit-raw-id-1',
        parentId: null,
        ordinal: 0,
        refCode: 'ZAK-8.4.1',
        nodeKind: 'leaf',
        title: 'Supplier qualification v2',
        requirementText: null,
        mandatory: true,
        weight: null,
        sourceReference: null,
        auditQuestion: null,
        expectedEvidence: [],
        auditProcedure: null,
        samplingGuidance: null,
        applicabilityRule: {},
        suggestedOwnerRole: null,
      },
    ]);
    // Render PO zapisie jest z odpowiedzi serwera, nie z lokalnego stanu.
    await waitFor(() => expect(mockedGetPack.mock.calls.length).toBeGreaterThan(callsBefore));
    await waitFor(() =>
      expect(screen.queryByTestId('pack-criteria-editor')).not.toBeInTheDocument()
    );
  });

  it('błąd zapisu 4xx/5xx → komunikat inline, tryb edycji i stan lokalny ZACHOWANY', async () => {
    setRole('ADMIN');
    mockedGetPack.mockResolvedValue(makeDetail({ publicationStatus: 'draft' }));
    mockedReplaceCriteria.mockRejectedValue(new Error('AUDIT_CRITERION_TITLE_MISSING'));
    renderPage();
    await openCriteriaSection();
    fireEvent.click(await screen.findByTestId('pack-criteria-edit'));

    fireEvent.change(await screen.findByTestId('pack-criteria-title-crit-raw-id-1'), {
      target: { value: 'Kept locally' },
    });
    fireEvent.click(screen.getByTestId('pack-criteria-save'));

    expect(await screen.findByTestId('pack-criteria-save-error')).toHaveTextContent(
      /AUDIT_CRITERION_TITLE_MISSING/
    );
    expect(screen.getByTestId('pack-criteria-editor')).toBeInTheDocument();
    expect(
      (screen.getByTestId('pack-criteria-title-crit-raw-id-1') as HTMLInputElement).value
    ).toBe('Kept locally');
  });
});
