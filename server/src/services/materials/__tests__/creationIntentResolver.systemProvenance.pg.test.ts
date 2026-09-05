/** @vitest-environment node */

/**
 * creationIntent.ts — system-template provenance bypass, real PostgreSQL.
 *
 * ===========================================================================
 * WHAT WAS BROKEN (AGENT_WZORCE_SYSTEMOWE_ATESTACJA_20260905, decyzja CTO)
 * ===========================================================================
 * "Użyj wzorca" odrzucał z 409 `TEMPLATE_PROVENANCE_UNVERIFIED` KAŻDY
 * wzorzec, którego `provenance_status <> 'approved'` — bez rozróżnienia
 * systemowy/organizacji. Migracja `20261017_material_export_policy_provenance.sql`
 * ustawiła `provenance_status DEFAULT 'unknown'` na WSZYSTKICH historycznych
 * wierszach trzech rejestrów (`document_studio_templates`,
 * `report_builder_templates`, `presentation_templates`), łącznie z wzorcami
 * SYSTEMOWYMI dostarczonymi z produktem (np. „DRD Full Diagnostic Report",
 * `organization_id IS NULL` / `SYSTEM_ORG_ID`). Kolejka atestacji
 * (`listPendingTemplateProvenance` / `approveTemplateProvenance`,
 * `deliverableTemplateService.ts`) filtruje `organization_id = <wołający>` —
 * SYSTEM_ORG_ID nigdy nie jest "wołającym", więc wzorzec systemowy NIE MIAŁ i
 * NIE MÓGŁ MIEĆ drogi do atestacji. Efekt: żaden wzorzec systemowy nie
 * działał nikomu, na żadnym koncie.
 *
 * DECYZJA CTO 2026-09-05: wzorzec systemowy dostarczony z produktem jest
 * zaufany Z DEFINICJI (pochodzenie: „systemowy Consultify", prawa: „licencja
 * produktu") — trzy resolwery w `creationIntent.ts` pomijają
 * `provenance_status` dla wiersza systemowego; bramka zostaje WYŁĄCZNIE dla
 * wzorców organizacji.
 *
 * ===========================================================================
 * DLACZEGO REALNA BAZA, NIE MOCK
 * ===========================================================================
 * `creationIntentResolver.test.ts` (obok) mockuje `DbPromise.js` całkowicie —
 * udowadnia kontrakt resolverów przy ZAŁOŻONYM kształcie wiersza, ale nie
 * może wykryć, czy naprawiony predykat faktycznie odróżnia SYSTEM_ORG_ID /
 * `organization_id IS NULL` od zwykłego wiersza organizacji na PRAWDZIWYCH
 * wartościach kolumn, ani czy realny UPDATE `provenance_status='approved'`
 * (to, co `approveTemplateProvenance` naprawdę zapisuje) faktycznie odblokowuje
 * wzorzec organizacji. Ten plik zakłada WŁASNĄ, jednorazową bazę Postgres
 * (patrz `WZORCE_SYS_PROV_20260905_LOCK_KEY` + namespace guard w `beforeAll`),
 * wstawia PRAWDZIWE wiersze do wszystkich trzech rejestrów i woła
 * eksportowane resolwery bez żadnego `vi.mock`.
 *
 * Dowód mutacyjny na rejestr (3 przypadki × 3 rejestry = 9 testów):
 *   1. SYSTEM — `provenance_status='unknown'` → resolver mimo to zwraca wynik
 *      (bez rzucania `TEMPLATE_PROVENANCE_UNVERIFIED`); wiersz w bazie
 *      NIE jest przy tym przepisywany (żadna cicha "auto-atestacja" w
 *      danych — decyzja zapada przy odczycie, nie przez UPDATE).
 *   2. ORGANIZACJA bez atestacji — `provenance_status='unknown'`, WŁASNA
 *      organizacja wołającego → 409 `TEMPLATE_PROVENANCE_UNVERIFIED` (bramka
 *      MUSI zostać, to nie jest ogólne rozluźnienie bramki).
 *   3. ORGANIZACJA po atestacji — ten sam wiersz z (2), REALNY
 *      `UPDATE ... SET provenance_status='approved'` (dokładny kształt
 *      `provenance_json`, jakiego wymaga CHECK constraint i jaki produkuje
 *      `approveTemplateProvenance`) → resolver teraz zwraca wynik.
 *
 * ===========================================================================
 * GATE (fail-closed, cztery zmienne, WSZYSTKIE wymagane)
 * ===========================================================================
 *   RUN_DB_TESTS=1  MOCK_DB=false  WZORCE_SYS_PROV_20260905_CLEANUP=1
 *   DATABASE_URL=postgresql://…  (host dowolny — namespace guard niżej
 *   wymaga jednak, by nazwa bazy zaczynała się od `mat_provenance_`, ten sam
 *   konwencja co `deliverableTemplates.provenance.test.ts` MAT-PROV-19).
 * Brak którejkolwiek zmiennej → `describe.skipIf` czyni cały blok no-opem
 * (zero importów, zero efektów) — nigdy cichym zielonym bez pomiaru.
 */
