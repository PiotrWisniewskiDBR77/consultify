import { afterEach, describe, expect, it, vi } from 'vitest';

import { Badge } from '../atomics/Badge.js';
import { Highlight } from '../atomics/Highlight.js';
import { KpiValue } from '../atomics/KpiValue.js';
import { SlideTitle } from '../atomics/SlideTitle.js';
import { getDesignTokens } from '../designTokens.js';

const tokens = getDesignTokens('corporate');
const position = { x: 0, y: 0, w: 2, h: 1 };

function renderOptions(enabled: boolean) {
  if (enabled) process.env.ENABLE_DECK_OVERFLOW_WARNING = 'true';
  else delete process.env.ENABLE_DECK_OVERFLOW_WARNING;
  const addText = vi.fn();
  const slide = { addText, addShape: vi.fn() };
  SlideTitle({ text: 'Bardzo długi tytuł kontrolny', position }, tokens).apply(slide);
  KpiValue({ value: 123456789, position }, tokens).apply(slide);
  Highlight({ text: 'Długa wartość', position }, tokens).apply(slide);
  Badge({ text: 'STATUS', position }, tokens).apply(slide);
  return addText.mock.calls.map((call) => call[1]);
}

describe('day230 shrink flag', () => {
  afterEach(() => delete process.env.ENABLE_DECK_OVERFLOW_WARNING);

  it('OFF zachowuje dzisiejsze fit shrink', () => {
    expect(renderOptions(false).every((options) => options.fit === 'shrink')).toBe(true);
  });

  it('ON nie ukrywa przepełnienia przez fit shrink', () => {
    expect(renderOptions(true).every((options) => !('fit' in options))).toBe(true);
  });
});
