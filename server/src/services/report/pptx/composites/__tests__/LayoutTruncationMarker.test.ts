/**
 * Unit tests for the Layout Truncation / Review Marker (Sprint S15).
 *
 * Pure helper — no PPTX runtime, no fixtures. We assert:
 *   - decideLayoutTruncationMarker returns the right priority tier
 *     for every recognized flag class.
 *   - Unrecognized flags are filtered out.
 *   - Empty / undefined flag arrays produce no marker.
 *   - High-priority tier wins when mixed with advisory flags.
 *   - buildLayoutTruncationMarker returns null when no marker needed
 *     and a `RenderedElement` with the right shape + text colors when
 *     it does.
 *   - The HIGH_PRIORITY_FLAGS / KNOWN_FLAGS sets stay in sync with the
 *     audit's LayoutAuditFlag union (drift guard).
 */

import { describe, expect, it, vi } from 'vitest';

import type { DesignTokens, UnifiedSlide } from '../../types.js';
import {
  _highPriorityFlagsForTests,
  _knownFlagsForTests,
  _markerColorsForTests,
  _markerPositionForTests,
  buildLayoutTruncationMarker,
  decideLayoutTruncationMarker,
} from '../LayoutTruncationMarker.js';

function slide(partial: Partial<UnifiedSlide> & Pick<UnifiedSlide, 'intent'>): UnifiedSlide {
  return {
    key_message: 'm',
    content: { title: 'A' } as unknown as UnifiedSlide['content'],
    ...partial,
  } as UnifiedSlide;
}

function fakeTokens(): DesignTokens {
  // Minimal placeholder — the marker doesn't read tokens (semantic
  // colors are fixed). Anything castable to DesignTokens works.
  return {} as DesignTokens;
}

describe('LayoutTruncationMarker — decideLayoutTruncationMarker', () => {
  it('returns shouldRender=false for a slide with no auditFlags field', () => {
    const decision = decideLayoutTruncationMarker(slide({ intent: 'cover' }));
    expect(decision).toEqual({
      shouldRender: false,
      priority: 'none',
      recognizedFlagCount: 0,
      recognizedFlags: [],
    });
  });

  it('returns shouldRender=false for an empty auditFlags array', () => {
    const decision = decideLayoutTruncationMarker(slide({ intent: 'cover', auditFlags: [] }));
    expect(decision.shouldRender).toBe(false);
  });

  it('returns shouldRender=false when auditFlags contains only unrecognized strings', () => {
    const decision = decideLayoutTruncationMarker(
      slide({
        intent: 'cover',
        auditFlags: ['totally_made_up_flag', 'another_one'],
      })
    );
    expect(decision.shouldRender).toBe(false);
    expect(decision.recognizedFlags).toEqual([]);
  });

  it('classifies a single overflow flag as advisory priority', () => {
    const decision = decideLayoutTruncationMarker(
      slide({ intent: 'cover', auditFlags: ['layout_overflow_title'] })
    );
    expect(decision.shouldRender).toBe(true);
    expect(decision.priority).toBe('advisory');
    expect(decision.recognizedFlagCount).toBe(1);
  });

  it('classifies a missing-source flag as high priority', () => {
    const decision = decideLayoutTruncationMarker(
      slide({
        intent: 'assessment',
        auditFlags: ['missing_source_for_evidence_intent'],
      })
    );
    expect(decision.shouldRender).toBe(true);
    expect(decision.priority).toBe('high');
  });

  it('classifies an unsupported_intent_for_pptx_export flag as high priority', () => {
    const decision = decideLayoutTruncationMarker(
      slide({
        // @ts-expect-error - intentionally unsupported intent
        intent: 'unknown_intent',
        auditFlags: ['unsupported_intent_for_pptx_export'],
      })
    );
    expect(decision.priority).toBe('high');
  });

  it('classifies an unsupported_intent_for_pdf_export flag as high priority', () => {
    const decision = decideLayoutTruncationMarker(
      slide({
        // @ts-expect-error - intentionally unsupported intent
        intent: 'unknown_intent',
        auditFlags: ['unsupported_intent_for_pdf_export'],
      })
    );
    expect(decision.priority).toBe('high');
  });

  it('upgrades to high priority when ANY high-priority flag is mixed with advisory flags', () => {
    const decision = decideLayoutTruncationMarker(
      slide({
        intent: 'recommendation_single',
        auditFlags: [
          'layout_overflow_title',
          'layout_overflow_blocks',
          'missing_source_for_evidence_intent',
        ],
      })
    );
    expect(decision.priority).toBe('high');
    expect(decision.recognizedFlagCount).toBe(3);
  });

  it('dedupes repeated flags before counting', () => {
    const decision = decideLayoutTruncationMarker(
      slide({
        intent: 'cover',
        auditFlags: ['layout_overflow_title', 'layout_overflow_title', 'layout_overflow_title'],
      })
    );
    expect(decision.recognizedFlagCount).toBe(1);
    expect(decision.recognizedFlags).toEqual(['layout_overflow_title']);
  });

  it('drops unrecognized flags but keeps recognized ones in the same array', () => {
    const decision = decideLayoutTruncationMarker(
      slide({
        intent: 'cover',
        auditFlags: ['bogus_flag', 'layout_overflow_blocks', 'another_bogus'],
      })
    );
    expect(decision.shouldRender).toBe(true);
    expect(decision.recognizedFlags).toEqual(['layout_overflow_blocks']);
  });

  it('returns flags sorted for deterministic output', () => {
    const decision = decideLayoutTruncationMarker(
      slide({
        intent: 'cover',
        auditFlags: [
          'layout_overflow_title',
          'layout_overflow_blocks',
          'layout_overflow_key_message',
        ],
      })
    );
    expect(decision.recognizedFlags).toEqual([
      'layout_overflow_blocks',
      'layout_overflow_key_message',
      'layout_overflow_title',
    ]);
  });
});

