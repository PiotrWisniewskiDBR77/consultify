/**
 * CB-05/RB-045 — node type label vocabulary + generic fallback.
 */
import { describe, expect, it } from 'vitest';

import { getCanvasNodeTypeLabel } from '../canvasNodeTypeVocabulary';

describe('getCanvasNodeTypeLabel', () => {
  it('maps a known type to its PL label', () => {
    expect(getCanvasNodeTypeLabel('shape_rectangle', true)).toBe('Kształt: prostokąt');
  });

  it('maps a known type to its EN label', () => {
    expect(getCanvasNodeTypeLabel('shape_rectangle', false)).toBe('Shape: rectangle');
  });

  it('falls back to a localized generic label for an unknown type (never the literal word "Node")', () => {
    expect(getCanvasNodeTypeLabel('some_unmapped_future_type', true)).toBe('Element');
    expect(getCanvasNodeTypeLabel('some_unmapped_future_type', false)).toBe('Element');
  });

  it('falls back to the localized generic label when type is undefined', () => {
    expect(getCanvasNodeTypeLabel(undefined, true)).toBe('Element');
    expect(getCanvasNodeTypeLabel(undefined, false)).toBe('Element');
  });
});
