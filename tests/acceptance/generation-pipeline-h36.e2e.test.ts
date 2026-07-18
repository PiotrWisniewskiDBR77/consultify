/**
 * Acceptance (H3.6) — WARSTWA PIPELINE generatora doc/deck/sheet: timeout watchdog,
 * retry na błędy przejściowe, spójność statusów (error vs ready/empty).
 *
 * Wzorzec 1:1 z `docs-teresa.e2e.test.ts` / `notebook.e2e.test.ts`: REALNA lokalna
 * Postgres (parity :5443 przez DATABASE_URL), REALNE serwisy runtime, zero mocków
 * logiki. Izolacja: prefiks `odbior--h36--`, sprzątanie w afterAll.
 *
 * Zakres testu (warstwa pipeline, NIE budowanie treści):
 *  1. isTransientError / withTransientRetry — klasyfikacja + 1 retry.
 *  2. Deck watchdog (DB) — 'generating' > timeout → 'failed' + powód; świeży zostaje.
 *  3. Doc/sheet watchdog (in-memory) — stale 'generating' → 'error' + powód; świeży zostaje.
 *  4. statusDoc — rozróżnia error (treść-błędu) od ready od plan_ready (szkielet).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SEED, seed } from './seed.mjs';
import { pgClient } from './harness.js';

import {
  isTransientError,
  withTransientRetry,
} from '../../server/src/services/deliverables/transientRetry.js';
import {
  sweepStaleGenerations,
  sweepStaleDeckGenerations,
} from '../../server/src/services/deliverables/generationWatchdog.js';
import {
  sweepStaleDocGenerations,
  statusDoc,
  __clearDocRuntimeStateForTests,
  __setDocRuntimeForTests,
  __getDocRuntimeForTests,
} from '../../server/src/services/deliverables/docGenerationRuntime.js';

const PREFIX = 'odbior--h36--';

// Ids trzymane do sprzątania.
const deckIds: string[] = [];
const draftIds: string[] = [];

beforeAll(async () => {
  await seed(); // idempotent — org/user/membership odbioru
}, 60_000);

afterAll(async () => {
  __clearDocRuntimeStateForTests();
  const client = pgClient();
  await client.connect();
  try {
    if (deckIds.length) {
      await client.query('DELETE FROM presentation_decks WHERE id = ANY($1)', [deckIds]);
    }
    if (draftIds.length) {
      await client.query('DELETE FROM work_canvas_drafts WHERE id = ANY($1)', [draftIds]);
    }
  } finally {
    await client.end();
  }
});

// ============================================================================
// 1) Klasyfikacja błędów przejściowych + retry
// ============================================================================
describe('H3.6 — transient error classification + retry', () => {
  it('classifies transient (429/5xx/timeout/network) as transient, permanent as not', () => {
    expect(isTransientError({ status: 429, message: 'Too Many Requests' })).toBe(true);
    expect(isTransientError({ status: 503 })).toBe(true);
    expect(isTransientError({ code: 'ETIMEDOUT' })).toBe(true);
    expect(isTransientError(new Error('socket hang up'))).toBe(true);
    expect(isTransientError(new Error('rate limit exceeded'))).toBe(true);
    expect(isTransientError(new Error('Gateway Timeout'))).toBe(true);

    // Trwałe — NIE ponawiamy.
    expect(isTransientError(new Error('setup wymaga conversationId'))).toBe(false);
    expect(isTransientError(new Error('invalid outline'))).toBe(false);
    expect(isTransientError({ status: 400, message: 'Bad Request' })).toBe(false);
    expect(isTransientError(null)).toBe(false);
  });

  it('retries once on a transient error then succeeds', async () => {
    let calls = 0;
    const result = await withTransientRetry(
      async () => {
        calls += 1;
        if (calls === 1) throw Object.assign(new Error('429 too many requests'), { status: 429 });
        return 'ok';
      },
      { label: 'test', backoffMs: 1 }
    );
    expect(result).toBe('ok');
    expect(calls).toBe(2);
  });

  it('does NOT retry a permanent error (propagates on first failure)', async () => {
    let calls = 0;
    await expect(
      withTransientRetry(
        async () => {
          calls += 1;
          throw new Error('permanent validation failure');
        },
        { label: 'test', backoffMs: 1 }
      )
    ).rejects.toThrow('permanent validation failure');
    expect(calls).toBe(1);
  });
});

// ============================================================================
// 2) Deck watchdog (SSOT w DB: presentation_decks.status)
// ============================================================================
describe('H3.6 — deck timeout watchdog (DB)', () => {
  it('flips a stale generating deck to failed with a reason; leaves a fresh one', async () => {
    const staleId = `${PREFIX}deck-stale-${Date.now()}`;
    const freshId = `${PREFIX}deck-fresh-${Date.now()}`;
    deckIds.push(staleId, freshId);

    const client = pgClient();
    await client.connect();
    try {
      // Stary wiersz 'generating' — updated_at 30 min wstecz.
      await client.query(
        `INSERT INTO presentation_decks (id, organization_id, title, status, updated_at, created_at)
         VALUES ($1, $2, $3, 'generating', NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '30 minutes')`,
        [staleId, SEED.ORG_ID, `${PREFIX}Stale Deck`]
      );
      // Świeży wiersz 'generating' — updated_at teraz (nie powinien zostać zamieciony).
      await client.query(
        `INSERT INTO presentation_decks (id, organization_id, title, status, updated_at, created_at)
         VALUES ($1, $2, $3, 'generating', NOW(), NOW())`,
        [freshId, SEED.ORG_ID, `${PREFIX}Fresh Deck`]
      );
    } finally {
      await client.end();
    }

    // Timeout 5 min — stale (30 min) łapie się, fresh (0 min) nie.
    const res = await sweepStaleDeckGenerations(5 * 60 * 1000);
    expect(res.swept).toContain(staleId);
    expect(res.swept).not.toContain(freshId);

    const client2 = pgClient();
    await client2.connect();
    try {
      const { rows } = await client2.query(
        `SELECT id, status, validation_warnings FROM presentation_decks WHERE id = ANY($1)`,
        [[staleId, freshId]]
      );
      const byId = Object.fromEntries(rows.map((r: any) => [r.id, r]));
      expect(byId[staleId].status).toBe('failed');
      expect(String(byId[staleId].validation_warnings || '')).toContain('limit czasu');
      expect(byId[freshId].status).toBe('generating');
    } finally {
      await client2.end();
    }
  });
});

// ============================================================================
// 3) Doc/sheet watchdog (stan in-memory docRuntimeState)
// ============================================================================
describe('H3.6 — doc/sheet timeout watchdog (in-memory)', () => {
  it('flips a stale in-memory generating entry to error with reason; leaves a fresh one', () => {
    __clearDocRuntimeStateForTests();
    const staleId = `${PREFIX}doc-stale`;
    const freshId = `${PREFIX}doc-fresh`;

    // Stale: startowany 30 min temu.
    __setDocRuntimeForTests(
      staleId,
      { state: 'generating', warnings: [] },
      Date.now() - 30 * 60 * 1000
    );
    // Fresh: startowany teraz.
    __setDocRuntimeForTests(freshId, { state: 'generating', warnings: [] }, Date.now());

    const { swept } = sweepStaleDocGenerations(5 * 60 * 1000);
    expect(swept).toContain(staleId);
    expect(swept).not.toContain(freshId);

    expect(__getDocRuntimeForTests(staleId)?.state).toBe('error');
    expect(__getDocRuntimeForTests(staleId)?.error).toContain('limit czasu');
    expect(__getDocRuntimeForTests(freshId)?.state).toBe('generating');

    __clearDocRuntimeStateForTests();
  });

  it('sweepStaleGenerations sweeps both deck (DB) and doc (memory) in one pass', async () => {
    __clearDocRuntimeStateForTests();
    const memId = `${PREFIX}doc-combined`;
    __setDocRuntimeForTests(
      memId,
      { state: 'generating', warnings: [] },
      Date.now() - 30 * 60 * 1000
    );
    const res = await sweepStaleGenerations({ timeoutMs: 5 * 60 * 1000 });
    expect(res.docSwept).toContain(memId);
    expect(__getDocRuntimeForTests(memId)?.state).toBe('error');
    __clearDocRuntimeStateForTests();
  });
});

// ============================================================================
// 4) statusDoc — spójność statusów (error vs ready vs plan_ready)
// ============================================================================
describe('H3.6 — statusDoc status consistency (error vs empty vs ready)', () => {
  async function insertDraft(id: string, kind: string, content: string): Promise<void> {
    draftIds.push(id);
    const client = pgClient();
    await client.connect();
    try {
      await client.query(
        `INSERT INTO work_canvas_drafts
           (id, organization_id, created_by, conversation_id, kind, title, content_json,
            save_state, lifecycle_state, dirty_state, visibility, audit_status, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'saved','active','clean','private','none',NOW()::text,NOW()::text)`,
        [id, SEED.ORG_ID, SEED.USER_ID, `${PREFIX}conv`, kind, `${PREFIX}${kind}`, JSON.stringify(content)]
      );
    } finally {
      await client.end();
    }
  }

  it('returns error (not draft) when the draft carries failure content and no runtime entry', async () => {
    __clearDocRuntimeStateForTests(); // wymuś ścieżkę fallback (po restarcie)
    const id = `${PREFIX}doc-failed-${Date.now()}`;
    const failureContent = [
      '# Test',
      '',
      '> **Generacja nie powiodła się.** Dokument nie został wypełniony treścią.',
      '',
      'Powód: LLM niedostępny (429)',
    ].join('\n');
    await insertDraft(id, 'document', failureContent);

    const res = await statusDoc({ generationId: id, organizationId: SEED.ORG_ID });
    expect(res.state).toBe('error');
    expect(res.error).toContain('LLM niedostępny');
  });

  it('returns plan_ready for a skeleton draft and draft for real content', async () => {
    __clearDocRuntimeStateForTests();
    const skeletonId = `${PREFIX}doc-skeleton-${Date.now()}`;
    const readyId = `${PREFIX}doc-ready-${Date.now()}`;
    // Marker szkieletu PL rozpoznawany przez isSkeletonContent.
    await insertDraft(
      skeletonId,
      'document',
      '# Szkielet\n\n*Treść pojawi się po zakończeniu generacji.*'
    );
    await insertDraft(
      readyId,
      'document',
      '# Gotowy dokument\n\n## Wprowadzenie\n\nTo jest realna, wypełniona treść dokumentu.'
    );

    const skeletonRes = await statusDoc({ generationId: skeletonId, organizationId: SEED.ORG_ID });
    expect(skeletonRes.state).toBe('plan_ready');

    const readyRes = await statusDoc({ generationId: readyId, organizationId: SEED.ORG_ID });
    expect(readyRes.state).toBe('draft');
  });
});
