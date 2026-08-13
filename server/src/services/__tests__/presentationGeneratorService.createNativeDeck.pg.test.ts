/**
 * presentationGeneratorService.createNativeDeck — persist-honesty proof,
 * against a REAL PostgreSQL (Case Workspace V1, packet E6).
 *
 * ===========================================================================
 * THE DEFECT (found and documented by an earlier packet, fixed here)
 * ===========================================================================
 * `createNativeDeck`'s `INSERT INTO presentation_decks` ran through the
 * module-local `dbRun` with NO `{ fallback: false }` override. `DbPromise.run`'s
 * documented default is `fallback = true`, which means a genuine SQL error on
 * that INSERT resolves `{ success: false, error }` instead of rejecting — and
 * `createNativeDeck` never inspected that return value before proceeding to
 * register an unrelated artifact-registry row and returning a normal-looking
 * `{ deckId, deck, slideCount, registryArtifactId }` for a deck that was NEVER
 * WRITTEN. Documented in full in
 * `../caseWorkspace/adapters/documentsAdapter.ts`'s file header (that
 * adapter's own post-create readback was, until this fix, the ONLY defense
 * against this defect for callers outside a pinned transaction).
 *
 * This suite drives the REAL `createNativeDeck` directly (no adapter, no
 * capability plumbing) so the fix is proved at its source, not only through
 * one caller's external guard.
 *
 * ===========================================================================
 * HOW TO RUN
 * ===========================================================================
 *   cd server && DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   POSTGRES_SKIP_INIT_IN_TEST=1 \
 *   DATABASE_URL="postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_test" \
 *   npx vitest run src/services/__tests__/presentationGeneratorService.createNativeDeck.pg.test.ts \
 *   --environment node
 *
 * ===========================================================================
 * WHAT EACH TEST PROVES
 * ===========================================================================
 *   1. [negative control] A real Postgres CHECK-constraint violation
 *      (`presentation_decks.status` is
 *      `CHECK (status IN ('draft','generating','ready','exported','failed'))`,
 *      migration `750_presentation_decks_00base.sql`) is driven through the
 *      REAL `createNativeDeck` by supplying an out-of-range `status`. Before
 *      the fix this resolved normally (phantom success, zero rows written).
 *      After the fix it must reject, and zero rows must exist.
 *   2. [happy path] A normal call persists a real row, and the row's
 *      `deck_json` / `unified_json` — read back from the database, not the
 *      in-memory return value — contain the exact distinctive title/content
 *      text this test supplied. Guards against this program's documented
 *      "deck marked ready with zero bytes of content" history.
 */

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createNativeDeck } from '../presentationGeneratorService.js';
import type { UnifiedReportJSON } from '../report/pptx/types.js';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

async function canReachWithSchema(connectionString: string): Promise<boolean> {
  const probe = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 3000 });
  try {
    const orgs = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'organizations'
          AND column_name IN ('id', 'name')`
    );
    const decks = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'presentation_decks'
          AND column_name IN ('id', 'organization_id', 'title', 'status', 'deck_json', 'unified_json')`
    );
    return Number(orgs.rows[0]?.present ?? 0) === 2 && Number(decks.rows[0]?.present ?? 0) === 6;
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

const REACHABLE = REAL_DB_REQUESTED ? await canReachWithSchema(CONNECTION_STRING) : false;

if (!REACHABLE) {
  // eslint-disable-next-line no-console
  console.warn(
    `[presentationGeneratorService.createNativeDeck pg suite SKIPPED — clean skip, not a failure] ` +
      `needs DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false, a reachable DATABASE_URL, ` +
      `and the organizations + presentation_decks schema applied. ` +
      `requested=${REAL_DB_REQUESTED} reachable=${REACHABLE}`
  );
}

const suite = REACHABLE ? describe.sequential : describe.skip;

let control: Pool;
const seededOrgIds: string[] = [];

async function seedOrg(label: string): Promise<string> {
  const orgId = `cwtest-e6-deck-${label}-${randomUUID()}`;
  await control.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
    orgId,
    `E6 createNativeDeck test org (${label})`,
  ]);
  seededOrgIds.push(orgId);
  return orgId;
}

async function deckRowsForOrg(orgId: string): Promise<any[]> {
  const result = await control.query(
    `SELECT id, organization_id, status, deck_json, unified_json, slide_count
       FROM presentation_decks WHERE organization_id = $1`,
    [orgId]
  );
  return result.rows;
}

