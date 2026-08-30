/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';

const databaseUrl = process.env.DATABASE_URL || '';
const enabled =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  /^postgres(?:ql)?:/.test(databaseUrl);

describe.skipIf(!enabled)('Day 158 KPI crosswalk on real PostgreSQL', () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const organizationId = `day158-${randomUUID()}`;
  const sourceMappedId = randomUUID();
  const sourceUnmappedId = randomUUID();
  const canonicalMappedId = randomUUID();
  const canonicalSameNameId = randomUUID();
  const versionMappedId = randomUUID();
  const versionSameNameId = randomUUID();
  const policyId = randomUUID();

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    await pool.query('INSERT INTO organizations (id, name) VALUES ($1, $2)', [
      organizationId,
      'Day 158 crosswalk proof',
    ]);
    await pool.query(
      `INSERT INTO initiative_kpis
         (id, organization_id, name, unit, target_value, current_value, status)
       VALUES
         ($1, $3, 'Retention', '%', 20, 12, 'on_track'),
         ($2, $3, 'Same label is not identity', '%', 50, 25, 'on_track')`,
      [sourceMappedId, sourceUnmappedId, organizationId]
    );
    await pool.query(
      `INSERT INTO rvn_kpi_definitions
         (kpi_id, organization_id, kpi_code, status, created_by)
       VALUES
         ($1, $3, 'DAY158-MAPPED', 'active', 'day158'),
         ($2, $3, 'DAY158-SAME-NAME', 'active', 'day158')`,
      [canonicalMappedId, canonicalSameNameId, organizationId]
    );
    await pool.query(
      `INSERT INTO rvn_kpi_definition_versions
         (definition_version_id, kpi_id, organization_id, version_number, name, unit,
          target_geometry, target_value, approval_status, created_by)
       VALUES
         ($1, $3, $5, 1, 'Retention', '%', 'threshold_min', 20, 'approved', 'day158'),
         ($2, $4, $5, 1, 'Same label is not identity', '%', 'threshold_min', 50, 'approved', 'day158')`,
      [versionMappedId, versionSameNameId, canonicalMappedId, canonicalSameNameId, organizationId]
    );
    await pool.query(
      `UPDATE rvn_kpi_definitions
          SET current_definition_version_id = CASE kpi_id
            WHEN $1::uuid THEN $3::uuid
            WHEN $2::uuid THEN $4::uuid
          END
        WHERE kpi_id IN ($1::uuid, $2::uuid)`,
      [canonicalMappedId, canonicalSameNameId, versionMappedId, versionSameNameId]
    );
    await pool.query(
      `INSERT INTO rvn_kpi_measurements
         (kpi_id, definition_version_id, organization_id, period_start, period_end,
          actual_value, performance_status, source, recorded_by)
       VALUES ($1, $2, $3, now() - interval '1 day', now(), 11, 'warning', 'day158', 'day158')`,
      [canonicalMappedId, versionMappedId, organizationId]
    );
    await pool.query(
      `INSERT INTO rvn_platform_visibility_policies
         (policy_id, organization_id, domain, policy_version, visibility_mode, created_by)
       VALUES ($1, $2, 'kpi', 1, 'OPEN_ORG', 'day158')`,
      [policyId, organizationId]
    );
    await pool.query(
      `INSERT INTO rvn_platform_resource_visibility
         (resource_type, resource_id, organization_id, visibility_mode, policy_id)
       VALUES ('kpi', $1, $2, 'OPEN_ORG', $3)`,
      [canonicalMappedId, organizationId, policyId]
    );
  }, 30000);

  afterAll(async () => {
    await pool.query('DELETE FROM kpi_crosswalk WHERE organization_id = $1', [organizationId]);
    await pool.query('DELETE FROM rvn_platform_resource_visibility WHERE organization_id = $1', [
      organizationId,
    ]);
    await pool.query('DELETE FROM rvn_platform_visibility_policies WHERE organization_id = $1', [
      organizationId,
    ]);
    await pool.query('DELETE FROM rvn_kpi_measurements WHERE organization_id = $1', [
      organizationId,
    ]);
    await pool.query(
      'UPDATE rvn_kpi_definitions SET current_definition_version_id = NULL WHERE organization_id = $1',
      [organizationId]
    );
    await pool.query('DELETE FROM rvn_kpi_definition_versions WHERE organization_id = $1', [
      organizationId,
    ]);
    await pool.query('DELETE FROM rvn_kpi_definitions WHERE organization_id = $1', [
      organizationId,
    ]);
    await pool.query('DELETE FROM initiative_kpis WHERE organization_id = $1', [organizationId]);
    await pool.query('DELETE FROM organizations WHERE id = $1', [organizationId]);
    await pool.end();
  });

  it('runs with the effective PostgreSQL environment', () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    expect(process.env.MOCK_DB).toBe('false');
    expect(databaseUrl).toContain('127.0.0.1:6045/cx158');
  });

  it('writes only explicitly confirmed mappings and leaves same-name rows unmapped', async () => {
    const { registerConfirmedInitiativeKpiMappings, readInitiativeKpiCrosswalkCounts } =
      await import('../../services/resultsVnext/kpi/kpiCrosswalkService.js');

    const result = await registerConfirmedInitiativeKpiMappings({
      organizationId,
      createdBy: 'day158',
      mappings: [
        { sourceId: sourceMappedId, canonicalKpiId: canonicalMappedId, matchBasis: 'manual' },
        {
          sourceId: 'missing-source',
          canonicalKpiId: canonicalSameNameId,
          matchBasis: 'owner_confirmed',
        },
      ],
    });
    expect(result).toEqual({ requested: 2, inserted: 1, rejected: 1 });

    const readback = await readInitiativeKpiCrosswalkCounts(organizationId);
    expect(readback).toEqual({
      organizationId,
      sourceSystem: 'initiative_kpis',
      sourceRows: 2,
      mappedRows: 1,
      unmappedRows: 1,
      unmappedReason: 'no_confirmed_mapping',
    });
    const unmapped = await pool.query(
      `SELECT source.id
         FROM initiative_kpis source
         LEFT JOIN kpi_crosswalk cw
           ON cw.organization_id = source.organization_id
          AND cw.source_system = 'initiative_kpis'
          AND cw.source_id = source.id
        WHERE source.organization_id = $1 AND cw.crosswalk_id IS NULL`,
      [organizationId]
    );
    expect(unmapped.rows.map((row) => row.id)).toEqual([sourceUnmappedId]);
  });

  it('reports field-level divergences without changing either registry', async () => {
    const { registerConfirmedInitiativeKpiMappings } =
      await import('../../services/resultsVnext/kpi/kpiCrosswalkService.js');
    const { runInitiativeKpiShadowRead } =
      await import('../../services/resultsVnext/kpi/kpiShadowReadService.js');
    await registerConfirmedInitiativeKpiMappings({
      organizationId,
      createdBy: 'day158',
      mappings: [
        { sourceId: sourceMappedId, canonicalKpiId: canonicalMappedId, matchBasis: 'manual' },
      ],
    });
    const before = await pool.query(
      `SELECT current_value, target_value, unit, status
         FROM initiative_kpis WHERE id = $1`,
      [sourceMappedId]
    );

    const result = await runInitiativeKpiShadowRead(organizationId);

    expect(result.comparedPairs).toBe(1);
    expect(result.matchingPairs).toBe(0);
    expect(result.divergentPairs).toBe(1);
    expect(result.pairs[0]?.differences).toEqual(
      expect.arrayContaining([
        { field: 'value', sourceValue: 12, canonicalValue: '11' },
        { field: 'status', sourceValue: 'on_track', canonicalValue: 'active' },
        { field: 'visibility', sourceValue: null, canonicalValue: 'OPEN_ORG' },
      ])
    );

    const after = await pool.query(
      `SELECT current_value, target_value, unit, status
         FROM initiative_kpis WHERE id = $1`,
      [sourceMappedId]
    );
    expect(after.rows).toEqual(before.rows);
  });
});
