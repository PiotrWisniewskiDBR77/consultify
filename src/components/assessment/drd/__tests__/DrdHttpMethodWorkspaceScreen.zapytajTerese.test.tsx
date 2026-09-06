/**
 * @vitest-environment jsdom
 *
 * DEC-415 (uwaga właściciela 06.09 15:10: „jest przycisk »Zapytaj Teresę« i on
 * w ogóle nie jest aktywny").
 *
 * ZMIERZONA PRZYCZYNA: wołacz istniał i wołał `runtime.createTeresaPreview`,
 * ale `TeresaPreviewPanel` — jedyna powierzchnia, która te propozycje rysowała
 * — został wyjęty z powłoki hotfixem 30eb0a1140. Klik robił zapis, którego
 * nikt nie widział (kształt 8: wołacz istnieje, odbiorca się nie renderuje).
 *
 * NAPRAWA, której ten plik pilnuje: oba wołacze w warsztacie (dyskretny
 * przycisk w rzędzie komend oraz „Zapytaj Teresę" pod „Przykład i dowody")
 * otwierają GLOBALNY dok Teresy (DEC-404) z kontekstem pytania — nazwą metody,
 * jednostką, poziomem, treścią pytania i obecną odpowiedzią.
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

describe('„Zapytaj Teresę" otwiera globalny dok Teresy z kontekstem pytania', () => {
  it('klik w rzędzie komend woła openChatWithContext z metodą, jednostką, poziomem i treścią pytania', async () => {
    await renderAtInterviewFocus();

    fireEvent.click(screen.getByTestId('ask-teresa-command'));

    await waitFor(() => expect(hoisted.openChatWithContext).toHaveBeenCalledTimes(1));
    const options = hoisted.openChatWithContext.mock.calls[0][0];

    expect(options.entityType).toBe('assessment');
    expect(options.entityId).toBe('sess-http-1');
    expect(options.pmoContext).toMatchObject({ assessmentId: 'sess-http-1' });

    const ctx = options.contextData;
    expect(ctx.unitId).toBe(AREA_1A.id);
    expect(ctx.level).toBe(3);
    expect(ctx.methodName).toMatch(/DRD/);
    expect(typeof ctx.questionId).toBe('string');
    expect(ctx.questionId.length).toBeGreaterThan(0);
    expect(ctx.questionWording.length).toBeGreaterThan(0);

    // Treść pytania trafia do promptu, którym otwiera się rozmowa — nie tylko
    // do metadanych, których czat nie czyta.
    expect(ctx.teresaPrompt).toContain(ctx.questionWording);
    expect(ctx.teresaPrompt).toContain('poziom: 3');
    expect(ctx.teresaPrompt).toContain(AREA_1A.namePL || AREA_1A.name);
  });

  it('„Zapytaj Teresę" pod pomocą do pytania woła ten sam dok (jedna Teresa, nie drugi czat)', async () => {
    await renderAtInterviewFocus();

    const helpButtons = screen.getAllByRole('button', { name: /Zapytaj Teresę/i });
    expect(helpButtons.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(helpButtons[0]);

    await waitFor(() => expect(hoisted.openChatWithContext).toHaveBeenCalledTimes(1));
    expect(hoisted.openChatWithContext.mock.calls[0][0].contextData.topic).toBe('explain');
  });

  it('„Pokaż różnicę L-1/L/L+1" pyta o porównanie poziomów, nie o wyjaśnienie', async () => {
    await renderAtInterviewFocus();

    fireEvent.click(screen.getByRole('button', { name: /Pokaż różnicę/i }));

    await waitFor(() => expect(hoisted.openChatWithContext).toHaveBeenCalledTimes(1));
    const ctx = hoisted.openChatWithContext.mock.calls[0][0].contextData;
    expect(ctx.topic).toBe('compare_levels');
    expect(ctx.teresaPrompt).toMatch(/różnic/i);
  });

  it('sesja tylko do odczytu NIE odbiera prawa do zapytania Teresy (to akcja czytająca)', async () => {
    await renderAtInterviewFocus(['viewer']);

    const button = screen.getByTestId('ask-teresa-command') as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    fireEvent.click(button);

    await waitFor(() => expect(hoisted.openChatWithContext).toHaveBeenCalledTimes(1));
  });

  it('klik NIE tworzy już propozycji Teresy w panelu, którego powłoka nie renderuje', async () => {
    await renderAtInterviewFocus();
    hoisted.teresaPreview.mockClear();

    fireEvent.click(screen.getByTestId('ask-teresa-command'));

    await waitFor(() => expect(hoisted.openChatWithContext).toHaveBeenCalledTimes(1));
    expect(hoisted.teresaPreview).not.toHaveBeenCalled();
  });
});
