/**
 * Live HTTP contract-cycle proof — tests 1-5 and 11 from the S4 brief.
 *
 * Unlike every other test in this directory, this one does NOT mock
 * `fetch`/`methodCoreApi` — it talks to a REAL running
 * `server/src/routes/method-core.routes.ts` over HTTP, against the REAL
 * Postgres test database, exactly the way CLAUDE.md's "Złota reguła 1"
 * ("Weryfikuj REALNY runtime, nie docy/flagi") requires for anything claimed
 * to "work". A mocked 200 response proves the client code shapes a request
 * correctly; it does NOT prove the server actually refuses a commit without
 * a previewId, an expired preview, a double-commit, or an invalid-quality
 * preview — those refusals live in `TeresaProposalService`
 * (server/src/method-core/TeresaProposalService.ts, out of S4's scope to
 * modify) and can only be proven by actually hitting it.
 *
 * Uses `node:http` directly, NOT the global `fetch` — `tests/setup.ts`
 * (shared repo-wide test infra, out of S4's scope) unconditionally replaces
 * `global.fetch` with a stub that always resolves `{ data: [] }` to keep
 * unit tests offline. That stub is correct for every OTHER test in this
 * repo; this file is the one deliberate exception that needs a REAL socket,
 * so it goes around it via Node's own HTTP client instead of asking to
 * change shared test infra for one file.
 *
 * Gated behind `RUN_TERESA_LIVE_TESTS=1` because it requires:
 *   - a server on `TERESA_LIVE_SERVER_URL` (default http://localhost:42210)
 *     started with `NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false
 *     ENABLE_TEST_AUTH_BYPASS=true METHOD_CORE_DEMO_BYPASS_PACK_READINESS=true`
 *     — see the S4 report for the exact command; `RUN_DB_TESTS=1
 *     MOCK_DB=false` is NOT optional under `NODE_ENV=test` — omitting it
 *     silently skips the entire DB-init sequence
 *     (server/src/startup/testModeGates.ts `shouldInitializeTestDatabase`)
 *     and `/api/ready` never leaves `not_ready`, forever, with no error.
 *   - `postgresql://t:t@localhost:55495/t_test` seeded with org
 *     `test-org-id`, user `test-user-id`, pack `drd@2.0.0-methodpack.1`.
 * Skipped (not failed) otherwise, so the rest of the suite stays green
 * without a live server — this file is opted into explicitly rather than
 * silently attempted.
 */
import * as http from 'node:http';

import { beforeAll, describe, expect, it } from 'vitest';

const BASE_URL = process.env.TERESA_LIVE_SERVER_URL || 'http://localhost:42210';
const LIVE = process.env.RUN_TERESA_LIVE_TESTS === '1';
const API = `${BASE_URL}/api/method`;

interface RawResponse {
  status: number;
  body: any;
}

function request(
  method: string,
  url: string,
  body?: unknown,
  extraHeaders: Record<string, string> = {}
): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = body !== undefined ? JSON.stringify(body) : undefined;
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: `${u.pathname}${u.search}`,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...extraHeaders,
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          let parsed: any = {};
          try {
            parsed = raw ? JSON.parse(raw) : {};
          } catch {
            parsed = { raw };
          }
          resolve({ status: res.statusCode ?? 0, body: parsed });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function idem(): string {
  return `live-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function createSession(): Promise<{ id: string }> {
  const res = await request('POST', `${API}/sessions`, {
    module: 'assessment',
    methodPackId: 'drd',
    methodPackVersion: '2.0.0-methodpack.1',
    mode: 'guided_manual',
    demoBypass: true,
  }, { 'Idempotency-Key': idem() });
  if (res.status !== 201 && res.status !== 200) {
    throw new Error(`createSession failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.session;
}

function previewPayload(overrides: Record<string, unknown> = {}) {
  return {
    capabilityId: 'draft_score_proposal',
    unitId: 'unit-1a',
    level: 3,
    invokedBy: 'local_action',
    statements: [
      { kind: 'respondent_declaration', text: 'Proces jest opisany i używany.', sourceRefs: [] },
      { kind: 'missing_evidence', text: 'Brak dowodu na regularny przegląd.', sourceRefs: [] },
      { kind: 'proposal', text: 'Proponowany poziom: 3.', sourceRefs: [] },
    ],
    proposedChanges: [{ target: 'score_proposal', targetId: 'unit-1a', before: 2, after: 3 }],
    quality: { verdict: 'valid', failedChecks: [] },
    ...overrides,
  };
}

