import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const COVERED_FILES = [
  'src/services/api.ts',
  'src/components/ReportBuilder/useReportBuilder.ts',
  'src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx',
  'src/hooks/useReportSections.ts',
  'src/components/DocumentStudio/DocumentStudioTemplateArchitectView.tsx',
  'src/components/Presentations/PresentationTemplateArchitectView.tsx',
] as const;

const BASELINE: Record<(typeof COVERED_FILES)[number], number> = {
  'src/services/api.ts': 0,
  'src/components/ReportBuilder/useReportBuilder.ts': 0,
  'src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx': 0,
  'src/hooks/useReportSections.ts': 0,
  'src/components/DocumentStudio/DocumentStudioTemplateArchitectView.tsx': 0,
  'src/components/Presentations/PresentationTemplateArchitectView.tsx': 0,
};

const RAW_JSX = /\{[^{}]*(?:data\.error|err\.message|error\.message)[^{}]*\}/g;

function rawErrorInterpolations(file: string): string[] {
  if (!file.endsWith('.tsx')) return [];
  const source = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
  return source.match(RAW_JSX) ?? [];
}

describe('DAY316 raw server error JSX ratchet', () => {
  it('obejmuje sześć jawnych plików rdzenia', () => {
    expect(COVERED_FILES).toHaveLength(6);
    expect(Object.keys(BASELINE).sort()).toEqual([...COVERED_FILES].sort());
  });

  it.each(COVERED_FILES)('%s nie przekracza linii bazowej', (file) => {
    const matches = rawErrorInterpolations(file);
    expect(matches, `${file}: ${matches.join(', ')}`).toHaveLength(BASELINE[file]);
  });
});
