/**
 * A4 — resolveConvertOutcomeType (whiteboardContracts).
 *
 * Drives the `idea-whiteboard-register-output` listener in IdeaWhiteboardTool:
 * after a successful /my-ideas/:id/convert, every linked node must resolve to an
 * outcomeRegistry type so the WhiteboardOutcomeRecord gets its exportedToType /
 * exportedToId ref. Pre-A4 the listener read raw `data.semanticType` only, so
 * generic nodes (plain sticky/text) were silently skipped.
 */
import { describe, expect, it } from 'vitest';

import { resolveConvertOutcomeType } from '@/components/MyWork/whiteboard/whiteboardContracts';

describe('resolveConvertOutcomeType (A4)', () => {
  it('keeps explicit outcome semantics regardless of target', () => {
    expect(
      resolveConvertOutcomeType({ type: 'textBlock', data: { semanticType: 'decision' } }, 'task_set')
    ).toBe('decision');
    expect(
      resolveConvertOutcomeType({ type: 'stickyNote', data: { semanticType: 'action' } }, 'decision')
    ).toBe('action');
    expect(
      resolveConvertOutcomeType({ type: 'frameNode', data: { semanticType: 'cluster' } }, 'report')
    ).toBe('cluster');
    expect(
      resolveConvertOutcomeType({ type: 'summaryCard', data: { semanticType: 'theme' } }, 'report')
    ).toBe('theme');
  });

  it('uses inferred semantics when they map to an outcome type (summaryCard → outcome)', () => {
    expect(resolveConvertOutcomeType({ type: 'summaryCard', data: {} }, 'report')).toBe('outcome');
  });

  it('falls back to the convert target for generic nodes (the A4 gap)', () => {
    // Plain sticky note — inferWhiteboardSemanticType returns 'note'
    expect(resolveConvertOutcomeType({ type: 'stickyNote', data: {} }, 'decision')).toBe(
      'decision'
    );
    expect(resolveConvertOutcomeType({ type: 'stickyNote', data: {} }, 'task_set')).toBe('action');
    expect(resolveConvertOutcomeType({ type: 'textBlock', data: {} }, 'initiative')).toBe(
      'outcome'
    );
  });

  it('returns null for generic nodes converted to non-outcome targets', () => {
    expect(resolveConvertOutcomeType({ type: 'stickyNote', data: {} }, 'report')).toBeNull();
    expect(resolveConvertOutcomeType({ type: 'stickyNote', data: {} }, 'presentation')).toBeNull();
    expect(resolveConvertOutcomeType({ type: 'stickyNote', data: {} }, '')).toBeNull();
  });

  it('ignores bogus explicit semanticType and still applies the target fallback', () => {
    expect(
      resolveConvertOutcomeType({ type: 'stickyNote', data: { semanticType: 'nonsense' } }, 'decision')
    ).toBe('decision');
  });
});
