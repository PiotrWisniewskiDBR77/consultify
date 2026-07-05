// @vitest-environment node
/**
 * F0/L1 — buildGroundingBlock: grunt generacji z 4 źródeł (org/lineage/financials/portfolio).
 * Część kręgosłupa inicjatyw (INITIATIVE_SYSTEM_SSOT §F0). Czysta funkcja.
 */
import { describe, expect, it, vi } from 'vitest';

// Serwis instancjuje getDatabase() w konstruktorze (default export) — mockujemy, by
// import czystej funkcji nie wymagał realnej DB.
vi.mock('../../../server/src/database/connection.js', () => ({ getDatabase: () => ({}) }), { virtual: true });

import { buildGroundingBlock } from '../../../server/src/services/initiativeGenerationService.ts';

const base = { language: 'pl' as const };

describe('F0 — buildGroundingBlock (grunt 4 źródeł)', () => {
  it('pusty kontekst → null (nie ma czym gruntować)', () => {
    expect(buildGroundingBlock({ ...base })).toBeNull();
  });

  it('portfolio trafia do groundingu z anty-duplikat instrukcją', () => {
    const g = buildGroundingBlock({ ...base, portfolioSummary: 'Automatyzacja [EXECUTING]; Migracja CRM [PLANNING]' });
    expect(g).toContain('Istniejące inicjatywy');
    expect(g).toContain('NIE duplikuj');
    expect(g).toContain('Automatyzacja [EXECUTING]');
  });

  it('kontekst org + financials + lineage + KPI — wszystkie w bloku', () => {
    const g = buildGroundingBlock({
      ...base,
      orgContext: 'Producent klimatyzatorów, cel: -15% kosztów operacyjnych',
      financialsSummary: 'Przychód R3 8.8M EUR, EBITDA 2.7M',
      sourceLineage: 'audit #a-123',
      existingKpis: 'OEE (baseline 62 → cel 75 %)',
    })!;
    expect(g).toContain('Kontekst organizacji');
    expect(g).toContain('Dane finansowe org');
    expect(g).toContain('audit #a-123');
    expect(g).toContain('OEE');
  });

  it('kontekst org jest PIERWSZY (najwyższy priorytet gruntu)', () => {
    const g = buildGroundingBlock({ ...base, orgContext: 'ORG', problemStatement: 'PROB' })!;
    expect(g.indexOf('Kontekst organizacji')).toBeLessThan(g.indexOf('Problem:'));
  });

  it('ucina długie pola (portfolio ≤1000, reszta ≤800)', () => {
    const g = buildGroundingBlock({ ...base, orgContext: 'x'.repeat(2000), portfolioSummary: 'y'.repeat(2000) })!;
    // org ≤800 + label, portfolio ≤1000 + label — sumarycznie znacznie poniżej 2×2000
    expect(g.length).toBeLessThan(2100);
  });
});
