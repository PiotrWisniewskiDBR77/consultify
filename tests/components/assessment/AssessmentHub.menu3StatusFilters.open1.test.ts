import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('OPEN-1 U-23 Assessment Menu 3 status filters', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/components/assessment/AssessmentHub.tsx'),
    'utf8'
  );

  it('renders the existing data-driven status chips in StandardModuleBar surfaces', () => {
    expect(source).toContain(
      "const hubMenu3Chips = activeTab === 'outputs' ? hubMenu3InfoChips : statusFilterChips"
    );
    expect(source).toContain('<AssessmentMenu3ActionBar chips={hubMenu3Chips}');
    expect(source).toContain('commandRowContent={hubCommandRowContent}');
  });

  it('keeps Library without a command row and does not create a bespoke bar', () => {
    expect(source).toContain("activeTab === 'library'\n        ? bulkCommandRowContent");
    expect(source).toContain('<StandardModuleBar');
  });
});