describe.skipIf(!LIVE)('Teresa Intent -> Preview -> Commit — live HTTP contract cycle', () => {
  let sessionId: string;

  beforeAll(async () => {
    const ready = await request('GET', `${BASE_URL}/api/ready`);
    if (ready.body.status !== 'ready') {
      throw new Error(`Server at ${BASE_URL} is not ready: ${JSON.stringify(ready.body)} — see file header for the startup command.`);
    }
    const session = await createSession();
    sessionId = session.id;
  }, 30000);

  it('test 1 — preview returns a diff with a concrete unitId#level cell', async () => {
    const res = await request('POST', `${API}/sessions/${sessionId}/teresa/preview`, previewPayload());
    expect(res.status).toBe(201);
    const { preview } = res.body;
    expect(preview.previewId).toBeTruthy();
    expect(preview.intent.unitId).toBe('unit-1a');
    expect(preview.intent.level).toBe(3);
    expect(preview.proposedChanges[0]).toMatchObject({ target: 'score_proposal', targetId: 'unit-1a', after: 3 });
  });

  it('test 2 — commit without previewId is refused by the server (type AND runtime)', async () => {
    const res = await request(
      'POST',
      `${API}/sessions/${sessionId}/teresa/commit`,
      { decision: 'accept' }, // no previewId
      { 'Idempotency-Key': idem() }
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/previewId is required/);
  });

  it('test 3 — commit of an EXPIRED preview is rejected', async () => {
    const previewRes = await request(
      'POST',
      `${API}/sessions/${sessionId}/teresa/preview`,
      previewPayload({ ttlMs: 1 })
    );
    const { preview } = previewRes.body;
    await new Promise((r) => setTimeout(r, 50));
    const commitRes = await request(
      'POST',
      `${API}/sessions/${sessionId}/teresa/commit`,
      { previewId: preview.previewId, decision: 'accept' },
      { 'Idempotency-Key': idem() }
    );
    expect(commitRes.status).toBe(409);
    expect(commitRes.body.error).toBe('preview_expired');
  });

  it('test 4 — committing the SAME preview twice: second commit is refused', async () => {
    const previewRes = await request('POST', `${API}/sessions/${sessionId}/teresa/preview`, previewPayload());
    const { preview } = previewRes.body;

    const first = await request(
      'POST',
      `${API}/sessions/${sessionId}/teresa/commit`,
      { previewId: preview.previewId, decision: 'accept' },
      { 'Idempotency-Key': idem() }
    );
    expect(first.status).toBe(200);

    const second = await request(
      'POST',
      `${API}/sessions/${sessionId}/teresa/commit`,
      { previewId: preview.previewId, decision: 'accept' },
      { 'Idempotency-Key': idem() }
    );
    expect(second.status).toBe(409);
    expect(second.body.error).toBe('preview_already_consumed');
  });

  it('test 5 — a preview with quality.verdict=invalid is refused at commit', async () => {
    const previewRes = await request(
      'POST',
      `${API}/sessions/${sessionId}/teresa/preview`,
      previewPayload({ quality: { verdict: 'invalid', failedChecks: ['no_unsupported_claim'] } })
    );
    const { preview } = previewRes.body;
    const commitRes = await request(
      'POST',
      `${API}/sessions/${sessionId}/teresa/commit`,
      { previewId: preview.previewId, decision: 'accept' },
      { 'Idempotency-Key': idem() }
    );
    expect(commitRes.status).toBe(422);
    expect(commitRes.body.error).toBe('quality_invalid');
  });

  it('test 11 — the TERESA_PROPOSAL_CREATED event carries actorKind="teresa" and actorUserId of the calling human', async () => {
    const previewRes = await request('POST', `${API}/sessions/${sessionId}/teresa/preview`, previewPayload());
    const { preview } = previewRes.body;

    const eventsRes = await request('GET', `${API}/sessions/${sessionId}/events`);
    const events: any[] = eventsRes.body.events;
    const created = events.find(
      (e) => e.type === 'TERESA_PROPOSAL_CREATED' && e.payload?.previewRef === preview.previewId
    );
    expect(created).toBeDefined();
    expect(created.actorKind).toBe('teresa');
    // the test-auth-bypass identity IS the calling human in this harness.
    expect(created.actorUserId).toBe('test-user-id');
  });

  it('negative — the server independently rejects a forbidden-effect capabilityId (not just the client)', async () => {
    const res = await request(
      'POST',
      `${API}/sessions/${sessionId}/teresa/preview`,
      previewPayload({ capabilityId: 'approve_score' })
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/closed TERESA_CAPABILITIES set/);
  });

  it('negative — accepting a draft_score_proposal preview never itself changes session state (no hidden approve_score)', async () => {
    const before = await request('GET', `${API}/sessions/${sessionId}`);
    const previewRes = await request('POST', `${API}/sessions/${sessionId}/teresa/preview`, previewPayload());
    const { preview } = previewRes.body;
    const commitRes = await request(
      'POST',
      `${API}/sessions/${sessionId}/teresa/commit`,
      { previewId: preview.previewId, decision: 'accept' },
      { 'Idempotency-Key': idem() }
    );
    expect(commitRes.status).toBe(200);
    const after = await request('GET', `${API}/sessions/${sessionId}`);
    // Same state, version only advances if something ELSE (a human, via
    // /events or /transition) writes — Teresa's own accept does not.
    expect(after.body.session.state).toBe(before.body.session.state);
    expect(after.body.session.version).toBe(before.body.session.version);
  });
});
