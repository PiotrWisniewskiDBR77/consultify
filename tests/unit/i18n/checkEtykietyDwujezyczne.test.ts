import { describe, expect, it } from 'vitest';
import { analyzeSource } from '../../../scripts/dev/check-etykiety-dwujezyczne.mjs';

describe('check-etykiety-dwujezyczne', () => {
  it('wykrywa prawdziwy defekt identycznych angielskich gałęzi', () => {
    const rows = analyzeSource("const label = isPolish ? 'Mission & Context' : 'Mission & Context';", 'fixture.ts');
    expect(rows).toMatchObject([{ file: 'fixture.ts', identical: true, justified: false }]);
  });

  it('nie zgłasza uzasadnionych identyczności Status i SWOT', () => {
    const rows = analyzeSource("const a = isPolish ? 'Status' : 'Status'; const b = isPolish ? 'SWOT' : 'SWOT';", 'fixture.ts');
    expect(rows).toHaveLength(2);
    expect(rows.every(row => row.identical && row.justified)).toBe(true);
  });
});
