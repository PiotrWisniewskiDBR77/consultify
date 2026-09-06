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
    // DEC-407 (06.09.2026): osobny przycisk „Wypełnij z AI" ZNIKNĄŁ — zastąpiła go
    // pozycja „Uzupełnij cały dokument" w liście wspólnego komponentu `PracujZAI`
    // (jedna struktura sterowania AI we wszystkich kartach N). Sprawdzamy to,
    // co jest kontraktem TERAZ: pozycja „cały dokument" wciąż woła TEN SAM
    // sekwencyjny runner, a etykiety nazywa komponent, nie karta.
    expect(source).toMatch(/uzupelnijDokument=\{\{[\s\S]{0,400}void runWholeCardAi\(\)/);
    expect(source).toMatch(/uzupelnijSekcje=\{\{[\s\S]{0,400}void runActiveSectionAi\(\)/);
    expect(source).not.toContain("label={isPolish ? 'Wypełnij z AI'");
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
