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
 *   5. KNOWN-GAP characterization (GAP 1, not fixed by this task — fix is
 *      owned by the integrator): a plain org member can list/read a DRAFT
 *      pack via the exact code path `GET /packs` and `GET /packs/:id` call
 *      (packService.listPacks / packService.getPack), because
 *      server/src/routes/audits/packs.routes.ts performs NO capability
 *      check and NO publication_status filter before calling them (verified
 *      by reading the route file — only POST/PATCH/DELETE call
 *      requireAdmin()).
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

const suite = REAL_PG ? describe : describe.skip;

if (!REAL_PG) {
  // eslint-disable-next-line no-console
  console.warn(
    '[auditPackRights.realdb.test.ts SKIPPED — clean skip, not a failure] wymaga ' +
      'NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=postgresql://... ' +
      '(patrz komentarz na górze pliku)',
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

  beforeAll(async () => {
    auditsDb = await import('../../audits/auditsDb.js');
    packService = await import('../../audits/packService.js');
    packValidator = await import('../../audits/packValidator.js');
    programService = await import('../../audits/programService.js');
    packSeed = await import('../../audits/packSeed.js');
  });

  afterAll(async () => {
    for (const orgId of cleanupOrgIds) {
      await auditsDb.auditRun(`DELETE FROM audit_program_criteria WHERE organization_id = $1`, [orgId]).catch(() => {});
      await auditsDb.auditRun(`DELETE FROM audit_programs WHERE organization_id = $1`, [orgId]).catch(() => {});
      await auditsDb.auditRun(`DELETE FROM audit_pack_criteria WHERE pack_id IN (SELECT id FROM audit_packs WHERE organization_id = $1)`, [orgId]).catch(() => {});
      await auditsDb.auditRun(`DELETE FROM audit_packs WHERE organization_id = $1`, [orgId]).catch(() => {});
      await auditsDb.auditRun(`DELETE FROM audit_norm_sources WHERE organization_id = $1`, [orgId]).catch(() => {});
    }
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
});
