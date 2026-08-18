/**
 * auditPackRights.realdb.test — AUD-MVP-RIGHTS-001 negative-control evidence.
 *
 * Proves, against a REAL Postgres, exactly what the Audits kernel enforces
 * today around provenance/rights of named external standards:
 *
 *   1. Publish is refused when a pack's title implies a named standard
 *      without verified normative coverage (PACK_TITLE_IMPLIES_NORMATIVE).
 *   2. Publish is refused when a pack declares classification
 *      VERIFIED_NORMATIVE without a verified/normative source (SOURCE_MISSING).
 *      NOTE: `classification` in this schema is a PACK-level property —
 *      `audit_pack_criteria` has no per-criterion classification column
 *      (verified by reading server/src/services/audits/types.ts). "a
 *      criterion classified VERIFIED_NORMATIVE" is therefore tested as "a
 *      pack declared VERIFIED_NORMATIVE", which is the actual mechanism.
 *   3. A DRAFT (unpublished) pack cannot launch a program — refusal is
 *      asserted AND a SELECT proves zero `audit_programs` rows were created.
 *   4. POSITIVE control: the clean internal DEMONSTRATION seed pack CAN be
 *      published and CAN launch a program — proves the harness isn't just
 *      finding everything broken.
 *   5. GAP 1 — CLOSED (requalified 2026-08-18, AUD-MVP-RIGHTS-001 /
 *      AMD-AUD-RIGHTS-001): draft/in-review pack visibility is now
 *      author-or-platform-admin scoped. `server/src/routes/audits/
 *      packs.routes.ts` GET /packs, GET /packs/:id, GET .../compare and
 *      GET .../validate all pass `readScope: isPlatformAdmin(actor) ?
 *      undefined : { actorUserId: actor.userId }`; enforcement is
 *      `assertRowReadable` in `packService.ts` (404, not 403, so a foreign
 *      draft's existence is not disclosed). This describe block used to
 *      characterize the gap as open; it now proves the fix, including a
 *      mounted-router supertest against the real `packs.routes.ts`. The
 *      historical characterization is preserved verbatim in
 *      docs/program/evidence/closure/a/AUD-MVP-RIGHTS-001/TASK_EVIDENCE.json;
 *      this fix landed in ancestor commits 0dc91d839f / e05577375e, not in
 *      this task — this pass requalified it, it did not implement it.
 *   6. Tenant isolation: org B cannot read or publish org A's pack.
 *   7. Cold readback: after publishing, a SEPARATE `pg.Pool` (not the app's
 *      shared DbPromise connection) still sees exactly one published pack
 *      with the expected classification — proves the write really landed in
 *      Postgres, not just in an in-process cache.
 *
 * RUN (from worktree root):
 *   CI=true NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false \
 *   POSTGRES_SKIP_INIT_IN_TEST=1 \
 *   DATABASE_URL="postgresql://consultinity:consultinity@127.0.0.1:34910/aud_rights" \
 *   npx vitest run server/src/services/auditProgramRights/__tests__/auditPackRights.realdb.test.ts \
 *     --no-file-parallelism --maxWorkers=1 --maxConcurrency=2 --retry=0
 *
 * Every fixture gets its own organizationId; cleanup deletes by
 * organization_id (cascades to audit_pack_criteria / audit_programs FKs
 * where applicable) so this file cannot collide with other suites sharing
 * the same database container.
 */

import { randomUUID } from 'node:crypto';

import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');
if (REAL_PG) {
  process.env.DB_TYPE = 'postgres';
}

/**
 * FIXTURE CLEANUP SAFETY (same contract as independenceScanCursor.realdb.test.ts).
 * This suite deletes rows in afterAll. Even though every delete is bounded by
 * organization_id, the deletes must never be pointed at a database the runner
 * does not own, and a cleanup that fails must say so instead of silently
 * leaving residue. Both are enforced below.
 */
const CLEANUP_OPT_IN = process.env.AUD_PACK_RIGHTS_ALLOW_FIXTURE_CLEANUP === '1';
const DISPOSABLE_DB_PREFIX = process.env.AUD_PACK_RIGHTS_DISPOSABLE_DB_PREFIX ?? '';
const DESTRUCTIVE_FIXTURES_ENABLED = REAL_PG && CLEANUP_OPT_IN && DISPOSABLE_DB_PREFIX.length > 0;

/** Distinct from the cursor suite's key so the two suites do not serialise against each other. */
const PACK_RIGHTS_CLEANUP_LOCK_KEY = 8_113_2027;

const suite = DESTRUCTIVE_FIXTURES_ENABLED ? describe : describe.skip;

if (!REAL_PG) {
  // eslint-disable-next-line no-console
  console.warn(
    '[auditPackRights.realdb.test.ts SKIPPED — clean skip, not a failure] wymaga ' +
      'NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=postgresql://... ' +
      '(patrz komentarz na górze pliku)',
  );
} else if (!DESTRUCTIVE_FIXTURES_ENABLED) {
  // eslint-disable-next-line no-console
  console.warn(
    '[auditPackRights.realdb.test.ts SKIPPED — clean skip, not a failure] this suite deletes ' +
      'fixture rows and therefore requires an explicit disposable-database declaration: set ' +
      'AUD_PACK_RIGHTS_ALLOW_FIXTURE_CLEANUP=1 and ' +
      'AUD_PACK_RIGHTS_DISPOSABLE_DB_PREFIX=<prefix of the throwaway database you created>.',
  );
}

