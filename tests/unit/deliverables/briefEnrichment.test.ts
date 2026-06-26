// @vitest-environment node
/**
 * W3.2 (F2.2) — briefEnrichment: zakotwicza brief w kontekście organizacji
 * (komponuje searchInsights + searchOrgNotes). DI → testowalne bez DB/flag.
 */
import { describe, expect, it } from 'vitest';
import {
  enrichBriefWithOrgContext,
  type BriefEnrichmentDeps,
} from '../../../server/src/services/deliverables/briefEnrichment.js';

const BRIEF = 'TestCo buduje platformę SaaS dla logistyki, runda seed 500k EUR.';

function fakeDeps(insights: any[], notes: any[]): BriefEnrichmentDeps {
  return {
    searchInsights: async () => ({ results: insights }),
    searchOrgNotes: async () => ({ results: notes }),
  };
}

describe('W3.2 — enrichBriefWithOrgContext', () => {
  it('trafienia → blok kontekstu dopisany do briefu, used=true', async () => {
    const deps = fakeDeps(
      [{ title: 'Audyt AI Apator', snippet: '7 z 12 procesów zdigitalizowano' }],
      [{ title: 'Notatka rynek', snippet: 'TAM logistyki PL ~8 mld EUR' }],
    );
    const out = await enrichBriefWithOrgContext(BRIEF, 'org-1', deps);
    expect(out.used).toBe(true);
    expect(out.hits.length).toBe(2);
    expect(out.enrichedBrief).toContain(BRIEF);
    expect(out.enrichedBrief).toContain('Audyt AI Apator');
    expect(out.enrichedBrief).toContain('TAM logistyki PL');
    expect(out.contextBlock).not.toBeNull();
  });

  it('brak trafień → oryginalny brief, used=false', async () => {
    const out = await enrichBriefWithOrgContext(BRIEF, 'org-1', fakeDeps([], []));
    expect(out.used).toBe(false);
    expect(out.enrichedBrief).toBe(BRIEF);
    expect(out.contextBlock).toBeNull();
  });

  it('brak orgId → oryginał (fail-soft)', async () => {
    const out = await enrichBriefWithOrgContext(BRIEF, '', fakeDeps([{ title: 'x', snippet: 'y' }], []));
    expect(out.used).toBe(false);
    expect(out.enrichedBrief).toBe(BRIEF);
  });

  it('narzędzie rzuca → oryginał (fail-soft, nie rzuca)', async () => {
    const deps: BriefEnrichmentDeps = {
      searchInsights: async () => { throw new Error('retrieval down'); },
      searchOrgNotes: async () => { throw new Error('retrieval down'); },
    };
    const out = await enrichBriefWithOrgContext(BRIEF, 'org-1', deps);
    expect(out.used).toBe(false);
    expect(out.enrichedBrief).toBe(BRIEF);
  });

  it('respektuje maxHits', async () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ title: `I${i}`, snippet: `s${i}` }));
    const out = await enrichBriefWithOrgContext(BRIEF, 'org-1', fakeDeps(many, many), { maxHits: 4 });
    expect(out.hits.length).toBe(4);
  });

  it('blok kontekstu uciięty do maxContextChars', async () => {
    const big = [{ title: 'T', snippet: 'x'.repeat(5000) }];
    const out = await enrichBriefWithOrgContext(BRIEF, 'org-1', fakeDeps(big, []), { maxContextChars: 500 });
    expect(out.contextBlock!.length).toBeLessThanOrEqual(500);
  });

  it('EN nagłówek gdy language=en', async () => {
    const out = await enrichBriefWithOrgContext(BRIEF, 'org-1', fakeDeps([{ title: 'A', snippet: 'b' }], []), { language: 'en' });
    expect(out.contextBlock).toContain('Organization context');
  });

  it('za krótki brief (<3 znaki) → oryginał', async () => {
    const out = await enrichBriefWithOrgContext('ab', 'org-1', fakeDeps([{ title: 'A', snippet: 'b' }], []));
    expect(out.used).toBe(false);
  });
});
