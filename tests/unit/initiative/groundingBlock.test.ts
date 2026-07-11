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

  // §6 downstream Insight seeds (#57/Z60) — insightMaterializationService.
  // deriveInitiativeSeedContext feeds these two fields; the generator must
  // INHERIT them (instruct the LLM to use directly) instead of guessing.
  describe('§6 downstream Insight seeds (seedOwnerRole / seedKpiSeeds)', () => {
    it('bez seedów blok NIE wspomina zalążków (istniejące zachowanie niezmienione)', () => {
      expect(buildGroundingBlock({ ...base })).toBeNull();
      const g = buildGroundingBlock({ ...base, orgContext: 'ORG' })!;
      expect(g).not.toContain('Zalążek');
      expect(g).not.toContain('Zalążki KPI');
    });

    it('seedOwnerRole trafia do bloku z instrukcją "UŻYJ WPROST"', () => {
      const g = buildGroundingBlock({ ...base, seedOwnerRole: 'Head of Operations' })!;
      expect(g).toContain('Zalążek właściciela z Insightu');
      expect(g).toContain('UŻYJ WPROST');
      expect(g).toContain('Head of Operations');
    });

    it('seedKpiSeeds trafia do bloku z instrukcją "UŻYJ WPROST"', () => {
      const g = buildGroundingBlock({
        ...base,
        seedKpiSeeds: 'czas obsługi zapytania (~5 dni → 1 dzień, 2 kwartały)',
      })!;
      expect(g).toContain('Zalążki KPI z Insightu');
      expect(g).toContain('UŻYJ WPROST');
      expect(g).toContain('czas obsługi zapytania (~5 dni → 1 dzień, 2 kwartały)');
    });

    it('oba seedy razem współistnieją z resztą groundingu (additive, nie zastępuje)', () => {
      const g = buildGroundingBlock({
        ...base,
        orgContext: 'ORG',
        seedOwnerRole: 'Head of Sales Ops',
        seedKpiSeeds: 'metric (a → b)',
      })!;
      expect(g).toContain('Kontekst organizacji');
      expect(g).toContain('Head of Sales Ops');
      expect(g).toContain('metric (a → b)');
    });
  });
});
