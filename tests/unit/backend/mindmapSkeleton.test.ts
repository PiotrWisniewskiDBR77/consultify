/**
 * M06 Fala 2 · 2.3 — mindmapSkeleton builder (minimal-but-real graph).
 *
 * The chat→mindmap deliverable relies on a deterministic skeleton builder (no
 * LLM) so CI can prove the graph shape without a model. These tests lock the
 * parsing rules: colon-list → branches, newline/bullet list → branches, comma
 * list → branches, and a bare topic → root-only map.
 */

import { describe, it, expect } from 'vitest';
import { buildMindmapSkeleton } from '../../../server/src/services/ai/mindmapSkeleton.js';

describe('buildMindmapSkeleton', () => {
  it('parses a colon-delimited list into branch nodes fanned off the center', () => {
    const g = buildMindmapSkeleton(
      'zrób mapę myśli o transformacji cyfrowej: ludzie, procesy, technologia',
      'Transformacja cyfrowa'
    );
    const center = g.nodes.find((n) => n.type === 'center');
    expect(center?.data.label).toBe('Transformacja cyfrowa');

    const branches = g.nodes.filter((n) => n.type === 'branch').map((n) => n.data.label.toLowerCase());
    expect(branches).toEqual(expect.arrayContaining(['ludzie', 'procesy', 'technologia']));

    // one edge per branch, all rooted at center, ids unique
    expect(g.edges).toHaveLength(branches.length);
    expect(new Set(g.edges.map((e) => e.id)).size).toBe(g.edges.length);
    for (const e of g.edges) expect(e.source).toBe('center');
  });

  it('parses a newline / bullet list into branches', () => {
    const g = buildMindmapSkeleton('Backlog\n- Auth\n- Billing\n- Reporting');
    const branches = g.nodes.filter((n) => n.type === 'branch').map((n) => n.data.label);
    expect(branches).toEqual(expect.arrayContaining(['Auth', 'Billing', 'Reporting']));
  });

  it('parses a bare comma list into branches', () => {
    const g = buildMindmapSkeleton('Alpha, Beta, Gamma');
    const branches = g.nodes.filter((n) => n.type === 'branch');
    expect(branches.length).toBeGreaterThanOrEqual(2);
  });

  it('emits a valid root-only map when no structure is detectable', () => {
    const g = buildMindmapSkeleton('Pomysły na nowy produkt');
    expect(g.nodes).toHaveLength(1);
    expect(g.nodes[0].type).toBe('center');
    expect(g.edges).toHaveLength(0);
  });

  it('derives the root label from the topic when no title is given', () => {
    const g = buildMindmapSkeleton('make a mind map of onboarding: signup, activation');
    const center = g.nodes.find((n) => n.type === 'center');
    expect(center?.data.label.toLowerCase()).toContain('onboarding');
  });

  it('caps the number of branches (no unbounded graphs)', () => {
    const many = Array.from({ length: 20 }, (_, i) => `item${i}`).join(', ');
    const g = buildMindmapSkeleton(`Topic: ${many}`);
    const branches = g.nodes.filter((n) => n.type === 'branch');
    expect(branches.length).toBeLessThanOrEqual(8);
  });

  it('never returns a branch identical to the root label', () => {
    const g = buildMindmapSkeleton('Sprint: Sprint, Planning, Review', 'Sprint');
    const branches = g.nodes.filter((n) => n.type === 'branch').map((n) => n.data.label.toLowerCase());
    expect(branches).not.toContain('sprint');
  });
});
