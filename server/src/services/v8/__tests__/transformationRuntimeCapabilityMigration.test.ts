import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('947 transformation runtime capability migration', () => {
  const sql = fs.readFileSync(
    path.resolve(process.cwd(), 'server/migrations/947_transformation_runtime_capability_registry.sql'),
    'utf8'
  );

  it('is structurally replay-safe and tenant scoped', () => {
    expect(sql.match(/CREATE TABLE IF NOT EXISTS/g)?.length).toBe(2);
    expect(sql.match(/CREATE INDEX IF NOT EXISTS/g)?.length).toBe(2);
    expect(sql).toContain('UNIQUE (organization_id, lifecycle_stage)');
    expect(sql).toContain(
      'UNIQUE (organization_id, transformation_case_id, plan_id, registry_digest)'
    );
  });

  it('preserves explicit non-ready truth in the plan constraint', () => {
    expect(sql).toContain("'PARTIAL','BLOCKED','EVIDENCE_MISSING'");
    expect(sql).toContain("derived_status IN ('REAL','PARTIAL','BLOCKED','EVIDENCE_MISSING')");
  });
});
