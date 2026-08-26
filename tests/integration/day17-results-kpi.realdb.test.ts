import { randomUUID } from 'node:crypto';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { getKpiHistory } from '../../server/src/services/resultsVnext/kpi/kpiHistoryRepository.js';
import { getKpiNextObligation } from '../../server/src/services/resultsVnext/kpi/kpiNextObligationRepository.js';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const REAL_DB =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');

describe.skipIf(!REAL_DB)('Day 17 K.2/K.3 repositories — real PostgreSQL', () => {
  const orgA = `day17-kpi-org-a-${randomUUID()}`;
  const orgB = `day17-kpi-org-b-${randomUUID()}`;
  const userA = `day17-kpi-user-a-${randomUUID()}`;
  const kpiA = randomUUID();
  const kpiB = randomUUID();
  const definitionA = randomUUID();
  const policyA = randomUUID();
  const policyB = randomUUID();
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    await client.query(
      `INSERT INTO rvn_kpi_definitions
         (kpi_id, organization_id, kpi_code, status, owner_user_id, created_by)
       VALUES ($1,$2,'DAY17-A','active',$3,$3), ($4,$5,'DAY17-B','active',$3,$3)`,
      [kpiA, orgA, userA, kpiB, orgB]
    );
    await client.query(
      `INSERT INTO rvn_kpi_definition_versions
         (definition_version_id, kpi_id, organization_id, version_number, name, unit,
          target_geometry, target_min, approval_status, created_by, effective_from,
          measurement_frequency_days)
       VALUES ($1,$2,$3,1,'Day 17 KPI','unit','threshold_min',1,'approved',$4,now(),7)`,
      [definitionA, kpiA, orgA, userA]
    );
    await client.query(
      `UPDATE rvn_kpi_definitions SET current_definition_version_id=$1 WHERE kpi_id=$2`,
      [definitionA, kpiA]
    );
    await client.query(
      `INSERT INTO rvn_platform_visibility_policies
         (policy_id, organization_id, domain, policy_version, visibility_mode, is_active, created_by)
       VALUES ($1,$2,'kpi',1,'OPEN_ORG',true,$3), ($4,$5,'kpi',1,'OPEN_ORG',true,$3)`,
      [policyA, orgA, userA, policyB, orgB]
    );
    await client.query(
      `INSERT INTO rvn_platform_resource_visibility
         (resource_type, resource_id, organization_id, visibility_mode, policy_id, owner_user_id)
       VALUES ('kpi',$1,$2,'OPEN_ORG',$3,$4), ('kpi',$5,$6,'OPEN_ORG',$7,$4)`,
      [kpiA, orgA, policyA, userA, kpiB, orgB, policyB]
    );
    const eventTypes = [
      'kpi.activated',
      'kpi.definition_approved',
      'kpi.measurement_recorded',
      'kpi.measurement_corrected',
      'kpi.visibility_changed',
    ];
    for (const [index, eventType] of eventTypes.entries()) {
      await client.query(
        `INSERT INTO rvn_platform_events
           (event_type, aggregate_type, aggregate_id, organization_id, actor_user_id,
            actor_effective_role, command_id, correlation_id, occurred_at, policy_version,
            state_hash, source, idempotency_key, resulting_version, payload)
         VALUES ($1,'kpi',$2,$3,$4,'OWNER',$5,$6,$7,'day17','hash','day17',$8,$9,$10::jsonb)`,
        [
          eventType,
          kpiA,
          orgA,
          userA,
          randomUUID(),
          randomUUID(),
          new Date(Date.UTC(2026, 7, index + 1)).toISOString(),
          `day17-kpi-${kpiA}-${index}`,
          index + 1,
          JSON.stringify({ measurementId: randomUUID(), definitionVersionId: definitionA }),
        ]
      );
    }
    await client.query(
      `INSERT INTO rvn_platform_obligations
         (organization_id, assignee_user_id, reference_type, reference_id,
          aggregate_version_at_creation, obligation_type, due_at, status, deduplication_key)
       VALUES ($1,$2,'kpi',$3,1,'MEASURE',$4,'open',$5)`,
      [orgA, userA, kpiA, '2026-08-01T00:00:00.000Z', `day17-obligation-${kpiA}`]
    );
  });

  afterAll(async () => {
    if (!client) return;
    await client.query(`DELETE FROM rvn_platform_obligations WHERE organization_id=$1`, [orgA]);
    await client.query(`DELETE FROM rvn_platform_events WHERE organization_id=$1`, [orgA]);
    await client.query(
      `DELETE FROM rvn_platform_resource_visibility WHERE organization_id=ANY($1)`,
      [[orgA, orgB]]
    );
    await client.query(
      `DELETE FROM rvn_platform_visibility_policies WHERE organization_id=ANY($1)`,
      [[orgA, orgB]]
    );
    await client.query(
      `UPDATE rvn_kpi_definitions SET current_definition_version_id=NULL WHERE kpi_id=$1`,
      [kpiA]
    );
    await client.query(`DELETE FROM rvn_kpi_definition_versions WHERE organization_id=$1`, [orgA]);
    await client.query(`DELETE FROM rvn_kpi_definitions WHERE organization_id=ANY($1)`, [
      [orgA, orgB],
    ]);
    await client.end();
  });

  it('K.2 pages five kinds without duplicates', async () => {
    const seen: string[] = [];
    const entryIds: string[] = [];
    let cursor: string | null | undefined;
    for (let page = 0; page < 10; page += 1) {
      const result = await getKpiHistory({
        userId: userA,
        organizationId: orgA,
        kpiId: kpiA,
        limit: 2,
        cursor,
      });
      seen.push(...result.entries.map((entry) => entry.kind));
      entryIds.push(...result.entries.map((entry) => entry.entryId));
      cursor = result.nextCursor;
      if (!cursor) break;
    }
    expect(new Set(seen)).toEqual(
      new Set([
        'LIFECYCLE',
        'DEFINITION_VERSION',
        'MEASUREMENT',
        'MEASUREMENT_CORRECTION',
        'VISIBILITY',
      ])
    );
    expect(new Set(entryIds).size).toBe(entryIds.length);
  });

  it('K.3 returns the recorded obligation first and calculates overdue', async () => {
    const result = await getKpiNextObligation({
      userId: userA,
      organizationId: orgA,
      kpiId: kpiA,
      now: new Date('2026-08-10T00:00:00.000Z'),
    });
    expect(result.obligation).toMatchObject({
      obligationType: 'MEASURE',
      overdue: true,
      source: 'OBLIGATION_ROW',
    });
    expect(result.derived).toBeNull();
  });

  it('does not expose a KPI from another organization', async () => {
    expect(await getKpiHistory({ userId: userA, organizationId: orgA, kpiId: kpiB })).toMatchObject(
      { found: false, entries: [] }
    );
    expect(
      await getKpiNextObligation({ userId: userA, organizationId: orgA, kpiId: kpiB })
    ).toMatchObject({ found: false, obligation: null });
  });
});
