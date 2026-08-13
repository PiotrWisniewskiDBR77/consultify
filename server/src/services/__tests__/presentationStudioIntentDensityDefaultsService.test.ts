/**
 * Unit tests for `presentationStudioIntentDensityDefaultsService` (Sprint S14).
 *
 * Verifies:
 *   - The mapping covers every SlideIntent the audit deems
 *     PPTX-supported (drift guard against new intents shipping
 *     without a registered density default).
 *   - `intentDensityDefaultsFor` returns immutable, deep-copied entries
 *     so callers cannot mutate the registered map.
 *   - `applyIntentDensityDefaults` fills missing fields, NEVER
 *     overrides caller-provided fields, and merges per-slot overrides
 *     correctly (caller wins on a per-slot basis).
 *   - Mixed-density intents emit the documented per-slot overrides
 *     (`comparison`, `prioritization_matrix`, `recommendation_single`).
 */

import { describe, expect, it } from 'vitest';

import type { OutlineItem } from '../presentationGeneratorService.js';
import {
  _intentDensityDefaultsForTests,
  applyIntentDensityDefaults,
  intentDensityDefaultsFor,
} from '../presentationStudioIntentDensityDefaultsService.js';
import { _pptxSupportedIntentsForTests } from '../presentationStudioLayoutAuditService.js';

function slide(partial: Partial<OutlineItem>): OutlineItem {
  return {
    intent: 'cover',
    title: 'A',
    enabled: true,
    ...partial,
  } as OutlineItem;
}

describe('presentationStudioIntentDensityDefaultsService', () => {
  it('registers a density default for every PPTX-supported intent (drift guard)', () => {
    const registered = _intentDensityDefaultsForTests();
    const supported = _pptxSupportedIntentsForTests();
    const missing: string[] = [];
    for (const intent of supported) {
      if (!Object.prototype.hasOwnProperty.call(registered, intent)) missing.push(intent);
    }
    // If this fails, a new SlideIntent shipped without a registered
    // density default. Add an entry to INTENT_DENSITY_DEFAULTS in
    // presentationStudioIntentDensityDefaultsService.ts.
    expect(missing).toEqual([]);
  });

  it('intentDensityDefaultsFor returns the canonical entry for a known intent', () => {
    expect(intentDensityDefaultsFor('cover')).toEqual({ density: 'visual' });
    expect(intentDensityDefaultsFor('comparison')).toEqual({
      density: 'balanced',
      slotDensities: { title: 'visual', blocks: 'document' },
    });
  });

  it('intentDensityDefaultsFor returns undefined for unknown intents', () => {
    // We DON'T fabricate defaults for unknown intents — the caller
    // must opt in by registering the intent or letting the audit fall
    // back to slide-level 'balanced'.
    expect(intentDensityDefaultsFor('totally_made_up_intent')).toBeUndefined();
    expect(intentDensityDefaultsFor(undefined)).toBeUndefined();
    expect(intentDensityDefaultsFor('')).toBeUndefined();
  });

  it('intentDensityDefaultsFor returns a fresh object — caller mutation does not leak into the registry', () => {
    const a = intentDensityDefaultsFor('comparison')!;
    a.slotDensities!.title = 'document';
    const b = intentDensityDefaultsFor('comparison')!;
    expect(b.slotDensities!.title).toBe('visual');
  });

  it('applyIntentDensityDefaults fills slide-level density when missing', () => {
    const item = slide({ intent: 'executive_summary' });
    expect(item.density).toBeUndefined();
    const enriched = applyIntentDensityDefaults(item);
    expect(enriched.density).toBe('balanced');
    expect(enriched.slotDensities).toEqual({ blocks: 'document' });
  });

  it('applyIntentDensityDefaults preserves caller-set density', () => {
    const item = slide({ intent: 'executive_summary', density: 'document' });
    const enriched = applyIntentDensityDefaults(item);
    expect(enriched.density).toBe('document');
    // The blocks override still flows through because the caller did
    // not set slotDensities.
    expect(enriched.slotDensities).toEqual({ blocks: 'document' });
  });

  it('applyIntentDensityDefaults merges per-slot overrides (caller wins per slot)', () => {
    const item = slide({
      intent: 'comparison',
      // Caller set title only; defaults provide title='visual' and
      // blocks='document'. Caller's title MUST win; blocks default
      // MUST flow through.
      slotDensities: { title: 'document' },
    });
    const enriched = applyIntentDensityDefaults(item);
    expect(enriched.slotDensities).toEqual({
      title: 'document',
      blocks: 'document',
    });
  });

  it('applyIntentDensityDefaults preserves caller-set slot fully when no default exists for that slot', () => {
    const item = slide({
      intent: 'cover',
      slotDensities: { keyMessage: 'document' },
    });
    const enriched = applyIntentDensityDefaults(item);
    // Cover has no slot-level overrides registered. Caller's keyMessage
    // must persist; title/blocks must NOT be invented.
    expect(enriched.slotDensities).toEqual({ keyMessage: 'document' });
  });

  it('applyIntentDensityDefaults emits the canonical comparison mix (visual title + document blocks)', () => {
    const enriched = applyIntentDensityDefaults(slide({ intent: 'comparison' }));
    expect(enriched.density).toBe('balanced');
    expect(enriched.slotDensities).toEqual({
      title: 'visual',
      blocks: 'document',
    });
  });

  it('applyIntentDensityDefaults emits the canonical recommendation_single mix (visual title)', () => {
    const enriched = applyIntentDensityDefaults(slide({ intent: 'recommendation_single' }));
    expect(enriched.density).toBe('balanced');
    expect(enriched.slotDensities).toEqual({
      title: 'visual',
      blocks: 'document',
    });
  });

  it('applyIntentDensityDefaults omits slotDensities entirely when neither caller nor default has any', () => {
    const enriched = applyIntentDensityDefaults(slide({ intent: 'next_steps' }));
    expect(enriched.density).toBe('balanced');
    expect(enriched.slotDensities).toBeUndefined();
  });

  it('applyIntentDensityDefaults passes unknown intents through untouched', () => {
    const item = slide({
      // @ts-expect-error - intentionally unknown
      intent: 'totally_made_up_intent',
      density: 'visual',
    });
    const enriched = applyIntentDensityDefaults(item);
    expect(enriched.density).toBe('visual');
    expect(enriched.slotDensities).toBeUndefined();
  });

  it('applyIntentDensityDefaults is pure — calling it twice produces equivalent objects, not the same reference', () => {
    const item = slide({ intent: 'comparison' });
    const a = applyIntentDensityDefaults(item);
    const b = applyIntentDensityDefaults(item);
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});
