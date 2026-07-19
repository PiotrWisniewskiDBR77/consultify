import { describe, expect, it } from 'vitest';

import {
  buildDetailLevelDirective,
  getToolSuggestionPrompt,
  getToolSummaryPrompt,
} from '../../src/hooks/discovery/toolAi/promptRegistry';
import type { SWOTData } from '../../src/store/useToolStore';

/**
 * K5 (decyzja właściciela 07-19, Kanon §5): SWOT (i pozostałe Discovery tools
 * współdzielące getToolSuggestionPrompt/getToolSummaryPrompt) generowane na 3
 * poziomach szczegółowości — short/medium/full — tego samego SWOT.
 * Backend+prompt plumbing landed on demo at 9385ca2c65 (promptRegistry.ts +
 * useToolAI.ts); this test proves the mechanic actually works end-to-end at
 * the prompt-construction layer (no UI wired yet — that half stays 🟠 for
 * Piotr's visual review):
 *   1. backward compatibility — 'medium'/undefined produce a byte-identical
 *      prompt to the pre-K5 baseline (no directive injected)
 *   2. 'short'/'full' inject a real, distinct directive between the tool
 *      prompt and the grounding rules
 *   3. the wiring works for BOTH getToolSuggestionPrompt (per-step) and
 *      getToolSummaryPrompt (conclusion), for the flagship dynamic-swot tool
 */
describe('K5 — ToolDetailLevel plumbing (promptRegistry)', () => {
  const swotData: SWOTData = {
    context: {
      industry: 'manufacturing',
      geographicScope: 'PL',
      position: 'challenger',
      goal: 'Increase EBITDA margin',
      scope: 'Operations',
      successSignal: '+3pp margin in 12 months',
      timeframe: 'medium',
      constraints: '',
      assumptions: '',
      kpiTarget: '',
    } as SWOTData['context'],
    signals: [],
    items: [],
    correlations: [],
    tensions: [],
    recommendedMoves: [],
    outputCandidates: [],
  };

  describe('buildDetailLevelDirective', () => {
    it('returns empty string for undefined (backward-compat default)', () => {
      expect(buildDetailLevelDirective(undefined, false)).toBe('');
    });

    it("returns empty string for 'medium' (explicit == today's baseline)", () => {
      expect(buildDetailLevelDirective('medium', false)).toBe('');
    });

    it("returns a non-empty, distinct directive for 'short'", () => {
      const short = buildDetailLevelDirective('short', false);
      expect(short).not.toBe('');
      expect(short.toUpperCase()).toContain('SHORT');
    });

    it("returns a non-empty, distinct directive for 'full'", () => {
      const full = buildDetailLevelDirective('full', false);
      expect(full).not.toBe('');
      expect(full.toUpperCase()).toContain('FULL');
    });

    it('short and full directives are different from each other', () => {
      const short = buildDetailLevelDirective('short', false);
      const full = buildDetailLevelDirective('full', false);
      expect(short).not.toBe(full);
    });

    it('emits Polish copy when isPolish=true', () => {
      const shortPl = buildDetailLevelDirective('short', true);
      expect(shortPl).toContain('POZIOM SZCZEGÓŁOWOŚCI');
    });
  });

  describe('getToolSuggestionPrompt (dynamic-swot, stepId=swot)', () => {
    const base = () => getToolSuggestionPrompt('dynamic-swot', 'swot', swotData);

    it('undefined level === medium level === no-level baseline (byte-identical)', () => {
      const noLevel = base();
      const explicitMedium = getToolSuggestionPrompt('dynamic-swot', 'swot', swotData, 'medium');
      expect(explicitMedium).toBe(noLevel);
      expect(noLevel).not.toContain('DETAIL LEVEL');
    });

    it("'short' injects the SHORT directive and changes the prompt", () => {
      const noLevel = base();
      const short = getToolSuggestionPrompt('dynamic-swot', 'swot', swotData, 'short');
      expect(short).not.toBe(noLevel);
      expect(short).toContain('DETAIL LEVEL: SHORT');
      // directive sits between the tool prompt and the grounding rules
      expect(short.indexOf('DETAIL LEVEL: SHORT')).toBeLessThan(short.indexOf('GROUNDING'));
    });

    it("'full' injects the FULL directive and changes the prompt", () => {
      const noLevel = base();
      const full = getToolSuggestionPrompt('dynamic-swot', 'swot', swotData, 'full');
      expect(full).not.toBe(noLevel);
      expect(full).toContain('DETAIL LEVEL: FULL');
    });

    it('preserves the full required JSON contract at every level (structure untouched)', () => {
      const noLevel = base();
      const short = getToolSuggestionPrompt('dynamic-swot', 'swot', swotData, 'short');
      const full = getToolSuggestionPrompt('dynamic-swot', 'swot', swotData, 'full');
      const jsonContractMarker = '"items": [{"text"';
      expect(noLevel).toContain(jsonContractMarker);
      expect(short).toContain(jsonContractMarker);
      expect(full).toContain(jsonContractMarker);
    });
  });

  describe('getToolSummaryPrompt (dynamic-swot)', () => {
    it('undefined level === medium level (byte-identical), short/full differ', () => {
      const noLevel = getToolSummaryPrompt('dynamic-swot', swotData);
      const explicitMedium = getToolSummaryPrompt('dynamic-swot', swotData, 'medium');
      const short = getToolSummaryPrompt('dynamic-swot', swotData, 'short');
      const full = getToolSummaryPrompt('dynamic-swot', swotData, 'full');

      expect(explicitMedium).toBe(noLevel);
      expect(short).not.toBe(noLevel);
      expect(full).not.toBe(noLevel);
      expect(short).toContain('DETAIL LEVEL: SHORT');
      expect(full).toContain('DETAIL LEVEL: FULL');
    });
  });
});
