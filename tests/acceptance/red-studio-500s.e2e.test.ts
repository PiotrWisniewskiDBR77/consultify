/**
 * RED-STUDIO-500s — schema-500 sweep for the presentations / document-studio
 * (Word) rewir (ŁOWCA RED task, 2026-07-19).
 *
 * Scope: presentations.routes.ts, presentation-enterprise.routes.ts
 * (/api/presentations-v4), presentationStudio.routes.ts
 * (/api/presentation-studio), document-studio.routes.ts (/api/document-studio
 * — canonical Word/Document runtime; there is no separate excel- or sheet-
 * prefixed route file in this codebase — grep confirmed only
 * spreadsheetProcessor.ts (an AI processor, not a route) and no word/excel/
 * sheet router files exist).
 * Excluded per orchestrator instruction: deliverables*.routes.ts (swept
 * RED-E) and reportPdf.routes.ts (W3).
 *
 * Pattern: 1:1 with tests/acceptance/red-assess-500s.e2e.test.ts — REAL
 * router + REAL verifyToken (each router self-mounts `router.use(verifyToken)`
 * + `router.use(requireOrgAccess())` internally) + REAL local Postgres
 * (parity :5443). document-studio additionally replicates the Gateway-level
 * `highRiskSurfaceGuard(['upload','export','public_share'])` — a 403 BLOCKED
 * response from that guard is an acceptable/expected outcome (NOT a red
 * regression) for a TRIAL-scoped seed org without the TRIAL_*_ENABLED flags.
 *
 * LLM endpoints: real LLM calls are skipped. Where the route offers a
 * deterministic `useLlm:false` path (document-studio /plan, /generate,
 * /templates/plan) we exercise that. Where the route has no deterministic
 * bypass (presentations /generate/outline, /generate/deck; presentationStudio
 * preview/generate endpoints) we send a minimal/empty body so only the
 * pre-LLM validation/DB path is exercised — the 10s timeout in `tryReq`
 * guards against an actual hung outbound LLM call.
 *
 * IMPORTANT — deferred path resolution: fixture ids (DECK_ID,
 * DOC_ARTIFACT_ID, ...) are created in `beforeAll`, which runs AFTER vitest's
 * synchronous describe/it collection phase. Every path that references a
 * fixture id is therefore built with a `() => string` closure and resolved
 * INSIDE the `it()` callback (test-execution phase), never at collection
 * time — otherwise every such path would silently bake in an empty string.
 *
 * Seed prefix: odbior--redstu-- (reversible, cleaned in afterAll).
 */
import { appendFileSync, writeFileSync } from 'node:fs';

import express, { type Express } from 'express';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mintToken, requireLocalDbUrl } from './harness.js';
import { seed, SEED } from './seed.mjs';

const RANDOM_UUID = '00000000-0000-4000-8000-000000000000';
const PREFIX = 'odbior--redstu--';
const RESULTS_FILE = process.env.REDSTU_RESULTS_FILE || '/tmp/red-studio-results.log';
writeFileSync(RESULTS_FILE, '');
const evidence = (line: string) => appendFileSync(RESULTS_FILE, line + '\n');

/**
 * KNOWN RED — confirmed real 500s (parity pg18, 2026-07-19). All 3 are
 * OUT of migration-fix scope: none are Postgres schema errors (the whole
 * 205-endpoint sweep produced ZERO occurrences of 42703/42P01/23502/22P02/
 * 42883/42804 or "does not exist" — grep-verified against the raw evidence
 * log). Each is an unhandled application-code exception from missing
 * input validation / missing error-to-HTTP-status mapping on the LLM
 * generation routes, reached via an intentionally minimal `{}` body
 * (LLM call itself is never made — the throw happens in the pre-LLM
 * synchronous setup):
 *
 * 1. POST /api/presentations/generate/outline — `TypeError: setup.
 *    sourceArtifacts is not iterable` at presentationGeneratorService.ts
 *    generateDefaultOutline():355 — iterates `setup.sourceArtifacts`
 *    without checking it is an array first.
 * 2. POST /api/presentations/generate/deck — uncaught `ZodError` (missing
 *    `originRecordId`) propagates past the route's try/catch instead of
 *    being mapped to a 400.
 * 3. POST /api/presentation-studio/decks/:deckId/slides/:i/regenerate —
 *    `Error: Deck not found` thrown by regenerateSlide() (presentation
 *    GeneratorService.ts:1992) is a domain "not found" condition that
 *    should 404, but the route has no catch mapping it, so it falls
 *    through to Express's default 500 handler.
 *
 * See RAPORT RED in the handoff message for the full write-up. Code-level
 * fix (add validation / catch+404-map), not a SQL migration — do not
 * "fix" these here per orchestrator scope (schema-500 / migrations only).
 */
