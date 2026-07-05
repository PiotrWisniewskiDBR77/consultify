/**
 * A2 — accept-side application of whiteboard AI proposal patches.
 *
 * Fixtures mirror the backend formatter contract
 * (tests/unit/backend/services/ideaAIGeneratorService.whiteboardFormatters.test.ts):
 * whiteboard patches only carry addNodes / addEdges / extensions / moveNodes
 * (+ updateNodes for wb_name_clusters). These helpers are what IdeaWhiteboardTool
 * runs when a proposal is ACCEPTED in IdeaProposalReview.
 */
import { describe, expect, it } from 'vitest';

import {
  applyProposalNodeMoves,
  applyProposalNodeUpdates,
  isWbNodeKind,
  resolveProposalEdges,
  toWbNodeKind,
} from '@/components/MyWork/whiteboard/whiteboardProposalPatch';

describe('toWbNodeKind — proposal node type normalization', () => {
  it('maps backend runtime types to whiteboard kinds', () => {
    expect(toWbNodeKind('stickyNote')).toBe('sticky'); // wb_extract_actions / sticky_summarize
    expect(toWbNodeKind('frameNode')).toBe('frame'); // wb_find_themes theme frames
    expect(toWbNodeKind('textBlock')).toBe('text');
    expect(toWbNodeKind('summaryCard')).toBe('summary');
  });

  it('maps cross-tool node types to sticky previews (wb_to_map_branches / wb_to_table)', () => {
    expect(toWbNodeKind('branch')).toBe('sticky');
    expect(toWbNodeKind('leaf')).toBe('sticky');
    expect(toWbNodeKind('idea')).toBe('sticky');
  });

  it('passes native kinds through and falls back to sticky for unknowns', () => {
    expect(toWbNodeKind('frame')).toBe('frame');
    expect(toWbNodeKind('text')).toBe('text');
    expect(toWbNodeKind('definitely-not-a-kind')).toBe('sticky');
    expect(toWbNodeKind(undefined)).toBe('sticky');
  });

  it('isWbNodeKind accepts only native whiteboard kinds', () => {
    expect(isWbNodeKind('sticky')).toBe(true);
    expect(isWbNodeKind('stickyNote')).toBe(false);
  });
});

describe('resolveProposalEdges — patch.addEdges application (wb_to_map_branches)', () => {
  // Shape from the wb_to_map_branches formatter: root/branch/leaf ids + edges between them
  const patchEdges = [
    { id: 'e-root-br1', source: 'root-1', target: 'br-1' },
    { id: 'e-br1-leaf1', source: 'br-1', target: 'leaf-1', label: 'child' },
  ];

  it('remaps proposal ids to freshly created canvas ids so topology survives', () => {
    const idMap = new Map([
      ['root-1', 'wb-100'],
      ['br-1', 'wb-101'],
      ['leaf-1', 'wb-102'],
    ]);

    const resolved = resolveProposalEdges(patchEdges, idMap, new Set(), 42);

    expect(resolved).toHaveLength(2);
    expect(resolved[0]).toMatchObject({ source: 'wb-100', target: 'wb-101' });
    expect(resolved[1]).toMatchObject({ source: 'wb-101', target: 'wb-102', label: 'child' });
    // fresh, deterministic edge ids — never reuse proposal ids that may collide
    expect(resolved.map((e) => e.id)).toEqual(['wb-edge-42-0', 'wb-edge-42-1']);
  });

  it('accepts endpoints that already exist on the canvas', () => {
    const resolved = resolveProposalEdges(
      [{ source: 'sticky-existing', target: 'br-1' }],
      new Map([['br-1', 'wb-200']]),
      new Set(['sticky-existing']),
      7
    );
    expect(resolved).toEqual([
      { id: 'wb-edge-7-0', source: 'sticky-existing', target: 'wb-200' },
    ]);
  });

  it('drops edges whose endpoints cannot be resolved', () => {
    const resolved = resolveProposalEdges(
      [{ source: 'ghost-a', target: 'ghost-b' }],
      new Map(),
      new Set(),
      7
    );
    expect(resolved).toEqual([]);
  });
});

describe('applyProposalNodeUpdates — wb_name_clusters', () => {
  it('merges proposal data into matching nodes and leaves the rest untouched', () => {
    const nodes = [
      { id: 'frame-1', data: { label: 'Cluster', bgColor: '#eee' } },
      { id: 'sticky-1', data: { label: 'Note' } },
    ];
    // Shape from the wb_name_clusters formatter: updateNodes[{id, data:{label, _nameRationale}}]
    const next = applyProposalNodeUpdates(nodes, [
      { id: 'frame-1', data: { label: 'Pricing themes', _nameRationale: 'shared topic' } },
    ]);

    expect(next[0].data).toEqual({
      label: 'Pricing themes',
      bgColor: '#eee',
      _nameRationale: 'shared topic',
    });
    expect(next[1]).toBe(nodes[1]);
  });
});

describe('applyProposalNodeMoves — whiteboard_organize', () => {
  it('repositions matched nodes and skips moves without a position', () => {
    const nodes = [
      { id: 'sticky-1', position: { x: 0, y: 0 } },
      { id: 'sticky-2', position: { x: 10, y: 10 } },
    ];
    const next = applyProposalNodeMoves(nodes, [
      { nodeId: 'sticky-1', position: { x: 120, y: 180 } },
      { nodeId: 'sticky-2' }, // no position → ignored
      { nodeId: 'ghost', position: { x: 1, y: 1 } }, // unknown node → ignored
    ]);

    expect(next[0].position).toEqual({ x: 120, y: 180 });
    expect(next[1]).toBe(nodes[1]);
  });
});
