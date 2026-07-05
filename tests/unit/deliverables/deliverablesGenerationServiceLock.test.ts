/**
 * P0.3 — testy jednostkowe serwisu generacji L1 (deck):
 *  1) lock atomowy w start(): dwa równoległe start() dla tego samego decka →
 *     dokładnie jeden wygrywa (odpala generateDeck), drugi dostaje 'invalid_state'
 *     zamiast dublować generację.
 *  2) trwałość błędu generacji: status() po "restarcie" (runtimeState wyczyszczone,
 *     jak po restarcie procesu) czyta błąd z presentation_decks.validation_warnings,
 *     nie tylko z mapy in-memory.
 *
 * Mockujemy DbPromise.js (in-memory `presentation_decks`) + presentationGeneratorService.js
 * (generateDeck/generateOutline) + zależności poboczne (telemetry, artifact registry).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface DeckRow {
  id: string;
  organization_id: string;
  status: string;
  outline_json: string | null;
  slide_count: number | null;
  validation_warnings: string | null;
  title: string;
}

const db = vi.hoisted(() => ({
  decks: new Map<string, DeckRow>(),
}));

function seedDeck(row: Partial<DeckRow> & { id: string; organization_id: string }): void {
  db.decks.set(row.id, {
    status: 'draft',
    outline_json: JSON.stringify({
      outline: [
        { intent: 'executive_summary', title: 'Podsumowanie', enabled: true, keyMessage: 'x' },
      ],
    }),
    slide_count: null,
    validation_warnings: null,
    title: 'Test deck',
    ...row,
  });
}

// ── Mock DbPromise.js: get() czyta z Mapy, run() obsługuje UPDATE ... RETURNING id ──
vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  get: async (sql: string, params: unknown[] = []) => {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    if (normalized.startsWith('SELECT') && normalized.includes('FROM presentation_decks')) {
      const [id, organizationId] = params as [string, string];
      const row = db.decks.get(id);
      if (!row || row.organization_id !== organizationId) return undefined;
      return { ...row };
    }
    throw new Error(`Unexpected get(): ${normalized}`);
  },
  run: async (sql: string, params: unknown[] = []) => {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    if (normalized.startsWith('UPDATE presentation_decks SET status = \'generating\'')) {
      // P0.3 lock: atomowy warunkowy UPDATE ... WHERE status != 'generating' RETURNING id
      const [id, organizationId] = params as [string, string];
      const row = db.decks.get(id);
      if (!row || row.organization_id !== organizationId || row.status === 'generating') {
        return { success: true, changes: 0 };
      }
      row.status = 'generating';
      return { success: true, changes: 1 };
    }
    throw new Error(`Unexpected run(): ${normalized}`);
  },
}));

const generateDeckMock = vi.fn();
const generateOutlineMock = vi.fn();
vi.mock('../../../server/src/services/presentationGeneratorService.js', () => ({
  generateDeck: (...args: unknown[]) => generateDeckMock(...args),
  generateOutline: (...args: unknown[]) => generateOutlineMock(...args),
}));

vi.mock('../../../server/src/services/v8/artifactRegistryService.js', () => ({
  getArtifactByOriginUnscoped: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../../server/src/services/deliverables/deliverablesTelemetryService.js', () => ({
  trackDeliverableEvent: vi.fn().mockResolvedValue(undefined),
}));

// docGenerationRuntime branch is unreachable for format='deck' but the module is
// imported at top-level — stub its exports so import doesn't drag in real deps.
vi.mock('../../../server/src/services/deliverables/docGenerationRuntime.js', () => ({
  planDoc: vi.fn(),
  planSheet: vi.fn(),
  startDoc: vi.fn(),
  startSheet: vi.fn(),
  statusDoc: vi.fn(),
}));

const {
  start,
  status,
  __clearRuntimeStateForTests,
} = await import('../../../server/src/services/deliverables/deliverablesGenerationService.js');

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('deliverablesGenerationService — P0.3 concurrent-generation lock', () => {
  const orgId = 'org-1';
  const deckId = 'deck-lock-1';

  beforeEach(() => {
    db.decks.clear();
    generateDeckMock.mockReset();
    generateOutlineMock.mockReset();
    __clearRuntimeStateForTests();
  });
  afterEach(() => vi.clearAllMocks());

  it('two concurrent start() calls for the same deck: exactly one wins, the other gets invalid_state', async () => {
    seedDeck({ id: deckId, organization_id: orgId, status: 'draft' });
    const gate = deferred<void>();
    generateDeckMock.mockImplementation(async () => {
      await gate.promise;
      return { deckId, slideCount: 3, warnings: [], exportPath: null };
    });

    const paramsBase = {
      generationId: deckId,
      format: 'deck' as const,
      setup: { title: 't', language: 'pl' },
      organizationId: orgId,
    };

    const [r1, r2] = await Promise.allSettled([start(paramsBase), start(paramsBase)]);

    // Exactly one of the two concurrent starts must succeed with state='generating'.
    const fulfilled = [r1, r2].filter((r) => r.status === 'fulfilled');
    const rejected = [r1, r2].filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    expect((fulfilled[0] as PromiseFulfilledResult<any>).value.state).toBe('generating');
    expect((rejected[0] as PromiseRejectedResult).reason.code).toBe('invalid_state');
    expect((rejected[0] as PromiseRejectedResult).reason.message).toMatch(/już trwa/);

    // generateDeck must have been invoked exactly once — no duplicate job.
    expect(generateDeckMock).toHaveBeenCalledTimes(1);

    // DB row reflects the winner's lock.
    expect(db.decks.get(deckId)?.status).toBe('generating');

    gate.resolve();
  });

  it('start() rejects with invalid_state when deck is already generating in DB (no runtime entry — e.g. after a restart)', async () => {
    seedDeck({ id: deckId, organization_id: orgId, status: 'generating' });

    await expect(
      start({
        generationId: deckId,
        format: 'deck',
        setup: { title: 't', language: 'pl' },
        organizationId: orgId,
      })
    ).rejects.toMatchObject({ code: 'invalid_state' });

    expect(generateDeckMock).not.toHaveBeenCalled();
  });

  it('a second start() after the first completes is allowed (lock is released by status transition)', async () => {
    seedDeck({ id: deckId, organization_id: orgId, status: 'draft' });
    generateDeckMock.mockResolvedValue({ deckId, slideCount: 5, warnings: [], exportPath: null });

    const first = await start({
      generationId: deckId,
      format: 'deck',
      setup: { title: 't', language: 'pl' },
      organizationId: orgId,
    });
    expect(first.state).toBe('generating');

    // Simulate generateDeck() completing and flipping the DB row to 'ready'
    // (this is what the real presentationGeneratorService.generateDeck does).
    const row = db.decks.get(deckId)!;
    row.status = 'ready';

    const second = await start({
      generationId: deckId,
      format: 'deck',
      setup: { title: 't', language: 'pl' },
      organizationId: orgId,
    });
    expect(second.state).toBe('generating');
    expect(generateDeckMock).toHaveBeenCalledTimes(2);
  });
});

describe('deliverablesGenerationService — P0.3 persisted generation error survives restart', () => {
  const orgId = 'org-1';
  const deckId = 'deck-error-1';

  beforeEach(() => {
    db.decks.clear();
    generateDeckMock.mockReset();
    generateOutlineMock.mockReset();
    __clearRuntimeStateForTests();
  });
  afterEach(() => vi.clearAllMocks());

  it('status() reports state=error with the persisted message when runtimeState has no entry (post-restart)', async () => {
    // Mirrors presentationGeneratorService.generateDeck's own catch-path contract:
    // status='failed' + validation_warnings=JSON.stringify([err.message]).
    seedDeck({
      id: deckId,
      organization_id: orgId,
      status: 'failed',
      validation_warnings: JSON.stringify(['Boom: PPTX render exploded']),
    });

    // __clearRuntimeStateForTests() in beforeEach already guarantees no in-memory
    // entry exists — this simulates the process having restarted after the failure.
    const res = await status({ generationId: deckId, organizationId: orgId });

    expect(res.state).toBe('error');
    expect(res.error).toBe('Boom: PPTX render exploded');
  });

  it('status() falls back to a generic message when validation_warnings is empty/malformed', async () => {
    seedDeck({ id: deckId, organization_id: orgId, status: 'failed', validation_warnings: null });

    const res = await status({ generationId: deckId, organizationId: orgId });

    expect(res.state).toBe('error');
    expect(res.error).toBe('Generacja nie powiodła się');
  });
});
