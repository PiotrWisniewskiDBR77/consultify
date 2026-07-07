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

  // ── naprawa-c4 (DEFEKT #1 · Layer 3): the deterministic fallback must NOT emit
  // instruction/structure GARBAGE. On the long DBR77 prompt the old splitter
  // produced "centrum teza", "6 filarów (Kapitał", "DACH)", "każdy z celami",
  // "ryzykami", "Do pracy jako mapa myśli". The clean fallback keeps ONLY the real
  // pillars (from the parenthetical enumeration) — better 6 clean than 8 with junk.
  describe('c4: clean skeleton fallback (no instruction junk)', () => {
    const DBR77 =
      'Stwórz mapę myśli DBR77: centrum teza, 6 filarów (Kapitał, Talent, Produkt i Moat, Delivery, Popyt, DACH), każdy z 2-3 pod-węzłami (cel + ryzyko). Do pracy jako mapa myśli.';

    it('extracts the 6 clean pillars from the parenthetical list (Moat preserved)', () => {
      const g = buildMindmapSkeleton(DBR77);
      const branches = g.nodes.filter((n) => n.type === 'branch').map((n) => n.data.label);
      expect(branches).toEqual(['Kapitał', 'Talent', 'Produkt i Moat', 'Delivery', 'Popyt', 'DACH']);
    });

    it('drops instruction/structure fragments as branches', () => {
      const g = buildMindmapSkeleton(DBR77);
      const branches = g.nodes.filter((n) => n.type === 'branch').map((n) => n.data.label);
      for (const junk of [
        'centrum teza',
        '6 filarów (Kapitał',
        'DACH)',
        'każdy z celami',
        'ryzykami',
        'Do pracy jako mapa myśli',
        'cel',
        'ryzyko',
      ]) {
        expect(branches).not.toContain(junk);
      }
      // No branch carries a leaked instruction/structure keyword.
      for (const b of branches) {
        expect(b).not.toMatch(/filar|pod-?w[eę]z|centrum|ryzyk|\bcel\b|każd|jako map/i);
      }
    });

    it('still keeps a single lowercase topic word in a colon-list (not over-filtered)', () => {
      const g = buildMindmapSkeleton(
        'zrób mapę myśli o transformacji cyfrowej: ludzie, procesy, technologia'
      );
      const branches = g.nodes.filter((n) => n.type === 'branch').map((n) => n.data.label);
      expect(branches).toEqual(expect.arrayContaining(['ludzie', 'procesy', 'technologia']));
    });
  });
});
