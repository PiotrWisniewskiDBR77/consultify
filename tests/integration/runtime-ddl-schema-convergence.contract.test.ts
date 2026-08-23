import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('mounted runtime DDL schema convergence migration', () => {
  const migration = fs.readFileSync(
    path.resolve(process.cwd(), 'server/migrations/20260823_runtime_ddl_schema_convergence.sql'),
    'utf8'
  );

  const requiredColumns: Record<string, string[]> = {
    organizations: ['logo_url', 'branding_primary_color', 'branding_accent_color'],
    users: ['is_active', 'last_login_at', 'extended_preferences'],
    trusted_devices: ['trusted_at'],
    report_builder_reports: [
      'report_type_v3',
      'period_from',
      'period_to',
      'communication_register',
      'density',
      'form',
      'data_level',
      'confidentiality',
      'theme_id',
      'context_pack_snapshot',
      'goal_v3',
    ],
    report_builder_sections: ['summary', 'is_refreshable', 'last_data_timestamp'],
    schedule_executions: ['created_at'],
    usage_records: ['metric_name', 'quantity'],
  };

  for (const [table, columns] of Object.entries(requiredColumns)) {
    it.each(columns)(`migrates ${table}.%s before runtime startup`, (column) => {
      expect(migration).toContain(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} `);
    });
  }

  it.each(['report_public_links', 'organization_brand_voice_profiles'])(
    'migrates live service table %s instead of relying on runtime CREATE',
    (table) => {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS ${table} (`);
    }
  );

  it('uses a numeric quantity type required by SUM(quantity)', () => {
    expect(migration).toContain(
      'ALTER TABLE usage_records ADD COLUMN IF NOT EXISTS quantity NUMERIC DEFAULT 0;'
    );
  });
});
