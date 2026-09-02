import fs from 'node:fs';

import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  `${process.cwd()}/src/components/Initiatives/InitiativeDocumentView.tsx`,
  'utf8'
);

describe('Day 277 whole initiative AI fill contract', () => {
  it('wires the existing toolbar button to the whole-card sequential runner', () => {
    expect(source).toContain('const runWholeCardAi = useCallback(async () =>');
    expect(source).toContain('for (const [index, section] of candidates.entries())');
    expect(source).toContain('await runSectionAi(section.id)');
    expect(source).toMatch(/label=\{isPolish \? 'Wypełnij z AI'[\s\S]{0,1000}void runWholeCardAi\(\)/);
    expect(source.match(/label=\{isPolish \? 'Wypełnij z AI'/g)).toHaveLength(1);
  });

  it('reports section names and reasons instead of silently accepting partial fill', () => {
    expect(source).toContain('failures.push(');
    expect(source).toContain("failures.join('; ')");
    expect(source).toContain('Nie uzupełniono');
  });

  it.todo(
    'capacity report: Utwórz raport navigates to a different URL and renders staffing versus plan from server data'
  );
});
