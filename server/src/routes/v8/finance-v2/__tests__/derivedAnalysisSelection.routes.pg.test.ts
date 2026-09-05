/**
 * F-P4 / F-P5 — trasa `POST /api/v8/finance-v2/versions/:sourceVersionId/derived-analysis`
 * zakłada DEFINICJĘ ANALIZY i WIERSZE SELEKCJI wskaźników, a `POST /analysis/:bv/compute`
 * zwraca `resultsCount > 0`. Realne HTTP + realny PostgreSQL.
 *
 * Po co osobny plik obok `lineage-navigator.routes.pg.test.ts`: tamta suita sprawdza
 * idempotencję/rodowód i robi to przez PODPISANY JWT (trzy jej testy `DERIVED ANALYSIS` są
 * czerwone na 401 także na czystym `origin/staging` — zastane, zmierzone przed tą paczką).
 * Ta suita używa niepodpisanego harnessu (`req.v8Context` wstrzykiwany), tak jak `appA` tamże,
 * więc mierzy WYŁĄCZNIE nowe zachowanie: czy przewód „kreator → selekcja → wskaźniki" istnieje.
 *
 * Zabezpieczenie, w które celuje mutacja: „analiza utworzona z pakietu MUSI mieć z czego liczyć".
 */
import { randomUUID } from 'node:crypto';

import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');
if (REAL_PG_REQUESTED) {
  process.env.DB_TYPE = 'postgres';
}
const REAL_PG = REAL_PG_REQUESTED;

