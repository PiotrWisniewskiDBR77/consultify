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
  // 5. KNOWN GAP (GAP-1, not fixed here — integrator change request) —
  //    draft packs are readable by any org member via the read path.
  // -------------------------------------------------------------------------
  describe('5. KNOWN GAP characterization — GAP-1 unpublished pack browsability', () => {
    it('KNOWN GAP (unfixed, integrator-owned): plain org member CAN list a DRAFT pack because packs.routes.ts GET / and GET /:id apply no capability check and no publication_status filter unless the caller explicitly passes ?status=published', async () => {
      const draft = await createDraftPack({
        packKey: `aud-rights-gap1-${randomUUID()}`,
        title: 'Pakiet roboczy — nie do publikacji jeszcze',
      });
      await packService.replaceCriteria(adminActor, draft.id, [validLeafCriterion]);
      expect(draft.publicationStatus).toBe('draft');

      // memberActor has NO admin platformRole and NO pack.write/publish
      // capability, yet listPacks/getPack — the exact functions the route
      // calls with zero capability gate — return the draft pack anyway.
      const listed = await packService.listPacks(orgA, {});
      expect(listed.items.some((p) => p.id === draft.id)).toBe(true);

      const fetched = await packService.getPack(orgA, draft.id);
      expect(fetched.id).toBe(draft.id);
      expect(fetched.publicationStatus).toBe('draft');

      // Explicit status filter DOES narrow correctly — the gap is only that
      // it is opt-in, not the default.
      const filtered = await packService.listPacks(orgA, { status: 'published' });
      expect(filtered.items.some((p) => p.id === draft.id)).toBe(false);
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