async function cleanupOrg(orgId: string): Promise<void> {
  await control
    .query(`DELETE FROM presentation_cards WHERE deck_id IN (SELECT id FROM presentation_decks WHERE organization_id = $1)`, [
      orgId,
    ])
    .catch(() => undefined);
  await control.query(`DELETE FROM presentation_decks WHERE organization_id = $1`, [orgId]).catch(() => undefined);
  await control.query(`DELETE FROM organization_members WHERE organization_id = $1`, [orgId]).catch(() => undefined);
  await control.query(`DELETE FROM users WHERE organization_id = $1`, [orgId]).catch(() => undefined);
  await control.query(`DELETE FROM organizations WHERE id = $1`, [orgId]).catch(() => undefined);
}

function buildUnifiedJson(marker: string): UnifiedReportJSON {
  return {
    meta: {
      client: `E6 client ${marker}`,
      project: `E6 project ${marker}`,
      date: new Date().toISOString(),
      author: 'e6-test-actor',
      confidentiality: 'confidential',
      language: 'en',
      template: 'corporate',
    },
    slides: [
      {
        intent: 'cover',
        key_message: `E6 cover key message ${marker}`,
        content: {
          type: 'cover',
          title: `E6 Persist Proof Title ${marker}`,
          subtitle: `E6 distinctive subtitle marker ${marker}`,
          organization: `E6 org ${marker}`,
          date: new Date().toISOString(),
          confidentiality: 'confidential',
        },
      },
    ],
  } as UnifiedReportJSON;
}

suite('presentationGeneratorService.createNativeDeck — real Postgres persist honesty', () => {
  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
  }, 30_000);

  afterAll(async () => {
    await control?.end().catch(() => undefined);
  });

  afterEach(async () => {
    while (seededOrgIds.length > 0) {
      const orgId = seededOrgIds.pop()!;
      await cleanupOrg(orgId);
    }
  });

  it(
    '[negative control] surfaces a failure instead of a false success when the real INSERT violates the status CHECK constraint',
    async () => {
      const orgId = await seedOrg('negctrl');
      const marker = randomUUID();
      const nowIso = new Date().toISOString();

      let thrown: unknown = null;
      try {
        await createNativeDeck({
          organizationId: orgId,
          title: `E6 negative control ${marker}`,
          unifiedJson: buildUnifiedJson(marker),
          sourceType: 'test',
          sourceId: 'e6-negctrl',
          createdBy: 'e6-test-actor',
          createdAt: nowIso,
          // Not a member of presentation_decks' own
          // CHECK (status IN ('draft','generating','ready','exported','failed')).
          status: 'definitely_not_a_real_status' as unknown as 'ready',
          registerArtifact: false,
        });
      } catch (error) {
        thrown = error;
      }

      // MUST throw — a phantom success (no throw, but zero rows) is exactly
      // the pre-fix defect this test exists to catch.
      expect(thrown).not.toBeNull();

      const rows = await deckRowsForOrg(orgId);
      expect(rows).toHaveLength(0);
    },
    90_000
  );

  it(
    '[happy path] persists a real row whose DATABASE content (not the in-memory return value) contains the real deck text',
    async () => {
      const orgId = await seedOrg('happy');
      const marker = randomUUID();
      const nowIso = new Date().toISOString();

      const result = await createNativeDeck({
        organizationId: orgId,
        title: `E6 happy path deck ${marker}`,
        unifiedJson: buildUnifiedJson(marker),
        sourceType: 'test',
        sourceId: 'e6-happy',
        createdBy: 'e6-test-actor',
        createdAt: nowIso,
        status: 'ready',
        registerArtifact: false,
      });

      expect(result.deckId).toBeTruthy();
      expect(result.slideCount).toBe(1);
      expect(result.registryArtifactId).toBeNull();

      const rows = await deckRowsForOrg(orgId);
      expect(rows).toHaveLength(1);
      const row = rows[0];
      expect(row.id).toBe(result.deckId);
      expect(row.status).toBe('ready');
      expect(row.slide_count).toBe(1);

      // Real content, read back from the database — not merely a row/id
      // existing. This subsystem has a documented history of decks marked
      // ready while containing zero bytes of content.
      const deckJsonText = typeof row.deck_json === 'string' ? row.deck_json : JSON.stringify(row.deck_json);
      const unifiedJsonText =
        typeof row.unified_json === 'string' ? row.unified_json : JSON.stringify(row.unified_json);

      expect(deckJsonText).toContain(`E6 Persist Proof Title ${marker}`);
      expect(deckJsonText).toContain(`E6 distinctive subtitle marker ${marker}`);
      expect(unifiedJsonText).toContain(`E6 cover key message ${marker}`);
    },
    90_000
  );
});
