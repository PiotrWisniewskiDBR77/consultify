import { describe, expect, it } from 'vitest';

import {
  appendAIHistoryEntry,
  applyNodeStyle,
  collectDescendantIds,
  copyNodeStyle,
  normalizeMindMapNodes,
  sanitizeTags,
} from '../../../src/components/MyWork/mindmap/mindMapNodeModel';

describe('mindMapNodeModel', () => {
  it('normalizes root label, tags, and artifact links', () => {
    const nodes = [
      {
        id: 'root',
        data: { label: '', tags: [' alpha ', 'alpha', 'beta'] },
      },
      {
        id: 'n-1',
        data: {
          label: 'Child',
          tags: [' hypothesis '],
          artifactLinks: [{ artifactRef: { type: 'initiative', id: '123' }, label: 'Init 123' }],
        },
      },
    ] as any;
    const edges = [{ source: 'root', target: 'n-1' }] as any;

    const normalized = normalizeMindMapNodes(nodes, edges, 'Strategic Bet', false);

    expect(normalized[0].type).toBe('center');
    expect(normalized[0].data.label).toBe('Strategic Bet');
    expect(normalized[1].type).toBe('idea');
    expect(normalized[1].data._depth).toBe(1);
    expect(normalized[1].data.tags).toEqual(['hypothesis']);
    expect(normalized[1].data.artifactLinks).toHaveLength(1);
  });

  it('collects descendant ids recursively', () => {
    const descendants = collectDescendantIds(
      'a',
      [
        { source: 'a', target: 'b' },
        { source: 'b', target: 'c' },
        { source: 'a', target: 'd' },
      ] as any
    );

    expect(descendants).toEqual(['b', 'c', 'd']);
  });

  it('copies and applies node style', () => {
    const source = {
      id: 'n-1',
      data: { shape: 'diamond', branchKey: 'evidence', priority: 90, label: 'Source' },
    } as any;
    const target = {
      id: 'n-2',
      data: { shape: 'default', branchKey: 'options', priority: 10, label: 'Target' },
    } as any;

    const style = copyNodeStyle(source);
    const styled = applyNodeStyle(target, style);

    expect(styled.data.shape).toBe('diamond');
    expect(styled.data.branchKey).toBe('evidence');
    expect(styled.data.priority).toBe(90);
    expect(styled.data.label).toBe('Target');
  });

  it('copies and applies extended style fields (color, fontSize, semanticType, etc.)', () => {
    const source = {
      id: 'n-ext',
      data: {
        label: 'Extended',
        shape: 'default',
        branchKey: 'risks',
        priority: 50,
        color: '#ef4444',
        fillOpacity: 80,
        lineStyle: 'dashed',
        fontSize: 18,
        bold: true,
        semanticType: 'risk',
        locked: true,
        branchTheme: 'orthogonal',
      },
    } as any;
    const target = {
      id: 'n-plain',
      data: { label: 'Plain', shape: 'default' },
    } as any;

    const style = copyNodeStyle(source);
    expect(style.color).toBe('#ef4444');
    expect(style.fillOpacity).toBe(80);
    expect(style.lineStyle).toBe('dashed');
    expect(style.fontSize).toBe(18);
    expect(style.bold).toBe(true);
    expect(style.semanticType).toBe('risk');
    expect(style.locked).toBe(true);
    expect(style.branchTheme).toBe('orthogonal');

    const styled = applyNodeStyle(target, style);
    expect(styled.data.color).toBe('#ef4444');
    expect(styled.data.fillOpacity).toBe(80);
    expect(styled.data.lineStyle).toBe('dashed');
    expect(styled.data.fontSize).toBe(18);
    expect(styled.data.bold).toBe(true);
    expect(styled.data.semanticType).toBe('risk');
    expect(styled.data.locked).toBe(true);
    expect(styled.data.branchTheme).toBe('orthogonal');
    expect(styled.data.label).toBe('Plain');
  });

  it('copyNodeStyle returns empty for missing extended fields', () => {
    const node = { id: 'n-min', data: { label: 'Minimal' } } as any;
    const style = copyNodeStyle(node);
    expect(style.color).toBeUndefined();
    expect(style.fontSize).toBeUndefined();
    expect(style.bold).toBeUndefined();
    expect(style.semanticType).toBeUndefined();
  });

  it('sanitizes tags and caps ai history length', () => {
    expect(sanitizeTags(['  a ', '', 'b', 'a'])).toEqual(['a', 'b']);

    const history = Array.from({ length: 12 }, (_, idx) => ({
      timestamp: `2026-03-10T00:00:${String(idx).padStart(2, '0')}Z`,
      prompt: `Prompt ${idx}`,
      resultSummary: `Summary ${idx}`,
    }));
    const next = appendAIHistoryEntry(history, {
      timestamp: '2026-03-10T00:01:00Z',
      prompt: 'New prompt',
      resultSummary: 'New summary',
    });

    expect(next).toHaveLength(12);
    expect(next.at(-1)?.resultSummary).toBe('New summary');
    expect(next[0].resultSummary).toBe('Summary 1');
  });
});
