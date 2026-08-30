import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'src/components/Execution/ExecutionHub.tsx'),
  'utf8'
);

describe('ExecutionHub source relation contract', () => {
  it('uses the human source label and appends a non-empty framework', () => {
    expect(source).toContain("getSourceDisplayLabel(previewModel.sourceType)");
    expect(source).toContain("String((selectedRow as any)?.sourceFramework || '').trim()");
    expect(source).toContain('sourceFrameworkValue');
    expect(source).toContain('`${sourceLabel} · ${sourceFrameworkValue}`');
  });

  it('falls back to the label and keeps no-source relations empty', () => {
    expect(source).toContain(': sourceLabel');
    expect(source).toMatch(/sourceLabel[\s\S]*\? \[[\s\S]*: \[\]/);
    expect(source).not.toContain("${t('common.source', 'Source')}: ${previewModel.sourceType}");
  });
});