const KNOWN_RED: Record<string, { status: number | 'HANG'; messageIncludes?: string }> = {
  'POST /api/presentations/generate/outline': {
    status: 500,
    messageIncludes: 'setup.sourceArtifacts is not iterable',
  },
  'POST /api/presentations/generate/deck': {
    status: 500,
    messageIncludes: 'originRecordId',
  },
  'POST /api/presentation-studio/decks/00000000-0000-4000-8000-000000000000/slides/0/regenerate': {
    status: 500,
    messageIncludes: 'Deck not found',
  },
};

function assertNotRegressed(r: {
  label: string;
  status: number | 'HANG';
  body?: any;
  text?: string;
  error?: string;
}) {
  const known = KNOWN_RED[r.label];
  if (known) {
    expect(r.status, `${r.label} — expected pinned KNOWN RED status`).toBe(known.status);
    if (known.messageIncludes) {
      // 500s from routes with no JSON error middleware surface as raw HTML
      // (Express default error page with the stack trace) — supertest
      // leaves `body` as `{}` for a non-JSON response, so the real signal
      // is in `text`. Check both so this works whether the route returns
      // a JSON error envelope or falls through to the HTML default page.
      const msg = `${JSON.stringify(r.body || '')} ${r.text || ''}`;
      expect(msg, `${r.label} — KNOWN RED message drifted`).toContain(known.messageIncludes);
    }
    return;
  }
  expect(r.status, `${r.label} — NEW regression (not in KNOWN_RED)`).not.toBe('HANG');
  expect(
    typeof r.status === 'number' ? r.status : 999,
    `${r.label} — NEW regression (not in KNOWN_RED): ${JSON.stringify(r.body)}`
  ).toBeLessThan(500);
}

let token: string;
let deckApp: Express;
let entApp: Express;
let studioApp: Express;
let docApp: Express;

// Real fixtures created via the API itself (deterministic, non-LLM paths).
let DECK_ID = '';
let DOC_ARTIFACT_ID = '';
let SOURCE_PACK_ID = '';
let BRAND_VOICE_PROFILE_ID = '';
let AUDIENCE_PROFILE_ID = '';
let DOC_COMMENT_ID = '';
let DOC_APPROVAL_ID = '';
let DOC_SNAPSHOT_VERSION_ID = '';
let DOC_SHARE_LINK_ID = '';

const RESULTS: Array<{ label: string; status: number | 'HANG'; body?: any; text?: string; error?: string }> =
  [];

/** Try a request with a hard timeout so a hung import/handler doesn't block the sweep. */
async function tryReq(
  label: string,
  fn: () => Promise<{ status: number; body: any; text?: string }>
): Promise<{ label: string; status: number | 'HANG'; body?: any; text?: string; error?: string }> {
  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT_10s')), 10_000)
    );
    const res = await Promise.race([fn(), timeout]);
    const out = { label, status: res.status, body: res.body, text: res.text };
    const bodyStr = JSON.stringify(res.body);
    const preview = bodyStr && bodyStr !== '{}' ? bodyStr : String(res.text || '').slice(0, 500);
    evidence(`LIVE   ${String(out.status).padEnd(6)} ${label}  ${preview.slice(0, 600)}`);
    return out;
  } catch (e: any) {
    const isHang = String(e?.message).includes('TIMEOUT');
    const out = {
      label,
      status: 'HANG' as const,
      error: isHang ? 'router/handler did not respond in 10s' : String(e?.message || e),
    };
    evidence(`LIVE   HANG   ${label}  ${out.error}`);
    return out;
  }
}

