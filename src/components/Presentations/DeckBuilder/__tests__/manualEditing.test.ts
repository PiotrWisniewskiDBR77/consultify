import { describe, expect, it } from 'vitest';

import { resolveBlankCardInsertionIndex } from '../manualEditing';

describe('manual PowerPoint editing helpers', () => {
  it('appends when React passes a click event to New slide', () => {
    expect(resolveBlankCardInsertionIndex({ type: 'click' }, 8)).toBe(8);
  });

  it('keeps numeric gap insertion and clamps it to the deck', () => {
    expect(resolveBlankCardInsertionIndex(3, 8)).toBe(3);
    expect(resolveBlankCardInsertionIndex(-5, 8)).toBe(0);
    expect(resolveBlankCardInsertionIndex(99, 8)).toBe(8);
  });
});
