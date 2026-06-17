/**
 * P20-K Integration Test: Confidentiality Export/Share Role Matrix — contract
 * Contract: FINAL_IMPLEMENTATION_PLAN_20_PREZENTACJE §P20-K (confidentiality controls)
 *
 * Covers: confidential decks block export for unprivileged callers, non-public decks
 * block share for project_manager, and public decks allow share for any authorized role.
 *
 * ── L-07 STATUS: SKIPPED (caboose required) ──────────────────────────────────
 * All 3 tests require a live API server at $API_URL (default
 * http://localhost:3001/api) AND a seeded staging database (caboose).
 * The original tests were doubly vacuous: they bailed out on
 * `if (!backendReachable || !confidentialDeckId) { expect(true).toBe(true); return; }`
 * AND on status mismatch with `if (status !== 403) { expect(true).toBe(true); return; }` —
 * always passing regardless of server state.
 *
 * S7 (share/confidentiality enforcement) is logged as [P1] backlog in the M19
 * evidence file (f2_tests_report.md §5 item 5). The intended replacement is a
 * supertest in-process test against presentationStudio.routes (which already has
 * 71 RBAC tests in server/src/routes/__tests__/presentationStudio.routes.test.ts).
 *
 * These live-server tests are preserved as skip() so their intent is visible and
 * they can be re-enabled by running against caboose (§06):
 *   API_URL=https://caboose.railway.app/api npx vitest run tests/integration/presentations/confidentiality-controls.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';

const API_URL = process.env.API_URL || 'http://localhost:3001/api';
const AUTH_HEADER = { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' };

async function apiPost(path: string, body: any, extraHeaders: Record<string, string> = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { ...AUTH_HEADER, ...extraHeaders },
    body: JSON.stringify(body),
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

async function apiGet(path: string, extraHeaders: Record<string, string> = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { ...AUTH_HEADER, ...extraHeaders },
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

async function apiPatch(path: string, body: any, extraHeaders: Record<string, string> = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'PATCH',
    headers: { ...AUTH_HEADER, ...extraHeaders },
    body: JSON.stringify(body),
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

async function tryCreateDeck(meta: Record<string, any> = {}): Promise<string | null> {
  try {
    const { status, data } = await apiPost('/presentations/decks', {
      title: 'P20-K Confidentiality Test Deck',
      theme: 'corporate',
      slides: [
        { type: 'cover', content: { title: 'Confidentiality' } },
        { type: 'content', content: { text: 'Body' } },
      ],
      source: 'test',
      meta,
    });
    if (status === 201 || status === 200) {
      return data?.data?.id || data?.id || null;
    }
    return null;
  } catch {
    return null;
  }
}

describe('P20-K confidentiality controls — contract (SKIPPED: requires caboose §06)', () => {
  let confidentialDeckId: string | null = null;
  let internalDeckId: string | null = null;
  let publicDeckId: string | null = null;

  beforeAll(async () => {
    confidentialDeckId = await tryCreateDeck({ confidentiality: 'confidential' });
    internalDeckId = await tryCreateDeck({});
    publicDeckId = await tryCreateDeck({});

    if (publicDeckId) {
      try {
        await apiPatch(`/presentations/decks/${publicDeckId}`, {
          meta: { confidentiality: 'public' },
        });
      } catch {
        // Best-effort: backend may not support PATCH of confidentiality.
      }
    }
  });

  it.skip('blocks export of confidential deck for unprivileged caller (HTTP 403, code CONFIDENTIALITY_POLICY_BLOCKED) [caboose]', async () => {
    expect(confidentialDeckId).toBeTruthy();
    const { status, data } = await apiGet(
      `/presentations/decks/${confidentialDeckId}/download`,
      { 'X-Test-Role': 'USER' },
    );
    expect(status).toBe(403);
    expect(data?.code || data?.error?.code).toBe('CONFIDENTIALITY_POLICY_BLOCKED');
    expect(data?.action || data?.error?.action).toBe('export');
  });

  it.skip('blocks share for non-public deck for project_manager (HTTP 403, code CONFIDENTIALITY_SHARE_REQUIRES_ADMIN) [caboose]', async () => {
    expect(internalDeckId).toBeTruthy();
    const { status, data } = await apiPost(
      `/presentations/decks/${internalDeckId}/share`,
      { expiresInDays: 7 },
      { 'X-Test-Role': 'PROJECT_MANAGER' },
    );
    expect(status).toBe(403);
    expect(data?.code || data?.error?.code).toBe('CONFIDENTIALITY_SHARE_REQUIRES_ADMIN');
  });

  it.skip('allows share for public deck for any authorized role (HTTP 200, contains shareToken) [caboose]', async () => {
    expect(publicDeckId).toBeTruthy();
    const { status, data } = await apiPost(
      `/presentations/decks/${publicDeckId}/share`,
      { expiresInDays: 7 },
    );
    expect(status).toBe(200);
    expect(data?.data?.shareToken || data?.shareToken).toBeTruthy();
  });
});
