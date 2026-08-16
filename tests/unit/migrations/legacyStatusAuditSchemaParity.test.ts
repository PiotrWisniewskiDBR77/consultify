import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const sql = fs.readFileSync(
  path.resolve('server/migrations/20260906_legacy_status_audit_schema_parity.sql'),
  'utf8'
);

describe('legacy status/audit schema parity migration', () => {
  it('uses repeatable additive DDL for every route-owned column', () => {
    const additions = [
      ['projects', 'health'],
      ['projects', 'progress_pct'],
      ['projects', 'updated_at'],
      ['status_reports', 'title'],
      ['status_reports', 'content'],
      ['status_reports', 'health'],
      ['status_reports', 'period'],
      ['audits', 'type'],
      ['audits', 'auditor'],
      ['audits', 'scheduled_date'],
      ['audits', 'completed_date'],
      ['audits', 'score'],
    ] as const;

    for (const [table, column] of additions) {
      expect(sql).toContain(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} `);
    }
  });

  it('removes only the three M14 constraints incompatible with the mounted project report writer', () => {
    expect(sql.match(/DROP NOT NULL/g)).toHaveLength(3);
    expect(sql).toContain('ALTER COLUMN initiative_id DROP NOT NULL');
    expect(sql).toContain('ALTER COLUMN period_start DROP NOT NULL');
    expect(sql).toContain('ALTER COLUMN period_end DROP NOT NULL');
    expect(sql).not.toMatch(/DROP TABLE|DROP COLUMN|DELETE FROM|TRUNCATE/i);
  });

  it('keeps the legacy audit date as text so the mounted API round-trips YYYY-MM-DD', () => {
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS scheduled_date TEXT');
    expect(sql).toContain('ALTER COLUMN scheduled_date TYPE TEXT USING scheduled_date::TEXT');
  });
});
