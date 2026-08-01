/**
 * FIN-005 — the rule that decides what may stay in the demo Finance tenant.
 *
 * The cleanup script moves rows out of the demo workspace based on this policy,
 * so getting it wrong either leaves foreign records on a client demo or hides a
 * legitimate one. The cases below are the ones the 2026-08-01 staging probe
 * actually produced, plus the near-misses that would make a naive rule unsafe.
 */

import { describe, expect, it } from 'vitest';

import {
  classifyFinanceDemoRows,
  financeDemoNameFlags,
  isCanonicalDemoRowId,
} from '../financeDemoCoherencePolicy.js';

const ORG = 'demo-org';

describe('isCanonicalDemoRowId', () => {
  it('accepts ids minted by the demo seed for this tenant', () => {
    expect(isCanonicalDemoRowId(`${ORG}--statement-pack--atelier-fy2014`, ORG)).toBe(true);
    expect(isCanonicalDemoRowId(`${ORG}--financial-model--transformation-2015-roi`, ORG)).toBe(true);
  });

  it('rejects rows that did not come from the seed', () => {
    // Operator-created rows use uuids.
    expect(isCanonicalDemoRowId('7c9d2f11-4c11-4d6b-9a2e-1f0a2b3c4d5e', ORG)).toBe(false);
    expect(isCanonicalDemoRowId('staging-finance-pl-01', ORG)).toBe(false);
  });

  it('does not treat another tenant’s seeded row as canonical here', () => {
    expect(isCanonicalDemoRowId('dbr77--financial-model--forecast', ORG)).toBe(false);
  });

  it('requires the "--" separator so a prefix org id cannot false-positive', () => {
    // 'demo' is a prefix of 'demo-org'; without the separator this would pass.
    expect(isCanonicalDemoRowId('demo-org-extra--financial-model--x', 'demo-org')).toBe(false);
    expect(isCanonicalDemoRowId('demo-orgsomething', 'demo-org')).toBe(false);
  });

  it('is safe on empty input instead of matching everything', () => {
    expect(isCanonicalDemoRowId('', ORG)).toBe(false);
    expect(isCanonicalDemoRowId(null, ORG)).toBe(false);
    expect(isCanonicalDemoRowId(`${ORG}--x--y`, '')).toBe(false);
  });
});

describe('financeDemoNameFlags', () => {
  it('flags the exact names found in the demo tenant on 2026-08-01', () => {
    expect(financeDemoNameFlags('DBR77 Manufacturing')).toContain('DBR77');
    expect(financeDemoNameFlags('DBR77 Staging Financial Analysis')).toEqual(
      expect.arrayContaining(['DBR77', 'staging'])
    );
    expect(financeDemoNameFlags('DBR77 Staging Finance Model (kopia)')).toEqual(
      expect.arrayContaining(['DBR77', 'staging', 'ui-duplicate'])
    );
    expect(financeDemoNameFlags('Grupa Apator FY25-FY27 3Y Forecast')).toContain('Apator');
    expect(financeDemoNameFlags('M16 seed model')).toContain('technical-seed');
  });

  it('flags a numbered duplicate as well as a bare one', () => {
    expect(financeDemoNameFlags('Model A (kopia 3)')).toContain('ui-duplicate');
    expect(financeDemoNameFlags('Model A (copy)')).toContain('ui-duplicate');
  });

  it('leaves the canonical Atelier names unflagged', () => {
    expect(financeDemoNameFlags('Atelier Toys')).toEqual([]);
    expect(financeDemoNameFlags('Atelier Toys — Transformation 2015 ROI')).toEqual([]);
    expect(financeDemoNameFlags('Atelier Toys — FY2014 Baseline Financial Analysis')).toEqual([]);
  });

  it('returns no flags for empty names rather than throwing', () => {
    expect(financeDemoNameFlags('')).toEqual([]);
    expect(financeDemoNameFlags(null)).toEqual([]);
    expect(financeDemoNameFlags(undefined)).toEqual([]);
  });
});

describe('classifyFinanceDemoRows', () => {
  it('splits the observed staging tenant into canonical and foreign', () => {
    const { canonical, foreign } = classifyFinanceDemoRows(
      [
        {
          table: 'financial_statement_packs',
          id: `${ORG}--statement-pack--atelier-fy2014`,
          displayName: 'Atelier Toys',
        },
        {
          table: 'financial_statements',
          id: 'uuid-dbr77-pl',
          displayName: 'DBR77 Manufacturing',
        },
        {
          table: 'financial_analyses',
          id: 'uuid-dbr77-analysis',
          displayName: 'DBR77 Staging Financial Analysis',
        },
        {
          table: 'financial_models',
          id: 'uuid-copy-1',
          displayName: 'DBR77 Staging Finance Model (kopia)',
        },
        {
          table: 'financial_models',
          id: `${ORG}--financial-model--transformation-2015-roi`,
          displayName: 'Atelier Toys — Transformation 2015 ROI',
        },
      ],
      ORG
    );

    expect(canonical.map((row) => row.displayName)).toEqual([
      'Atelier Toys',
      'Atelier Toys — Transformation 2015 ROI',
    ]);
    expect(foreign).toHaveLength(3);
    expect(foreign.every((row) => row.flags.length > 0)).toBe(true);
  });

  it('classifies an unnamed leftover as foreign even with no name flags', () => {
    // This is why the id prefix decides and the name only informs.
    const { foreign } = classifyFinanceDemoRows(
      [{ table: 'financial_models', id: 'uuid-unnamed', displayName: 'Untitled' }],
      ORG
    );
    expect(foreign).toHaveLength(1);
    expect(foreign[0].flags).toEqual([]);
  });

  it('keeps a canonical row even if its name contains a flagged word', () => {
    // A name-only rule would wrongly quarantine this.
    const { canonical, foreign } = classifyFinanceDemoRows(
      [
        {
          table: 'financial_models',
          id: `${ORG}--financial-model--seed-scenario`,
          displayName: 'Atelier Toys — seed scenario',
        },
      ],
      ORG
    );
    expect(foreign).toEqual([]);
    expect(canonical).toHaveLength(1);
    expect(canonical[0].flags).toContain('technical-seed');
  });

  it('tolerates an empty tenant', () => {
    const result = classifyFinanceDemoRows([], ORG);
    expect(result.all).toEqual([]);
    expect(result.canonical).toEqual([]);
    expect(result.foreign).toEqual([]);
  });
});