describe.skipIf(!REAL_PG)(
  'F-P4 derived-analysis → selekcja wskaźników (realne HTTP + realny PostgreSQL)',
  () => {
    let withPinnedPostgresTransaction: typeof import('../../../../database/PostgresDatabase.js').withPinnedPostgresTransaction;
    let av: typeof import('../../../../services/finance/canonical/artifactVersionService.js');
    let app: express.Express;

    const orgId = `org-fp4-http-${randomUUID()}`;
    const userId = `user-fp4-http-${randomUUID()}`;
    let calendarId = '';
    let periodIds: string[] = [];
    let catalogCount = 0;

    async function makePack() {
      const pack = await av.createArtifact({
        organizationId: orgId,
        artifactType: 'STATEMENT_PACK',
        createdBy: userId,
      });
      return pack.businessVersion.business_version_id;
    }

    async function seedPackContent(packBvId: string) {
      const entity = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ id: string }>(
          `INSERT INTO finance_stmt_entities (
           organization_id, business_version_id, entity_code, legal_name, role,
           consolidation_method, ownership_pct, functional_currency, created_by
         ) VALUES (?, ?, ?, 'DBR77-podobna sp. z o.o.', 'GROUP_PARENT', 'NOT_CONSOLIDATED', NULL, 'PLN', ?)
         RETURNING id`,
          [orgId, packBvId, `PARENT-${randomUUID().slice(0, 8)}`, userId]
        )
      );
      if (!entity) throw new Error('entity fixture insert returned no row');
      for (const periodId of periodIds) {
        for (const [code, type, value] of [
          ['REVENUE', 'P&L', 182_000_000],
          ['GROSS_MARGIN', 'P&L', 64_000_000],
          ['NET_INCOME', 'P&L', 17_010_000],
          ['CFO', 'CF', 15_000_000],
          ['CURRENT_ASSETS', 'BS', 56_500_000],
          ['CURRENT_LIABILITIES', 'BS', 17_500_000],
          ['LONG_TERM_DEBT', 'BS', 40_500_000],
          ['EQUITY', 'BS', 100_000_000],
          ['AR', 'BS', 26_000_000],
        ] as Array<[string, string, number]>) {
          const line = await withPinnedPostgresTransaction((tx) =>
            tx.queryOne<{ id: string }>(
              `SELECT id FROM financial_statement_lines WHERE line_code = ? AND organization_id IS NULL LIMIT 1`,
              [code]
            )
          );
          if (!line) throw new Error(`financial_statement_lines seed row not found for ${code}`);
          await withPinnedPostgresTransaction((tx) =>
            tx.queryRun(
              `INSERT INTO finance_stmt_lines (
               organization_id, business_version_id, statement_type, canonical_line_id, entity_id, period_id,
               accumulation_basis, consolidation_scope, value_status, value_decimal, native_currency,
               presentation_currency, unit, sign_convention, accounting_policy, created_by
             ) VALUES (?, ?, ?, ?, ?, ?, 'FULL_YEAR', 'CONSOLIDATED', 'PRESENT_NONZERO', ?, 'PLN', 'PLN', 'UNITS', 'NATURAL', 'IFRS', ?)`,
              [orgId, packBvId, type, line.id, entity.id, periodId, value, userId]
            )
          );
        }
      }
    }

    beforeAll(async () => {
      ({ withPinnedPostgresTransaction } =
        await import('../../../../database/PostgresDatabase.js'));
      av = await import('../../../../services/finance/canonical/artifactVersionService.js');
      const financeV2Router = (await import('../index.js')).default;

      app = express();
      app.use(express.json());
      app.use((req: any, _res, next) => {
        req.user = { id: userId, organizationId: orgId, role: 'finance_admin' };
        req.v8Context = { organizationId: orgId, userId, userRole: 'finance_admin' };
        next();
      });
      app.use('/api/v8/finance-v2', financeV2Router);
      app.use((err: any, _req: any, res: any, _next: any) =>
        res.status(500).json({ error: String(err?.message || err) })
      );

      await withPinnedPostgresTransaction((tx) =>
        tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [
          orgId,
          'F-P4 HTTP Test Org',
        ])
      );
      // Ściana członkostwa (`requireActiveMembership` + `requireFinanceEditorMembership`) czyta
      // `organization_members` PRZY KAŻDYM żądaniu — bez tego wiersza zapis to 403, nie 201/409.
      await withPinnedPostgresTransaction(async (tx) => {
        await tx.queryRun(
          `INSERT INTO users (id, organization_id, email, password, role, status, created_at)
         VALUES (?, ?, ?, 'unused', 'ADMIN', 'active', ?)`,
          [userId, orgId, `${userId}@test.invalid`, new Date().toISOString()]
        );
        await tx.queryRun(
          `INSERT INTO organization_members (id, organization_id, user_id, role, status)
         VALUES (?, ?, ?, 'ADMIN', 'ACTIVE')`,
          [`mem-${userId}`, orgId, userId]
        );
      });
      const cal = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ fiscal_calendar_id: string }>(
          `INSERT INTO finance_stmt_calendars (organization_id, calendar_type, fiscal_year_end_month, effective_from, created_by)
         VALUES (?, 'STANDARD', 12, '2020-01-01', ?) RETURNING fiscal_calendar_id`,
          [orgId, userId]
        )
      );
      calendarId = cal!.fiscal_calendar_id;

      const p24 = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ period_id: string }>(
          `INSERT INTO finance_stmt_periods (organization_id, fiscal_calendar_id, period_type, fiscal_year, period_start, period_end, label, created_by)
         VALUES (?, ?, 'FY', 2024, '2024-01-01', '2024-12-31', 'FY2024', ?) RETURNING period_id`,
          [orgId, calendarId, userId]
        )
      );
      const p25 = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ period_id: string }>(
          `INSERT INTO finance_stmt_periods (organization_id, fiscal_calendar_id, period_type, fiscal_year, period_start, period_end, label, previous_period_id, created_by)
         VALUES (?, ?, 'FY', 2025, '2025-01-01', '2025-12-31', 'FY2025', ?, ?) RETURNING period_id`,
          [orgId, calendarId, p24!.period_id, userId]
        )
      );
      periodIds = [p24!.period_id, p25!.period_id];

      const catalog = await withPinnedPostgresTransaction((tx) =>
        tx.queryAll<{ id: string }>(
          `SELECT id FROM finance_analysis_kpi_catalog
          WHERE status = 'ACTIVE' AND tier = 'UNIVERSAL' AND organization_id IS NULL`
        )
      );
      catalogCount = catalog.length;
      expect(catalogCount).toBe(18);
    });

    afterAll(async () => {
      await withPinnedPostgresTransaction(async (tx) => {
        await tx.queryRun(`DELETE FROM finance_analysis_kpi_values WHERE organization_id = ?`, [
          orgId,
        ]);
        await tx.queryRun(`DELETE FROM finance_analysis_definitions WHERE organization_id = ?`, [
          orgId,
        ]);
        await tx.queryRun(`DELETE FROM finance_stmt_lines WHERE organization_id = ?`, [orgId]);
        await tx.queryRun(`DELETE FROM finance_stmt_entities WHERE organization_id = ?`, [orgId]);
        await tx.queryRun(`DELETE FROM finance_stmt_periods WHERE organization_id = ?`, [orgId]);
        await tx.queryRun(`DELETE FROM finance_stmt_calendars WHERE organization_id = ?`, [orgId]);
        await tx.queryRun(`DELETE FROM organization_members WHERE organization_id = ?`, [orgId]);
        await tx.queryRun(`DELETE FROM users WHERE organization_id = ?`, [orgId]);
      });
    });

    it('201: analiza z pakietu ma definicję, nazwę własną i komplet wierszy selekcji; compute liczy > 0', async () => {
      const packBvId = await makePack();
      await seedPackContent(packBvId);

      const created = await request(app)
        .post(`/api/v8/finance-v2/versions/${packBvId}/derived-analysis`)
        .set('Idempotency-Key', randomUUID())
        .send({ name: 'Analiza DBR77 2024–2025' });

      expect(created.status).toBe(201);
      expect(created.body.data.selection).toBeTruthy();
      expect(created.body.data.selection.selectionRowsTotal).toBe(catalogCount * periodIds.length);
      expect(created.body.data.selection.analysisName).toBe('Analiza DBR77 2024–2025');

      const analysisBvId = created.body.data.businessVersionId;

      // Odczyt na zimno — nie przez odpowiedź HTTP.
      const cold = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ selection: number; definitions: number; edges: number }>(
          `SELECT
           (SELECT count(*)::int FROM finance_analysis_kpi_values WHERE business_version_id = ?) AS selection,
           (SELECT count(*)::int FROM finance_analysis_definitions WHERE business_version_id = ?) AS definitions,
           (SELECT count(*)::int FROM finance_lineage_edges WHERE target_version_id = ? AND edge_type = 'STATEMENT_TO_ANALYSIS') AS edges`,
          [analysisBvId, analysisBvId, analysisBvId]
        )
      );
      expect(cold).toEqual({
        selection: catalogCount * periodIds.length,
        definitions: 1,
        edges: 1,
      });

      // Ścieżka właściciela: „utwórz i przelicz".
      const computed = await request(app)
        .post(`/api/v8/finance-v2/analysis/${analysisBvId}/compute`)
        .send({});
      expect(computed.status).toBe(200);
      expect(computed.body.data.resultsCount).toBeGreaterThan(0);
      expect(computed.body.data.resultsCount).toBe(catalogCount * periodIds.length);
    });

    it('409 + ZERO zapisu: pakiet bez okresów nie tworzy analizy-widma ani krawędzi rodowodu', async () => {
      const emptyPackBvId = await makePack();

      const before = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ artifacts: number; edges: number }>(
          `SELECT
           (SELECT count(*)::int FROM finance_artifacts WHERE organization_id = ? AND artifact_type = 'HISTORICAL_ANALYSIS') AS artifacts,
           (SELECT count(*)::int FROM finance_lineage_edges WHERE organization_id = ?) AS edges`,
          [orgId, orgId]
        )
      );

      const refused = await request(app)
        .post(`/api/v8/finance-v2/versions/${emptyPackBvId}/derived-analysis`)
        .set('Idempotency-Key', randomUUID())
        .send({});

      expect(refused.status).toBe(409);
      expect(refused.body.code).toBe('SOURCE_PACK_HAS_NO_ENTITIES');
      expect(String(refused.body.error)).toMatch(/jednostek/);

      const after = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ artifacts: number; edges: number }>(
          `SELECT
           (SELECT count(*)::int FROM finance_artifacts WHERE organization_id = ? AND artifact_type = 'HISTORICAL_ANALYSIS') AS artifacts,
           (SELECT count(*)::int FROM finance_lineage_edges WHERE organization_id = ?) AS edges`,
          [orgId, orgId]
        )
      );
      // Krawędzie rodowodu są APPEND-ONLY — analiza-widmo zostałaby w grafie na zawsze.
      expect(after).toEqual(before);
    });
  }
);
