import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

// DEC-2026-08-24-05: this exact denominator may decrease only after the full
// owner-approved cutover. Until then, both adding and silently removing a
// Benefits workspace import are contract violations.
describe('FinanceHub Benefits import cutover guard', () => {
  it('keeps exactly the three approved lazy imports', () => {
    const testDir = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.resolve(testDir, '../FinanceHub.tsx'), 'utf8');
    const imports = [...source.matchAll(/import\('\.\.\/Benefits\/([^']+)'\)/g)].map(
      ([, moduleName]) => moduleName
    );

    expect(imports).toEqual([
      'BudgetWorkspace',
      'FinancialAnalysisWorkspace',
      'ValuationWorkspace',
    ]);
    expect(imports).toHaveLength(3);
  });
});
