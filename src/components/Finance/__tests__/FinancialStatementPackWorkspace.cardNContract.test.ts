import { describe, expect, it } from 'vitest';

import source from '../FinancialStatementPackWorkspace.tsx?raw';

describe('P14-B finance statement pack card contract', () => {
  it('uses canonical card controls and does not reconnect the retired model workspace', () => {
    expect(source).toContain('<NModeMenu2');
    expect(source).toContain('<PracujZAI');
    expect(source).toContain('<ArtifactRightPanel');
    expect(source).toContain('<ArtifactPropertiesTable');
    expect(source).not.toContain('onCreateModelFromPack(packRow)');
    expect(source).not.toContain('<Calculator');
    expect(source).not.toContain("'Generate report section'");
  });
});
