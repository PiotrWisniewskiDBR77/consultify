/**
 * OKR-E008 — `recordOkrReflectionTeresaDraft`/
 * `recordOkrReflectionTeresaDraftDisposition` (D-OKR8-7/D-OKR8-8) against a
 * REAL Postgres.
 *
 * Design: docs/product/results-vnext/OKR_E008_DESIGN.md §3.9.
 * Schema: server/migrations/20260827_rvn_okr_teresa_reflection_draft.sql.
 *
 * Reuses OKR-E007's shared fixture (`okrE007TestFixtures.ts`) for the
 * Program->Cycle->Set(active)->Objective->KeyResult boilerplate.
 *
 * Six scenarios:
 *   1. Create path (no reflection row exists yet, expectedVersion=0):
 *      writes ONLY teresa_draft_reflection_payload/teresa_draft_generated_at
 *      — every narrative/score column stays NULL.
 *   2. Regenerate path (expectedVersion=row's own row_version): updates the
 *      draft payload, bumps row_version.
 *   3. Stale-version CAS rejection.
 *   4. recordOkrReflectionTeresaDraftDisposition records
 *      teresa_draft_disposition/_by/_at — narrative fields stay untouched
 *      (real divergence from ROI's PIR disposition, which DOES copy text —
 *      see okrReflectionCommands.ts's own header comment on why).
 *   5. Regeneration blocked once a disposition is recorded
 *      (DISPOSITION_ALREADY_RECORDED) — never silently invalidates a human
 *      decision.
 *   6. The human's OWN `recordObjectiveReflection` command remains fully
 *      independent — writing narrative fields never touches any
 *      teresa_draft_* column, and works whether or not a Teresa draft
 *      exists first.
 *
 * SKIP POLICY: same convention as every other `*.realdb.test.ts` in this
 * program.
 */
import { randomUUID } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  DB_CONFIGURED,
  buildClientConfig,
  buildActiveOkrSetFixture,
  cleanupOkrE007Fixture,
  type OkrE007Fixture,
} from './okrE007TestFixtures.js';

