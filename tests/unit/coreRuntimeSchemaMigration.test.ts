import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = path.resolve(
  process.cwd(),
  'server/migrations/954_core_task_membership_runtime_schema.sql'
);
const sql = fs.readFileSync(migrationPath, 'utf8');

describe('954 core task and membership runtime schema', () => {
  it('moves every effective-access membership column into the migration ledger', () => {
    for (const column of ['normalized_project_role', 'role_template_id', 'legacy_project_role']) {
      expect(sql).toContain(`ADD COLUMN IF NOT EXISTS ${column} TEXT`);
    }
  });

  it('creates replay-safe task history with both tenant-adjacent foreign keys', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS task_history');
    expect(sql).toContain("conname = 'task_history_task_id_fkey'");
    expect(sql).toContain('FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE');
    expect(sql).toContain("conname = 'task_history_changed_by_fkey'");
    expect(sql).toContain('FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL');
  });
});
