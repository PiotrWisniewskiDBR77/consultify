import { describe, expect, it } from 'vitest';

import { ideaMapToMarkdown } from '../../../src/components/MyWork/ideaMapToMarkdown';

const node = (id: string, label: string) => ({ id, data: { label } });
const edge = (source: string, target: string) => ({ source, target });

describe('ideaMapToMarkdown', () => {
  it('renders an empty map gracefully', () => {
    const md = ideaMapToMarkdown({ nodes: [], edges: [] }, { title: 'Pusta', isPolish: true });
    expect(md).toContain('## Pusta');
    expect(md).toContain('(mapa jest pusta)');
  });

  it('handles missing nodes/edges (null/undefined)', () => {
    const md = ideaMapToMarkdown({}, { title: 'X' });
    expect(md).toContain('## X');
    expect(md).toContain('pusta');
  });

  it('serializes a linear chain as a nested outline', () => {
    const md = ideaMapToMarkdown(
      {
        nodes: [node('a', 'Root'), node('b', 'Child'), node('c', 'Grandchild')],
        edges: [edge('a', 'b'), edge('b', 'c')],
      },
      { title: 'Łańcuch', isPolish: true }
    );
    const lines = md.split('\n');
    expect(lines[0]).toBe('## Łańcuch');
    expect(md).toContain('- Root');
    expect(md).toContain('  - Child');
    expect(md).toContain('    - Grandchild');
    // No "Other" section — everything is reachable from the root.
    expect(md).not.toContain('Pozostałe');
  });

  it('serializes a branching tree with multiple children', () => {
    const md = ideaMapToMarkdown(
      {
        nodes: [
          node('root', 'Strategia'),
          node('b1', 'Branch A'),
          node('b2', 'Branch B'),
          node('leaf', 'Leaf under A'),
        ],
        edges: [edge('root', 'b1'), edge('root', 'b2'), edge('b1', 'leaf')],
      },
      { title: 'Drzewo', isPolish: true }
    );
    expect(md).toContain('- Strategia');
    expect(md).toContain('  - Branch A');
    expect(md).toContain('  - Branch B');
    expect(md).toContain('    - Leaf under A');
  });

  it('treats a disconnected node with no incoming edge as a root', () => {
    const md = ideaMapToMarkdown(
      {
        nodes: [node('a', 'Root'), node('b', 'Child'), node('orphan', 'Lonely note')],
        edges: [edge('a', 'b')],
      },
      { title: 'Z sierotą', isPolish: false }
    );
    expect(md).toContain('- Root');
    expect(md).toContain('  - Child');
    // 'orphan' has no incoming edge → it is a valid top-level root, not "Other".
    expect(md).toContain('- Lonely note');
    expect(md).not.toContain('### Other');
  });

  it('appends unreachable cycle members under an Other section', () => {
    // c <-> d form a cycle with no entry point from the rooted tree.
    const md = ideaMapToMarkdown(
      {
        nodes: [node('a', 'Root'), node('b', 'Child'), node('c', 'Cycle C'), node('d', 'Cycle D')],
        edges: [edge('a', 'b'), edge('c', 'd'), edge('d', 'c')],
      },
      { title: 'Z cyklem', isPolish: false }
    );
    expect(md).toContain('- Root');
    expect(md).toContain('  - Child');
    expect(md).toContain('### Other');
    expect(md).toContain('- Cycle C');
    expect(md).toContain('- Cycle D');
  });

  it('does not infinitely recurse on cycles', () => {
    const md = ideaMapToMarkdown(
      {
        nodes: [node('a', 'A'), node('b', 'B')],
        edges: [edge('a', 'b'), edge('b', 'a')],
      },
      { title: 'Cykl' }
    );
    // 'a' has no incoming? Both have incoming → pure cycle, no root.
    // Both surface (as orphans) without hanging.
    expect(md).toContain('A');
    expect(md).toContain('B');
  });

  it('falls back to id/text when label is missing', () => {
    const md = ideaMapToMarkdown(
      {
        nodes: [{ id: 'n1', data: { text: 'From text' } }, { id: 'n2' }],
        edges: [],
      },
      { isPolish: false }
    );
    expect(md).toContain('- From text');
    expect(md).toContain('- n2');
  });

  it('caps output at the configured byte budget', () => {
    const nodes = Array.from({ length: 500 }, (_, i) =>
      node(`n${i}`, `Bardzo długa etykieta numer ${i} z dodatkowym tekstem`)
    );
    const md = ideaMapToMarkdown({ nodes, edges: [] }, { title: 'Duża', maxBytes: 1024 });
    expect(new TextEncoder().encode(md).length).toBeLessThanOrEqual(1024);
    expect(md).toContain('skrócono');
  });
});
