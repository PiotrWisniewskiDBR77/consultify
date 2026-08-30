import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('AssessmentLibraryTab day178 empty-state contract', () => {
  it('describes an empty static catalog without claiming a load failure', () => {
    const source = readFileSync('src/components/assessment/library/AssessmentLibraryTab.tsx', 'utf8');

    expect(source).toContain("isPolish ? 'Brak dostępnych metodyk oceny'");
    expect(source).toContain("'Katalog metodyk nie zawiera obecnie żadnych pozycji.'");
    expect(source).toContain("'The methodology catalog currently has no entries.'");
    expect(source).not.toContain('The methodology catalog could not be loaded.');
  });
});
