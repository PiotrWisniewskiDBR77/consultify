/**
 * FIX-205 pkt 1 — dowód, że `org.notes.manualContext` (claimy zapisane przez
 * PUT `organization-context-store.routes.ts` -> `OrganizationContextService
 * .recordOrganizationContextStoreSave` -> `buildResolvedContext`) faktycznie
 * trafia do WYRENDEROWANEGO STRINGU PROMPTU budowanego przez
 * `AIPipeline.buildOrganizationSection`, nie tylko do `JSON.stringify(resolved)`.
 *
 * Dyżur 205 udowodnił już (patrz `day205.organizationContextStoreWisdom.pg.test.ts`)
 * że PUT -> claim -> `buildResolvedContext` działa: `JSON.stringify(resolved)`
 * zawiera zapisane frazy. Ten test domyka OSTATNIĄ MILĘ — resolved.notes
 * .manualContext -> prompt — którą audytor zmierzył jako
 * `{inResolved:true, inOrgLayer:true, inPrompt:FALSE}` przed commitem
 * `7936b45e7a`. Wariant minimalny (zgodnie z instrukcją FIX-205): podajemy
 * `org.notes.manualContext` bezpośrednio do funkcji budującej sekcję (private
 * metoda `buildOrganizationSection`, jedyny konsument tego pola w AIPipeline)
 * i asertujemy obecność magicznego stringa w ZWRÓCONYM STRINGU (nie w JSON).
 *
 * Kształt payloadu wiernie odzwierciedla to, co
 * `OrganizationContextService.recordOrganizationContextStoreSave` faktycznie
 * pisze do claim_path='notes.manualContext' (`{ section, ...value }`, patrz
 * OrganizationContextService.ts ~1789) i co `buildResolvedContext` faktycznie
 * kładzie do `resolved.notes.manualContext` (patrz ~1548 `mergeUniqueObjects`).
 */

import { describe, expect, it } from 'vitest';

import { aiPipeline } from '../AIPipeline.js';

describe('Day205 FIX pkt 1 — org.notes.manualContext renders into the AIPipeline prompt string', () => {
  const MAGIC_GOALS = 'Day205-FIX-magic-goals-fbfb6b2a';
  const MAGIC_CHALLENGES = 'Day205-FIX-magic-challenges-1c8e0a55';
  const MAGIC_SYNTHESIS = 'Day205-FIX-magic-synthesis-77a944de';

  function buildOrgWithNotes() {
    return {
      organizationName: 'Day205 FIX Org',
      notes: {
        // Exact shape written by OrganizationContextService.recordOrganizationContextStoreSave
        // (`{section, ...payload}`) and read back by buildResolvedContext into
        // resolved.notes.manualContext.
        manualContext: [
          { section: 'goals', ambition: MAGIC_GOALS },
          { section: 'challenges', blocker: MAGIC_CHALLENGES },
          { section: 'synthesis', risk: MAGIC_SYNTHESIS },
        ],
      },
    };
  }

  it('renders all three manualContext claim values into the prompt text returned by buildOrganizationSection', () => {
    const org = buildOrgWithNotes();

    const promptSection: string = (aiPipeline as any).buildOrganizationSection(org);

    expect(typeof promptSection).toBe('string');
    // The proof must be on the rendered PROMPT STRING, not on JSON.stringify(org)
    // or JSON.stringify(resolved) — a string that merely round-trips the input
    // object would prove nothing about what Teresa actually reads.
    expect(promptSection).not.toEqual(JSON.stringify(org));
    expect(promptSection).toContain(MAGIC_GOALS);
    expect(promptSection).toContain(MAGIC_CHALLENGES);
    expect(promptSection).toContain(MAGIC_SYNTHESIS);
    expect(promptSection).toContain('### Notatki organizacji');
  });

  it('renders nothing extra when manualContext is empty (no false positive from an always-present heading)', () => {
    const org = { organizationName: 'Day205 FIX Org empty', notes: { manualContext: [] } };
    const promptSection: string = (aiPipeline as any).buildOrganizationSection(org);
    expect(promptSection).not.toContain('### Notatki organizacji');
  });
});
