/**
 * P20 Integration Test: Full Deck Lifecycle
 * Contract: FINAL_IMPLEMENTATION_PLAN_20_PREZENTACJE §5.2
 *
 * Covers: create deck with template -> verify in Outputs -> reopen via artifactId
 * -> autosave edit -> version conflict (409) -> start review -> export PDF + PPTX
 * -> verify export in ledger -> version history restore
 *
 * ── L-07 STATUS: SKIPPED (caboose required) ──────────────────────────────────
 * All 10 tests in this file require a live API server at $API_URL (default
 * http://localhost:3001/api) AND a seeded staging database (caboose). Without
 * the server the original tests silently passed by bailing out early on every
 * `if (!deckId) return` / `if (status !== 201) return` guard — vacuous green.
 *
 * S4 (snapshot round-trip) is now covered by the REAL in-process supertest
 * suite: tests/integration/presentations/deck-version-roundtrip.contract.test.ts
 * S5 (quality-gate 422) is covered by export-quality-gate.regression.test.ts
 *
 * These live-server tests are preserved as skip() so their intent is visible and
 * they can be re-enabled by running against caboose (§06):
 *   API_URL=https://caboose.railway.app/api npx vitest run tests/integration/presentations/p20-lifecycle.test.ts
 */

import { describe, it, expect } from 'vitest';

const API_URL = process.env.API_URL || 'http://localhost:3001/api';
const AUTH_HEADER = { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' };

async function apiPost(path: string, body: any) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: AUTH_HEADER,
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

async function apiGet(path: string) {
  const res = await fetch(`${API_URL}${path}`, { headers: AUTH_HEADER });
  return { status: res.status, data: await res.json() };
}

async function apiPut(path: string, body: any, extraHeaders: Record<string, string> = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'PUT',
    headers: { ...AUTH_HEADER, ...extraHeaders },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

describe('P20 Deck Lifecycle — E2E (SKIPPED: requires caboose §06)', () => {
  let deckId: string;

  it.skip('P20-A.2: create deck requires template_id (mandatory per contract §2.3) [caboose]', async () => {
    const { status, data } = await apiPost('/presentations/decks', {
      title: 'P20 Lifecycle Test Deck',
      theme: 'corporate',
      slides: [
        { type: 'cover', content: { title: 'Test Cover' } },
        { type: 'content', content: { text: 'Test slide' } },
      ],
      source: 'test',
    });
    expect(status).toBe(201);
    deckId = data?.data?.id;
    expect(deckId).toBeTruthy();
  });

  it.skip('P20-A.1: deck appears in registry as Output artifact [caboose]', async () => {
    const { data } = await apiGet(`/artifacts/orig/presentation/${deckId}`);
    expect(data?.data?.artifactId || data?.artifactId).toBeTruthy();
  });

  it.skip('P20-A.5: reopen via GET /decks/:id returns same deck with structure [caboose]', async () => {
    const { status, data } = await apiGet(`/presentations/decks/${deckId}`);
    expect(status).toBe(200);
    expect(data?.data?.id || data?.id).toBe(deckId);
  });

  it.skip('P20-A.13: autosave with version conflict returns 409 [caboose]', async () => {
    const body = { cards: [], title: 'Updated' };
    const { status: s1, data: d1 } = await apiPut(`/presentations/decks/${deckId}/autosave`, body);
    expect(s1).toBe(200);
    expect(d1.version).toBeGreaterThanOrEqual(1);

    const staleVersion = 0;
    const { status: s2 } = await apiPut(
      `/presentations/decks/${deckId}/autosave`,
      body,
      { 'X-Deck-Version': String(staleVersion) }
    );
    expect(s2).toBe(409);
  });

  it.skip('P20-A.9: export PDF succeeds with ledger trace [caboose]', async () => {
    const res = await fetch(`${API_URL}/presentations/decks/${deckId}/export/pdf`, {
      headers: AUTH_HEADER,
    });
    expect(res.status).toBe(200);
  });

  it.skip('P20-A.9: export PPTX download available [caboose]', async () => {
    const res = await fetch(`${API_URL}/presentations/decks/${deckId}/download`, {
      headers: AUTH_HEADER,
    });
    expect(res.status).toBe(200);
  });

  it.skip('P20 §2.6: version history is retrievable [caboose]', async () => {
    const { status, data } = await apiGet(`/presentations/decks/${deckId}/versions`);
    expect(status).toBe(200);
    expect(Array.isArray(data?.data)).toBe(true);
  });

  it.skip('P20 §2.6: version restore preserves deck identity [caboose]', async () => {
    const { data: versionsData } = await apiGet(`/presentations/decks/${deckId}/versions`);
    const versions = versionsData?.data || [];
    expect(versions.length).toBeGreaterThan(0);
    const { status, data } = await apiPost(
      `/presentations/decks/${deckId}/versions/${versions[0].id}/restore`,
      {}
    );
    expect(status).toBe(200);
    expect(data?.version).toBeGreaterThanOrEqual(1);
  });

  it.skip('P20-A.12: bounded analytics endpoint works [caboose]', async () => {
    const { status, data } = await apiGet(`/presentations/decks/${deckId}/analytics`);
    expect(status).toBe(200);
    expect(data?.data?.summary).toBeDefined();
  });

  it.skip('P20-A.11: share creates governed link [caboose]', async () => {
    const { status, data } = await apiPost(`/presentations/decks/${deckId}/share`, {
      expiresInDays: 7,
    });
    expect(status).toBe(200);
    expect(data?.data?.shareToken).toBeTruthy();
  });
});
