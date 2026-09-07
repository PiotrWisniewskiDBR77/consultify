import { describe, expect, it } from 'vitest';

import source from '../StatementPackWorkspaceV2.tsx?raw';

describe('P14-B canonical statement pack card', () => {
  it('uses the shared N frame and offers analysis without restoring the retired model', () => {
    expect(source).toContain('<DocumentCardNFrame');
    expect(source).toContain('type="finance-statement-pack"');
    expect(source).toContain("onCreateNew('HISTORICAL_ANALYSIS', businessVersionId)");
    expect(source).not.toContain('FinancialModelWorkspace');
  });
});
