/**
 * Dowód na defekt #3 audytu FIN 2026-09-06 (BLOKER): klik „Otwórz" na wierszu
 * sprawozdania NIE tworzy pustego duplikatu.
 *
 * Zmierzony przebieg przed naprawą (org DBR77, lokalna baza): otwarcie wiersza
 * CD PROJEKT założyło DRUGI artefakt `STATEMENT_PACK`
 * (`fe74a3a5-b7a5-4417-8721-b484b7a5dcb7`, `mapping_reason = materialized_on_open:STATEMENT_PACK`,
 * zero linii) i to jemu przypisało alias — prawdziwy pakiet z 238 liniami
 * pozostał nieosiągalny z listy.
 *
 * Dwa niezależne twierdzenia:
 *   A. brak jakiegokolwiek pakietu kanonicznego → `NOT_MIGRATED` i ZERO nowych
 *      artefaktów (uczciwy komunikat zamiast pustej powłoki);
 *   B. pakiet kanoniczny istnieje pod INNYM `natural_key`, ale z tym samym
 *      podmiotem i okresami → wiązanie z NIM, bez nowego artefaktu.
 */
import { randomUUID } from 'node:crypto';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');

describe.skipIf(!REAL_PG)('materializacja tożsamości — STATEMENT_PACK (real PostgreSQL)', () => {
  const orgId = `org-fin-matz-${randomUUID()}`;
  const userId = `user-fin-matz-${randomUUID()}`;
  const ENTITY_NAME = 'Grupa Testowa MATZ';
  const ENTITY_CODE = 'GRUPA_TESTOWA_MATZ';

  let client: Client;
  let ensureLegacyFinanceArtifactIdentity: typeof import('../legacyIdentityMaterializationService.js').ensureLegacyFinanceArtifactIdentity;
  let createArtifact: typeof import('../artifactVersionService.js').createArtifact;

  const artifactCount = async (): Promise<number> =>
    Number(
      (
        await client.query(
          `SELECT count(*)::int AS n FROM finance_artifacts WHERE organization_id=$1 AND artifact_type='STATEMENT_PACK'`,
          [orgId]
        )
      ).rows[0].n
    );

  /** Zakłada wiersz legacy `financial_statement_packs` — dokładnie to, co widzi lista Sprawozdań. */
  const insertLegacyPack = async (packId: string, periodStart: string, periodEnd: string) => {
    await client.query(
      `INSERT INTO financial_statement_packs
         (id, organization_id, entity_name, period_start, period_end, period_label, currency, scaling, pack_status)
       VALUES ($1,$2,$3,$4::date,$5::date,'FY-TEST','PLN','thousands','confirmed')`,
      [packId, orgId, ENTITY_NAME, periodStart, periodEnd]
    );
  };

  /** Pakiet kanoniczny Z TREŚCIĄ (linia dla podmiotu i okresu) pod dowolnym kluczem naturalnym. */
  const insertCanonicalPackWithLines = async (naturalKey: string) => {
    const created = await createArtifact({
      organizationId: orgId,
      artifactType: 'STATEMENT_PACK',
      naturalKey,
      createdBy: userId,
    });
    const bvId = created.businessVersion.business_version_id;
    const calendarId = `cal-${randomUUID()}`;
    const periodId = `per-${randomUUID()}`;
    const entityRowId = `ent-${randomUUID()}`;
    await client.query(
      `INSERT INTO finance_stmt_calendars
         (fiscal_calendar_id, organization_id, calendar_type, fiscal_year_end_month, effective_from, created_by)
       VALUES ($1,$2,'STANDARD',12,'2024-01-01',$3)`,
      [calendarId, orgId, userId]
    );
    await client.query(
      `INSERT INTO finance_stmt_periods
         (period_id, organization_id, fiscal_calendar_id, period_type, fiscal_year, period_start, period_end, label, created_by)
       VALUES ($1,$2,$3,'FY',2024,'2024-01-01','2024-12-31','FY2024',$4)`,
      [periodId, orgId, calendarId, userId]
    );
    await client.query(
      `INSERT INTO finance_stmt_entities
         (id, organization_id, business_version_id, entity_code, legal_name, role, consolidation_method, ownership_pct, functional_currency, created_by)
       VALUES ($1,$2,$3,$4,$5,'GROUP_PARENT','FULL',100,'PLN',$6)`,
      [entityRowId, orgId, bvId, ENTITY_CODE, ENTITY_NAME, userId]
    );
    const canonicalLineId = (
      await client.query(
        `SELECT id FROM financial_statement_lines WHERE line_code='CASH' AND organization_id IS NULL LIMIT 1`
      )
    ).rows[0].id;
    await client.query(
      `INSERT INTO finance_stmt_lines
         (id, organization_id, business_version_id, statement_type, canonical_line_id, entity_id, period_id,
          value_status, value_decimal, native_currency, presentation_currency, unit, accounting_policy, created_by)
       VALUES ($1,$2,$3,'BS',$4,$5,$6,'PRESENT_NONZERO',114115,'PLN','PLN','THOUSANDS','IFRS',$7)`,
      [`line-${randomUUID()}`, orgId, bvId, canonicalLineId, entityRowId, periodId, userId]
    );
    return { artifactId: created.artifact.artifact_id, businessVersionId: bvId };
  };

  beforeAll(async () => {
    process.env.DB_TYPE = 'postgres';
    client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    ({ ensureLegacyFinanceArtifactIdentity } = await import(
      '../legacyIdentityMaterializationService.js'
    ));
    ({ createArtifact } = await import('../artifactVersionService.js'));
    await client.query(`INSERT INTO organizations(id,name) VALUES($1,'MATZ finance')`, [orgId]);
    await client.query(
      `INSERT INTO users(id,organization_id,email,first_name,last_name,role)
       VALUES($1,$2,$3,'Matz','Owner','ADMIN')`,
      [userId, orgId, `${userId}@test.local`]
    );
    await client.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status,created_at)
       VALUES($1,$2,$3,'OWNER','ACTIVE',now())`,
      [randomUUID(), orgId, userId]
    );
  });

  afterAll(async () => {
    if (!client) return;
    await client.query('BEGIN');
    try {
      await client.query(`SET LOCAL session_replication_role=replica`);
      await client.query(
        `DELETE FROM finance_stmt_lines WHERE organization_id=$1`, [orgId]);
      await client.query(`DELETE FROM finance_stmt_entities WHERE organization_id=$1`, [orgId]);
      await client.query(`DELETE FROM finance_stmt_periods WHERE organization_id=$1`, [orgId]);
      await client.query(`DELETE FROM finance_stmt_calendars WHERE organization_id=$1`, [orgId]);
      await client.query(`DELETE FROM finance_artifact_aliases WHERE organization_id=$1`, [orgId]);
      await client.query(
        `DELETE FROM finance_working_revisions WHERE business_version_id IN
           (SELECT business_version_id FROM finance_business_versions WHERE organization_id=$1)`,
        [orgId]
      );
      await client.query(`DELETE FROM finance_business_versions WHERE organization_id=$1`, [orgId]);
      await client.query(`DELETE FROM finance_artifacts WHERE organization_id=$1`, [orgId]);
      await client.query(`DELETE FROM financial_statement_packs WHERE organization_id=$1`, [orgId]);
      await client.query(`DELETE FROM organization_members WHERE organization_id=$1`, [orgId]);
      await client.query(`DELETE FROM users WHERE organization_id=$1`, [orgId]);
      await client.query(`DELETE FROM organizations WHERE id=$1`, [orgId]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      await client.end();
    }
  });

  it('A. bez pakietu kanonicznego: NOT_MIGRATED i ZERO nowych artefaktów', async () => {
    const packId = `pack-a-${randomUUID()}`;
    await insertLegacyPack(packId, '2024-01-01', '2024-12-31');
    const before = await artifactCount();

    const result = await ensureLegacyFinanceArtifactIdentity({
      organizationId: orgId,
      userId,
      legacyTable: 'financial_statement_packs',
      legacyId: packId,
      expectedArtifactType: 'STATEMENT_PACK',
    });

    expect(result.status).toBe('NOT_MIGRATED');
    expect(await artifactCount()).toBe(before);
    const aliases = await client.query(
      `SELECT count(*)::int AS n FROM finance_artifact_aliases WHERE organization_id=$1 AND legacy_id=$2`,
      [orgId, packId]
    );
    expect(Number(aliases.rows[0].n)).toBe(0);
  });

  it('B. pakiet kanoniczny pod INNYM kluczem naturalnym: wiązanie z NIM, bez nowego artefaktu', async () => {
    const packId = `pack-b-${randomUUID()}`;
    await insertLegacyPack(packId, '2024-01-01', '2024-12-31');
    // Klucz seeda — dokładnie ten kształt, który w produkcji NIE pasował do nazwy wiersza legacy.
    const real = await insertCanonicalPackWithLines(
      `seed:finance-test-matz:${orgId}:${ENTITY_CODE}`
    );
    const before = await artifactCount();

    const result = await ensureLegacyFinanceArtifactIdentity({
      organizationId: orgId,
      userId,
      legacyTable: 'financial_statement_packs',
      legacyId: packId,
      expectedArtifactType: 'STATEMENT_PACK',
    });

    expect(result.status).toBe('RESOLVED');
    if (result.status !== 'RESOLVED') throw new Error('nieosiągalne');
    expect(result.artifactId).toBe(real.artifactId);
    expect(result.businessVersionId).toBe(real.businessVersionId);
    expect(await artifactCount()).toBe(before);
  });

  it('B2. drugie otwarcie jest idempotentne — dalej ten sam artefakt, dalej zero nowych', async () => {
    const packId = `pack-b2-${randomUUID()}`;
    await insertLegacyPack(packId, '2024-01-01', '2024-12-31');
    await insertCanonicalPackWithLines(`seed:finance-test-matz-b2:${orgId}:${ENTITY_CODE}`);
    const first = await ensureLegacyFinanceArtifactIdentity({
      organizationId: orgId,
      userId,
      legacyTable: 'financial_statement_packs',
      legacyId: packId,
      expectedArtifactType: 'STATEMENT_PACK',
    });
    const between = await artifactCount();
    const second = await ensureLegacyFinanceArtifactIdentity({
      organizationId: orgId,
      userId,
      legacyTable: 'financial_statement_packs',
      legacyId: packId,
      expectedArtifactType: 'STATEMENT_PACK',
    });

    expect(first.status).toBe('RESOLVED');
    expect(second.status).toBe('RESOLVED');
    expect(second.status === 'RESOLVED' && first.status === 'RESOLVED'
      ? second.artifactId === first.artifactId
      : false).toBe(true);
    expect(await artifactCount()).toBe(between);
  });
});
