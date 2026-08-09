import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/Economics/FinanceHub.tsx'),
  'utf8'
);

describe('FinanceHub governed runtime contract', () => {
  it('keeps Finance tabs as list surfaces without restoring below-list tool panels', () => {
    expect(source).toContain('Finance tabs are list surfaces.');
    expect(source).not.toContain('WhatIfSensitivityPanel');
    expect(source).not.toContain('MonteCarloNpvPanel');
    expect(source).not.toContain('ValuationVisualsPanel');
  });

  it('retains governed statement-pack lookup for import completion', () => {
    expect(source).toContain('V8FinanceApi.getStatementPacks');
    expect(source).toContain('V8FinanceApi.getStatement');
  });

  it('retains the governed V8 health seam without coupling to obsolete tab mocks', () => {
    expect(source).toContain('V8FinanceApi.getDashboard');
    expect(source).toContain('finance-v8-health-chip');
  });
});
