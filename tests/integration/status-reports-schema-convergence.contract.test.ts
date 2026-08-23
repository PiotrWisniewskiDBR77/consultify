import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('status_reports schema convergence migration', () => {
  const migration = fs.readFileSync(
    path.resolve(
      process.cwd(),
      'server/migrations/20260823_status_reports_legacy_columns_fresh_db.sql'
    ),
    'utf8'
  );

  it.each(['title', 'content', 'health', 'period'])(
    'adds the legacy %s column without replacing existing data',
    (column) => {
      expect(migration).toContain(
        `ALTER TABLE status_reports ADD COLUMN IF NOT EXISTS ${column} TEXT;`
      );
    }
  );

  it.each(['initiative_id', 'period_start', 'period_end'])(
    'allows legacy project reports to omit %s on rich-first databases',
    (column) => {
      expect(migration).toContain(
        `ALTER TABLE status_reports ALTER COLUMN ${column} DROP NOT NULL;`
      );
    }
  );
});
