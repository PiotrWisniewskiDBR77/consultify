/**
 * ROI-E007 Stream C — `roiFinanceReconciliationAdapter` + the repaired
 * `PUT /api/economics/analyses/:id/benefits`, proved against a REAL
 * PostgreSQL.
 *
 * A mocked DB cannot prove ANY of the claims this suite exists to make. The
 * central one — "a recorded `benefit_tracking.actual_cost_savings` is not
 * overwritten, and the endpoint does not 500" — is a claim about a plpgsql
 * TRIGGER (`trg_benefit_tracking_deny_actual_overwrite`,
 * `server/migrations/20260809_finance_v3_e007_03_legacy_actual_protection.sql`)
 * that simply does not exist in a mock. The others are claims about the
 * canonical seam's CHECK constraints, CAS `row_version` and event/outbox
 * writes. Everything below therefore runs against a throwaway cluster or
 * reports SKIPPED — never a false green.
 *
 * Same env-var contract as this repo's other `.pg.test.ts` suites
 * (`RUN_DB_TESTS=1`, `MOCK_DB=false`, `DATABASE_URL=postgresql://...`,
 * `DB_TYPE=postgres`), `describe.skipIf`-gated, shape copied from
 * `canonicalServices.pg.test.ts` / Stream B's
 * `roiFinanceLinkAdapter.pg.test.ts`.
 *
 * HOW TO RUN (your own ephemeral cluster — NEVER the shared local Postgres,
 * NEVER demo/staging/prod):
 *
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://postgres@127.0.0.1:<port>/<db> \
 *   npx vitest run --config server/vitest.config.ts \
 *     server/src/services/finance/canonical/__tests__/roiFinanceReconciliationAdapter.pg.test.ts \
 *     --no-file-parallelism
 *
 * SCHEMA PREREQUISITE handled by `beforeAll`, not assumed:
 * `benefit_tracking` (migrations 067/068) is silently EXCLUDED by
 * `migrate.postgres.ts`'s `isSqliteOnlyMigration()` on a strict fresh
 * install — the protection migration's own header documents this and guards
 * its trigger block behind `to_regclass()`, so a freshly migrated database
 * has NEITHER the table NOR the triggers. `beforeAll` creates the table in
 * its Postgres shape when missing and then executes the REAL protection
 * migration file verbatim off disk, so the trigger under test is the
 * production artifact, not a re-typed approximation.
 *
 * TENANCY / cleanup: one freshly generated org/initiative/case per run;
 * `afterAll` removes this suite's `benefit_tracking` and
 * `rvn_roi_finance_links` rows (both are deletable — `benefit_tracking`'s
 * DELETE guard is dropped for the cleanup statement and restored right
 * after) but not `rvn_roi_cases`/`rvn_platform_events`, which are
 * append-only, exactly as `canonicalServices.pg.test.ts` documents.
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import express, { type Express } from 'express';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');
if (REAL_PG_REQUESTED) {
  process.env.DB_TYPE = 'postgres';
}
const REAL_PG = REAL_PG_REQUESTED;

/** The only thing mocked in this suite: token verification. Every DB call —
 * including the router's own `DbPromise` writes — goes to the real cluster. */
let mockUser: { id: string; organizationId: string } | null = null;
vi.mock('../../../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: () => void) => {
    if (!mockUser) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }
    req.user = mockUser;
    next();
  },
}));

// `fileURLToPath`, not `new URL(...).pathname` — see the note in `coldReopen.pg.test.ts`: the
// latter stays percent-encoded and breaks under any checkout path containing a space.
const MIGRATIONS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../../migrations'
);
const PROTECTION_MIGRATION = path.join(
  MIGRATIONS_DIR,
  '20260809_finance_v3_e007_03_legacy_actual_protection.sql'
);

/** Postgres shape of `benefit_tracking` as the live demo/dev databases hold
 * it (migrations 067 + 068's `tracking_period` ALTER), minus the
 * `initiative_financials` FK — that table is excluded by the same
 * `isSqliteOnlyMigration()` rule, and the route under test inserts
 * `financial_id = NULL` anyway. Only used when the table is absent. */
