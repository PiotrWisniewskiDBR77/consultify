/**
 * Teresa "all 8 tools" rollout — canvasToolSkeletons builders.
 * Mirrors mindmapSkeleton.test.ts: deterministic, non-LLM {nodes,edges} graphs
 * derived from real chat intent text, in the shape the idea-workspace graph
 * validator (ideaWorkspaceGraph.validators.ts) accepts.
 */

import { describe, it, expect } from 'vitest';

import {
  buildProcessFlowSkeleton,
  buildIdeasTableSkeleton,
  buildWhiteboardSkeleton,
} from '../../../server/src/services/ai/canvasToolSkeletons.js';

describe('buildProcessFlowSkeleton', () => {
  it('builds Start -> steps -> End from a colon-list intent', () => {
    const graph = buildProcessFlowSkeleton(
      'Proces onboardingu: rejestracja, weryfikacja, aktywacja',
      'Onboarding',
      true
    );
    const types = graph.nodes.map((n) => n.type);
    expect(types[0]).toBe('start');
    expect(types[types.length - 1]).toBe('end');
    expect(types.filter((t) => t === 'step')).toHaveLength(3);

    // Linear chain: edges connect start -> step1 -> step2 -> step3 -> end
    expect(graph.edges.length).toBe(graph.nodes.length - 1);
    expect(graph.edges[0].source).toBe('start');
    expect(graph.edges[graph.edges.length - 1].target).toBe('end');
  });

  it('emits a valid Start->End flow when the intent has no parseable steps', () => {
    const graph = buildProcessFlowSkeleton('Nowy proces', undefined, true);
    expect(graph.nodes.some((n) => n.type === 'start')).toBe(true);
    expect(graph.nodes.some((n) => n.type === 'end')).toBe(true);
    expect(graph.edges.length).toBeGreaterThanOrEqual(1);
  });
});

describe('buildIdeasTableSkeleton', () => {
  it('builds row nodes from a comma-separated intent', () => {
    const graph = buildIdeasTableSkeleton(
      'Lista zadań: przygotować brief, zebrać dane, zrobić analizę',
      'Zadania',
      true
    );
    expect(graph.edges).toEqual([]);
    expect(graph.nodes.length).toBeGreaterThanOrEqual(3);
    for (const n of graph.nodes) {
      expect(n.type).toBe('row');
      expect(typeof n.data.label).toBe('string');
      expect(n.data.label.length).toBeGreaterThan(0);
    }
  });

  it('emits at least one seed row when the intent has no parseable list', () => {
    const graph = buildIdeasTableSkeleton('Pomysły na produkt', 'Tabela', true);
    expect(graph.nodes.length).toBeGreaterThanOrEqual(1);
    expect(graph.nodes[0].type).toBe('row');
  });
});

describe('buildWhiteboardSkeleton', () => {
  it('builds a center sticky + branch stickies, no forced edges', () => {
    const graph = buildWhiteboardSkeleton(
      'Burza mózgów: pomysł A, pomysł B, pomysł C',
      'Burza mózgów',
      true
    );
    expect(graph.nodes.every((n) => n.type === 'sticky')).toBe(true);
    expect(graph.nodes.length).toBeGreaterThanOrEqual(1);
    expect(graph.edges).toEqual([]);
  });

  it('emits a valid single-sticky board when the intent has no parseable list', () => {
    const graph = buildWhiteboardSkeleton('Sesja warsztatowa', undefined, true);
    expect(graph.nodes.length).toBeGreaterThanOrEqual(1);
    expect(graph.nodes[0].type).toBe('sticky');
  });
});
