import { describe, expect, it } from 'vitest';

import { detectMentionTrigger } from '@/components/MyWork/notebook/NotebookMentionMenu';

/**
 * Unit tests for the "@" mention trigger detection (K1). Pure logic over a
 * minimal editor mock — mirrors the SlashMenu detectSlashTrigger test shape.
 */
function mockEditor(textBefore: string) {
  const parentOffset = textBefore.length;
  const pos = parentOffset + 1; // arbitrary absolute pos (>= parentOffset)
  return {
    state: {
      selection: {
        $from: {
          pos,
          parentOffset,
          parent: { textContent: textBefore },
        },
      },
    },
    view: {
      coordsAtPos: () => ({ top: 10, bottom: 22, left: 40, right: 44 }),
    },
  } as any;
}

describe('detectMentionTrigger', () => {
  it('opens with an empty query for a bare "@" at block start', () => {
    const res = detectMentionTrigger(mockEditor('@'));
    expect(res?.open).toBe(true);
    expect(res?.query).toBe('');
  });

  it('captures a single-word query', () => {
    const res = detectMentionTrigger(mockEditor('see @init'));
    expect(res?.open).toBe(true);
    expect(res?.query).toBe('init');
  });

  it('captures a multi-word query (titles with spaces)', () => {
    const res = detectMentionTrigger(mockEditor('link @market expansion'));
    expect(res?.query).toBe('market expansion');
  });

  it('captures Polish characters in the query', () => {
    const res = detectMentionTrigger(mockEditor('zobacz @inicjatywa cyfrowa'));
    expect(res?.query).toBe('inicjatywa cyfrowa');
  });

  it('does NOT trigger on an email-style "@" (no leading whitespace)', () => {
    expect(detectMentionTrigger(mockEditor('user@domain'))).toBeNull();
  });

  it('does NOT trigger when there is no "@" before the cursor', () => {
    expect(detectMentionTrigger(mockEditor('just some text'))).toBeNull();
  });

  it('reports the trigger position at the "@" itself', () => {
    // "ab @cd" → '@' is at index 3; pos = parentOffset(6)+1 = 7; from = 7 - 2 - 1 = 4
    const res = detectMentionTrigger(mockEditor('ab @cd'));
    expect(res?.triggerPos).toBe(4);
  });
});
