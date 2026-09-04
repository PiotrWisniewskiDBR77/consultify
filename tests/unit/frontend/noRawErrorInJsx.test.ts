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
  'src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx': 3,
  'src/hooks/useReportSections.ts': 0,
  'src/components/DocumentStudio/DocumentStudioTemplateArchitectView.tsx': 1,
  'src/components/Presentations/PresentationTemplateArchitectView.tsx': 0,
};

const RAW_JSX = /\{\s*(?:(?:data\.error|[A-Za-z_$][\w$]*\??\.message)|\([A-Za-z_$][\w$]*\s+as\s+(?:Error|any)\)\.message|String\([A-Za-z_$][\w$]*\))\s*\}/g;

function readCoveredFile(file: string): string {
  const source = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
  if (!source.length) throw new Error(`covered file is empty: ${file}`);
  return source;
}

function rawErrorInterpolations(file: string): string[] {
  const source = readCoveredFile(file);
  return source.match(RAW_JSX) ?? [];
}

describe('DAY316 raw server error JSX ratchet', () => {
  it('obejmuje sześć jawnych plików rdzenia', () => {
    expect(COVERED_FILES).toHaveLength(6);
    expect(Object.keys(BASELINE).sort()).toEqual([...COVERED_FILES].sort());
    expect(COVERED_FILES.map(readCoveredFile)).toHaveLength(COVERED_FILES.length);
  });

  it.each(COVERED_FILES)('%s nie przekracza linii bazowej', (file) => {
    const matches = rawErrorInterpolations(file);
    expect(matches, `${file}: ${matches.join(', ')}`).toHaveLength(BASELINE[file]);
  });
});
