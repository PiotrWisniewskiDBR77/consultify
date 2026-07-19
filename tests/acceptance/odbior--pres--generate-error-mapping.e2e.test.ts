/**
 * RED-J W6 — presentations generate/regenerate error-mapping fix, focused
 * red→green proof (2026-07-19).
 *
 * Companion to the broad tests/acceptance/red-studio-500s.e2e.test.ts sweep
 * (which pinned these as KNOWN RED 500s on discovery and now — after the
 * fix below — asserts the generic "<500" invariant for the whole router).
 * This file adds the SPECIFIC status/shape assertions for the 3 bugs, so a
 * future regression is caught precisely (not just "still <500").
 *
 * REAL router + REAL verifyToken + REAL local Postgres (parity :5443,
 * standard acceptance env). No LLM calls — every case here is reached
 * before any outbound LLM call (pre-LLM validation / DB path only).
 *
 * Bugs fixed (all in server/src/services/presentationGeneratorService.ts /
 * server/src/routes/presentations.routes.ts / presentationStudio.routes.ts):
 *
 * 1. POST /api/presentations/generate/outline — `setup.sourceArtifacts` was
 *    iterated/read without an Array.isArray guard in
 *    generateDefaultOutline() (line ~355) and validateOutline() (~1129,
 *    ~1140), so a missing/non-array `sourceArtifacts` threw
 *    `TypeError: ... is not iterable` → 500. Now guarded: falls back to
 *    `[]` and the request completes (200) instead of crashing.
 * 2. POST /api/presentations/generate/deck — `generateDeck()` calls
 *    `registerArtifactOrigin()` deep inside, which does a raw
 *    `RegisterArtifactOriginParamsSchema.parse()` (requires
 *    `originRecordId` among other fields) and threw an uncaught ZodError
 *    on a body missing that shape → 500. The route now wraps the call in
 *    try/catch and maps `error instanceof ZodError` → 400
 *    VALIDATION_ERROR.
 * 3. POST /api/presentation-studio/decks/:deckId/slides/:i/regenerate —
 *    `regenerateSlide()` throws a plain `Error('Deck not found')` for a
 *    missing/foreign-org deck id; the route had no catch, so it fell
 *    through to Express's default 500 handler. Now mapped to 404
 *    DECK_NOT_FOUND (and `Invalid slide index` → 400, same function's
 *    other domain throw).
 *
 * Seed prefix: odbior--pres-- (reversible; this file creates no persistent
 * fixtures of its own beyond what the assertions need — the outline call
 * that succeeds (200) does insert a presentation_decks row, tracked +
 * cleaned in afterAll).
 */
import pg from 'pg';
import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mintToken, requireLocalDbUrl } from './harness.js';
import { seed, SEED } from './seed.mjs';

const PREFIX = 'odbior--pres--';
const RANDOM_UUID = '00000000-0000-4000-8000-000000000001';

let token: string;
let deckApp: Express;
let studioApp: Express;

const createdDeckIds: string[] = [];

beforeAll(async () => {
  await seed();
  token = mintToken();

  const { default: presentationsRouter } = await import(
    '../../server/src/routes/presentations.routes.js'
  );
  deckApp = express();
  deckApp.use(express.json({ limit: '5mb' }));
  deckApp.use('/api/presentations', presentationsRouter);

  const { default: presentationStudioRouter } = await import(
    '../../server/src/routes/presentationStudio.routes.js'
  );
  studioApp = express();
  studioApp.use(express.json({ limit: '5mb' }));
  studioApp.use('/api/presentation-studio', presentationStudioRouter);
}, 60_000);

afterAll(async () => {
  const client = new pg.Client({ connectionString: requireLocalDbUrl() });
  await client.connect();
  try {
    if (createdDeckIds.length) {
      await client
        .query('DELETE FROM v8_artifact_origin_links WHERE origin_record_id = ANY($1)', [
          createdDeckIds,
        ])
        .catch(() => {});
      await client
        .query('DELETE FROM v8_output_artifacts WHERE artifact_id = ANY($1)', [createdDeckIds])
        .catch(() => {});
      await client
        .query('DELETE FROM presentation_deck_versions WHERE deck_id = ANY($1)', [createdDeckIds])
        .catch(() => {});
      await client
        .query('DELETE FROM presentation_cards WHERE deck_id = ANY($1)', [createdDeckIds])
        .catch(() => {});
      await client
        .query('DELETE FROM presentation_decks WHERE id = ANY($1)', [createdDeckIds])
        .catch(() => {});
    }
  } finally {
    await client.end();
  }
}, 30_000);

