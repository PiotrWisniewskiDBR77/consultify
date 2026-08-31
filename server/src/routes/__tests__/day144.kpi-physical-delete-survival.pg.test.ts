/** @vitest-environment node */

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';

describe('Day 144 — KPI lifecycle decoupling from physical initiative deletion', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL || '' });
  const organizationId = randomUUID();
  const userId = randomUUID();
  const initiativeId = randomUUID();
  const kpiId = randomUUID();
  const mappingId = randomUUID();
  const deviationId = randomUUID();
  const measurementId = randomUUID();

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();

    await pool.query('INSERT INTO organizations (id,name) VALUES ($1,$2)', [
      organizationId,
      'Day 144 KPI lifecycle proof',
    ]);
    await pool.query(
      `INSERT INTO users (id,organization_id,email,role,status)
       VALUES ($1,$2,$3,'OWNER','active')`,
      [userId, organizationId, `${userId}@test.invalid`]
    );
    await pool.query(
      `INSERT INTO initiatives
         (id,organization_id,name,status,owner_business_id,created_by,updated_by,
          planned_start_date,planned_end_date)
       VALUES ($1,$2,$3,'EXECUTING',$4,$4,$4,'2026-01-01','2026-12-31')`,
      [initiativeId, organizationId, 'Day 144 physically deleted initiative', userId]
    );
    await pool.query(
      `INSERT INTO initiative_kpis
         (id,initiative_id,organization_id,name,target_value,current_value,unit,measurement_frequency)
       VALUES ($1,$2,$3,$4,100,40,'percent','monthly')`,
      [kpiId, initiativeId, organizationId, 'Day 144 durable KPI']
    );
    await pool.query(
      `INSERT INTO initiative_kpi_mappings
         (id,initiative_id,kpi_id,organization_id,expected_delta,notes)
       VALUES ($1,$2,$3,$4,12.5,'Day 144 mapping evidence')`,
      [mappingId, initiativeId, kpiId, organizationId]
    );
    await pool.query(
      `INSERT INTO kpi_deviation_cases
         (id,kpi_id,organization_id,period_start,severity,status,deviation_summary)
       VALUES ($1,$2,$3,'2026-08-01','RED','OPEN','Day 144 deviation evidence')`,
      [deviationId, kpiId, organizationId]
    );
    await pool.query(
      `INSERT INTO kpi_measurements
         (id,kpi_id,value,measured_at,notes)
       VALUES ($1,$2,40,'2026-08-30T08:00:00Z','Day 144 measurement evidence')`,
      [measurementId, kpiId]
    );
  });

  afterAll(async () => {
    await pool.end();
  });

  it(
    'preserves the KPI values and dependent rows after the initiative is physically deleted',
    { retry: 0 },
    async () => {
      const before = await pool.query(
        `SELECT k.id AS kpi_id,k.initiative_id,k.current_value,k.target_value,k.unit,
                m.id AS mapping_id,m.initiative_id AS mapping_initiative_id,
                d.id AS deviation_id,km.id AS measurement_id,km.value AS measurement_value
           FROM initiative_kpis k
           JOIN initiative_kpi_mappings m ON m.kpi_id=k.id
           JOIN kpi_deviation_cases d ON d.kpi_id=k.id
           JOIN kpi_measurements km ON km.kpi_id=k.id
          WHERE k.id=$1`,
        [kpiId]
      );
      console.log('DAY144_SELECT_BEFORE', JSON.stringify(before.rows));
      expect(before.rows).toHaveLength(1);

      await pool.query('DELETE FROM initiatives WHERE id=$1 AND organization_id=$2', [
        initiativeId,
        organizationId,
      ]);

      const after = await pool.query(
        `SELECT k.id AS kpi_id,k.initiative_id,k.current_value,k.target_value,k.unit,
                m.id AS mapping_id,m.initiative_id AS mapping_initiative_id,
                d.id AS deviation_id,km.id AS measurement_id,km.value AS measurement_value
           FROM initiative_kpis k
           JOIN initiative_kpi_mappings m ON m.kpi_id=k.id
           JOIN kpi_deviation_cases d ON d.kpi_id=k.id
           JOIN kpi_measurements km ON km.kpi_id=k.id
          WHERE k.id=$1`,
        [kpiId]
      );
      console.log('DAY144_SELECT_AFTER', JSON.stringify(after.rows));

      expect(after.rows).toHaveLength(1);
      expect(after.rows[0]).toMatchObject({
        kpi_id: kpiId,
        initiative_id: null,
        current_value: 40,
        target_value: 100,
        unit: 'percent',
        mapping_id: mappingId,
        mapping_initiative_id: null,
        deviation_id: deviationId,
        measurement_id: measurementId,
        measurement_value: 40,
      });
    }
  );
});
