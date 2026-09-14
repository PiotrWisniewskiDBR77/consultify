/**
 * @vitest-environment jsdom
 *
 * Zgłoszenia pilotażu (Paweł, 14.09, staging, UI EN) — sesja DRD, zakładka
 * Wywiad:
 *
 *  P-P04 (HIGH) „Changing the boxes below my answer is not being saved":
 *      wybór „Potwierdzone" po sekundzie wracał na „Częściowo".
 *      PRZYCZYNA: autozapis szkicu (debounce 800 ms z `useMethodWorkspaceSave`)
 *      wysyłał ZAWSZE `answerState: 'partial'`, a `questionAnswerState()`
 *      bierze OSTATNIE zdarzenie odpowiedzi — szkic lądował PO kliknięciu i
 *      nadpisywał wybór człowieka.
 *
 *  P-P03 (HIGH) „Assessment answer entry reloads the session and loses
 *      progress": każdy zapis (a więc każda fraza) wygaszał CAŁY warsztat
 *      napisem „Loading session…", bo `runWrite()` woła `refresh()`
 *      (`status: 'loading'`), a ekran przekazywał to jako `loading` do
 *      `MethodWorkspaceShell`. Panel wywiadu był odmontowywany i jego
 *      wewnętrzny numer kroku wracał do 1.
 *
 * Harness (mocki `methodCoreApi` + `useOpenChatWithContext`) — ten sam, co w
 * `DrdHttpMethodWorkspaceScreen.naglowekIStanOdpowiedzi.test.tsx`.
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
    id: 'sess-http-1',
    organizationId: 'org-1',
    projectId: null,
    module: 'assessment',
    methodPackId: DRD_METHOD_PACK_ID,
    methodPackVersion: DRD_METHOD_PACK_VERSION,
    state: 'active',
    domainStage: null,
    mode: 'guided_manual',
    ownerUserId: 'user-1',
    createdAt: '2026-08-13T00:00:00.000Z',
    updatedAt: '2026-08-13T00:00:00.000Z',
    version: 1,
    frozenSnapshotId: null,
    revisionOfSessionId: null,
    ...overrides,
  };
}

type Zapisane = Array<Record<string, any>>;

async function renderAtInterviewFocus(): Promise<{ events: Zapisane }> {
  const events: Zapisane = [];
  let evtSeq = 0;
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
      sessionId: 'sess-http-1',
      actorKind: 'human',
      actorUserId: 'user-1',
      methodPackVersion: DRD_METHOD_PACK_VERSION,
      occurredAt: '2026-08-13T00:00:00.000Z',
      ...evt,
    });
    return Promise.resolve({ id: `evt-${evtSeq}`, type: evt.type });
  });
  hoisted.listEvents.mockImplementation(() => Promise.resolve([...events]));

  render(<DrdHttpMethodWorkspaceScreen storage={makeMemoryStorage()} seedTo="interview" />);
  await screen.findByTestId('method-workspace-shell');
  await waitFor(() =>
    expect(screen.getByTestId('question-progress')).toHaveTextContent('Pytanie 3 z 7')
  );
  return { events };
}

const odpowiedziPytania = (events: Zapisane, questionId: string) =>
  events.filter(
    (e) =>
      (e.type === 'ANSWER_CONFIRMED' || e.type === 'ANSWER_DRAFTED') &&
      e.payload?.questionId === questionId
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe('P-P04 — autozapis szkicu nie cofa wybranego stanu odpowiedzi', () => {
  it('po wpisaniu tekstu i wyborze „Potwierdzone" szkic dopisuje CONFIRMED, nie „partial"', async () => {
    const { events } = await renderAtInterviewFocus();

    const karta = screen
      .getByTestId('interview-focus-panel')
      .querySelector('[data-testid^="question-card-"]')!;
    const questionId = karta.getAttribute('data-testid')!.replace('question-card-', '');

    // 1. człowiek pisze odpowiedź (uzbraja debounce autozapisu, 800 ms)
    // dwa uderzenia w klawiaturę, jak przy realnym pisaniu: `markDirty()`
    // zamraża `save` z POPRZEDNIEGO renderu, więc dopiero drugie ma w
    // domknięciu niepusty szkic (to samo zamrożenie stoi za P-P04).
    const pole = () =>
      screen.getByTestId('interview-focus-panel').querySelector('textarea')! as HTMLTextAreaElement;
    fireEvent.change(pole(), { target: { value: 'Budżet kontrolujemy' } });
    fireEvent.change(pole(), { target: { value: 'Budżet kontrolujemy w systemie na bieżąco.' } });
    // eslint-disable-next-line no-console
    console.log('SAVE-STATE PO ZMIANIE', document.querySelector('[data-testid="assessment-save-state-indicator"]')?.getAttribute('data-save-state'));
    // eslint-disable-next-line no-console
    console.log('PO SAMYM PISANIU', JSON.stringify(events.map((e) => e.type)));
    // 2. i ZARAZ wybiera stan — zanim debounce zdąży wystrzelić
    fireEvent.click(screen.getByRole('radio', { name: /Confirmed|Potwierdzone/ }));

    await waitFor(() =>
      expect(
        odpowiedziPytania(events, questionId).some((e) => e.type === 'ANSWER_CONFIRMED')
      ).toBe(true)
    );

    // 3. debounce dochodzi PO wyborze — kiedyś dopisywał tu „partial"
    await waitFor(
      () =>
        expect(
          odpowiedziPytania(events, questionId).some((e) => e.type === 'ANSWER_DRAFTED')
        ).toBe(true),
      { timeout: 4000 }
    );

    const ostatnia = odpowiedziPytania(events, questionId).at(-1)!;
    expect(ostatnia.payload.answerState).toBe('confirmed');

    // ...i pigułka na ekranie zostaje na „Potwierdzone"
    await waitFor(() =>
      expect(screen.getByTestId(`question-card-${questionId}`)).toHaveAttribute(
        'data-answer-state',
        'confirmed'
      )
    );
  }, 15000);
});

describe('P-P03 — zapis nie wygasza warsztatu („Loading session…")', () => {
  it('w trakcie odświeżania po zapisie panel wywiadu zostaje na ekranie', async () => {
    const { events } = await renderAtInterviewFocus();
    void events;

    // odświeżenie po zapisie „wisi" — dokładnie okno, w którym ekran
    // pokazywał pełnoekranowe „Loading session…"
    let zwolnij: () => void = () => {};
    hoisted.getSession.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          zwolnij = () =>
            resolve({
              session: makeSession({ state: 'active' }),
              roles: ['owner', 'lead_assessor', 'assessor'],
            });
        })
    );

    fireEvent.click(screen.getByRole('radio', { name: /Confirmed|Potwierdzone/ }));
    await waitFor(() => expect(hoisted.appendEvent).toHaveBeenCalled());

    expect(screen.queryByTestId('method-workspace-loading')).not.toBeInTheDocument();
    expect(screen.getByTestId('interview-focus-panel')).toBeInTheDocument();

    zwolnij();
    await waitFor(() => expect(screen.getByTestId('interview-focus-panel')).toBeInTheDocument());
  }, 15000);
});
