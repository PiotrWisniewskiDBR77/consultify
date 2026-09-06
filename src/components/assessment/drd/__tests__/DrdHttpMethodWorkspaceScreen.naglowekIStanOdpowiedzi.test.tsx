/**
 * @vitest-environment jsdom
 *
 * DEC-415b/c — sesja DRD, zlecenie 1.1-D2 (słowa właściciela 06.09):
 *   „Nie potrzebujemy tyle elementów, bo to się zapisuje automatycznie.
 *    Zostawiamy tylko przycisk Ustawień i kebab. Dodajemy przycisk »Pracuj
 *    z AI« tak jak w pozostałych miejscach."
 * oraz znalezisko 1.1-D1: po „Potwierdzone" ekran natychmiast przeskakiwał na
 * kolejny poziom, więc zielonej karty właściciel nie zobaczył ANI RAZU.
 *
 * Ten plik pilnuje TRZECH rzeczy na REALNYM ekranie sesji (nie na atrapie):
 *  (A) nagłówek ma dokładnie: Wyjdź · tytuł · Pracuj z AI · Ustawienia · kebab
 *      — bez pigułki statusu, bez „Zapisano" i bez „Zapisz teraz";
 *  (B) bez prawa edycji „Pracuj z AI" pokazuje WYŁĄCZNIE „Analizuj" (Zasada 2b);
 *  (C) wybór stanu odpowiedzi NIE zmienia aktywnego pytania — dalej prowadzi
 *      wyłącznie „Dalej".
 *
 * Harness (mocki `methodCoreApi` + `useOpenChatWithContext`) jest ten sam, co w
 * `DrdHttpMethodWorkspaceScreen.zapytajTerese.test.tsx` — jedna, sprawdzona
 * droga wejścia w ekran zamiast drugiej, własnej.
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

const AREA_1A = DRD_STRUCTURE[0].areas[0];

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

async function renderAtInterviewFocus(roles: string[] = ['owner', 'lead_assessor', 'assessor']) {
  const events: Array<Record<string, unknown>> = [];
  let evtSeq = 0;
  hoisted.createSession.mockResolvedValue({ session: makeSession(), idempotentReplay: false });
  hoisted.transition.mockResolvedValue(makeSession({ state: 'active' }));
  hoisted.getSession.mockResolvedValue({ session: makeSession({ state: 'active' }), roles });
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
}


beforeEach(() => {
  vi.clearAllMocks();
});

describe('(A) nagłówek sesji DRD — pięć elementów, ani jednego więcej', () => {
  it('renderuje Wyjdź · tytuł · Pracuj z AI · Ustawienia · kebab', async () => {
    await renderAtInterviewFocus();

    const header = screen.getByTestId('method-workspace-shell').querySelector('header');
    expect(header).not.toBeNull();

    expect(screen.getByRole('button', { name: /Wyjdź/ })).toBeInTheDocument();
    expect(header!.textContent).toMatch(/DRD/);
    expect(screen.getByTestId('pracuj-z-ai')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ustawienia' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Więcej opcji' })).toBeInTheDocument();
  });

  it('nie ma już „Zapisz teraz", „Zapisano" ani pigułki statusu — zapis jest automatyczny', async () => {
    await renderAtInterviewFocus();

    expect(screen.queryByRole('button', { name: 'Zapisz teraz' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('save-state-indicator')).not.toBeInTheDocument();
    const header = screen.getByTestId('method-workspace-shell').querySelector('header')!;
    expect(header.textContent).not.toMatch(/Zapisano/);
    expect(header.textContent).not.toMatch(/W trakcie wywiadu/);
  });
});

describe('(B) „Pracuj z AI" bez prawa edycji — wyłącznie „Analizuj" (Zasada 2b)', () => {
  it('rola bez zapisu widzi jedną pozycję i powód, a nie wyszarzone „Uzupełnij…"', async () => {
    await renderAtInterviewFocus(['viewer']);

    fireEvent.click(screen.getByTestId('pracuj-z-ai'));
    const menu = await screen.findByTestId('pracuj-z-ai-menu');
    const pozycje = Array.from(menu.querySelectorAll('[data-pozycja]')).map((el) =>
      el.getAttribute('data-pozycja')
    );

    expect(pozycje).toEqual(['analizuj']);
    expect(screen.getByTestId('pracuj-z-ai-tylko-odczyt')).toBeInTheDocument();
  });

  it('rola z prawem zapisu ma wszystkie trzy pozycje', async () => {
    await renderAtInterviewFocus();

    fireEvent.click(screen.getByTestId('pracuj-z-ai'));
    const menu = await screen.findByTestId('pracuj-z-ai-menu');
    const pozycje = Array.from(menu.querySelectorAll('[data-pozycja]')).map((el) =>
      el.getAttribute('data-pozycja')
    );

    expect(pozycje).toEqual(['analizuj', 'uzupelnij-sekcje', 'uzupelnij-dokument']);
  });

  it('„Analizuj" otwiera ocenę gotowości sesji i niczego nie zapisuje', async () => {
    await renderAtInterviewFocus(['viewer']);
    hoisted.appendEvent.mockClear();

    fireEvent.click(screen.getByTestId('pracuj-z-ai'));
    const menu = await screen.findByTestId('pracuj-z-ai-menu');
    fireEvent.click(menu.querySelector('[data-pozycja="analizuj"]')!);

    expect(await screen.findByTestId('drd-analiza-gotowosci')).toBeInTheDocument();
    expect(hoisted.appendEvent).not.toHaveBeenCalled();
  });
});

describe('(C) wybór stanu odpowiedzi nie przeskakuje na kolejny poziom', () => {
  it('po „Potwierdzone" na ekranie zostaje TO SAMO pytanie, w kolorze stanu', async () => {
    await renderAtInterviewFocus();

    const pytaniePrzed = screen
      .getByTestId('interview-focus-panel')
      .querySelector('[data-testid^="question-card-"]')!
      .getAttribute('data-testid');

    fireEvent.click(screen.getByRole('radio', { name: /Potwierdzone/ }));

    // Zdarzenie musi dojść (inaczej test przechodziłby dlatego, że NIC się nie
    // stało — a nie dlatego, że ekran został na miejscu).
    await waitFor(() => expect(hoisted.appendEvent).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByTestId(pytaniePrzed!)).toHaveAttribute('data-answer-state', 'confirmed')
    );

    expect(screen.getByTestId('question-progress')).toHaveTextContent('Pytanie 3 z 7');
    expect(screen.getByTestId(pytaniePrzed!)).toBeInTheDocument();
  });

  it('dopiero „Dalej" odsłania kolejny, otwarty poziom tej jednostki', async () => {
    await renderAtInterviewFocus();

    fireEvent.click(screen.getByRole('radio', { name: /Potwierdzone/ }));
    await waitFor(() => expect(hoisted.appendEvent).toHaveBeenCalled());
    expect(screen.getByTestId('question-progress')).toHaveTextContent('Pytanie 3 z 7');

    fireEvent.click(screen.getByRole('button', { name: /^Dalej$/ }));

    await waitFor(() =>
      expect(screen.getByTestId('question-progress')).toHaveTextContent('Pytanie 4 z 7')
    );
  });
});
