/**
 * @vitest-environment jsdom
 *
 * P-P21 (Paweł, pilotaż 14.09, staging, UI EN) — „Next" na OSTATNIM kroku
 * w pełni odpowiedzianej jednostki wracał na „Question 1 of 7 / Step 1/3"
 * TEJ SAMEJ jednostki zamiast przejść do następnej (1A → 1B).
 *
 * ZMIERZONA PRZYCZYNA (przed naprawą):
 *   - `drdAdapter.resolveOpenLevels` zwraca dla jednostki w 100 %
 *     potwierdzonej `blockedAtLevel === null` (nic nie jest zablokowane) —
 *     patrz fikstura `drd-progression-full-ramp-v1` w `compileDrdPack.ts`;
 *   - `derivedFocusLevel` dla sesji CZYNNEJ brało wyłącznie
 *     `blockedAtLevel ?? Math.min(levels)`, czyli spadało na poziom 1;
 *   - `handleNext` widziało `derivedFocusLevel (1) !== pinnedFocus.level (7)`
 *     i traktowało to jako „odpowiedź otworzyła nowy poziom w tej samej
 *     jednostce" → samo odpinało poziom i ZOSTAWAŁO w jednostce, pokazując
 *     pytanie poziomu 1.
 *
 * Test odtwarza dokładnie ten przepływ: jednostka 1A ma potwierdzone poziomy
 * 1-6, człowiek potwierdza poziom 7 (ostatni krok) i klika „Next".
 * OCZEKIWANIE: ekran pokazuje następną jednostkę osi (1B, Marketing
 * Processes), a nie „Question 1 of 7" jednostki 1A.
 *
 * Harness (mocki `methodCoreApi` + `useOpenChatWithContext`) — ten sam, co w
 * `DrdHttpMethodWorkspaceScreen.pilotazPawel.test.tsx`.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  getSession: vi.fn(),
  listEvents: vi.fn(),
  createSession: vi.fn(),
  appendEvent: vi.fn(),
  transition: vi.fn(),
  freeze: vi.fn(),
  getOutput: vi.fn(),
  teresaPreview: vi.fn(),
  teresaCommit: vi.fn(),
  createReport: vi.fn(),
  createInitiativeDraft: vi.fn(),
  openChatWithContext: vi.fn(),
}));

vi.mock('@/method-core/api/methodCoreApi', async () => {
  const actual = await vi.importActual<typeof import('@/method-core/api/methodCoreApi')>(
    '@/method-core/api/methodCoreApi'
  );
  return {
    ...actual,
    getSession: hoisted.getSession,
    listEvents: hoisted.listEvents,
    createSession: hoisted.createSession,
    appendEvent: hoisted.appendEvent,
    transition: hoisted.transition,
    freeze: hoisted.freeze,
    getOutput: hoisted.getOutput,
    teresaPreview: hoisted.teresaPreview,
    teresaCommit: hoisted.teresaCommit,
    createReport: hoisted.createReport,
    createInitiativeDraft: hoisted.createInitiativeDraft,
  };
});

vi.mock('@/hooks/useOpenChatWithContext', () => ({
  useOpenChatWithContext: () => hoisted.openChatWithContext,
  default: () => hoisted.openChatWithContext,
}));

const { DrdHttpMethodWorkspaceScreen } = await import('../DrdHttpMethodWorkspaceScreen');
const { DRD_METHOD_PACK_ID, DRD_METHOD_PACK_VERSION } = await import(
  '@/method-core/methods/drd/compileDrdPack'
);
const { DRD_STRUCTURE } = await import('@/services/drdStructure');

function makeMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    setItem: (k, v) => void store.set(k, v),
    removeItem: (k) => void store.delete(k),
    clear: () => store.clear(),
    key: (i) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sess-http-p21',
    organizationId: 'org-1',
    projectId: null,
    module: 'assessment',
    methodPackId: DRD_METHOD_PACK_ID,
    methodPackVersion: DRD_METHOD_PACK_VERSION,
    state: 'active',
    domainStage: null,
    mode: 'guided_manual',
    ownerUserId: 'user-1',
    createdAt: '2026-09-14T00:00:00.000Z',
    updatedAt: '2026-09-14T00:00:00.000Z',
    version: 1,
    frozenSnapshotId: null,
    revisionOfSessionId: null,
    ...overrides,
  };
}

type Zapisane = Array<Record<string, any>>;

/** Zdarzenie potwierdzonej odpowiedzi — dokładnie to, co czyta
 *  `confirmedLevelsFor` (typ ANSWER_CONFIRMED + payload.answerState). */
function potwierdzony(unitId: string, level: number, seq: number) {
  return {
    id: `evt-seed-${seq}`,
    organizationId: 'org-1',
    sessionId: 'sess-http-p21',
    actorKind: 'human',
    actorUserId: 'user-1',
    methodPackVersion: DRD_METHOD_PACK_VERSION,
    occurredAt: '2026-09-14T00:00:00.000Z',
    type: 'ANSWER_CONFIRMED',
    unitId,
    level,
    payload: {
      questionId: `${unitId}-L${level}-Q1`,
      answerState: 'confirmed',
      text: 'Odpowiedź potwierdzona w pilotażu.',
    },
  };
}

/** Jednostka 1A (oś 1, 7 poziomów) z potwierdzonymi poziomami 1-6 —
 *  człowiekowi zostaje DOKŁADNIE ostatni poziom do potwierdzenia. */
