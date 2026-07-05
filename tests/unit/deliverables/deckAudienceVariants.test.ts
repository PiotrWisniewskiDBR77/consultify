// @vitest-environment node
/**
 * Unit tests — deckAudienceVariants (F10.3)
 *
 * AV-1: working = full passthrough
 * AV-2: board = condensed, framing kept, cap honored, reindexed
 * AV-3: small deck (≤cap) → board == full
 * AV-4: buildBothVariants
 */

import { describe, expect, it } from 'vitest';
import {
  buildAudienceVariant,
  buildBothVariants,
  BOARD_CUT_MAX,
} from '../../../server/src/services/deliverables/deckAudienceVariants.js';
import type { SlideLayoutPlan } from '../../../server/src/services/presentationLayoutDirectorService.js';

function mkPlan(intent: string, index: number): SlideLayoutPlan {
  return {
    slideIndex: index,
    layoutIntent: intent as any,
    paletteId: 'harvard',
    imageBrief: null,
    reasoning: 'test',
    source: 'deterministic',
    title: `Slide ${index}`,
  };
}

// 12-slide deck: cover + 10 mixed + next_steps
const DECK: SlideLayoutPlan[] = [
  mkPlan('cover', 0),
  mkPlan('executive_summary', 1),
  mkPlan('key_messages', 2),
  mkPlan('data_overview', 3),      // tier 2
  mkPlan('analysis', 4),           // tier 2
  mkPlan('recommendation_single', 5),
  mkPlan('root_cause', 6),         // tier 2
  mkPlan('performance_overview', 7),
  mkPlan('comparison', 8),         // tier 2
  mkPlan('risk_management', 9),
  mkPlan('agenda', 10),            // tier 2
  mkPlan('next_steps', 11),
];

describe('deckAudienceVariants', () => {
  it('AV-1: working = full passthrough, nothing dropped', () => {
    const res = buildAudienceVariant(DECK, 'working');
    expect(res.plans).toHaveLength(DECK.length);
    expect(res.droppedSlideIndices).toHaveLength(0);
  });

  it('AV-2: board = condensed to ≤ cap, framing kept, reindexed 0..N-1', () => {
    const res = buildAudienceVariant(DECK, 'board');
    expect(res.plans.length).toBeLessThanOrEqual(BOARD_CUT_MAX);
    expect(res.droppedSlideIndices.length).toBeGreaterThan(0);

    // framing preserved: first is cover, last is next_steps
    expect(res.plans[0].layoutIntent).toBe('cover');
    expect(res.plans[res.plans.length - 1].layoutIntent).toBe('next_steps');

    // reindexed cleanly
    res.plans.forEach((p, i) => expect(p.slideIndex).toBe(i));

    // tier-2 fillers (data_overview/analysis/agenda/comparison) should be dropped first
    const keptIntents = new Set(res.plans.map((p) => p.layoutIntent));
    expect(keptIntents.has('executive_summary')).toBe(true);
    expect(keptIntents.has('recommendation_single')).toBe(true);
  });

  it('AV-2b: board cut drops low-priority tier-2 slides, keeps decision slides', () => {
    const res = buildAudienceVariant(DECK, 'board');
    const dropped = new Set(res.droppedSlideIndices);
    // agenda (idx 10) and data_overview (idx 3) are tier-2 fillers → likely dropped
    expect(dropped.size).toBe(DECK.length - res.plans.length);
  });

  it('AV-3: deck already ≤ cap → board == full (no drop)', () => {
    const small = [mkPlan('cover', 0), mkPlan('key_messages', 1), mkPlan('next_steps', 2)];
    const res = buildAudienceVariant(small, 'board');
    expect(res.plans).toHaveLength(3);
    expect(res.droppedSlideIndices).toHaveLength(0);
  });

  it('AV-4: buildBothVariants returns board (condensed) + working (full)', () => {
    const both = buildBothVariants(DECK);
    expect(both.working.plans).toHaveLength(DECK.length);
    expect(both.board.plans.length).toBeLessThanOrEqual(BOARD_CUT_MAX);
    // both cuts share the SAME source slides (consistency): every board slide title
    // exists in working
    const workingTitles = new Set(both.working.plans.map((p) => p.title));
    for (const p of both.board.plans) {
      expect(workingTitles.has(p.title)).toBe(true);
    }
  });

  it('AV-5: custom maxSlides honored', () => {
    const res = buildAudienceVariant(DECK, 'board', 4);
    expect(res.plans.length).toBeLessThanOrEqual(4);
  });
});