const tag = `${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
const ORG_ID = `okr-e008-teresa-refl-org-${tag}`;
const USER_OWNER = `okr-e008-teresa-refl-owner-${tag}`;
const USER_REVIEWER = `okr-e008-teresa-refl-reviewer-${tag}`;
const USER_ADMIN = `okr-e008-teresa-refl-admin-${tag}`;

let client: Client;
let reachable = false;
let fixture: OkrE007Fixture;

type ReflectionCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrReflectionCommands.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let recordOkrReflectionTeresaDraft: ReflectionCommandsModule['recordOkrReflectionTeresaDraft'];
let recordOkrReflectionTeresaDraftDisposition: ReflectionCommandsModule['recordOkrReflectionTeresaDraftDisposition'];
let recordObjectiveReflection: ReflectionCommandsModule['recordObjectiveReflection'];
let closePgPool: (() => Promise<void>) | undefined;

async function readReflectionRow(objectiveId: string) {
  const result = await client.query(
    `SELECT * FROM okr_vnext_reflections WHERE objective_id = $1 AND organization_id = $2`,
    [objectiveId, ORG_ID]
  );
  return result.rows[0] as
    | {
        reflection_id: string;
        row_version: number;
        status: string;
        what_worked: string | null;
        what_did_not_work: string | null;
        why: string | null;
        learning: string | null;
        next_cycle_change: string | null;
        disposition: string | null;
        final_score: string | null;
        teresa_draft_reflection_payload: unknown;
        teresa_draft_generated_at: string | null;
        teresa_draft_disposition: string | null;
        teresa_draft_disposition_by: string | null;
        teresa_draft_disposition_at: string | null;
      }
    | undefined;
}

describe('OKR-E008 recordOkrReflectionTeresaDraft / recordOkrReflectionTeresaDraftDisposition (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — OKR-E008 reflection-draft tests did NOT run. This run is not evidence.');
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT teresa_draft_reflection_payload FROM okr_vnext_reflections LIMIT 0');
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing the OKR-E008 teresa-draft columns); refusing to report a green run. ' +
          String(error)
      );
    }
    reachable = true;

    const reflectionCommands: ReflectionCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrReflectionCommands.js'
    );
    recordOkrReflectionTeresaDraft = reflectionCommands.recordOkrReflectionTeresaDraft;
    recordOkrReflectionTeresaDraftDisposition = reflectionCommands.recordOkrReflectionTeresaDraftDisposition;
    recordObjectiveReflection = reflectionCommands.recordObjectiveReflection;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;

    fixture = await buildActiveOkrSetFixture({
      organizationId: ORG_ID,
      adminUserId: USER_ADMIN,
      ownerUserId: USER_OWNER,
      reviewerUserId: USER_REVIEWER,
    });
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    await cleanupOkrE007Fixture(client, ORG_ID);
    await client.end();
    if (closePgPool) await closePgPool();
  });

  it('create path (expectedVersion=0): writes ONLY the two Teresa-draft columns, every narrative/score column stays NULL', async () => {
    if (!reachable) return;
    const objectiveId = fixture.objectiveIds[0]!;

    const outcome = await recordOkrReflectionTeresaDraft({
      objectiveId,
      setId: fixture.setId,
      organizationId: ORG_ID,
      expectedVersion: 0,
      draftPayload: { draft_reflection_text: 'What worked: focus. What did not: late check-ins.' },
      actorUserId: USER_OWNER,
      actorEffectiveRole: 'teresa_initiated',
      idempotencyKey: `e008-teresa-draft-create-${randomUUID()}`,
    });

    expect(outcome.outcome).toBe('applied');
    expect(outcome.resultingVersion).toBe(1);

    const row = await readReflectionRow(objectiveId);
    expect(row).toBeDefined();
    expect(row!.teresa_draft_reflection_payload).toBeTruthy();
    expect(row!.teresa_draft_generated_at).not.toBeNull();
    expect(row!.what_worked).toBeNull();
    expect(row!.what_did_not_work).toBeNull();
    expect(row!.why).toBeNull();
    expect(row!.learning).toBeNull();
    expect(row!.next_cycle_change).toBeNull();
    expect(row!.disposition).toBeNull();
    expect(row!.final_score).toBeNull();
    expect(row!.teresa_draft_disposition).toBeNull();
  });

  it('regenerate path (expectedVersion=current row_version): updates the draft payload, bumps row_version', async () => {
    if (!reachable) return;
    const objectiveId = fixture.objectiveIds[0]!;
    const before = await readReflectionRow(objectiveId);

    const outcome = await recordOkrReflectionTeresaDraft({
      objectiveId,
      setId: fixture.setId,
      organizationId: ORG_ID,
      expectedVersion: before!.row_version,
      draftPayload: { draft_reflection_text: 'Regenerated draft text.' },
      actorUserId: USER_OWNER,
      actorEffectiveRole: 'teresa_initiated',
      idempotencyKey: `e008-teresa-draft-regen-${randomUUID()}`,
    });

    expect(outcome.outcome).toBe('applied');
    expect(outcome.resultingVersion).toBe(before!.row_version + 1);

    const after = await readReflectionRow(objectiveId);
    expect((after!.teresa_draft_reflection_payload as { draft_reflection_text: string }).draft_reflection_text).toBe(
      'Regenerated draft text.'
    );
  });

  it('stale expectedVersion is rejected (CAS)', async () => {
    if (!reachable) return;
    const objectiveId = fixture.objectiveIds[0]!;
    await expect(
      recordOkrReflectionTeresaDraft({
        objectiveId,
        setId: fixture.setId,
        organizationId: ORG_ID,
        expectedVersion: 1, // stale — the row is already at row_version 2 by now
        draftPayload: { draft_reflection_text: 'Should not land.' },
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'teresa_initiated',
        idempotencyKey: `e008-teresa-draft-stale-${randomUUID()}`,
      })
    ).rejects.toMatchObject({ code: 'STALE_VERSION' });
  });

  it('recordOkrReflectionTeresaDraftDisposition records disposition/_by/_at only — narrative fields stay untouched', async () => {
    if (!reachable) return;
    const objectiveId = fixture.objectiveIds[0]!;
    const before = await readReflectionRow(objectiveId);

    const outcome = await recordOkrReflectionTeresaDraftDisposition({
      objectiveId,
      organizationId: ORG_ID,
      expectedVersion: before!.row_version,
      disposition: 'accepted',
      actorUserId: USER_REVIEWER,
      actorEffectiveRole: 'member',
      idempotencyKey: `e008-teresa-disposition-${randomUUID()}`,
    });

    expect(outcome.outcome).toBe('applied');

    const after = await readReflectionRow(objectiveId);
    expect(after!.teresa_draft_disposition).toBe('accepted');
    expect(after!.teresa_draft_disposition_by).toBe(USER_REVIEWER);
    expect(after!.teresa_draft_disposition_at).not.toBeNull();
    // Core guarantee: disposition recording never copies text into any
    // narrative field — the human's own recordObjectiveReflection is the
    // ONLY path that ever does (see test below).
    expect(after!.what_worked).toBeNull();
    expect(after!.disposition).toBeNull(); // authoritative column, distinct from teresa_draft_disposition
  });

  it('regeneration is blocked once a disposition is recorded (never silently invalidates a human decision)', async () => {
    if (!reachable) return;
    const objectiveId = fixture.objectiveIds[0]!;
    const row = await readReflectionRow(objectiveId);

    await expect(
      recordOkrReflectionTeresaDraft({
        objectiveId,
        setId: fixture.setId,
        organizationId: ORG_ID,
        expectedVersion: row!.row_version,
        draftPayload: { draft_reflection_text: 'Attempted regeneration after disposition.' },
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'teresa_initiated',
        idempotencyKey: `e008-teresa-draft-blocked-${randomUUID()}`,
      })
    ).rejects.toMatchObject({ code: 'DISPOSITION_ALREADY_RECORDED' });
  });

  it('the human\'s own recordObjectiveReflection remains fully independent — writes narrative fields, never touches any teresa_draft_* column', async () => {
    if (!reachable) return;
    const objectiveId = fixture.objectiveIds[0]!;
    const before = await readReflectionRow(objectiveId);

    const outcome = await recordObjectiveReflection({
      objectiveId,
      setId: fixture.setId,
      organizationId: ORG_ID,
      expectedVersion: before!.row_version,
      whatWorked: 'Focused scope kept velocity high.',
      whatDidNotWork: 'Check-ins slipped in week 6.',
      why: 'Owner was on leave.',
      learning: 'Pre-assign a backup reviewer next time.',
      nextCycleChange: 'Add a mid-cycle checkpoint.',
      disposition: 'carry_forward',
      actorUserId: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `e008-human-reflection-${randomUUID()}`,
    });

    expect(outcome.outcome).toBe('applied');

    const after = await readReflectionRow(objectiveId);
    expect(after!.what_worked).toBe('Focused scope kept velocity high.');
    expect(after!.disposition).toBe('carry_forward');
    // The Teresa-draft columns this test's earlier steps populated are
    // UNCHANGED by the human's own narrative write — two fully independent
    // write paths onto the same row, exactly as D-OKR8-7 requires.
    expect(after!.teresa_draft_disposition).toBe('accepted');
    expect((after!.teresa_draft_reflection_payload as { draft_reflection_text: string }).draft_reflection_text).toBe(
      'Regenerated draft text.'
    );
  });
});
