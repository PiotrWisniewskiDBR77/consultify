/**
 * @vitest-environment jsdom
 *
 * K-24a (DEC-649) — read-only lista dowodów DRD na REALNYM ekranie sesji.
 *
 * Test WPIĘCIA, nie obecności: karmi zdarzenie `EVIDENCE_ATTACHED` przez
 * `listEvents` i asertuje, że projekcja read-modelu (`evidenceItemsFor`)
 * dowiozła do panelu wiersz nazwa / data / kto — na żywym komponencie,
 * flaga `VITE_DRD_EVIDENCE_LIST` ON. Osobny przypadek pilnuje, że przy
 * fladze OFF (domyślnie) lista NIE renderuje (wizualia za flagą, DEC-650).
 *
 * Harness (mocki `methodCoreApi` + `useOpenChatWithContext`) jest ten sam, co
 * w `DrdHttpMethodWorkspaceScreen.naglowekIStanOdpowiedzi.test.tsx`.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

/**
 * Seeds the runtime to the interview focus AND pre-loads one EVIDENCE_ATTACHED
 * event onto the active unit, so the read model has a row to project. The
 * event is pushed straight into the array `listEvents` resolves from — the
 * same path the appendEvent mock writes through.
 */
async function renderAtInterviewWithEvidence() {
  const events: Array<Record<string, unknown>> = [
    {
      id: 'evt-evidence-1',
      organizationId: 'org-1',
      sessionId: 'sess-http-1',
      type: 'EVIDENCE_ATTACHED',
      unitId: AREA_1A.id,
      level: 1,
      actorKind: 'human',
      actorUserId: 'anna.kowalska',
      methodPackVersion: DRD_METHOD_PACK_VERSION,
      occurredAt: '2026-08-13T09:30:00.000Z',
      payload: {
        evidenceId: 'polityka-bezpieczenstwa-2026.pdf',
        evidenceType: 'document',
        strength: 'E2',
        linkedQuestionIds: [],
      },
    },
  ];
  let evtSeq = 100;
  hoisted.createSession.mockResolvedValue({ session: makeSession(), idempotentReplay: false });
  hoisted.transition.mockResolvedValue(makeSession({ state: 'active' }));
  hoisted.getSession.mockResolvedValue({ session: makeSession({ state: 'active' }), roles: ['owner', 'lead_assessor', 'assessor'] });
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
    expect(screen.getByTestId('question-progress')).toHaveTextContent('Question 3 of 7')
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('K-24a — read-only lista dowodów DRD (nazwa / data / kto)', () => {
  it('flaga ON: projekcja EVIDENCE_ATTACHED renderuje wiersz z nazwą, datą i autorem', async () => {
    vi.stubEnv('VITE_DRD_EVIDENCE_LIST', 'true');
    await renderAtInterviewWithEvidence();

    const lists = await screen.findAllByTestId('evidence-list');
    expect(lists.length).toBeGreaterThan(0);
    const rows = screen.getAllByTestId('evidence-list-row');
    expect(rows.length).toBeGreaterThan(0);
    const row = rows[0];
    const list = lists[0];

    // nazwa = payload.evidenceId, kto = actorUserId ze zdarzenia
    expect(row.textContent).toContain('polityka-bezpieczenstwa-2026.pdf');
    expect(row.textContent).toContain('anna.kowalska');
    // data wyrenderowana (nie pusta), z rocznikiem zdarzenia
    expect(row.textContent).toMatch(/2026/);
    // trzy kolumny nagłówka
    expect(list.textContent).toContain('Name');
    expect(list.textContent).toContain('Date');
    expect(list.textContent).toContain('By');
  });



  it('K-24b: kliknięcie usuń zapisuje EVIDENCE_REMOVED i projekcja ukrywa wiersz', async () => {
    vi.stubEnv('VITE_DRD_EVIDENCE_LIST', 'true');
    await renderAtInterviewWithEvidence();

    const row = await screen.findByText('polityka-bezpieczenstwa-2026.pdf');
    expect(row).toBeInTheDocument();

    const removeButtons = await screen.findAllByTestId('evidence-remove-button');
    fireEvent.click(removeButtons[0]);

    await waitFor(() =>
      expect(hoisted.appendEvent).toHaveBeenCalledWith(
        'sess-http-1',
        expect.objectContaining({
          type: 'EVIDENCE_REMOVED',
          unitId: AREA_1A.id,
          payload: expect.objectContaining({
            evidenceId: 'polityka-bezpieczenstwa-2026.pdf',
            removedEventId: 'evt-evidence-1',
          }),
        }),
        expect.stringMatching(/^evidence-removed:polityka-bezpieczenstwa-2026\.pdf:/)
      )
    );
    await waitFor(() =>
      expect(screen.queryByText('polityka-bezpieczenstwa-2026.pdf')).not.toBeInTheDocument()
    );
  });

  it('flaga OFF (domyślnie): lista dowodów NIE renderuje — wizualia za flagą (DEC-650)', async () => {
    vi.stubEnv('VITE_DRD_EVIDENCE_LIST', 'false');
    await renderAtInterviewWithEvidence();

    await screen.findByTestId('question-progress');
    expect(screen.queryByTestId('evidence-list')).not.toBeInTheDocument();
  });
});
