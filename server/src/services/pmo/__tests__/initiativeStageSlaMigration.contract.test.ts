import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const up = () => readFileSync('server/migrations/20262281_pmo1b_roles_sla_escalations.sql', 'utf8');
const down = () =>
  readFileSync('server/migrations/rollback/20262281_pmo1b_roles_sla_escalations.down.sql', 'utf8');

describe('PMO-1b migration contract', () => {
  it('adds PMO role columns without changing the legacy role column', () => {
    const sql = up();
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS pmo_role TEXT');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS pmo_role_source TEXT');
    expect(sql).not.toMatch(/ALTER TABLE initiative_stakeholders\s+ALTER COLUMN\s+role/i);
    expect(sql).not.toMatch(/DROP COLUMN IF EXISTS role/i);
    expect(sql.includes('Sponsor / CFO')).toBe(false);
  });

  it('creates exactly the three PMO-1b tables and a rollback for them', () => {
    const sql = up();
    const rollback = down();
    for (const table of [
      'initiative_stage_sla_policies',
      'initiative_stage_due_dates',
      'initiative_stage_escalation_events',
    ]) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
      expect(rollback).toContain(`DROP TABLE IF EXISTS ${table}`);
    }
    expect(rollback).toContain('DROP COLUMN IF EXISTS pmo_role_source');
    expect(rollback).toContain('DROP COLUMN IF EXISTS pmo_role');
  });
});
