import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const migration = fs.readFileSync(
  path.resolve(process.cwd(), 'server/migrations/20260915_interview_templates_category.sql'),
  'utf8'
);
const rollback = fs.readFileSync(
  path.resolve(
    process.cwd(),
    'server/migrations/rollback/20260915_interview_templates_category.rollback.sql'
  ),
  'utf8'
);

describe('DEC-519 interview template category migration contract', () => {
  it('is additive, constrained to 18 V6 system templates and pins the expected distribution', () => {
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS format TEXT');
    expect(migration).toContain('target_count NOT IN (0, 18)');
    expect(migration).toContain('organization_id IS NULL');
    expect(migration).toContain("template_scope = 'system'");
    expect(migration).toContain('"commercial":2');
    expect(migration).toContain('"operations":4');
    expect(migration).toContain('"strategy":4');
  });

  it('keeps rollback additive and never drops the format column', () => {
    expect(rollback).toContain('format = NULL');
    expect(rollback.toUpperCase()).not.toContain('DROP COLUMN');
    expect(rollback.toUpperCase()).not.toContain('DROP TABLE');
  });
});
