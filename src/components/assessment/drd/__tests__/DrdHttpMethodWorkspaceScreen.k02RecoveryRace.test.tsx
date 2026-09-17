/**
 * @vitest-environment jsdom
 *
 * K-02 RED reproducer: DRD-2b manual decision must win over an already armed
 * text autosave. Current implementation lets the later draft restore
 * `partial` roughly 800 ms after Save & next level.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));

vi.mock('@/utils/drdInterviewV2Flag', () => ({
  isDrdInterviewV2Enabled: () => true,
  DRD_INTERVIEW_V2_ENV_KEY: 'VITE_DRD_INTERVIEW_V2',
}));
vi.mock('@/method-core/api/methodCoreApi', async () => {
  const actual = await vi.importActual<typeof import('@/method-core/api/methodCoreApi')>(
    '@/method-core/api/methodCoreApi'
  );
  return { ...actual, ...hoisted };
});
vi.mock('@/hooks/useOpenChatWithContext', () => ({
  useOpenChatWithContext: () => vi.fn(),
  default: () => vi.fn(),
}));
vi.mock('@/services/api', () => ({
  Api: { get: hoisted.apiGet, post: hoisted.apiPost },
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>, values?: Record<string, unknown>) => {
      const messages: Record<string, string> = {
        'common.saved': 'Saved',
        'documents.taskCreateFailed': 'The task could not be created.',
      };
      const template = typeof fallback === 'string' ? fallback : messages[key] ?? key;
      const replacements = values ?? (typeof fallback === 'object' ? fallback : {});
      return Object.entries(replacements).reduce(
        (text, [name, value]) => text.replace(`{{${name}}}`, String(value)),
        template
      );
    },
    i18n: { language: 'en' },
  }),
}));

const { DrdHttpMethodWorkspaceScreen } = await import('../DrdHttpMethodWorkspaceScreen');
const { DRD_METHOD_PACK_ID, DRD_METHOD_PACK_VERSION } =
  await import('@/method-core/methods/drd/compileDrdPack');

function storage(): Storage {
  const values = new Map<string, string>();
  return {
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => void values.set(k, v),
    removeItem: (k) => void values.delete(k),
    clear: () => values.clear(),
    key: (i) => [...values.keys()][i] ?? null,
    get length() {
      return values.size;
    },
  } as Storage;
}
function session() {
  return {
    id: 'sess-k02',
    organizationId: 'org-1',
    projectId: null,
    module: 'assessment',
    methodPackId: DRD_METHOD_PACK_ID,
    methodPackVersion: DRD_METHOD_PACK_VERSION,
    state: 'active',
    domainStage: null,
    mode: 'guided_manual',
    ownerUserId: 'user-1',
    createdAt: '2026-09-17T00:00:00.000Z',
    updatedAt: '2026-09-17T00:00:00.000Z',
    version: 1,
    frozenSnapshotId: null,
    revisionOfSessionId: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('K-02 — DRD-2b autosave/manual-save ordering', () => {
  it('keeps the explicit Yes decision after the armed 800 ms draft save completes', async () => {
    const events: Array<Record<string, any>> = [];
    let sequence = 0;
    hoisted.createSession.mockResolvedValue({ session: session(), idempotentReplay: false });
    hoisted.getSession.mockResolvedValue({ session: session(), roles: ['owner', 'lead_assessor'] });
    hoisted.listEvents.mockImplementation(() => Promise.resolve([...events]));
    const pending: Array<{ event: Record<string, any>; resolve: (value: unknown) => void }> = [];
    hoisted.appendEvent.mockImplementation(
      (_sessionId: string, event: Record<string, any>) =>
        new Promise((resolve) => pending.push({ event, resolve }))
    );

    render(<DrdHttpMethodWorkspaceScreen storage={storage()} demoSessionId="sess-k02" />);
    await screen.findByTestId('drd-level-interview-v2');

    const answer = screen.getByLabelText(/Your answer for this level|Twoja odpowiedź/i);
    fireEvent.change(answer, { target: { value: 'Evidence entered' } });
    fireEvent.change(answer, { target: { value: 'Evidence entered before decision' } });

    // The debounce has already started its request, but the server has not
    // completed it yet. This is the narrow race window reported in K-02.
    await waitFor(
      () => expect(pending.some(({ event }) => event.type === 'ANSWER_DRAFTED')).toBe(true),
      { timeout: 4000 }
    );
    fireEvent.click(screen.getByRole('button', { name: /^Yes$|^Tak$/i }));
    fireEvent.click(screen.getByRole('button', { name: /Save & next level|Zapisz/i }));

    const complete = async (type: string) => {
      const item = pending.find(({ event }) => event.type === type)!;
      const stored = {
        id: `evt-${++sequence}`,
        sessionId: 'sess-k02',
        organizationId: 'org-1',
        actorKind: 'human',
        actorUserId: 'user-1',
        methodPackVersion: DRD_METHOD_PACK_VERSION,
        occurredAt: new Date().toISOString(),
        ...item.event,
      };
      events.push(stored);
      await act(async () => {
        item.resolve(stored);
        await Promise.resolve();
        await Promise.resolve();
      });
    };
    // The stale draft was already in flight, so it may finish first. The
    // explicit decision must be serialized after it and remain authoritative.
    await complete('ANSWER_DRAFTED');
    await waitFor(() =>
      expect(pending.some(({ event }) => event.type === 'ANSWER_CONFIRMED')).toBe(true)
    );
    await complete('ANSWER_CONFIRMED');
    await waitFor(() => expect(events).toHaveLength(2));

    const answers = events.filter(
      (event) => event.type === 'ANSWER_CONFIRMED' || event.type === 'ANSWER_DRAFTED'
    );
    expect(answers.at(-1)?.payload?.answerState).toBe('confirmed');
  }, 15000);

  it('does not create a help task when persisting the answer fails', async () => {
    hoisted.createSession.mockResolvedValue({ session: session(), idempotentReplay: false });
    hoisted.getSession.mockResolvedValue({ session: session(), roles: ['owner', 'lead_assessor'] });
    hoisted.listEvents.mockResolvedValue([]);
    hoisted.appendEvent.mockRejectedValue(new Error('answer write failed'));

    render(<DrdHttpMethodWorkspaceScreen storage={storage()} demoSessionId="sess-k02" />);
    await screen.findByTestId('drd-level-interview-v2');
    fireEvent.click(screen.getByRole('button', { name: /I need help|Potrzebuję pomocy/i }));
    fireEvent.click(screen.getByRole('button', { name: /Save & next level|Zapisz/i }));

    await waitFor(() => expect(hoisted.appendEvent).toHaveBeenCalled());
    expect(hoisted.apiGet).not.toHaveBeenCalled();
    expect(hoisted.apiPost).not.toHaveBeenCalled();
  });

  it('persists Help before task creation and retries a failed task without duplicating the answer', async () => {
    const events: Array<Record<string, any>> = [];
    hoisted.createSession.mockResolvedValue({ session: session(), idempotentReplay: false });
    hoisted.getSession.mockResolvedValue({ session: session(), roles: ['owner', 'lead_assessor'] });
    hoisted.listEvents.mockImplementation(() => Promise.resolve([...events]));
    hoisted.appendEvent.mockImplementation((_sessionId: string, event: Record<string, any>) => {
      const stored = {
        id: `evt-${events.length + 1}`,
        sessionId: 'sess-k02',
        organizationId: 'org-1',
        actorKind: 'human',
        actorUserId: 'user-1',
        methodPackVersion: DRD_METHOD_PACK_VERSION,
        occurredAt: new Date().toISOString(),
        ...event,
      };
      events.push(stored);
      return Promise.resolve(stored);
    });
    hoisted.apiGet.mockResolvedValue({
      roles: [{ role: 'evidence_owner', userId: 'evidence-owner' }],
    });
    hoisted.apiPost.mockRejectedValue(new Error('task write failed'));

    render(<DrdHttpMethodWorkspaceScreen storage={storage()} demoSessionId="sess-k02" />);
    await screen.findByTestId('drd-level-interview-v2');
    fireEvent.click(screen.getByRole('button', { name: /I need help|Potrzebuję pomocy/i }));
    fireEvent.click(screen.getByRole('button', { name: /Save & next level|Zapisz/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Saved. The task could not be created.');
    expect(hoisted.appendEvent).toHaveBeenCalledTimes(1);
    expect(hoisted.appendEvent.mock.invocationCallOrder[0]).toBeLessThan(
      hoisted.apiPost.mock.invocationCallOrder[0]
    );

    fireEvent.click(screen.getByRole('button', { name: /Save & next level|Zapisz/i }));
    await waitFor(() => expect(hoisted.apiPost).toHaveBeenCalledTimes(2));
    expect(hoisted.appendEvent).toHaveBeenCalledTimes(1);
    expect(hoisted.apiPost.mock.calls[0][1].idempotencyKey).toBe(
      hoisted.apiPost.mock.calls[1][1].idempotencyKey
    );
  });

  it('persists Help again after a different decision invalidates the failed task retry', async () => {
    const events: Array<Record<string, any>> = [];
    hoisted.createSession.mockResolvedValue({ session: session(), idempotentReplay: false });
    hoisted.getSession.mockResolvedValue({ session: session(), roles: ['owner', 'lead_assessor'] });
    hoisted.listEvents.mockImplementation(() => Promise.resolve([...events]));
    hoisted.appendEvent.mockImplementation((_sessionId: string, event: Record<string, any>) => {
      const stored = {
        id: `evt-${events.length + 1}`,
        sessionId: 'sess-k02',
        organizationId: 'org-1',
        actorKind: 'human',
        actorUserId: 'user-1',
        methodPackVersion: DRD_METHOD_PACK_VERSION,
        occurredAt: new Date().toISOString(),
        ...event,
      };
      events.push(stored);
      return Promise.resolve(stored);
    });
    hoisted.apiGet.mockResolvedValue({
      roles: [{ role: 'evidence_owner', userId: 'evidence-owner' }],
    });
    hoisted.apiPost
      .mockRejectedValueOnce(new Error('task write failed'))
      .mockResolvedValueOnce({ id: 'task-1' });

    render(<DrdHttpMethodWorkspaceScreen storage={storage()} demoSessionId="sess-k02" />);
    await screen.findByTestId('drd-level-interview-v2');

    fireEvent.click(screen.getByRole('button', { name: /I need help|Potrzebuję pomocy/i }));
    fireEvent.click(screen.getByRole('button', { name: /Save & next level|Zapisz/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Saved. The task could not be created.');

    fireEvent.click(screen.getByRole('button', { name: /^No$|^Nie$/i }));
    fireEvent.click(screen.getByRole('button', { name: /Save & next level|Zapisz/i }));
    await waitFor(() => expect(hoisted.appendEvent).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole('treeitem', { name: /Sales Processes/ }));
    await screen.findByTestId('drd-level-interview-v2');
    fireEvent.click(screen.getByRole('button', { name: /I need help|Potrzebuję pomocy/i }));
    fireEvent.click(screen.getByRole('button', { name: /Save & next level|Zapisz/i }));

    await waitFor(() => expect(hoisted.apiPost).toHaveBeenCalledTimes(2));
    expect(hoisted.appendEvent).toHaveBeenCalledTimes(3);
    expect(events.at(-1)?.payload?.answerState).toBe('dont_know');
  });
});