import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DATABASE_URL = process.env.DATABASE_URL || '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  process.env.WZORCE_SYS_PROV_20260905_CLEANUP === '1' &&
  DATABASE_URL.startsWith('postgres');

const LOCK_KEY = 'consultify:wzorce-sys-prov-20260905:creationIntentResolver.systemProvenance.pg.test.ts';

function parseDatabaseNameFromUrl(url: string): string {
  try {
    return new URL(url).pathname.replace(/^\//, '');
  } catch {
    return '';
  }
}

function approvedProvenanceJson(): string {
  return JSON.stringify({
    source: 'internal-catalog',
    licenseBasis: 'owned',
    authority: 'legal@consultify.ai',
    actor: 'wzorce-sys-prov-20260905-test',
    version: '1.0.0',
    evidence: `https://intranet.consultify.ai/rights/${randomUUID()}`,
  });
}

describe.skipIf(!REAL_PG)(
  'creationIntent — wzorzec systemowy zaufany z definicji, wzorzec organizacji nadal pod bramką (real PostgreSQL)',
  () => {
    let pool: Pool;
    let lockClient: import('pg').PoolClient;
    let resolveDocumentTemplateForCreation: typeof import('../creationIntent.js').resolveDocumentTemplateForCreation;
    let resolvePresentationTemplateForCreation: typeof import('../creationIntent.js').resolvePresentationTemplateForCreation;
    let isTemplateResolveError: typeof import('../creationIntent.js').isTemplateResolveError;
    let DOC_STUDIO_SYSTEM_ORG_ID: string;

    let orgId = '';
    const createdDocStudioIds: string[] = [];
    const createdReportBuilderIds: string[] = [];
    const createdPresentationIds: string[] = [];

    beforeAll(async () => {
      pool = new Pool({ connectionString: DATABASE_URL });

      const expectedDbName = parseDatabaseNameFromUrl(DATABASE_URL);
      const actual = await pool.query<{ name: string }>('SELECT current_database() AS name');
      const actualDbName = String(actual.rows[0]?.name || '');
      if (
        !expectedDbName ||
        actualDbName !== expectedDbName ||
        !/^mat_provenance_/.test(actualDbName) ||
        !/^mat_provenance_/.test(expectedDbName)
      ) {
        throw new Error(
          `WZORCE-SYS-PROV-20260905 namespace guard refused this database: current_database()=${JSON.stringify(
            actualDbName
          )} DATABASE_URL database=${JSON.stringify(expectedDbName)} (both must match and start with "mat_provenance_")`
        );
      }

      lockClient = await pool.connect();
      await lockClient.query('SELECT pg_advisory_lock(hashtext($1))', [LOCK_KEY]);

      const creationIntentModule = await import('../creationIntent.js');
      resolveDocumentTemplateForCreation = creationIntentModule.resolveDocumentTemplateForCreation;
      resolvePresentationTemplateForCreation =
        creationIntentModule.resolvePresentationTemplateForCreation;
      isTemplateResolveError = creationIntentModule.isTemplateResolveError;

      const daoModule = await import('../../documentStudio/documentTemplateRegistryDao.js');
      DOC_STUDIO_SYSTEM_ORG_ID = daoModule.SYSTEM_ORG_ID;

      orgId = randomUUID();
      await pool.query(
        `INSERT INTO organizations (id, name, plan, status) VALUES ($1, $2, 'enterprise', 'active')`,
        [orgId, 'WZORCE-SYS-PROV-20260905 tenant']
      );
    }, 30000);

    afterAll(async () => {
      if (!pool) return;
      try {
        for (const id of createdDocStudioIds) {
          await pool.query('DELETE FROM document_studio_templates WHERE template_id = $1', [id]);
        }
        for (const id of createdReportBuilderIds) {
          await pool.query('DELETE FROM report_builder_templates WHERE id = $1', [id]);
        }
        for (const id of createdPresentationIds) {
          await pool.query('DELETE FROM presentation_templates WHERE id = $1', [id]);
        }
        if (orgId) {
          await pool.query('DELETE FROM organizations WHERE id = $1', [orgId]);
        }
      } finally {
        await lockClient.query('SELECT pg_advisory_unlock(hashtext($1))', [LOCK_KEY]);
        lockClient.release();
        await pool.end();
      }
    }, 30000);

    // =========================================================================
    // document_studio_templates
    // =========================================================================
    describe('document_studio_templates', () => {
      it('SYSTEM_ORG_ID row with provenance_status=unknown resolves OK (trusted by definition)', async () => {
        const id = randomUUID();
        createdDocStudioIds.push(id);
        await pool.query(
          `INSERT INTO document_studio_templates
             (template_id, organization_id, name, category, document_type, purpose, created_by,
              is_system, status, provenance_status)
           VALUES ($1, $2, $3, 'general', 'report', 'WZORCE-SYS-PROV-20260905 fixture', $4,
                   TRUE, 'approved', 'unknown')`,
          [id, DOC_STUDIO_SYSTEM_ORG_ID, 'System DRD fixture', 'system-seed']
        );

        const result = await resolveDocumentTemplateForCreation(
          { kind: 'internal', canonicalTemplateId: id, originRuntime: 'document_template' },
          { organizationId: orgId }
        );
        expect(result.canonicalTemplateId).toBe(id);
        expect(result.originRuntime).toBe('document_template');

        // Mutation proof, negative half: the row's own provenance_status was
        // NOT rewritten to 'approved' by the resolve call — trust is a
        // read-time decision on the SYSTEM_ORG_ID marker, not a silent
        // auto-attestation that would corrupt the audit trail.
        const row = await pool.query<{ provenance_status: string }>(
          'SELECT provenance_status FROM document_studio_templates WHERE template_id = $1',
          [id]
        );
        expect(row.rows[0]?.provenance_status).toBe('unknown');
      });

      it('organization-owned row without attestation → 409 TEMPLATE_PROVENANCE_UNVERIFIED', async () => {
        // Fresh, never-before-hydrated caller org id — NOT the shared `orgId`.
        // `documentTemplateService`'s in-process registry cache
        // (`hydratedOrgs`) hydrates an organization's tenant rows AT MOST
        // ONCE per process and never invalidates; reusing the shared `orgId`
        // across tests would let an earlier test's (empty) hydration snapshot
        // shadow a row this test inserts afterwards — a pre-existing,
        // orthogonal cache-staleness property of that module, not something
        // this fix touches. Isolating the caller org per test keeps this
        // suite's proof about the PROVENANCE GATE, not that cache.
        const docStudioOrgId = randomUUID();
        const id = randomUUID();
        createdDocStudioIds.push(id);
        await pool.query(
          `INSERT INTO document_studio_templates
             (template_id, organization_id, name, category, document_type, purpose, created_by,
              is_system, status, provenance_status)
           VALUES ($1, $2, $3, 'general', 'report', 'WZORCE-SYS-PROV-20260905 fixture', $2,
                   FALSE, 'approved', 'unknown')`,
          [id, docStudioOrgId, 'Org template fixture (doc studio)']
        );

        let thrown: unknown = null;
        try {
          await resolveDocumentTemplateForCreation(
            { kind: 'internal', canonicalTemplateId: id, originRuntime: 'document_template' },
            { organizationId: docStudioOrgId }
          );
        } catch (err) {
          thrown = err;
        }
        expect(thrown).not.toBeNull();
        expect(isTemplateResolveError(thrown)).toBe(true);
        expect((thrown as { code?: string }).code).toBe('TEMPLATE_PROVENANCE_UNVERIFIED');
      });

      it('organization-owned row: after REAL approval UPDATE, resolves OK', async () => {
        // Fresh caller org id — see the comment on the previous test: this
        // test's SECOND resolve call (after the real UPDATE) must trigger a
        // first-time hydration that reads the row's post-UPDATE state, which
        // only happens for an organization id `ensureTemplateRegistryHydrated`
        // has never seen before in this process.
        const docStudioOrgId = randomUUID();
        const id = randomUUID();
        createdDocStudioIds.push(id);
        await pool.query(
          `INSERT INTO document_studio_templates
             (template_id, organization_id, name, category, document_type, purpose, created_by,
              is_system, status, provenance_status)
           VALUES ($1, $2, $3, 'general', 'report', 'WZORCE-SYS-PROV-20260905 fixture', $2,
                   FALSE, 'approved', 'unknown')`,
          [id, docStudioOrgId, 'Org template fixture (doc studio, to be approved)']
        );

        await expect(
          resolveDocumentTemplateForCreation(
            { kind: 'internal', canonicalTemplateId: id, originRuntime: 'document_template' },
            { organizationId: docStudioOrgId }
          )
        ).rejects.toMatchObject({ code: 'TEMPLATE_PROVENANCE_UNVERIFIED' });

        const updateResult = await pool.query(
          `UPDATE document_studio_templates
              SET provenance_status = 'approved', provenance_json = $2::jsonb
            WHERE template_id = $1`,
          [id, approvedProvenanceJson()]
        );
        expect(updateResult.rowCount).toBe(1);

        const result = await resolveDocumentTemplateForCreation(
          { kind: 'internal', canonicalTemplateId: id, originRuntime: 'document_template' },
          { organizationId: docStudioOrgId }
        );
        expect(result.canonicalTemplateId).toBe(id);
      });
    });

    // =========================================================================
    // report_builder_templates (legacy) — the exact registry that holds the
    // real-world example named in the incident report: "DRD Full Diagnostic
    // Report" (organization_id IS NULL).
    // =========================================================================
    describe('report_builder_templates', () => {
      it('organization_id IS NULL row with provenance_status=unknown resolves OK (trusted by definition)', async () => {
        const id = randomUUID();
        createdReportBuilderIds.push(id);
        await pool.query(
          `INSERT INTO report_builder_templates
             (id, organization_id, name, source_type, sections_json, is_system, is_active, is_public,
              provenance_status)
           VALUES ($1, NULL, $2, 'ASSESSMENT', '[]', TRUE, TRUE, FALSE, 'unknown')`,
          [id, 'System DRD-style report fixture']
        );

        const result = await resolveDocumentTemplateForCreation(
          { kind: 'internal', canonicalTemplateId: id, originRuntime: 'report_template' },
          { organizationId: orgId }
        );
        expect(result.canonicalTemplateId).toBe(id);
        expect(result.legacy).toBe(true);

        const row = await pool.query<{ provenance_status: string }>(
          'SELECT provenance_status FROM report_builder_templates WHERE id = $1',
          [id]
        );
        expect(row.rows[0]?.provenance_status).toBe('unknown');
      });

      it('organization-owned row without attestation → 409 TEMPLATE_PROVENANCE_UNVERIFIED', async () => {
        const id = randomUUID();
        createdReportBuilderIds.push(id);
        await pool.query(
          `INSERT INTO report_builder_templates
             (id, organization_id, name, source_type, sections_json, is_system, is_active, is_public,
              provenance_status)
           VALUES ($1, $2, $3, 'ASSESSMENT', '[]', FALSE, TRUE, FALSE, 'unknown')`,
          [id, orgId, 'Org report template fixture']
        );

        let thrown: unknown = null;
        try {
          await resolveDocumentTemplateForCreation(
            { kind: 'internal', canonicalTemplateId: id, originRuntime: 'report_template' },
            { organizationId: orgId }
          );
        } catch (err) {
          thrown = err;
        }
        expect(isTemplateResolveError(thrown)).toBe(true);
        expect((thrown as { code?: string }).code).toBe('TEMPLATE_PROVENANCE_UNVERIFIED');
      });

      it('organization-owned row: after REAL approval UPDATE, resolves OK', async () => {
        const id = randomUUID();
        createdReportBuilderIds.push(id);
        await pool.query(
          `INSERT INTO report_builder_templates
             (id, organization_id, name, source_type, sections_json, is_system, is_active, is_public,
              provenance_status)
           VALUES ($1, $2, $3, 'ASSESSMENT', '[]', FALSE, TRUE, FALSE, 'unknown')`,
          [id, orgId, 'Org report template fixture (to be approved)']
        );

        await expect(
          resolveDocumentTemplateForCreation(
            { kind: 'internal', canonicalTemplateId: id, originRuntime: 'report_template' },
            { organizationId: orgId }
          )
        ).rejects.toMatchObject({ code: 'TEMPLATE_PROVENANCE_UNVERIFIED' });

        const updateResult = await pool.query(
          `UPDATE report_builder_templates
              SET provenance_status = 'approved', provenance_json = $2::jsonb
            WHERE id = $1`,
          [id, approvedProvenanceJson()]
        );
        expect(updateResult.rowCount).toBe(1);

        const result = await resolveDocumentTemplateForCreation(
          { kind: 'internal', canonicalTemplateId: id, originRuntime: 'report_template' },
          { organizationId: orgId }
        );
        expect(result.canonicalTemplateId).toBe(id);
      });
    });

    // =========================================================================
    // presentation_templates
    // =========================================================================
    describe('presentation_templates', () => {
      it('organization_id IS NULL row with provenance_status=unknown resolves OK (trusted by definition)', async () => {
        const id = randomUUID();
        createdPresentationIds.push(id);
        await pool.query(
          `INSERT INTO presentation_templates
             (id, organization_id, name, deck_type, outline_json, is_system, is_active, lifecycle_state,
              provenance_status)
           VALUES ($1, NULL, $2, 'policy', '[]', TRUE, TRUE, 'approved', 'unknown')`,
          [id, 'System deck template fixture']
        );

        const result = await resolvePresentationTemplateForCreation(
          { kind: 'internal', canonicalTemplateId: id, originRuntime: 'presentation_template' },
          { organizationId: orgId }
        );
        expect(result.canonicalTemplateId).toBe(id);

        const row = await pool.query<{ provenance_status: string }>(
          'SELECT provenance_status FROM presentation_templates WHERE id = $1',
          [id]
        );
        expect(row.rows[0]?.provenance_status).toBe('unknown');
      });

      it('organization-owned row without attestation → 409 TEMPLATE_PROVENANCE_UNVERIFIED', async () => {
        const id = randomUUID();
        createdPresentationIds.push(id);
        await pool.query(
          `INSERT INTO presentation_templates
             (id, organization_id, name, deck_type, outline_json, is_system, is_active, lifecycle_state,
              provenance_status)
           VALUES ($1, $2, $3, 'policy', '[]', FALSE, TRUE, 'approved', 'unknown')`,
          [id, orgId, 'Org deck template fixture']
        );

        let thrown: unknown = null;
        try {
          await resolvePresentationTemplateForCreation(
            { kind: 'internal', canonicalTemplateId: id, originRuntime: 'presentation_template' },
            { organizationId: orgId }
          );
        } catch (err) {
          thrown = err;
        }
        expect(isTemplateResolveError(thrown)).toBe(true);
        expect((thrown as { code?: string }).code).toBe('TEMPLATE_PROVENANCE_UNVERIFIED');
      });

      it('organization-owned row: after REAL approval UPDATE, resolves OK', async () => {
        const id = randomUUID();
        createdPresentationIds.push(id);
        await pool.query(
          `INSERT INTO presentation_templates
             (id, organization_id, name, deck_type, outline_json, is_system, is_active, lifecycle_state,
              provenance_status)
           VALUES ($1, $2, $3, 'policy', '[]', FALSE, TRUE, 'approved', 'unknown')`,
          [id, orgId, 'Org deck template fixture (to be approved)']
        );

        await expect(
          resolvePresentationTemplateForCreation(
            { kind: 'internal', canonicalTemplateId: id, originRuntime: 'presentation_template' },
            { organizationId: orgId }
          )
        ).rejects.toMatchObject({ code: 'TEMPLATE_PROVENANCE_UNVERIFIED' });

        const updateResult = await pool.query(
          `UPDATE presentation_templates
              SET provenance_status = 'approved', provenance_json = $2::jsonb
            WHERE id = $1`,
          [id, approvedProvenanceJson()]
        );
        expect(updateResult.rowCount).toBe(1);

        const result = await resolvePresentationTemplateForCreation(
          { kind: 'internal', canonicalTemplateId: id, originRuntime: 'presentation_template' },
          { organizationId: orgId }
        );
        expect(result.canonicalTemplateId).toBe(id);
      });
    });
  }
);