suite('Audits — rights/provenance negative controls (real Postgres, AUD-MVP-RIGHTS-001)', () => {
  let auditsDb: typeof import('../../audits/auditsDb.js');
  let packService: typeof import('../../audits/packService.js');
  let packValidator: typeof import('../../audits/packValidator.js');
  let programService: typeof import('../../audits/programService.js');
  let packSeed: typeof import('../../audits/packSeed.js');

  const orgA = `aud-rights-org-a-${randomUUID()}`;
  const orgB = `aud-rights-org-b-${randomUUID()}`;
  // program.create/pack.read are ORG_MEMBER_CAPABILITIES — granted to every
  // member regardless of platformRole (see permissions.ts). adminActor is
  // only needed for pack write/publish, which is gated at the ROUTE layer
  // (requireAdmin in packs.routes.ts), not inside packService itself — so
  // both actors below can call packService methods directly; we use
  // `adminActor` for pack authoring to mirror what the route requires in
  // production, and `memberActor` for read + program creation to prove the
  // capability model really is that open for those two actions.
  const adminActor = { organizationId: orgA, userId: `aud-rights-admin-${randomUUID()}`, platformRole: 'admin' as const };
  const memberActor = { organizationId: orgA, userId: `aud-rights-member-${randomUUID()}` };
  const actorB = { organizationId: orgB, userId: `aud-rights-b-${randomUUID()}` };

  const cleanupOrgIds = [orgA, orgB];
  const cleanupActorIds = [adminActor.userId, memberActor.userId, actorB.userId];
  const cleanupPackIds = new Set<string>();
  const cleanupProgramIds = new Set<string>();

  beforeAll(async () => {
    auditsDb = await import('../../audits/auditsDb.js');
    packService = await import('../../audits/packService.js');
    packValidator = await import('../../audits/packValidator.js');
    programService = await import('../../audits/programService.js');
    packSeed = await import('../../audits/packSeed.js');
  });

  /**
   * Refuses unless the SERVER reports a database whose name starts with the
   * caller-declared disposable prefix. Asked of `current_database()` rather
   * than parsed from the connection string, which can lie (pgbouncer, a
   * copy-pasted URL, a search_path trick). Throws before any DELETE is
   * prepared, so a mismatch cannot execute a partial cleanup.
   */
  async function assertDisposableDatabase(prefixOverride?: string): Promise<string> {
    const prefix = prefixOverride ?? DISPOSABLE_DB_PREFIX;
    if (!CLEANUP_OPT_IN) throw new Error('AUD_PACK_RIGHTS_FIXTURE_CLEANUP_NOT_OPTED_IN');
    if (!prefix) throw new Error('AUD_PACK_RIGHTS_DISPOSABLE_DB_PREFIX_MISSING');
    const row = await auditsDb.auditGet<{ db: string }>(`SELECT current_database() AS db`);
    const db = String(row?.db ?? '');
    if (!db.startsWith(prefix)) {
      throw new Error(
        `AUD_PACK_RIGHTS_DISPOSABLE_DB_MISMATCH: current_database()='${db}' does not start with declared disposable prefix '${prefix}' — refusing to delete anything.`,
      );
    }
    return db;
  }

  /**
   * FK-safe cleanup, scoped to exactly the organizations this run created,
   * inside one transaction holding a transaction-scoped advisory lock.
   * Errors are NOT swallowed: the previous `.catch(() => {})` on every
   * statement meant a cleanup that silently failed still reported success and
   * left residue behind for the next run to trip over.
   */
  async function cleanupOwnFixtures(prefixOverride?: string): Promise<void> {
    await assertDisposableDatabase(prefixOverride);
    const { acquirePgClient } = await import('../../../database/PostgresDatabase.js');
    const client = await acquirePgClient();
    let appendOnlyTriggerDisabled = false;
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1)', [PACK_RIGHTS_CLEANUP_LOCK_KEY]);
      for (const row of (
        await client.query<{ id: string }>(
          `SELECT id FROM audit_packs WHERE organization_id = ANY($1)`,
          [cleanupOrgIds],
        )
      ).rows) cleanupPackIds.add(row.id);
      for (const row of (
        await client.query<{ id: string }>(
          `SELECT id FROM audit_programs WHERE organization_id = ANY($1)`,
          [cleanupOrgIds],
        )
      ).rows) cleanupProgramIds.add(row.id);
      const trigger = await client.query<{ tgname: string; tgenabled: string }>(
        `SELECT tgname,tgenabled FROM pg_trigger
          WHERE tgrelid='audit_domain_events'::regclass
            AND tgname='trg_audit_domain_events_append_only' AND NOT tgisinternal`,
      );
      expect(trigger.rows).toEqual([
        { tgname: 'trg_audit_domain_events_append_only', tgenabled: 'O' },
      ]);
      await client.query(
        `ALTER TABLE audit_domain_events DISABLE TRIGGER trg_audit_domain_events_append_only`,
      );
      appendOnlyTriggerDisabled = true;
      await client.query(
        `DELETE FROM audit_domain_events
          WHERE (organization_id = ANY($1) OR actor_id = ANY($2))`,
        [cleanupOrgIds, cleanupActorIds],
      );
      await client.query(
        `ALTER TABLE audit_domain_events ENABLE TRIGGER trg_audit_domain_events_append_only`,
      );
      appendOnlyTriggerDisabled = false;
      expect(
        (
          await client.query<{ tgenabled: string }>(
            `SELECT tgenabled FROM pg_trigger
              WHERE tgrelid='audit_domain_events'::regclass
                AND tgname='trg_audit_domain_events_append_only' AND NOT tgisinternal`,
          )
        ).rows,
      ).toEqual([{ tgenabled: 'O' }]);
      // Children before parents, bounded by ids captured from this run's exact organizations.
      await client.query(`DELETE FROM audit_program_criteria WHERE program_id = ANY($1)`, [
        [...cleanupProgramIds],
      ]);
      await client.query(`DELETE FROM audit_programs WHERE id = ANY($1)`, [[...cleanupProgramIds]]);
      await client.query(`DELETE FROM audit_pack_criteria WHERE pack_id = ANY($1)`, [
        [...cleanupPackIds],
      ]);
      await client.query(`DELETE FROM audit_packs WHERE id = ANY($1)`, [[...cleanupPackIds]]);
      await client.query(`DELETE FROM audit_norm_sources WHERE organization_id = ANY($1)`, [
        cleanupOrgIds,
      ]);
      await client.query('COMMIT');
    } catch (err) {
      if (appendOnlyTriggerDisabled) {
        await client
          .query(
            `ALTER TABLE audit_domain_events ENABLE TRIGGER trg_audit_domain_events_append_only`,
          )
          .catch(() => {});
        appendOnlyTriggerDisabled = false;
      }
      await client.query('ROLLBACK').catch(() => {});
      expect(
        (
          await client.query<{ tgenabled: string }>(
            `SELECT tgenabled FROM pg_trigger
              WHERE tgrelid='audit_domain_events'::regclass
                AND tgname='trg_audit_domain_events_append_only' AND NOT tgisinternal`,
          )
        ).rows,
      ).toEqual([{ tgenabled: 'O' }]);
      throw err; // surfaced, never swallowed
    } finally {
      client.release();
    }
  }

  async function countOwnRows(): Promise<number> {
    const row = await auditsDb.auditGet<{ n: string }>(
      `SELECT (
         (SELECT count(*) FROM audit_packs    WHERE organization_id = ANY($1)) +
         (SELECT count(*) FROM audit_programs WHERE organization_id = ANY($1)) +
         (SELECT count(*) FROM audit_norm_sources WHERE organization_id = ANY($1)) +
         (SELECT count(*) FROM audit_domain_events
           WHERE (organization_id = ANY($1) OR actor_id = ANY($2))) +
         (SELECT count(*) FROM audit_pack_criteria WHERE pack_id = ANY($3)) +
         (SELECT count(*) FROM audit_program_criteria WHERE program_id = ANY($4)) +
         (SELECT count(*) FROM organization_members
           WHERE organization_id = ANY($1) OR user_id = ANY($2)) +
         (SELECT count(*) FROM users WHERE id = ANY($2)) +
         (SELECT count(*) FROM organizations WHERE id = ANY($1))
       )::text AS n`,
      [cleanupOrgIds, cleanupActorIds, [...cleanupPackIds], [...cleanupProgramIds]],
    );
    return Number(row?.n ?? -1);
  }

  async function ownDomainEventSnapshot(): Promise<Record<string, unknown>[]> {
    return auditsDb.auditAll<Record<string, unknown>>(
      `SELECT * FROM audit_domain_events
        WHERE (organization_id = ANY($1) OR actor_id = ANY($2))
        ORDER BY occurred_at,id`,
      [cleanupOrgIds, cleanupActorIds],
    );
  }

  afterAll(async () => {
    await cleanupOwnFixtures();
    // residue0 for everything this run created.
    expect(await countOwnRows()).toBe(0);
  });

  describe('0. fixture cleanup is guarded and scoped', () => {
    it('a disposable-DB prefix MISMATCH aborts before deleting anything', async () => {
      const pack = await createDraftPack({ packKey: `aud-rights-cleanup-canary-${randomUUID()}` });
      await expect(cleanupOwnFixtures('definitely-not-this-database-')).rejects.toThrow(
        /AUD_PACK_RIGHTS_DISPOSABLE_DB_MISMATCH/,
      );
      const survivor = await auditsDb.auditGet<{ id: string }>(
        `SELECT id FROM audit_packs WHERE id = $1`,
        [pack.id],
      );
      expect(survivor?.id).toBe(pack.id); // canary intact — no partial cleanup
    });

    it('the guard reads current_database() from the server and accepts only a true prefix', async () => {
      const db = await assertDisposableDatabase();
      expect(db.startsWith(DISPOSABLE_DB_PREFIX)).toBe(true);
      await expect(assertDisposableDatabase(`x${db}`)).rejects.toThrow(
        /AUD_PACK_RIGHTS_DISPOSABLE_DB_MISMATCH/,
      );
    });

    it('cleanup errors are surfaced, not swallowed', async () => {
      // A syntactically valid but impossible prefix must reject rather than
      // resolve — proving the removal of the old per-statement `.catch(() => {})`.
      await expect(cleanupOwnFixtures(' -impossible-prefix')).rejects.toBeInstanceOf(Error);
    });
  });

  const validTaxonomy = [
    { key: 'conforming', label: 'Zgodne', nonConforming: false, requiresCorrectiveAction: false },
    { key: 'nonconforming', label: 'Niezgodne', nonConforming: true, requiresCorrectiveAction: true },
  ];

  const validLeafCriterion = {
    title: 'Kryterium testowe rights',
    nodeKind: 'criterion' as const,
    ordinal: 0,
    requirementText: 'Własne sformułowanie wymagania testowego.',
    auditQuestion: 'Czy wymaganie jest spełnione?',
  };

  async function createDraftPack(overrides: Partial<Parameters<typeof packService.createPack>[1]> = {}) {
    return packService.createPack(adminActor, {
      packKey: `aud-rights-pk-${randomUUID()}`,
      title: 'Wewnętrzny pakiet testowy rights',
      classification: 'INTERNAL_FRAMEWORK',
      scope: 'Zakres testowy',
      objectives: 'Cele testowe',
      requiredRoles: ['lead_auditor'],
      findingTaxonomy: validTaxonomy,
      ...overrides,
    });
  }

  // -------------------------------------------------------------------------
  // 1. PACK_TITLE_IMPLIES_NORMATIVE
  // -------------------------------------------------------------------------
  describe('1. title implies a named standard without verified coverage', () => {
    it('validatePack (unit-level, exact code) flags PACK_TITLE_IMPLIES_NORMATIVE', () => {
      const result = packValidator.validatePack({
        pack: {
          packKey: 'iso-title-unit',
          title: 'ISO 27001 Compliance Audit Pack',
          version: 1,
          classification: 'INTERNAL_FRAMEWORK',
          sourceType: 'INTERNAL_PROCEDURE',
          scope: 'x',
          objectives: 'x',
          requiredRoles: ['lead_auditor'],
          expertApprovedBy: 'u1',
          expertApprovedAt: new Date().toISOString(),
        },
        criteria: [validLeafCriterion],
        source: null,
        targetPublicationStatus: 'published',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.map((e) => e.code)).toContain('PACK_TITLE_IMPLIES_NORMATIVE');
    });

    it('publishPack against real Postgres REJECTS the pack end-to-end', async () => {
      const pack = await createDraftPack({
        packKey: `aud-rights-iso-title-${randomUUID()}`,
        title: 'ISO 27001 Readiness Pack',
      });
      await packService.replaceCriteria(adminActor, pack.id, [validLeafCriterion]);
      await packService.approveByExpert(adminActor, pack.id, 'test approval');

      await expect(packService.publishPack(adminActor, pack.id)).rejects.toMatchObject({
        code: 'AUDIT_PACK_NOT_PUBLISHABLE',
      });
      await expect(packService.publishPack(adminActor, pack.id)).rejects.toThrow(
        /PACK_TITLE_IMPLIES_NORMATIVE/,
      );

      const row = await auditsDb.auditGet<{ publication_status: string }>(
        `SELECT publication_status FROM audit_packs WHERE id = $1`,
        [pack.id],
      );
      expect(row?.publication_status).toBe('draft');
    });
  });

  // -------------------------------------------------------------------------
  // 2. VERIFIED_NORMATIVE without a verified/normative source -> SOURCE_MISSING
  // -------------------------------------------------------------------------
  describe('2. VERIFIED_NORMATIVE classification without a verified source', () => {
    it('validatePack (unit-level, exact code) flags SOURCE_MISSING', () => {
      const result = packValidator.validatePack({
        pack: {
          packKey: 'vn-unit',
          title: 'Wewnętrzny pakiet zgodności — bez normy w tytule',
          version: 1,
          classification: 'VERIFIED_NORMATIVE',
          scope: 'x',
          objectives: 'x',
          requiredRoles: ['lead_auditor'],
          expertApprovedBy: 'u1',
          expertApprovedAt: new Date().toISOString(),
        },
        criteria: [validLeafCriterion],
        source: null,
        targetPublicationStatus: 'published',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.map((e) => e.code)).toContain('SOURCE_MISSING');
    });

    it('publishPack against real Postgres REJECTS a VERIFIED_NORMATIVE pack with no source', async () => {
      const pack = await createDraftPack({
        packKey: `aud-rights-vn-nosrc-${randomUUID()}`,
        title: 'Wewnętrzny pakiet zgodności bez wskazanej normy',
        classification: 'VERIFIED_NORMATIVE',
      });
      await packService.replaceCriteria(adminActor, pack.id, [validLeafCriterion]);
      await packService.approveByExpert(adminActor, pack.id, 'test approval');

      await expect(packService.publishPack(adminActor, pack.id)).rejects.toMatchObject({
        code: 'AUDIT_PACK_NOT_PUBLISHABLE',
      });
      await expect(packService.publishPack(adminActor, pack.id)).rejects.toThrow(/SOURCE_MISSING/);
    });
  });

  // -------------------------------------------------------------------------
  // 3. DRAFT pack cannot launch a program
  // -------------------------------------------------------------------------
  describe('3. draft pack cannot launch a program', () => {
    it('createProgramFromPack refuses an unpublished pack and writes zero rows', async () => {
      const pack = await createDraftPack({ packKey: `aud-rights-draft-launch-${randomUUID()}` });
      await packService.replaceCriteria(adminActor, pack.id, [validLeafCriterion]);
      // deliberately NOT published

      await expect(
        programService.createProgramFromPack(orgA, memberActor, {
          packId: pack.id,
          name: 'Program z niepublikowanego pakietu',
        }),
      ).rejects.toMatchObject({ code: 'AUDIT_INVALID_STATE' });

      const countRow = await auditsDb.auditGet<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM audit_programs WHERE pack_id = $1`,
        [pack.id],
      );
      expect(Number(countRow?.count ?? -1)).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // 4. POSITIVE control — the clean demonstration pack works end-to-end
  // -------------------------------------------------------------------------
  describe('4. positive control — clean internal DEMONSTRATION pack', () => {
    it('can be published and can launch a program', async () => {
      const demo = await packSeed.seedDemoAuditPack(orgA, adminActor.userId);
      expect(demo.classification).toBe('DEMONSTRATION');

      // Idempotent seed may already be published from a previous run in this
      // org; approve+publish only if still draft.
      if (demo.publicationStatus !== 'published') {
        await packService.approveByExpert(adminActor, demo.id, 'demo approval');
        const published = await packService.publishPack(adminActor, demo.id);
        expect(published.publicationStatus).toBe('published');
      }

      const detail = await programService.createProgramFromPack(orgA, memberActor, {
        packId: demo.id,
        name: `Program demo rights ${randomUUID()}`,
      });
      expect(detail.program?.id).toBeTruthy();

      const row = await auditsDb.auditGet<{ id: string; pack_id: string }>(
        `SELECT id, pack_id FROM audit_programs WHERE id = $1`,
        [detail.program.id],
      );
      expect(row?.pack_id).toBe(demo.id);
    });
  });

  // -------------------------------------------------------------------------
  // 5. GAP-1 CLOSED — draft/in-review packs are author-or-platform-admin
  //    scoped, at the service layer and at the real mounted route.
  // -------------------------------------------------------------------------
  describe('5. draft/in-review visibility is author-or-admin scoped (AUD-MVP-RIGHTS-001 / AMD-AUD-RIGHTS-001)', () => {
    it('service: a scoped non-author caller sees published only — the draft is absent from list and 404s by id', async () => {
      const draft = await createDraftPack({
        packKey: `aud-rights-gap1-${randomUUID()}`,
        title: 'Pakiet roboczy — nie do publikacji jeszcze',
      });
      await packService.replaceCriteria(adminActor, draft.id, [validLeafCriterion]);
      expect(draft.publicationStatus).toBe('draft');

      const listedAsStranger = await packService.listPacks(orgA, {
        readScope: { actorUserId: memberActor.userId },
      });
      expect(listedAsStranger.items.some((p) => p.id === draft.id)).toBe(false);

      await expect(
        packService.getPack(orgA, draft.id, { actorUserId: memberActor.userId }),
      ).rejects.toMatchObject({ code: 'AUDIT_NOT_FOUND' });

      // An unscoped call (admin/internal caller, e.g. packSeed.ts) stays unrestricted.
      const listedUnrestricted = await packService.listPacks(orgA, {});
      expect(listedUnrestricted.items.some((p) => p.id === draft.id)).toBe(true);
    });

    it('service: a scoped caller cannot widen visibility via an explicit ?status= ask', async () => {
      const draft = await createDraftPack({
        packKey: `aud-rights-gap1-status-${randomUUID()}`,
        title: 'Pakiet roboczy — próba rozszerzenia przez status',
      });
      for (const status of ['draft', 'in_review'] as const) {
        const listed = await packService.listPacks(orgA, {
          status,
          readScope: { actorUserId: memberActor.userId },
        });
        expect(listed.items.some((p) => p.id === draft.id)).toBe(false);
      }
    });

    it('service: the AUTHOR sees their own draft without any admin role; a different member still cannot', async () => {
      const ownDraft = await packService.createPack(memberActor, {
        packKey: `aud-rights-gap1-own-${randomUUID()}`,
        title: 'Pakiet roboczy autora',
        classification: 'INTERNAL_FRAMEWORK',
        scope: 'Zakres testowy',
        objectives: 'Cele testowe',
        requiredRoles: ['lead_auditor'],
        findingTaxonomy: validTaxonomy,
      });
      expect(ownDraft.publicationStatus).toBe('draft');

      const listedAsAuthor = await packService.listPacks(orgA, {
        readScope: { actorUserId: memberActor.userId },
      });
      expect(listedAsAuthor.items.some((p) => p.id === ownDraft.id)).toBe(true);
      expect(
        (await packService.getPack(orgA, ownDraft.id, { actorUserId: memberActor.userId })).id,
      ).toBe(ownDraft.id);

      const otherMember = `aud-rights-other-${randomUUID()}`;
      const listedAsOther = await packService.listPacks(orgA, {
        readScope: { actorUserId: otherMember },
      });
      expect(listedAsOther.items.some((p) => p.id === ownDraft.id)).toBe(false);
      await expect(
        packService.getPack(orgA, ownDraft.id, { actorUserId: otherMember }),
      ).rejects.toMatchObject({ code: 'AUDIT_NOT_FOUND' });
    });

    it('ROUTE (supertest against the real mounted packs.routes.ts): member list omits a foreign draft, direct id 404s, admin sees both', async () => {
      const { default: packsRouter } = await import('../../../routes/audits/packs.routes.js');

      const foreignDraft = await createDraftPack({
        packKey: `aud-rights-gap1-route-${randomUUID()}`,
        title: 'Pakiet roboczy (trasa) — cudzy draft',
      });

      function appAs(actor: { organizationId: string; userId: string; platformRole?: string }): Express {
        const app = express();
        app.use(express.json());
        app.use((req: Request, _res: Response, next: NextFunction) => {
          (req as any).user = { id: actor.userId, organizationId: actor.organizationId, role: actor.platformRole };
          (req as any).organizationId = actor.organizationId;
          (req as any).userId = actor.userId;
          next();
        });
        app.use('/', packsRouter);
        return app;
      }

      const memberApp = appAs(memberActor);
      const listRes = await request(memberApp).get('/');
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.some((p: { id: string }) => p.id === foreignDraft.id)).toBe(false);

      const getRes = await request(memberApp).get(`/${foreignDraft.id}`);
      expect(getRes.status).toBe(404);
      expect(getRes.body.code).toBe('AUDIT_NOT_FOUND');

      const adminApp = appAs(adminActor);
      const adminListRes = await request(adminApp).get('/');
      expect(adminListRes.status).toBe(200);
      expect(adminListRes.body.data.some((p: { id: string }) => p.id === foreignDraft.id)).toBe(true);

      const adminGetRes = await request(adminApp).get(`/${foreignDraft.id}`);
      expect(adminGetRes.status).toBe(200);
      expect(adminGetRes.body.data.id).toBe(foreignDraft.id);
    });

    it('a denied read mutates nothing: the pack row is byte-identical before and after the 404', async () => {
      const { default: packsRouter } = await import('../../../routes/audits/packs.routes.js');
      const draft = await createDraftPack({
        packKey: `aud-rights-gap1-nomutate-${randomUUID()}`,
        title: 'Pakiet — brak mutacji po odmowie',
      });
      const before = await auditsDb.auditGet<Record<string, unknown>>(
        `SELECT * FROM audit_packs WHERE id = $1`,
        [draft.id],
      );
      const eventsBefore = await ownDomainEventSnapshot();

      const app = express();
      app.use(express.json());
      app.use((req: Request, _res: Response, next: NextFunction) => {
        (req as any).user = { id: memberActor.userId, organizationId: memberActor.organizationId };
        (req as any).organizationId = memberActor.organizationId;
        (req as any).userId = memberActor.userId;
        next();
      });
      app.use('/', packsRouter);

      expect((await request(app).get(`/${draft.id}`)).status).toBe(404);

      const after = await auditsDb.auditGet<Record<string, unknown>>(
        `SELECT * FROM audit_packs WHERE id = $1`,
        [draft.id],
      );
      expect(after).toEqual(before);
      expect(await ownDomainEventSnapshot()).toEqual(eventsBefore);
    });

    it('COMPARE is scoped like get: a stranger cannot diff two draft versions, the author can, admin can', async () => {
      const packKey = `aud-rights-compare-${randomUUID()}`;
      const v1 = await packService.createPack(memberActor, {
        packKey,
        title: 'Pakiet autora — wersja 1',
        classification: 'INTERNAL_FRAMEWORK',
        scope: 'Zakres',
        objectives: 'Cele',
        requiredRoles: ['lead_auditor'],
        findingTaxonomy: validTaxonomy,
      });
      expect(v1.publicationStatus).toBe('draft');
      await packService.replaceCriteria(memberActor, v1.id, [validLeafCriterion]);
      const v2 = await packService.createNewVersion(memberActor, packKey);
      expect(v2.version).toBeGreaterThan(v1.version);

      const stranger = `aud-rights-compare-stranger-${randomUUID()}`;
      // A stranger gets the same 404 shape used when a version genuinely does
      // not exist — no existence leak, no criterion content.
      await expect(
        packService.comparePackVersions(orgA, packKey, v1.version, v2.version, {
          actorUserId: stranger,
        }),
      ).rejects.toMatchObject({ code: 'AUDIT_NOT_FOUND' });

      // The author diffs their own drafts.
      const asAuthor = await packService.comparePackVersions(orgA, packKey, v1.version, v2.version, {
        actorUserId: memberActor.userId,
      });
      expect(asAuthor).toBeTruthy();

      // Admin path (unscoped, per existing policy) still works.
      const asAdmin = await packService.comparePackVersions(orgA, packKey, v1.version, v2.version);
      expect(asAdmin).toBeTruthy();
    });

    it('VALIDATE is scoped like get: a stranger cannot validate a foreign draft, the author and admin can', async () => {
      const draft = await createDraftPack({
        packKey: `aud-rights-validate-${randomUUID()}`,
        title: 'Pakiet roboczy — walidacja',
      });
      await packService.replaceCriteria(adminActor, draft.id, [validLeafCriterion]);

      const stranger = `aud-rights-validate-stranger-${randomUUID()}`;
      await expect(
        packService.validatePackById(orgA, draft.id, { actorUserId: stranger }),
      ).rejects.toMatchObject({ code: 'AUDIT_NOT_FOUND' });

      // The author of this one is adminActor (createDraftPack uses it).
      const asAuthor = await packService.validatePackById(orgA, draft.id, {
        actorUserId: adminActor.userId,
      });
      expect(asAuthor).toBeTruthy();

      const asAdmin = await packService.validatePackById(orgA, draft.id);
      expect(asAdmin).toBeTruthy();
    });

    it('a PUBLISHED pack stays readable/comparable/validatable for an ordinary member (contract unchanged)', async () => {
      const demo = await packSeed.seedDemoAuditPack(orgA, adminActor.userId);
      const published =
        demo.publicationStatus === 'published'
          ? demo
          : await packService.publishPack(adminActor, demo.id);
      expect(published.publicationStatus).toBe('published');

      const memberScope = { actorUserId: `aud-rights-published-reader-${randomUUID()}` };
      expect((await packService.getPack(orgA, published.id, memberScope)).id).toBe(published.id);
      expect(await packService.validatePackById(orgA, published.id, memberScope)).toBeTruthy();
      const listed = await packService.listPacks(orgA, { readScope: memberScope });
      expect(listed.items.some((p) => p.id === published.id)).toBe(true);
    });

    it('ROUTE-level: compare and validate on a foreign draft both 404 for a member and mutate nothing', async () => {
      const { default: packsRouter } = await import('../../../routes/audits/packs.routes.js');
      const packKey = `aud-rights-route-cv-${randomUUID()}`;
      const v1 = await createDraftPack({ packKey, title: 'Cudzy draft — trasa compare/validate' });
      await packService.replaceCriteria(adminActor, v1.id, [validLeafCriterion]);
      await packService.createNewVersion(adminActor, packKey);

      const beforeRows = await auditsDb.auditAll<Record<string, unknown>>(
        `SELECT * FROM audit_packs WHERE pack_key = $1 ORDER BY version`,
        [packKey],
      );
      const eventsBefore = await ownDomainEventSnapshot();

      const app = express();
      app.use(express.json());
      app.use((req: Request, _res: Response, next: NextFunction) => {
        (req as any).user = { id: memberActor.userId, organizationId: memberActor.organizationId };
        (req as any).organizationId = memberActor.organizationId;
        (req as any).userId = memberActor.userId;
        next();
      });
      app.use('/', packsRouter);

      const cmp = await request(app).get(`/${packKey}/compare?a=1&b=2`);
      expect(cmp.status).toBe(404);
      expect(cmp.body.code).toBe('AUDIT_NOT_FOUND');

      const val = await request(app).post(`/${v1.id}/validate`).send({});
      expect(val.status).toBe(404);
      expect(val.body.code).toBe('AUDIT_NOT_FOUND');

      const afterRows = await auditsDb.auditAll<Record<string, unknown>>(
        `SELECT * FROM audit_packs WHERE pack_key = $1 ORDER BY version`,
        [packKey],
      );
      expect(afterRows).toEqual(beforeRows);
      expect(await ownDomainEventSnapshot()).toEqual(eventsBefore);
    });

    it('FOREIGN TENANT gets 404 on get/compare/validate for org A content', async () => {
      const packKey = `aud-rights-foreign-${randomUUID()}`;
      const pack = await createDraftPack({ packKey, title: 'Pakiet org A' });
      await packService.replaceCriteria(adminActor, pack.id, [validLeafCriterion]);
      await packService.createNewVersion(adminActor, packKey);

      const scopeB = { actorUserId: actorB.userId };
      await expect(packService.getPack(orgB, pack.id, scopeB)).rejects.toMatchObject({
        code: 'AUDIT_NOT_FOUND',
      });
      await expect(packService.validatePackById(orgB, pack.id, scopeB)).rejects.toMatchObject({
        code: 'AUDIT_NOT_FOUND',
      });
      await expect(
        packService.comparePackVersions(orgB, packKey, 1, 2, scopeB),
      ).rejects.toMatchObject({ code: 'AUDIT_NOT_FOUND' });
      // Even an unscoped (admin-shaped) call from org B is refused by tenant scoping.
      await expect(packService.comparePackVersions(orgB, packKey, 1, 2)).rejects.toMatchObject({
        code: 'AUDIT_NOT_FOUND',
      });
    });

    it('cold readback: a separate pg.Pool confirms the draft is still draft and still owned by its author after all denied reads', async () => {
      const { Pool } = await import('pg');
      const draft = await createDraftPack({
        packKey: `aud-rights-gap1-cold-${randomUUID()}`,
        title: 'Pakiet — zimny odczyt po odmowach',
      });
      await packService
        .getPack(orgA, draft.id, { actorUserId: `stranger-${randomUUID()}` })
        .catch(() => undefined);

      const pool = new Pool({ connectionString: CONNECTION_STRING });
      try {
        const res = await pool.query<{ publication_status: string; created_by: string }>(
          `SELECT publication_status, created_by FROM audit_packs WHERE id = $1`,
          [draft.id],
        );
        expect(res.rows).toHaveLength(1);
        expect(res.rows[0]!.publication_status).toBe('draft');
        expect(res.rows[0]!.created_by).toBe(adminActor.userId);
      } finally {
        await pool.end();
      }
    });
  });

  // -------------------------------------------------------------------------
  // 6. Tenant isolation
  // -------------------------------------------------------------------------
  describe('6. tenant isolation', () => {
    it('org B cannot read org A pack (AuditNotFoundError)', async () => {
      const pack = await createDraftPack({ packKey: `aud-rights-tenant-read-${randomUUID()}` });
      await expect(packService.getPack(orgB, pack.id)).rejects.toMatchObject({ code: 'AUDIT_NOT_FOUND' });
    });

    it('org B cannot publish org A pack (AuditNotFoundError, not silently applied to A)', async () => {
      const pack = await createDraftPack({ packKey: `aud-rights-tenant-pub-${randomUUID()}` });
      await packService.replaceCriteria(adminActor, pack.id, [validLeafCriterion]);
      await packService.approveByExpert(adminActor, pack.id, 'approve for tenant test');

      await expect(packService.publishPack(actorB, pack.id)).rejects.toMatchObject({
        code: 'AUDIT_NOT_FOUND',
      });

      const row = await auditsDb.auditGet<{ publication_status: string }>(
        `SELECT publication_status FROM audit_packs WHERE id = $1`,
        [pack.id],
      );
      expect(row?.publication_status).toBe('draft');
    });
  });

  // -------------------------------------------------------------------------
  // 7. Cold readback through a SEPARATE pg.Pool
  // -------------------------------------------------------------------------
  describe('7. cold readback via a separate pg.Pool', () => {
    it('a fresh pool instance sees exactly one published pack with the expected classification', async () => {
      const pack = await createDraftPack({
        packKey: `aud-rights-cold-${randomUUID()}`,
        title: 'Wewnętrzny pakiet — odczyt na zimno',
        classification: 'INTERNAL_FRAMEWORK',
      });
      await packService.replaceCriteria(adminActor, pack.id, [validLeafCriterion]);
      await packService.approveByExpert(adminActor, pack.id, 'cold readback approval');
      await packService.publishPack(adminActor, pack.id);

      const { Pool } = await import('pg');
      const freshPool = new Pool({ connectionString: CONNECTION_STRING });
      try {
        const result = await freshPool.query(
          `SELECT publication_status, classification FROM audit_packs WHERE pack_key = $1`,
          [pack.packKey],
        );
        expect(result.rows.length).toBe(1);
        expect(result.rows[0].publication_status).toBe('published');
        expect(result.rows[0].classification).toBe('INTERNAL_FRAMEWORK');
      } finally {
        await freshPool.end();
      }
    });
  });

  // -------------------------------------------------------------------------
  // 8. Revoked/stale identity fails closed (mandatory negative control)
  // -------------------------------------------------------------------------
  describe('8. revoked/stale identity fails closed', () => {
    it('ROUTE: a request whose auth middleware attached no identity (session revoked/expired) gets 401 AUDIT_NO_CONTEXT, not 200 or 500', async () => {
      const { default: packsRouter } = await import('../../../routes/audits/packs.routes.js');

      // Mirrors what happens upstream when a token is revoked/expired: the
      // shared auth middleware does not attach req.user/organizationId/userId
      // at all (rather than attaching a stale one). The Audits kernel's own
      // `assertActor` must refuse this itself, not rely solely on a gate
      // further up the middleware chain.
      const noIdentityApp = express();
      noIdentityApp.use(express.json());
      noIdentityApp.use('/', packsRouter);

      const listRes = await request(noIdentityApp).get('/');
      expect(listRes.status).toBe(401);
      expect(listRes.body.code).toBe('AUDIT_NO_CONTEXT');
      expect(listRes.body.success).toBe(false);

      const draft = await createDraftPack({
        packKey: `aud-rights-revoked-${randomUUID()}`,
        title: 'Pakiet — sprawdzenie odwołanej tożsamości',
      });
      const getRes = await request(noIdentityApp).get(`/${draft.id}`);
      expect(getRes.status).toBe(401);
      expect(getRes.body.code).toBe('AUDIT_NO_CONTEXT');
    });

    it('ROUTE: an identity with organizationId but no userId (partially-stale session) also fails closed with 401, not a crash', async () => {
      const { default: packsRouter } = await import('../../../routes/audits/packs.routes.js');

      const partialApp = express();
      partialApp.use(express.json());
      partialApp.use((req: Request, _res: Response, next: NextFunction) => {
        // organizationId present, userId absent — e.g. a token whose subject
        // claim failed to resolve after the user record was revoked/deleted.
        (req as any).organizationId = orgA;
        next();
      });
      partialApp.use('/', packsRouter);

      const res = await request(partialApp).get('/');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('AUDIT_NO_CONTEXT');
    });
  });
});
