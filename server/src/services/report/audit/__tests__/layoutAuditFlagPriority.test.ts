/**
 * Unit tests for the shared layout-audit flag priority module
 * (Sprint S16). The PPTX marker (S15) and the PDF marker (S16) both
 * consume `decideLayoutAuditMarker`, so this module is the canonical
 * place to assert priority semantics + drift guards.
 */

import { describe, expect, it } from 'vitest';

import {
  _highPriorityFlagsForTests,
  _knownFlagsForTests,
  decideLayoutAuditMarker,
  HIGH_PRIORITY_FLAGS,
  KNOWN_FLAGS,
} from '../layoutAuditFlagPriority.js';

describe('layoutAuditFlagPriority — decideLayoutAuditMarker', () => {
  it('returns no-render for null', () => {
    expect(decideLayoutAuditMarker(null)).toEqual({
      shouldRender: false,
      priority: 'none',
      recognizedFlagCount: 0,
      recognizedFlags: [],
    });
  });

  it('returns no-render for undefined', () => {
    expect(decideLayoutAuditMarker(undefined)).toEqual({
      shouldRender: false,
      priority: 'none',
      recognizedFlagCount: 0,
      recognizedFlags: [],
    });
  });

  it('returns no-render for an empty array', () => {
    expect(decideLayoutAuditMarker([]).shouldRender).toBe(false);
  });

  it('returns no-render when the array contains only unrecognized flags', () => {
    const decision = decideLayoutAuditMarker(['totally_made_up_flag', 'nope']);
    expect(decision.shouldRender).toBe(false);
    expect(decision.recognizedFlags).toEqual([]);
  });

  it('classifies a single overflow flag as advisory', () => {
    const decision = decideLayoutAuditMarker(['layout_overflow_title']);
    expect(decision.shouldRender).toBe(true);
    expect(decision.priority).toBe('advisory');
    expect(decision.recognizedFlagCount).toBe(1);
  });

  it('classifies a missing-source flag as high priority', () => {
    expect(decideLayoutAuditMarker(['missing_source_for_evidence_intent']).priority).toBe('high');
  });

  it('classifies an unsupported_intent_for_pptx_export flag as high priority', () => {
    expect(decideLayoutAuditMarker(['unsupported_intent_for_pptx_export']).priority).toBe('high');
  });

  it('classifies an unsupported_intent_for_pdf_export flag as high priority', () => {
    expect(decideLayoutAuditMarker(['unsupported_intent_for_pdf_export']).priority).toBe('high');
  });

  it('upgrades to high priority when ANY high-priority flag is mixed with advisories', () => {
    const decision = decideLayoutAuditMarker([
      'layout_overflow_title',
      'layout_overflow_blocks',
      'missing_source_for_evidence_intent',
    ]);
    expect(decision.priority).toBe('high');
    expect(decision.recognizedFlagCount).toBe(3);
  });

  it('dedupes repeated flag ids before counting', () => {
    const decision = decideLayoutAuditMarker([
      'layout_overflow_title',
      'layout_overflow_title',
      'layout_overflow_title',
    ]);
    expect(decision.recognizedFlagCount).toBe(1);
    expect(decision.recognizedFlags).toEqual(['layout_overflow_title']);
  });

  it('drops unrecognized flags but keeps recognized ones in the same array', () => {
    const decision = decideLayoutAuditMarker([
      'bogus_flag',
      'layout_overflow_blocks',
      'another_bogus',
    ]);
    expect(decision.shouldRender).toBe(true);
    expect(decision.recognizedFlags).toEqual(['layout_overflow_blocks']);
  });

  it('returns flags sorted for deterministic output', () => {
    const decision = decideLayoutAuditMarker([
      'layout_overflow_title',
      'layout_overflow_blocks',
      'layout_overflow_key_message',
    ]);
    expect(decision.recognizedFlags).toEqual([
      'layout_overflow_blocks',
      'layout_overflow_key_message',
      'layout_overflow_title',
    ]);
  });

  it('rejects non-string values inside the array (defensive)', () => {
    const decision = decideLayoutAuditMarker([
      'layout_overflow_title',
      // @ts-expect-error - intentionally wrong type
      null,
      // @ts-expect-error - intentionally wrong type
      42,
      // @ts-expect-error - intentionally wrong type
      undefined,
    ]);
    expect(decision.recognizedFlags).toEqual(['layout_overflow_title']);
  });
});

describe('layoutAuditFlagPriority — drift guards', () => {
  it('HIGH_PRIORITY_FLAGS is a strict subset of KNOWN_FLAGS', () => {
    for (const flag of HIGH_PRIORITY_FLAGS) {
      expect(KNOWN_FLAGS.has(flag)).toBe(true);
    }
  });

  it('KNOWN_FLAGS exactly matches the LayoutAuditFlag canonical set', () => {
    // If the audit ships a new flag, this list must be updated AND
    // the renderer markers (PPTX + PDF) must classify it. The test
    // hardcodes the canonical set so a forgotten update fails CI
    // before merging.
    const expected = new Set([
      'layout_overflow_title',
      'layout_overflow_key_message',
      'layout_overflow_blocks',
      'missing_source_for_evidence_intent',
      'unsupported_intent_for_pptx_export',
      'unsupported_intent_for_pdf_export',
    ]);
    expect(KNOWN_FLAGS.size).toBe(expected.size);
    for (const flag of expected) {
      expect(KNOWN_FLAGS.has(flag)).toBe(true);
    }
  });

  it('test-only helpers expose the SAME sets as the public exports', () => {
    expect(_highPriorityFlagsForTests()).toBe(HIGH_PRIORITY_FLAGS);
    expect(_knownFlagsForTests()).toBe(KNOWN_FLAGS);
  });
});