describe('LayoutTruncationMarker — buildLayoutTruncationMarker', () => {
  it('returns null when no marker is needed', () => {
    expect(buildLayoutTruncationMarker(slide({ intent: 'cover' }), fakeTokens())).toBeNull();
    expect(
      buildLayoutTruncationMarker(slide({ intent: 'cover', auditFlags: [] }), fakeTokens())
    ).toBeNull();
  });

  it('returns a RenderedElement with kind="shape" when the marker should render', () => {
    const element = buildLayoutTruncationMarker(
      slide({ intent: 'cover', auditFlags: ['layout_overflow_title'] }),
      fakeTokens()
    );
    expect(element).not.toBeNull();
    expect(element!.kind).toBe('shape');
    expect(typeof element!.apply).toBe('function');
  });

  it('apply() draws an amber rounded rect + amber text for advisory priority', () => {
    const element = buildLayoutTruncationMarker(
      slide({ intent: 'cover', auditFlags: ['layout_overflow_title'] }),
      fakeTokens()
    )!;
    const addShape = vi.fn();
    const addText = vi.fn();
    element.apply({ addShape, addText });

    expect(addShape).toHaveBeenCalledTimes(1);
    expect(addShape).toHaveBeenCalledWith(
      'roundRect',
      expect.objectContaining({
        fill: { color: _markerColorsForTests().amberFill },
      })
    );

    expect(addText).toHaveBeenCalledTimes(1);
    expect(addText).toHaveBeenCalledWith(
      '⚠ 1',
      expect.objectContaining({
        color: _markerColorsForTests().amberText,
        bold: true,
      })
    );
  });

  it('apply() draws a rose rect + rose text for high priority', () => {
    const element = buildLayoutTruncationMarker(
      slide({
        intent: 'assessment',
        auditFlags: ['missing_source_for_evidence_intent'],
      }),
      fakeTokens()
    )!;
    const addShape = vi.fn();
    const addText = vi.fn();
    element.apply({ addShape, addText });

    expect(addShape).toHaveBeenCalledWith(
      'roundRect',
      expect.objectContaining({
        fill: { color: _markerColorsForTests().roseFill },
      })
    );
    expect(addText).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ color: _markerColorsForTests().roseText })
    );
  });

  it('apply() shows the recognized-flag count in the label', () => {
    const element = buildLayoutTruncationMarker(
      slide({
        intent: 'recommendation_single',
        auditFlags: [
          'layout_overflow_title',
          'layout_overflow_blocks',
          'layout_overflow_key_message',
        ],
      }),
      fakeTokens()
    )!;
    const addText = vi.fn();
    element.apply({ addShape: vi.fn(), addText });
    expect(addText).toHaveBeenCalledWith('⚠ 3', expect.any(Object));
  });

  it('positions the marker in the top-right corner of the 16:9 slide', () => {
    const pos = _markerPositionForTests();
    // Sanity: the marker fits inside a 10in x 5.625in slide and sits in
    // the top-right (x near right edge, y near top).
    expect(pos.x + pos.w).toBeLessThanOrEqual(10);
    expect(pos.x).toBeGreaterThan(7); // right half
    expect(pos.y).toBeLessThan(1); // top band
  });
});

describe('LayoutTruncationMarker — drift guards', () => {
  it('HIGH_PRIORITY_FLAGS is a strict subset of KNOWN_FLAGS', () => {
    const known = _knownFlagsForTests();
    const high = _highPriorityFlagsForTests();
    for (const flag of high) {
      expect(known.has(flag)).toBe(true);
    }
  });

  it('KNOWN_FLAGS covers exactly the LayoutAuditFlag union ids', () => {
    // If the audit ships a new flag, this list must be updated. The
    // hardcoded list here is the contract — adding a flag without
    // updating this set means the marker silently ignores it.
    const expected = new Set([
      'layout_overflow_title',
      'layout_overflow_key_message',
      'layout_overflow_blocks',
      'missing_source_for_evidence_intent',
      'unsupported_intent_for_pptx_export',
      'unsupported_intent_for_pdf_export',
    ]);
    const known = _knownFlagsForTests();
    expect(known.size).toBe(expected.size);
    for (const flag of expected) {
      expect(known.has(flag)).toBe(true);
    }
  });
});