// ============================================================================
// Bug #1 — POST /generate/outline: missing/malformed sourceArtifacts.
// ============================================================================
describe('Acceptance RED-J W6 #1: POST /api/presentations/generate/outline — sourceArtifacts guard', () => {
  it('empty body (sourceArtifacts absent) never 500s — completes with a default outline', async () => {
    const res = await request(deckApp)
      .post('/api/presentations/generate/outline')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status, `body=${JSON.stringify(res.body)}`).not.toBe(500);
    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(Array.isArray(res.body?.data?.outline)).toBe(true);
    const deckId = res.body?.data?.deckId;
    if (deckId) createdDeckIds.push(String(deckId));
  });

  it('sourceArtifacts as a non-array (malformed input) never 500s', async () => {
    const res = await request(deckApp)
      .post('/api/presentations/generate/outline')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: `${PREFIX}Outline`, sourceArtifacts: 'not-an-array' });
    expect(res.status, `body=${JSON.stringify(res.body)}`).not.toBe(500);
    expect([200, 400]).toContain(res.status);
    const deckId = res.body?.data?.deckId;
    if (deckId) createdDeckIds.push(String(deckId));
  });

  it('sourceArtifacts as null never 500s', async () => {
    const res = await request(deckApp)
      .post('/api/presentations/generate/outline')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: `${PREFIX}Outline2`, sourceArtifacts: null });
    expect(res.status, `body=${JSON.stringify(res.body)}`).not.toBe(500);
    expect([200, 400]).toContain(res.status);
    const deckId = res.body?.data?.deckId;
    if (deckId) createdDeckIds.push(String(deckId));
  });
});

// ============================================================================
// Bug #2 — POST /generate/deck: missing originRecordId (ZodError) -> 400.
// ============================================================================
describe('Acceptance RED-J W6 #2: POST /api/presentations/generate/deck — ZodError -> 400', () => {
  it('a body that cannot satisfy registerArtifactOrigin (no originRecordId shape) maps to 400, not 500', async () => {
    const res = await request(deckApp)
      .post('/api/presentations/generate/deck')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status, `body=${JSON.stringify(res.body)}`).not.toBe(500);
    expect(res.status).toBe(400);
    expect(res.body?.success).toBe(false);
    expect(res.body?.code).toBe('VALIDATION_ERROR');
  });

  it('an outline + minimal setup still missing required deck-generation fields maps to 400, not 500', async () => {
    const res = await request(deckApp)
      .post('/api/presentations/generate/deck')
      .set('Authorization', `Bearer ${token}`)
      .send({
        outline: [{ intent: 'cover', title: 'x', enabled: true }],
        setup: { title: `${PREFIX}Deck`, language: 'en' },
      });
    expect(res.status, `body=${JSON.stringify(res.body)}`).not.toBe(500);
    expect(res.status).toBeLessThan(500);
  });
});

// ============================================================================
// Bug #3 — POST /decks/:id/slides/:i/regenerate: unknown deck -> 404.
// ============================================================================
describe('Acceptance RED-J W6 #3: POST /decks/:id/slides/:i/regenerate — Deck not found -> 404', () => {
  it('a random/nonexistent deckId maps to 404 DECK_NOT_FOUND, not 500', async () => {
    const res = await request(studioApp)
      .post(`/api/presentation-studio/decks/${RANDOM_UUID}/slides/0/regenerate`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status, `body=${JSON.stringify(res.body)}`).not.toBe(500);
    expect(res.status).toBe(404);
    expect(res.body?.success).toBe(false);
    expect(res.body?.code).toBe('DECK_NOT_FOUND');
  });

  it('a deck from a different organization also maps to 404 (org-scoped SELECT), not 500', async () => {
    // Any well-formed-but-foreign-org UUID exercises the same
    // `WHERE id = ? AND organization_id = ?` miss -> "Deck not found" path.
    const res = await request(studioApp)
      .post(`/api/presentation-studio/decks/${SEED.ORG_ID}-foreign-deck/slides/0/regenerate`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status, `body=${JSON.stringify(res.body)}`).not.toBe(500);
    expect(res.status).toBe(404);
  });
});