const BENEFIT_TRACKING_DDL = `
  CREATE TABLE IF NOT EXISTS benefit_tracking (
    id TEXT PRIMARY KEY,
    financial_id TEXT NULL,
    initiative_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    period_type TEXT DEFAULT 'monthly',
    tracking_period TEXT NULL,
    planned_cost_savings REAL DEFAULT 0,
    planned_revenue_increase REAL DEFAULT 0,
    planned_productivity_gains REAL DEFAULT 0,
    actual_cost_savings REAL DEFAULT 0,
    actual_revenue_increase REAL DEFAULT 0,
    actual_productivity_gains REAL DEFAULT 0,
    variance_cost_savings_percent REAL,
    variance_revenue_percent REAL,
    variance_productivity_percent REAL,
    overall_variance_percent REAL,
    variance_notes TEXT,
    achievements TEXT,
    challenges TEXT,
    evidence_links TEXT,
    verified_by TEXT,
    verified_at TIMESTAMPTZ,
    verification_status TEXT DEFAULT 'pending',
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );
`;

describe.skipIf(!REAL_PG)(
  'ROI-E007 Stream C — reconciliation adapter + benefits endpoint (real PostgreSQL)',
  () => {
    let adapter: typeof import('../roiFinanceReconciliationAdapter.js');
    let roiCaseCommands: typeof import('../../../resultsVnext/roi/roiCaseCommands.js');
    let roiFinanceLinkCommands: typeof import('../../../resultsVnext/roi/roiFinanceLinkCommands.js');
    let economicsRoutes: express.Router;

    /** A raw client, separate from the app's pool, used for schema prep and
     * for OUT-OF-BAND verification reads — asserting the stored value through
     * the same code path that wrote it would prove nothing. */
    let raw: pg.Client;

    const orgId = `org-roi-e007-c-${randomUUID()}`;
    const userId = `user-roi-e007-c-${randomUUID()}`;
    const initiativeWithCase = `init-with-case-${randomUUID()}`;
    const initiativeWithoutCase = `init-no-case-${randomUUID()}`;
    const analysisWithCase = `analysis-with-case-${randomUUID()}`;
    const analysisWithoutCase = `analysis-no-case-${randomUUID()}`;

    let caseId: string;
    let linkId: string;
    const createdLinkIds: string[] = [];

    function createApp(): Express {
      const app = express();
      app.use(express.json());
      app.use('/api/economics', economicsRoutes);
      return app;
    }

    beforeAll(async () => {
      raw = new pg.Client({ connectionString: CONNECTION_STRING });
      await raw.connect();

      // --- schema prerequisite (see header) ---
      const hasTable = await raw.query<{ reg: string | null }>(
        `SELECT to_regclass('public.benefit_tracking')::text AS reg`
      );
      if (!hasTable.rows[0]?.reg) {
        await raw.query(BENEFIT_TRACKING_DDL);
      }
      // The REAL migration file, verbatim — the trigger this suite tests must
      // be the production one, byte for byte.
      await raw.query(readFileSync(PROTECTION_MIGRATION, 'utf8'));

      const triggers = await raw.query<{ tgname: string }>(
        `SELECT tgname FROM pg_trigger WHERE tgrelid = 'benefit_tracking'::regclass AND NOT tgisinternal`
      );
      const names = triggers.rows.map((r) => r.tgname);
      if (!names.includes('trg_benefit_tracking_deny_actual_overwrite')) {
        throw new Error(
          `fixture setup: append-only trigger missing after applying the real migration (${names.join(', ') || 'none'})`
        );
      }

      adapter = await import('../roiFinanceReconciliationAdapter.js');
      roiCaseCommands = await import('../../../resultsVnext/roi/roiCaseCommands.js');
      roiFinanceLinkCommands = await import('../../../resultsVnext/roi/roiFinanceLinkCommands.js');
      economicsRoutes = (await import('../../../../routes/economics.routes.js')).default;

      // --- fixtures ---
      await raw.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
        orgId,
        'ROI-E007 Stream C Org',
      ]);
      for (const [initId, label] of [
        [initiativeWithCase, 'Initiative WITH a ROI case'],
        [initiativeWithoutCase, 'Initiative WITHOUT a ROI case'],
      ]) {
        await raw.query(
          `INSERT INTO initiatives (id, organization_id, status, name) VALUES ($1, $2, 'DRAFT', $3)`,
          [initId, orgId, label]
        );
      }
      await raw.query(
        `INSERT INTO digitization_analyses (id, name, organization_id, initiative_id) VALUES ($1,$2,$3,$4), ($5,$6,$7,$8)`,
        [
          analysisWithCase,
          'Analysis linked to a ROI case',
          orgId,
          initiativeWithCase,
          analysisWithoutCase,
          'Analysis with no ROI case',
          orgId,
          initiativeWithoutCase,
        ]
      );
      // ROI-E001 §5 / RN-G1 §B.3: `createRoiCase` fails closed without an
      // active domain='roi' visibility policy, and `listRoiFinanceLinks`'s
      // ABAC join needs one too.
      await raw.query(
        `INSERT INTO rvn_platform_visibility_policies
         (organization_id, domain, policy_version, visibility_mode, default_scope_type, created_by)
       VALUES ($1,'roi',1,'OPEN_ORG',NULL,$2)`,
        [orgId, userId]
      );

      const caseOutcome = await roiCaseCommands.createRoiCase({
        organizationId: orgId,
        initiativeId: initiativeWithCase,
        title: 'ROI-E007 Stream C Case',
        ownerUserId: userId,
        currency: 'PLN',
        createdBy: userId,
        actorEffectiveRole: 'preparer',
        idempotencyKey: `idem-create-case-${randomUUID()}`,
      });
      caseId = caseOutcome.result.case.caseId;

      const linkOutcome = await roiFinanceLinkCommands.createRoiFinanceLink({
        caseId,
        organizationId: orgId,
        financeArtifactType: 'business_case',
        financeArtifactId: `finance-artifact-${randomUUID()}`,
        financeVersionId: `finance-version-${randomUUID()}`,
        source: 'finance_v3',
        asOf: new Date().toISOString(),
        semanticUnit: 'PLN',
        currency: 'PLN',
        linkPurpose: 'benefit_actuals',
        actorUserId: userId,
        actorEffectiveRole: 'preparer',
        idempotencyKey: `idem-create-link-${randomUUID()}`,
      });
      linkId = linkOutcome.result.linkId;
      createdLinkIds.push(linkId);

      mockUser = { id: userId, organizationId: orgId };
    }, 60_000);

    afterAll(async () => {
      if (!raw) return;
      try {
        // `benefit_tracking`'s DELETE guard is part of the artifact under test;
        // drop it only for this suite's own cleanup, then put it straight back.
        await raw.query(
          `DROP TRIGGER IF EXISTS trg_benefit_tracking_deny_delete ON benefit_tracking`
        );
        await raw.query(`DELETE FROM benefit_tracking WHERE organization_id = $1`, [orgId]);
        await raw.query(
          `CREATE TRIGGER trg_benefit_tracking_deny_delete BEFORE DELETE ON benefit_tracking
           FOR EACH ROW EXECUTE FUNCTION benefit_tracking_deny_actual_overwrite()`
        );
        if (createdLinkIds.length > 0) {
          await raw.query(
            `DELETE FROM rvn_roi_finance_reconciliations WHERE organization_id = $1`,
            [orgId]
          );
          await raw.query(`DELETE FROM rvn_roi_finance_links WHERE link_id = ANY($1::uuid[])`, [
            createdLinkIds,
          ]);
        }
      } finally {
        await raw.end();
      }
    }, 30_000);

    async function readReconciliation(reconciliationId: string) {
      const result = await raw.query(
        `SELECT reconciliation_id, case_id, finance_link_id, roi_value, finance_value, status,
              opened_by, resolved_by, resolution_notes, row_version
         FROM rvn_roi_finance_reconciliations WHERE reconciliation_id = $1`,
        [reconciliationId]
      );
      return result.rows[0] ?? null;
    }

    async function readStoredActual(
      initiativeId: string,
      trackingPeriod: string
    ): Promise<number | null> {
      const result = await raw.query<{ actual_cost_savings: number | null }>(
        `SELECT actual_cost_savings FROM benefit_tracking
        WHERE organization_id = $1 AND initiative_id = $2 AND tracking_period = $3`,
        [orgId, initiativeId, trackingPeriod]
      );
      const row = result.rows[0];
      return row ? Number(row.actual_cost_savings) : null;
    }

    // ============================================================
    // 1. detectAndReconcile — the 5% materiality threshold
    // ============================================================

    describe('detectAndReconcile', () => {
      it('opens a reconciliation ABOVE the threshold, with explicit scalar roi_value/finance_value', async () => {
        // 100 -> 120 = 20% divergence, four times the provisional 5% threshold.
        const result = await adapter.detectAndReconcile({
          organizationId: orgId,
          caseId,
          linkId,
          roiValue: 100,
          financeValue: 120,
          actorId: userId,
          divergenceReason: 'Finance restated Q1 savings',
        });

        expect(result.material).toBe(true);
        expect(result.reconciliationOpened).toBe(true);
        expect(result.divergencePercent).toBeCloseTo(20, 6);
        expect(result.thresholdPercent).toBe(adapter.PROVISIONAL_MATERIALITY_THRESHOLD_PCT);
        expect(result.reconciliationId).toBeTruthy();

        // Read back OUT OF BAND: the seam stores jawne skalary, not a jsonb blob.
        const row = await readReconciliation(result.reconciliationId!);
        expect(row).not.toBeNull();
        expect(Number(row.roi_value)).toBe(100);
        expect(Number(row.finance_value)).toBe(120);
        expect(row.status).toBe('open');
        expect(row.case_id).toBe(caseId);
        expect(row.finance_link_id).toBe(linkId);
        expect(row.opened_by).toBe(userId);
        expect(row.resolved_by).toBeNull();
      });

      it('writes NOTHING below the threshold (no row, no event)', async () => {
        const before = await raw.query<{ n: string }>(
          `SELECT count(*)::text AS n FROM rvn_roi_finance_reconciliations WHERE case_id = $1`,
          [caseId]
        );
        const eventsBefore = await raw.query<{ n: string }>(
          `SELECT count(*)::text AS n FROM rvn_platform_events WHERE organization_id = $1`,
          [orgId]
        );

        // 100 -> 104 = 4% divergence, inside the tolerance band.
        const result = await adapter.detectAndReconcile({
          organizationId: orgId,
          caseId,
          linkId,
          roiValue: 100,
          financeValue: 104,
          actorId: userId,
        });

        expect(result.material).toBe(false);
        expect(result.reconciliationOpened).toBe(false);
        expect(result.reconciliationId).toBeNull();
        expect(result.divergencePercent).toBeCloseTo(4, 6);

        const after = await raw.query<{ n: string }>(
          `SELECT count(*)::text AS n FROM rvn_roi_finance_reconciliations WHERE case_id = $1`,
          [caseId]
        );
        const eventsAfter = await raw.query<{ n: string }>(
          `SELECT count(*)::text AS n FROM rvn_platform_events WHERE organization_id = $1`,
          [orgId]
        );
        expect(after.rows[0].n).toBe(before.rows[0].n);
        expect(eventsAfter.rows[0].n).toBe(eventsBefore.rows[0].n);
      });

      it('treats a divergence exactly AT the threshold as immaterial (inclusive tolerance edge)', async () => {
        const result = await adapter.detectAndReconcile({
          organizationId: orgId,
          caseId,
          linkId,
          roiValue: 100,
          financeValue: 105,
          actorId: userId,
        });
        expect(result.divergencePercent).toBeCloseTo(5, 6);
        expect(result.material).toBe(false);
        expect(result.reconciliationOpened).toBe(false);
      });

      it('honours a caller-supplied threshold (per-org override once the owner decides)', async () => {
        const result = await adapter.detectAndReconcile({
          organizationId: orgId,
          caseId,
          linkId,
          roiValue: 100,
          financeValue: 102,
          actorId: userId,
          thresholdPercent: 1,
        });
        expect(result.material).toBe(true);
        expect(result.reconciliationOpened).toBe(true);
        expect(result.thresholdPercent).toBe(1);
      });

      it('rejects a link that does not belong to the case (canonical validation, not ours)', async () => {
        await expect(
          adapter.detectAndReconcile({
            organizationId: orgId,
            caseId,
            linkId: randomUUID(),
            roiValue: 100,
            financeValue: 500,
            actorId: userId,
          })
        ).rejects.toMatchObject({ code: 'FINANCE_LINK_NOT_FOUND' });
      });

      it('never touches the legacy actual stores', async () => {
        const realized = await raw.query<{ n: string }>(
          `SELECT count(*)::text AS n FROM roi_realized_values WHERE organization_id = $1`,
          [orgId]
        );
        expect(realized.rows[0].n).toBe('0');
      });
    });

    // ============================================================
    // 2. resolveReconciliationDecision
    // ============================================================

    describe('resolveReconciliationDecision', () => {
      async function openOne(): Promise<string> {
        const opened = await adapter.detectAndReconcile({
          organizationId: orgId,
          caseId,
          linkId,
          roiValue: 200,
          financeValue: 300,
          actorId: userId,
        });
        return opened.reconciliationId!;
      }

      it("closes with 'resolved', stamping resolved_by/notes and bumping row_version", async () => {
        const id = await openOne();
        const before = await readReconciliation(id);

        const updated = await adapter.resolveReconciliationDecision(
          id,
          `resolver-${userId}`,
          'Finance corrected its own mapping; ROI figure stands.',
          'resolved',
          { organizationId: orgId }
        );

        expect(updated.status).toBe('resolved');
        expect(updated.resolvedBy).toBe(`resolver-${userId}`);
        expect(updated.rowVersion).toBe(Number(before.row_version) + 1);

        const row = await readReconciliation(id);
        expect(row.status).toBe('resolved');
        expect(row.resolved_by).toBe(`resolver-${userId}`);
        expect(row.resolution_notes).toBe('Finance corrected its own mapping; ROI figure stands.');
        // The two scalars are the durable record of the divergence — closing
        // the reconciliation must not rewrite them.
        expect(Number(row.roi_value)).toBe(200);
        expect(Number(row.finance_value)).toBe(300);
      });

      it("closes with 'accepted_divergence'", async () => {
        const id = await openOne();
        const updated = await adapter.resolveReconciliationDecision(
          id,
          userId,
          'Known FX timing difference, accepted by the CFO.',
          'accepted_divergence',
          { organizationId: orgId }
        );
        expect(updated.status).toBe('accepted_divergence');
        expect(updated.resolvedAt).toBeTruthy();
      });

      it('respects CAS: a stale expectedVersion is rejected, the row is untouched', async () => {
        const id = await openOne();
        await expect(
          adapter.resolveReconciliationDecision(id, userId, 'stale attempt', 'resolved', {
            organizationId: orgId,
            expectedVersion: 99,
          })
        ).rejects.toMatchObject({ code: 'STALE_VERSION' });

        const row = await readReconciliation(id);
        expect(row.status).toBe('open');
        expect(row.resolved_by).toBeNull();
      });

      it('hides a reconciliation from another organization behind NOT_FOUND', async () => {
        const id = await openOne();
        await expect(
          adapter.resolveReconciliationDecision(id, userId, null, 'resolved', {
            organizationId: `other-org-${randomUUID()}`,
          })
        ).rejects.toMatchObject({ code: 'RECONCILIATION_NOT_FOUND' });
      });

      it('rejects a non-terminal resolution', async () => {
        const id = await openOne();
        await expect(
          adapter.resolveReconciliationDecision(id, userId, null, 'investigating' as never, {
            organizationId: orgId,
          })
        ).rejects.toMatchObject({ code: 'INVALID_RECONCILIATION_RESOLUTION' });
      });
    });

    // ============================================================
    // 3. REGRESSION A / B — PUT /api/economics/analyses/:id/benefits
    // ============================================================

    describe('PUT /api/economics/analyses/:id/benefits', () => {
      it('REGRESSION A: divergent actual WITH a ROI case + link -> 200 + reconciliationId, stored actual UNCHANGED', async () => {
        const trackingPeriod = `2026-Q1-${randomUUID().slice(0, 8)}`;

        // Seed the period row through the endpoint itself — the INSERT path is
        // legitimate (the trigger only guards UPDATE/DELETE).
        const seeded = await request(createApp())
          .put(`/api/economics/analyses/${analysisWithCase}/benefits`)
          .send({ trackingPeriod, plannedBenefits: 1000, actualBenefits: 900 });
        expect(seeded.status).toBe(200);
        expect(await readStoredActual(initiativeWithCase, trackingPeriod)).toBe(900);

        // Now try to overwrite the recorded actual: 900 -> 1500 (66.7%).
        const res = await request(createApp())
          .put(`/api/economics/analyses/${analysisWithCase}/benefits`)
          .send({ trackingPeriod, plannedBenefits: 1200, actualBenefits: 1500 });

        expect(res.status).toBe(200); // explicitly NOT 500
        expect(res.body.success).toBe(true);
        expect(res.body.actualBenefitsWriteRejected).toBe(true);
        expect(res.body.reconciliationId).toBeTruthy();
        expect(res.body.reconciliationOpened).toBe(true);
        expect(res.body.storedActualBenefits).toBe(900);
        expect(res.body.requestedActualBenefits).toBe(1500);

        // The whole point: the recorded actual survived.
        expect(await readStoredActual(initiativeWithCase, trackingPeriod)).toBe(900);

        // The rest of the request still landed.
        const row = await raw.query<{
          planned_cost_savings: number;
          overall_variance_percent: number;
        }>(
          `SELECT planned_cost_savings, overall_variance_percent FROM benefit_tracking
          WHERE organization_id = $1 AND initiative_id = $2 AND tracking_period = $3`,
          [orgId, initiativeWithCase, trackingPeriod]
        );
        expect(Number(row.rows[0].planned_cost_savings)).toBe(1200);
        // Variance is derived from the STORED actual (900), not the rejected 1500.
        expect(Number(row.rows[0].overall_variance_percent)).toBeCloseTo(
          ((900 - 1200) / 1200) * 100,
          4
        );

        // And the divergence is a durable record carrying both scalars.
        const rec = await readReconciliation(res.body.reconciliationId);
        expect(Number(rec.roi_value)).toBe(900);
        expect(Number(rec.finance_value)).toBe(1500);
        expect(rec.status).toBe('open');
        expect(rec.case_id).toBe(caseId);
      });

      it('REGRESSION B: divergent actual WITHOUT a ROI case -> 409, value unchanged, NOT 500', async () => {
        const trackingPeriod = `2026-Q2-${randomUUID().slice(0, 8)}`;

        const seeded = await request(createApp())
          .put(`/api/economics/analyses/${analysisWithoutCase}/benefits`)
          .send({ trackingPeriod, plannedBenefits: 500, actualBenefits: 400 });
        expect(seeded.status).toBe(200);
        expect(await readStoredActual(initiativeWithoutCase, trackingPeriod)).toBe(400);

        const res = await request(createApp())
          .put(`/api/economics/analyses/${analysisWithoutCase}/benefits`)
          .send({ trackingPeriod, plannedBenefits: 500, actualBenefits: 999 });

        expect(res.status).toBe(409);
        expect(res.status).not.toBe(500);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toBe('ROI_RECONCILIATION_TARGET_MISSING');
        expect(res.body.reason).toBe('NO_ACTIVE_ROI_CASE');
        expect(res.body.storedActualBenefits).toBe(400);
        expect(res.body.message).toContain('Brak powiązanego ROI Case — wartość niezmieniona');

        // Nothing changed at all — not even the columns the trigger allows,
        // because the handler refuses before mutating anything.
        expect(await readStoredActual(initiativeWithoutCase, trackingPeriod)).toBe(400);
        const row = await raw.query<{ planned_cost_savings: number }>(
          `SELECT planned_cost_savings FROM benefit_tracking
          WHERE organization_id = $1 AND initiative_id = $2 AND tracking_period = $3`,
          [orgId, initiativeWithoutCase, trackingPeriod]
        );
        expect(Number(row.rows[0].planned_cost_savings)).toBe(500);
      });

      it('an UNCHANGED actual still saves normally (the ordinary verify-a-period flow is not broken)', async () => {
        const trackingPeriod = `2026-Q3-${randomUUID().slice(0, 8)}`;

        await request(createApp())
          .put(`/api/economics/analyses/${analysisWithCase}/benefits`)
          .send({ trackingPeriod, plannedBenefits: 100, actualBenefits: 80 });

        const res = await request(createApp())
          .put(`/api/economics/analyses/${analysisWithCase}/benefits`)
          .send({ trackingPeriod, plannedBenefits: 150, actualBenefits: 80 });

        expect(res.status).toBe(200);
        expect(res.body.actualBenefitsWriteRejected).toBeUndefined();
        expect(await readStoredActual(initiativeWithCase, trackingPeriod)).toBe(80);
        const row = await raw.query<{ planned_cost_savings: number }>(
          `SELECT planned_cost_savings FROM benefit_tracking
          WHERE organization_id = $1 AND initiative_id = $2 AND tracking_period = $3`,
          [orgId, initiativeWithCase, trackingPeriod]
        );
        expect(Number(row.rows[0].planned_cost_savings)).toBe(150);
      });

      it('a sub-threshold divergence still refuses the overwrite, and says so instead of claiming a plain success', async () => {
        const trackingPeriod = `2026-Q4-${randomUUID().slice(0, 8)}`;

        await request(createApp())
          .put(`/api/economics/analyses/${analysisWithCase}/benefits`)
          .send({ trackingPeriod, plannedBenefits: 1000, actualBenefits: 1000 });

        // 1000 -> 1020 = 2%, below the provisional 5% threshold.
        const res = await request(createApp())
          .put(`/api/economics/analyses/${analysisWithCase}/benefits`)
          .send({ trackingPeriod, plannedBenefits: 1000, actualBenefits: 1020 });

        expect(res.status).toBe(200);
        expect(res.body.actualBenefitsWriteRejected).toBe(true);
        expect(res.body.reconciliationOpened).toBe(false);
        expect(res.body.reconciliationId).toBeNull();
        expect(await readStoredActual(initiativeWithCase, trackingPeriod)).toBe(1000);
      });
    });

    // ============================================================
    // 4. NEGATIVE CONTROL — does the harness actually detect a regression?
    // ============================================================

    describe('negative control', () => {
      it('the raw pre-migration UPDATE really is rejected by the trigger (proves the tests above are not vacuous)', async () => {
        const trackingPeriod = `2026-NEG-${randomUUID().slice(0, 8)}`;
        await request(createApp())
          .put(`/api/economics/analyses/${analysisWithCase}/benefits`)
          .send({ trackingPeriod, plannedBenefits: 10, actualBenefits: 10 });

        // The endpoint's OLD statement, verbatim. If this succeeded, every
        // "value unchanged" assertion above would be meaningless.
        await expect(
          raw.query(
            `UPDATE benefit_tracking SET planned_cost_savings = $1, actual_cost_savings = $2,
                  overall_variance_percent = $3, updated_at = now()
            WHERE organization_id = $4 AND initiative_id = $5 AND tracking_period = $6`,
            [10, 99999, 0, orgId, initiativeWithCase, trackingPeriod]
          )
        ).rejects.toThrow(/append-only/i);

        expect(await readStoredActual(initiativeWithCase, trackingPeriod)).toBe(10);
      });
    });
  }
);