async function renderNaOstatnimPoziomie(): Promise<{ events: Zapisane }> {
  const events: Zapisane = [1, 2, 3, 4, 5, 6].map((lvl, i) => potwierdzony('1A', lvl, i + 1));
  let evtSeq = 100;
  hoisted.createSession.mockResolvedValue({ session: makeSession(), idempotentReplay: false });
  hoisted.transition.mockResolvedValue(makeSession({ state: 'active' }));
  hoisted.getSession.mockResolvedValue({
    session: makeSession({ state: 'active' }),
    roles: ['owner', 'lead_assessor', 'assessor'],
  });
  hoisted.appendEvent.mockImplementation((_sessionId: string, evt: Record<string, unknown>) => {
    evtSeq += 1;
    events.push({
      id: `evt-${evtSeq}`,
      organizationId: 'org-1',
      sessionId: 'sess-http-p21',
      actorKind: 'human',
      actorUserId: 'user-1',
      methodPackVersion: DRD_METHOD_PACK_VERSION,
      occurredAt: '2026-09-14T00:00:00.000Z',
      ...evt,
    });
    return Promise.resolve({ id: `evt-${evtSeq}`, type: evt.type });
  });
  hoisted.listEvents.mockImplementation(() => Promise.resolve([...events]));

  render(<DrdHttpMethodWorkspaceScreen storage={makeMemoryStorage()} seedTo="interview" />);
  await screen.findByTestId('method-workspace-shell');
  // Premisa wejściowa: ekran stoi na OSTATNIM (7.) poziomie jednostki 1A.
  await waitFor(() =>
    expect(screen.getByTestId('question-progress')).toHaveTextContent('Question 7 of 7')
  );
  return { events };
}

const idPytaniaNaEkranie = () =>
  screen
    .getByTestId('interview-focus-panel')
    .querySelector('[data-testid^="question-card-"]')!
    .getAttribute('data-testid')!
    .replace('question-card-', '');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('P-P21 — „Next" po pełnym potwierdzeniu jednostki idzie do NASTĘPNEJ jednostki', () => {
  it('1A w 100 % potwierdzona → „Next" otwiera 1B, nie „Question 1 of 7" tej samej jednostki', async () => {
    await renderNaOstatnimPoziomie();

    expect(idPytaniaNaEkranie()).toMatch(/^1A-L7-/);

    // człowiek potwierdza ostatni poziom — jednostka jest odtąd pełna
    fireEvent.click(screen.getByRole('radio', { name: /Confirmed|Potwierdzone/ }));
    await waitFor(() => expect(hoisted.appendEvent).toHaveBeenCalled());
    // przypięcie trzyma ekran na potwierdzonym pytaniu (DEC-415c)
    await waitFor(() =>
      expect(screen.getByTestId('question-progress')).toHaveTextContent('Question 7 of 7')
    );

    // ...i DOPIERO „Next" prowadzi dalej
    fireEvent.click(screen.getByRole('button', { name: /^Next$|^Dalej$/ }));

    await waitFor(() => expect(idPytaniaNaEkranie()).toMatch(/^1B-/));
    expect(screen.getByTestId('interview-focus-panel')).toHaveTextContent('Marketing Processes');
  }, 15000);

  it('jednostka w 100 % potwierdzona otwiera się na OSTATNIM potwierdzonym poziomie, nie na pustym poziomie 1', async () => {
    await renderNaOstatnimPoziomie();
    fireEvent.click(screen.getByRole('radio', { name: /Confirmed|Potwierdzone/ }));
    await waitFor(() => expect(hoisted.appendEvent).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /^Next$|^Dalej$/ }));
    await waitFor(() => expect(idPytaniaNaEkranie()).toMatch(/^1B-/));

    // powrót „Back" do jednostki domkniętej: ognisko na poziomie 7
    // (tam stoi odpowiedź), a nie na pustym pytaniu poziomu 1
    fireEvent.click(screen.getByRole('button', { name: /^Back$|^Wstecz$/ }));
    await waitFor(() => expect(idPytaniaNaEkranie()).toMatch(/^1A-L7-/));
    expect(screen.getByTestId('question-progress')).toHaveTextContent('Question 7 of 7');
  }, 15000);
});

describe('P-P21 rodzeństwo — „Next" na granicy osi i na końcu całości', () => {
  const dalej = () => fireEvent.click(screen.getByRole('button', { name: /^Next$|^Dalej$/ }));

  it('ostatnia jednostka osi 1 → „Next" przechodzi do pierwszej jednostki osi 2 (kiedyś: ślepy zaułek)', async () => {
    await renderNaOstatnimPoziomie();
    const osAreas = DRD_STRUCTURE[0].areas;
    for (let i = 0; i < osAreas.length - 1; i += 1) dalej();
    await waitFor(() =>
      expect(idPytaniaNaEkranie()).toMatch(new RegExp(`^${osAreas[osAreas.length - 1].id}-`))
    );

    dalej();
    await waitFor(() =>
      expect(idPytaniaNaEkranie()).toMatch(new RegExp(`^${DRD_STRUCTURE[1].areas[0].id}-`))
    );
  }, 20000);

  it('ostatnia jednostka CAŁOŚCI → „Next" otwiera panel gotowości sesji', async () => {
    await renderNaOstatnimPoziomie();
    const wszystkie = DRD_STRUCTURE.flatMap((a) => a.areas);
    for (let i = 0; i < wszystkie.length - 1; i += 1) dalej();
    await waitFor(() =>
      expect(idPytaniaNaEkranie()).toMatch(new RegExp(`^${wszystkie[wszystkie.length - 1].id}-`))
    );

    dalej();
    await waitFor(() =>
      expect(screen.getByRole('dialog', { name: /Session readiness assessment|gotowości/i })).toBeInTheDocument()
    );
  }, 20000);
});
