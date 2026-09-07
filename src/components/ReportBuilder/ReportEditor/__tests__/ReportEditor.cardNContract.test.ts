import { describe, expect, it } from 'vitest';

import source from '../ReportEditor.tsx?raw';

describe('P14-B report-builder card contract', () => {
  it('uses one canonical AI entry and the standard right panel', () => {
    expect(source).toContain('<PracujZAI');
    expect(source).toContain('<ArtifactRightPanel');
    expect(source).toContain('<ArtifactPropertiesTable');
    expect(source).not.toContain("t('reportBuilder.editor.agent'");
    expect(source).not.toContain("t('reportBuilder.editor.generateNew'");
  });
});
