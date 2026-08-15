import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('server/scripts/finance-v3-id-inventory.ts', 'utf8');

describe('FIN-001 finance identity inventory contract', () => {
  it('is read-only by construction and reports the four canonical resolution states', () => {
    expect(source).toContain("client.query('BEGIN READ ONLY')");
    expect(source).toContain("await client.query('ROLLBACK')");
    expect(source).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/);
    for (const state of ['MAPPED', 'UNRESOLVED', 'QUARANTINED', 'DANGLING_ALIAS']) {
      expect(source).toContain(`'${state}'`);
    }
  });

  it('pins one canonical generation and fails the gate for unresolved identities', () => {
    expect(source).toContain("canonicalGeneration: 'finance_artifacts/finance_business_versions'");
    expect(source).toContain('report.totals.UNRESOLVED || report.totals.DANGLING_ALIAS');
    expect(source).toContain("flag: 'wx'");
  });
});