beforeAll(async () => {
  await seed();
  token = mintToken();

  const { default: presentationsRouter } = await import(
    '../../server/src/routes/presentations.routes.js'
  );
  deckApp = express();
  deckApp.use(express.json({ limit: '5mb' }));
  deckApp.use('/api/presentations', presentationsRouter);

  const { default: presentationEnterpriseRouter } = await import(
    '../../server/src/routes/presentation-enterprise.routes.js'
  );
  entApp = express();
  entApp.use(express.json({ limit: '5mb' }));
  entApp.use('/api/presentations-v4', presentationEnterpriseRouter);

  const { default: presentationStudioRouter } = await import(
    '../../server/src/routes/presentationStudio.routes.js'
  );
  studioApp = express();
  studioApp.use(express.json({ limit: '5mb' }));
  studioApp.use('/api/presentation-studio', presentationStudioRouter);

  // document-studio — replicate the Gateway chain: verifyToken (so
  // highRiskSurfaceGuard sees req.user) -> highRiskSurfaceGuard -> router
  // (which ALSO self-mounts verifyToken internally, harmlessly redundant).
  const { verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
  const { highRiskSurfaceGuard } = await import(
    '../../server/src/middleware/highRiskSurfaceGuard.middleware.js'
  );
  const { default: documentStudioRouter } = await import(
    '../../server/src/routes/document-studio.routes.js'
  );
  docApp = express();
  docApp.use(express.json({ limit: '5mb' }));
  docApp.use(
    '/api/document-studio',
    verifyToken as any,
    highRiskSurfaceGuard({ categories: ['upload', 'export', 'public_share'] }),
    documentStudioRouter
  );

  // ---- Real-fixture seeding via the API (non-LLM deterministic paths) ----
  const deckRes = await request(deckApp)
    .post('/api/presentations/decks')
    .set('Authorization', `Bearer ${token}`)
    .send({
      title: `${PREFIX}Deck`,
      theme: 'modern',
      source: 'odbior_redstu',
      slides: [{ type: 'title', content: { heading: `${PREFIX}Deck`, subheading: 'RED-STUDIO' } }],
    });
  DECK_ID = deckRes.body?.data?.id || '';
  evidence(`[seed] deck create status=${deckRes.status} id=${DECK_ID}`);

  const docRes = await request(docApp)
    .post('/api/document-studio/generate')
    .set('Authorization', `Bearer ${token}`)
    .send({
      intake: { title: `${PREFIX}Doc`, description: 'RED-STUDIO harness document.' },
      useLlm: false,
    });
  DOC_ARTIFACT_ID = docRes.body?.artifactId || '';
  evidence(`[seed] document generate status=${docRes.status} id=${DOC_ARTIFACT_ID}`);

  if (DOC_ARTIFACT_ID) {
    const commentRes = await request(docApp)
      .post(`/api/document-studio/${DOC_ARTIFACT_ID}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ body: 'RED-STUDIO seed comment', anchor: { kind: 'document' } });
    DOC_COMMENT_ID = commentRes.body?.comment?.commentId || commentRes.body?.comment?.id || '';
    evidence(`[seed] comment create status=${commentRes.status} id=${DOC_COMMENT_ID}`);

    const approvalRes = await request(docApp)
      .post(`/api/document-studio/${DOC_ARTIFACT_ID}/approvals`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    DOC_APPROVAL_ID = approvalRes.body?.approval?.approvalId || approvalRes.body?.approval?.id || '';
    evidence(`[seed] approval create status=${approvalRes.status} id=${DOC_APPROVAL_ID}`);

    const snapshotRes = await request(docApp)
      .post(`/api/document-studio/${DOC_ARTIFACT_ID}/snapshots`)
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'RED-STUDIO seed snapshot' });
    DOC_SNAPSHOT_VERSION_ID =
      snapshotRes.body?.snapshot?.versionId || snapshotRes.body?.snapshot?.id || '';
    evidence(`[seed] snapshot create status=${snapshotRes.status} id=${DOC_SNAPSHOT_VERSION_ID}`);

    const shareLinkRes = await request(docApp)
      .post(`/api/document-studio/${DOC_ARTIFACT_ID}/share-links`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    DOC_SHARE_LINK_ID =
      shareLinkRes.body?.shareLink?.shareLinkId || shareLinkRes.body?.shareLink?.id || '';
    evidence(`[seed] share-link create status=${shareLinkRes.status} id=${DOC_SHARE_LINK_ID}`);
  }

  const sourcePackRes = await request(docApp)
    .post('/api/document-studio/source-packs')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `${PREFIX}SourcePack` });
  SOURCE_PACK_ID = sourcePackRes.body?.pack?.packId || sourcePackRes.body?.pack?.id || '';
  evidence(`[seed] source-pack create status=${sourcePackRes.status} id=${SOURCE_PACK_ID}`);

  const brandVoiceRes = await request(docApp)
    .post('/api/document-studio/brand-voice/profiles')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `${PREFIX}BrandVoice` });
  BRAND_VOICE_PROFILE_ID =
    brandVoiceRes.body?.profile?.profileId || brandVoiceRes.body?.profile?.id || '';
  evidence(`[seed] brand-voice create status=${brandVoiceRes.status} id=${BRAND_VOICE_PROFILE_ID}`);

  const audienceRes = await request(docApp)
    .post('/api/document-studio/audience-profiles')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `${PREFIX}Audience` });
  AUDIENCE_PROFILE_ID = audienceRes.body?.profile?.profileId || audienceRes.body?.profile?.id || '';
  evidence(`[seed] audience-profile create status=${audienceRes.status} id=${AUDIENCE_PROFILE_ID}`);
}, 90_000);

afterAll(async () => {
  evidence('===== RED-STUDIO-500 SUMMARY =====');
  const fail5xx = RESULTS.filter(
    (r) => r.status === 'HANG' || (typeof r.status === 'number' && r.status >= 500)
  );
  for (const r of RESULTS) {
    const bodyPreview =
      r.status !== 'HANG' && r.body ? JSON.stringify(r.body).slice(0, 300) : r.error || '';
    evidence(`${String(r.status).padEnd(6)} ${r.label}  ${bodyPreview}`);
  }
  evidence(`===== END SUMMARY: ${fail5xx.length} FAIL (5xx/HANG) of ${RESULTS.length} total =====`);

  const client = new pg.Client({ connectionString: requireLocalDbUrl() });
  await client.connect();
  try {
    if (DECK_ID) {
      await client
        .query('DELETE FROM presentation_deck_versions WHERE deck_id = $1', [DECK_ID])
        .catch(() => {});
      await client.query('DELETE FROM presentation_cards WHERE deck_id = $1', [DECK_ID]).catch(() => {});
      await client.query('DELETE FROM presentation_decks WHERE id = $1', [DECK_ID]).catch(() => {});
    }
    if (DOC_ARTIFACT_ID) {
      await client
        .query('DELETE FROM wave5_artifact_versions WHERE artifact_id = $1', [DOC_ARTIFACT_ID])
        .catch(() => {});
      await client
        .query('DELETE FROM wave5_artifacts WHERE artifact_id = $1', [DOC_ARTIFACT_ID])
        .catch(() => {});
    }
  } finally {
    await client.end();
  }
}, 30_000);

// ============================================================================
// Generic sweep helpers — path/body are closures resolved INSIDE the `it()`
// callback (test-execution phase), so they always see fixture ids populated
// by `beforeAll`. `label` is a static string (used only for the test name +
// KNOWN_RED lookup key) built with the SAME closure so it matches the actual
// resolved URL.
// ============================================================================
function sweepGet(describeLabel: string, app: () => Express, prefix: string, paths: Array<() => string>) {
  describe(describeLabel, () => {
    for (const pathFn of paths) {
      it(`GET ${prefix}${pathFn()}`, async () => {
        const p = pathFn();
        const label = `GET ${prefix}${p}`;
        const r = await tryReq(label, () =>
          request(app()).get(`${prefix}${p}`).set('Authorization', `Bearer ${token}`)
        );
        RESULTS.push(r);
        assertNotRegressed(r);
      }, 20_000);
    }
  });
}

type MutateEntry = { method: 'post' | 'put' | 'patch' | 'delete'; path: () => string; body?: () => any };

function sweepMutate(describeLabel: string, app: () => Express, prefix: string, entries: MutateEntry[]) {
  describe(describeLabel, () => {
    for (const e of entries) {
      it(`${e.method.toUpperCase()} ${prefix}${e.path()}`, async () => {
        const p = e.path();
        const body = e.body ? e.body() : {};
        const label = `${e.method.toUpperCase()} ${prefix}${p}`;
        const r = await tryReq(label, () =>
          (request(app()) as any)[e.method](`${prefix}${p}`).set('Authorization', `Bearer ${token}`).send(body)
        );
        RESULTS.push(r);
        assertNotRegressed(r);
      }, 20_000);
    }
  });
}

// ============================================================================
// 0. fixture sanity
// ============================================================================
describe('RED-STUDIO: fixtures sane', () => {
  it('DECK_ID and DOC_ARTIFACT_ID were created', () => {
    expect(DECK_ID, 'deck fixture create failed in beforeAll').toBeTruthy();
    expect(DOC_ARTIFACT_ID, 'document fixture create failed in beforeAll').toBeTruthy();
  });
});

// ============================================================================
// 1. presentations.routes.ts — GET sweep
// ============================================================================
sweepGet('RED-STUDIO: presentations GET /api/presentations', () => deckApp, '/api/presentations', [
  () => `/shared/${RANDOM_UUID}`,
  () => '/governance/subscriber/dashboard',
  () => '/templates',
  () => `/templates/${RANDOM_UUID}`,
  () => `/templates/${RANDOM_UUID}/governance`,
  () => '/templates/governance/by-state/draft',
  () => `/templates/${RANDOM_UUID}/governance/lineage`,
  () => '/brand-kit',
  () => '/decks',
  () => `/decks/${DECK_ID}`,
  () => `/decks/${DECK_ID}/download`,
  () => `/decks/${DECK_ID}/export/pdf`,
  () => `/decks/${DECK_ID}/collaborators`,
  () => `/decks/${DECK_ID}/comments`,
  () => '/intents',
  () => `/decks/${DECK_ID}/export-parity`,
  () => `/decks/${DECK_ID}/governance-card`,
  () => '/governance/watchlist',
  () => '/operations/health',
  () => '/operations/health/export',
  () => `/operations/health/slo/${RANDOM_UUID}/drilldown`,
  () => '/benchmark/trend',
  () => '/governance/watchlist-presets',
  () => '/governance/watchlist/saved-searches',
  () => '/governance/alert-subscriptions',
  () => `/governance/alert-subscriptions/${RANDOM_UUID}/dashboard-tokens`,
  () => '/governance/alerts/recent',
  () => `/decks/${DECK_ID}/audit-log`,
  () => '/operations/audit-integrity',
  () => `/decks/${DECK_ID}/agent-history`,
  () => `/decks/${DECK_ID}/runtime-events/summary`,
  () => `/decks/${DECK_ID}/runtime-events`,
  () => '/media',
  () => `/decks/${DECK_ID}/analytics`,
  () => `/decks/${DECK_ID}/versions`,
  () => '/style-profile',
  () => '/benchmark/history',
]);

// ============================================================================
// 2. presentations.routes.ts — mutation sweep
// ============================================================================
sweepMutate('RED-STUDIO: presentations mutations /api/presentations', () => deckApp, '/api/presentations', [
  { method: 'post', path: () => `/templates/${RANDOM_UUID}/clone`, body: () => ({ title: 'x' }) },
  { method: 'put', path: () => `/templates/${RANDOM_UUID}`, body: () => ({ name: 'x' }) },
  {
    method: 'post',
    path: () => `/templates/${RANDOM_UUID}/governance/transition`,
    body: () => ({ toState: 'review' }),
  },
  { method: 'post', path: () => `/templates/${RANDOM_UUID}/governance/deprecate` },
  { method: 'put', path: () => '/brand-kit' },
  { method: 'post', path: () => '/generate/outline' },
  { method: 'post', path: () => '/generate/deck' },
  { method: 'delete', path: () => `/decks/${RANDOM_UUID}` },
  { method: 'post', path: () => `/decks/${DECK_ID}/share` },
  { method: 'delete', path: () => `/decks/${DECK_ID}/share` },
  {
    method: 'post',
    path: () => `/decks/${DECK_ID}/collaborators`,
    body: () => ({ email: 'nobody@example.com' }),
  },
  { method: 'delete', path: () => `/decks/${DECK_ID}/collaborators/${RANDOM_UUID}` },
  { method: 'post', path: () => `/decks/${DECK_ID}/comments`, body: () => ({ text: 'hi' }) },
  { method: 'patch', path: () => `/decks/${DECK_ID}/comments/${RANDOM_UUID}`, body: () => ({ text: 'x' }) },
  { method: 'delete', path: () => `/decks/${DECK_ID}/comments/${RANDOM_UUID}` },
  { method: 'post', path: () => `/decks/${DECK_ID}/export/html` },
  { method: 'post', path: () => `/decks/${DECK_ID}/cards/${RANDOM_UUID}/blocks/${RANDOM_UUID}/refresh` },
  { method: 'put', path: () => `/decks/${DECK_ID}/autosave`, body: () => ({ cards: [] }) },
  { method: 'post', path: () => `/decks/${DECK_ID}/agent-edit`, body: () => ({ instruction: 'test' }) },
  { method: 'post', path: () => `/decks/${DECK_ID}/agent-edit/${RANDOM_UUID}/accept` },
  { method: 'post', path: () => `/decks/${DECK_ID}/agent-edit/${RANDOM_UUID}/reject` },
  { method: 'post', path: () => '/governance/watchlist-presets', body: () => ({ name: 'x', filters: {} }) },
  { method: 'delete', path: () => `/governance/watchlist-presets/${RANDOM_UUID}` },
  {
    method: 'post',
    path: () => '/governance/watchlist/saved-searches',
    body: () => ({ name: 'x', query: {} }),
  },
  { method: 'delete', path: () => `/governance/watchlist/saved-searches/${RANDOM_UUID}` },
  { method: 'post', path: () => `/governance/watchlist/saved-searches/${RANDOM_UUID}/mark-used` },
  {
    method: 'post',
    path: () => '/governance/alert-subscriptions',
    body: () => ({ name: 'x', channel: 'email' }),
  },
  { method: 'delete', path: () => `/governance/alert-subscriptions/${RANDOM_UUID}` },
  { method: 'post', path: () => `/governance/alert-subscriptions/${RANDOM_UUID}/rotate-secret` },
  { method: 'post', path: () => `/governance/alert-subscriptions/${RANDOM_UUID}/test-delivery` },
  { method: 'post', path: () => `/governance/alert-subscriptions/${RANDOM_UUID}/dashboard-tokens` },
  {
    method: 'post',
    path: () => `/governance/alert-subscriptions/${RANDOM_UUID}/dashboard-tokens/${RANDOM_UUID}/revoke`,
  },
  { method: 'post', path: () => '/governance/alerts/playground/dispatch' },
  { method: 'post', path: () => '/governance/alerts/playground/inbox' },
  { method: 'post', path: () => '/governance/alerts/test' },
  { method: 'post', path: () => `/decks/${DECK_ID}/agent-history/${RANDOM_UUID}/revert` },
  { method: 'post', path: () => `/decks/${DECK_ID}/agent-history/bulk-revert`, body: () => ({ operationIds: [] }) },
  { method: 'post', path: () => `/decks/${DECK_ID}/quality-gates` },
  { method: 'post', path: () => `/decks/${DECK_ID}/export/png` },
  { method: 'post', path: () => `/decks/${DECK_ID}/analytics/view` },
  { method: 'post', path: () => `/decks/${DECK_ID}/versions/${RANDOM_UUID}/restore` },
]);

// ============================================================================
// 3. presentation-enterprise.routes.ts — /api/presentations-v4
// ============================================================================
sweepGet(
  'RED-STUDIO: presentation-enterprise GET /api/presentations-v4',
  () => entApp,
  '/api/presentations-v4',
  [
    () => `/decks/${DECK_ID}/bindings`,
    () => '/layout-rules',
    () => `/decks/${DECK_ID}/export-qa`,
    () => '/template-governance',
    () => '/pptx-imports',
    () => `/decks/${DECK_ID}/collab/active`,
    () => '/media',
  ]
);

sweepMutate(
  'RED-STUDIO: presentation-enterprise mutations /api/presentations-v4',
  () => entApp,
  '/api/presentations-v4',
  [
    { method: 'post', path: () => `/decks/${DECK_ID}/bindings`, body: () => ({ slideIndex: 0 }) },
    { method: 'post', path: () => `/bindings/${RANDOM_UUID}/refresh` },
    { method: 'post', path: () => `/bindings/${RANDOM_UUID}/approve` },
    { method: 'post', path: () => '/layout-rules', body: () => ({ name: 'x', rule: {} }) },
    { method: 'post', path: () => `/decks/${DECK_ID}/export-qa` },
    { method: 'post', path: () => '/template-governance', body: () => ({ name: 'x' }) },
    { method: 'post', path: () => `/template-governance/${RANDOM_UUID}/publish` },
    { method: 'post', path: () => '/pptx-imports', body: () => ({ fileName: 'x.pptx' }) },
    { method: 'patch', path: () => `/pptx-imports/${RANDOM_UUID}` },
    { method: 'post', path: () => `/decks/${DECK_ID}/collab/join` },
    { method: 'post', path: () => `/collab/${RANDOM_UUID}/presence` },
    { method: 'post', path: () => `/collab/${RANDOM_UUID}/leave` },
    { method: 'post', path: () => '/media' },
    { method: 'post', path: () => `/media/${RANDOM_UUID}/watermark` },
    { method: 'post', path: () => `/media/${RANDOM_UUID}/usage` },
  ]
);

// ============================================================================
// 4. presentationStudio.routes.ts — /api/presentation-studio
// ============================================================================
sweepGet(
  'RED-STUDIO: presentationStudio GET /api/presentation-studio',
  () => studioApp,
  '/api/presentation-studio',
  [() => '/source-artifacts', () => '/admin/layout-capacity']
);

sweepMutate(
  'RED-STUDIO: presentationStudio mutations /api/presentation-studio (LLM — pre-LLM validation only)',
  () => studioApp,
  '/api/presentation-studio',
  [
    { method: 'post', path: () => '/source-pack/preview' },
    { method: 'post', path: () => '/narrative-plan/preview' },
    { method: 'post', path: () => '/template-architect/preview' },
    { method: 'post', path: () => '/generate/preview' },
    { method: 'post', path: () => '/generate/request-approval' },
    { method: 'post', path: () => '/generate' },
    { method: 'post', path: () => '/admin/layout-capacity/propose' },
    { method: 'post', path: () => '/admin/layout-capacity/execute' },
    { method: 'post', path: () => '/admin/layout-capacity/reset/propose' },
    { method: 'post', path: () => '/admin/layout-capacity/reset/execute' },
    { method: 'post', path: () => `/decks/${RANDOM_UUID}/slides/0/regenerate` },
  ]
);

// ============================================================================
// 5. document-studio.routes.ts — /api/document-studio (WORD)
// ============================================================================
sweepGet(
  'RED-STUDIO: document-studio GET /api/document-studio',
  () => docApp,
  '/api/document-studio',
  [
    () => '/templates',
    () => `/templates/${RANDOM_UUID}`,
    () => `/templates/${RANDOM_UUID}/audit`,
    () => '/source-packs',
    () => `/source-packs/${SOURCE_PACK_ID}`,
    () => `/source-packs/${SOURCE_PACK_ID}/audit`,
    () => '/brand-voice/active',
    () => '/brand-voice/profiles',
    () => `/brand-voice/profiles/${BRAND_VOICE_PROFILE_ID}`,
    () => `/brand-voice/profiles/${BRAND_VOICE_PROFILE_ID}/audit`,
    () => '/audience-profiles',
    () => `/audience-profiles/${AUDIENCE_PROFILE_ID}`,
    () => `/audience-profiles/${AUDIENCE_PROFILE_ID}/audit`,
    () => '/content-blocks',
    () => `/content-blocks/${RANDOM_UUID}`,
    () => `/content-blocks/${RANDOM_UUID}/audit`,
    () => `/${DOC_ARTIFACT_ID}/approvals`,
    () => `/${DOC_ARTIFACT_ID}/approvals/active`,
    () => `/${DOC_ARTIFACT_ID}/approvals/${DOC_APPROVAL_ID}`,
    () => `/${DOC_ARTIFACT_ID}/approvals/${DOC_APPROVAL_ID}/audit`,
    () => `/${DOC_ARTIFACT_ID}/lifecycle`,
    () => `/${DOC_ARTIFACT_ID}/snapshots`,
    () => `/${DOC_ARTIFACT_ID}/snapshots/${DOC_SNAPSHOT_VERSION_ID}`,
    () => `/${DOC_ARTIFACT_ID}/diff?from=1&to=1`,
    () => `/${DOC_ARTIFACT_ID}/comments/threads`,
    () => `/${DOC_ARTIFACT_ID}/comments/counts`,
    () => `/${DOC_ARTIFACT_ID}/comments`,
    () => `/${DOC_ARTIFACT_ID}/comments/${DOC_COMMENT_ID}`,
    () => `/${DOC_ARTIFACT_ID}/variants`,
    () => `/${DOC_ARTIFACT_ID}/variants/${RANDOM_UUID}`,
    () => '/policy',
    () => `/${DOC_ARTIFACT_ID}`,
    () => `/${DOC_ARTIFACT_ID}/export/pdf`,
    () => `/${DOC_ARTIFACT_ID}/editor/audit`,
    () => `/${DOC_ARTIFACT_ID}/access-history`,
    () => `/${DOC_ARTIFACT_ID}/qa`,
    () => '/assets/logo/active',
    () => '/assets',
    () => `/assets/${RANDOM_UUID}`,
    () => `/assets/${RANDOM_UUID}/audit`,
    () => `/${DOC_ARTIFACT_ID}/share-links`,
    () => `/share-links/${DOC_SHARE_LINK_ID}`,
    () => `/share-links/${DOC_SHARE_LINK_ID}/audit`,
  ]
);

sweepMutate(
  'RED-STUDIO: document-studio mutations /api/document-studio',
  () => docApp,
  '/api/document-studio',
  [
    { method: 'post', path: () => '/plan', body: () => ({ intake: { title: 'x', description: 'y' } }) },
    {
      method: 'post',
      path: () => '/generate',
      body: () => ({ intake: { title: `${PREFIX}Doc2`, description: 'y' }, useLlm: false }),
    },
    { method: 'post', path: () => '/generate/stream' },
    { method: 'post', path: () => '/templates/plan', body: () => ({ input: { purpose: 'x' } }) },
    { method: 'post', path: () => `/templates/${RANDOM_UUID}/approve` },
    { method: 'post', path: () => `/templates/${RANDOM_UUID}/deprecate` },
    { method: 'post', path: () => `/templates/${RANDOM_UUID}/usage` },
    { method: 'post', path: () => `/templates/${RANDOM_UUID}/feedback`, body: () => ({ rating: 5 }) },
    {
      method: 'post',
      path: () => `/source-packs/${SOURCE_PACK_ID}/items`,
      body: () => ({ kind: 'text', title: 'x', content: 'y' }),
    },
    { method: 'delete', path: () => `/source-packs/${SOURCE_PACK_ID}/items/${RANDOM_UUID}` },
    { method: 'post', path: () => `/source-packs/${SOURCE_PACK_ID}/ready` },
    { method: 'post', path: () => `/source-packs/${SOURCE_PACK_ID}/archive` },
    { method: 'post', path: () => `/source-packs/${SOURCE_PACK_ID}/attach`, body: () => ({ artifactId: DOC_ARTIFACT_ID }) },
    { method: 'patch', path: () => `/brand-voice/profiles/${BRAND_VOICE_PROFILE_ID}`, body: () => ({ notes: 'x' }) },
    { method: 'post', path: () => `/brand-voice/profiles/${BRAND_VOICE_PROFILE_ID}/activate` },
    { method: 'post', path: () => `/brand-voice/profiles/${BRAND_VOICE_PROFILE_ID}/archive` },
    { method: 'patch', path: () => `/audience-profiles/${AUDIENCE_PROFILE_ID}`, body: () => ({ notes: 'x' }) },
    { method: 'post', path: () => `/audience-profiles/${AUDIENCE_PROFILE_ID}/activate` },
    { method: 'post', path: () => `/audience-profiles/${AUDIENCE_PROFILE_ID}/archive` },
    { method: 'post', path: () => '/content-blocks' },
    { method: 'patch', path: () => `/content-blocks/${RANDOM_UUID}`, body: () => ({ notes: 'x' }) },
    { method: 'post', path: () => `/content-blocks/${RANDOM_UUID}/activate` },
    { method: 'post', path: () => `/content-blocks/${RANDOM_UUID}/archive` },
    { method: 'post', path: () => `/content-blocks/${RANDOM_UUID}/instantiate` },
    { method: 'post', path: () => `/${DOC_ARTIFACT_ID}/content-blocks/${RANDOM_UUID}/insert` },
    {
      method: 'post',
      path: () => `/${DOC_ARTIFACT_ID}/approvals/${DOC_APPROVAL_ID}/decisions`,
      body: () => ({ kind: 'approve' }),
    },
    { method: 'post', path: () => `/${DOC_ARTIFACT_ID}/approvals/${RANDOM_UUID}/cancel` },
    { method: 'post', path: () => `/${DOC_ARTIFACT_ID}/status`, body: () => ({ status: 'in_review' }) },
    { method: 'post', path: () => `/${DOC_ARTIFACT_ID}/snapshots/${DOC_SNAPSHOT_VERSION_ID}/rollback` },
    { method: 'post', path: () => `/${DOC_ARTIFACT_ID}/comments/${DOC_COMMENT_ID}/reply`, body: () => ({ body: 'reply' }) },
    { method: 'post', path: () => `/${DOC_ARTIFACT_ID}/comments/${DOC_COMMENT_ID}/resolve` },
    { method: 'post', path: () => `/${DOC_ARTIFACT_ID}/comments/${DOC_COMMENT_ID}/reopen` },
    { method: 'delete', path: () => `/${DOC_ARTIFACT_ID}/comments/${RANDOM_UUID}` },
    { method: 'post', path: () => `/${DOC_ARTIFACT_ID}/editor/proposals/local` },
    { method: 'put', path: () => `/${DOC_ARTIFACT_ID}/content`, body: () => ({ sections: [], expectedVersion: 1 }) },
    { method: 'post', path: () => `/${DOC_ARTIFACT_ID}/editor/proposals/section` },
    { method: 'post', path: () => `/${DOC_ARTIFACT_ID}/editor/proposals/global` },
    { method: 'post', path: () => `/${DOC_ARTIFACT_ID}/editor/proposals/methodology` },
    { method: 'post', path: () => `/${DOC_ARTIFACT_ID}/editor/proposals/source` },
    { method: 'post', path: () => `/${DOC_ARTIFACT_ID}/editor/proposals/transformative` },
    { method: 'post', path: () => `/${DOC_ARTIFACT_ID}/editor/proposals/${RANDOM_UUID}/approve` },
    { method: 'post', path: () => `/${DOC_ARTIFACT_ID}/editor/proposals/${RANDOM_UUID}/reject` },
    { method: 'post', path: () => '/assets/logo' },
    { method: 'post', path: () => '/assets/logo/upload' },
    { method: 'post', path: () => `/assets/${RANDOM_UUID}/archive` },
    { method: 'post', path: () => `/${DOC_ARTIFACT_ID}/share-links` },
    { method: 'post', path: () => `/share-links/${DOC_SHARE_LINK_ID}/revoke` },
    { method: 'post', path: () => `/share-links/${DOC_SHARE_LINK_ID}/rotate` },
  ]
);
