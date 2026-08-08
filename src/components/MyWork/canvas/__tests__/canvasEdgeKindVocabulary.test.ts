/**
 * CB-05/RB-018 — Idea Table Edges view must show domain language, not raw
 * ReactFlow edge type/kind strings.
 */
import { describe, expect, it } from 'vitest';

import { getCanvasEdgeKindLabel } from '../canvasEdgeKindVocabulary';

describe('getCanvasEdgeKindLabel', () => {
  it('maps the default edge kind to domain language', () => {
    expect(getCanvasEdgeKindLabel('labeled', true)).toBe('Powiązanie');
    expect(getCanvasEdgeKindLabel('labeled', false)).toBe('Connection');
  });

  it('falls back to a localized generic label for an unmapped raw kind', () => {
    expect(getCanvasEdgeKindLabel('some_raw_reactflow_type', true)).toBe('Połączenie');
    expect(getCanvasEdgeKindLabel('some_raw_reactflow_type', false)).toBe('Connection');
  });
});
