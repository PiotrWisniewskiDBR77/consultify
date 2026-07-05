/**
 * Parity test: the server-side duplicate of ideaMapToMarkdown
 * (server/src/services/ai/mindmapSerialize.ts) must produce byte-for-byte
 * identical output to the canonical front-end serializer
 * (src/components/MyWork/ideaMapToMarkdown.ts).
 *
 * This is the drift guard for the deliberate duplication (M06 Fala 2 §0.3):
 * if either implementation changes, this test fails loudly.
 */
import { describe, expect, it } from 'vitest';

import { ideaMapToMarkdown as feSerialize } from '@/components/MyWork/ideaMapToMarkdown';
import { ideaMapToMarkdown as serverSerialize } from '../../../server/src/services/ai/mindmapSerialize.js';

const graphs: Array<{
  name: string;
  input: { nodes?: any[]; edges?: any[] };
  options?: Record<string, unknown>;
}> = [
  {
    name: 'simple tree (roots + children)',
    input: {
      nodes: [
        { id: 'r', data: { label: 'Root' } },
        { id: 'a', data: { label: 'Child A' } },
        { id: 'b', data: { label: 'Child B' } },
        { id: 'a1', data: { label: 'Grandchild A1' } },
      ],
      edges: [
        { source: 'r', target: 'a' },
        { source: 'r', target: 'b' },
        { source: 'a', target: 'a1' },
      ],
    },
    options: { title: 'Transformacja Apator', isPolish: true },
  },
  {
    name: 'graph with a cycle + orphans (EN labels)',
    input: {
      nodes: [
        { id: '1', label: 'One' },
        { id: '2', label: 'Two' },
        { id: '3', label: 'Three' },
        { id: 'orphan', text: 'Lonely node' },
        { data: { label: 'No id node' } },
      ],
      edges: [
        { sourceId: '1', targetId: '2' },
        { sourceId: '2', targetId: '3' },
        { sourceId: '3', targetId: '1' }, // cycle back to a root
      ],
    },
    options: { isPolish: false },
  },
  {
    name: 'large graph forcing byte-cap truncation',
    input: {
      nodes: Array.from({ length: 400 }, (_, i) => ({
        id: `n${i}`,
        data: { label: `Węzeł numer ${i} z dłuższą etykietą testową` },
      })),
      edges: Array.from({ length: 399 }, (_, i) => ({
        source: `n${i}`,
        target: `n${i + 1}`,
      })),
    },
    options: { title: 'Duża mapa', maxBytes: 1024 },
  },
];

describe('mindmapSerialize parity (server ↔ front-end)', () => {
  for (const g of graphs) {
    it(`identical output — ${g.name}`, () => {
      const fe = feSerialize(g.input, g.options as any);
      const srv = serverSerialize(g.input, g.options as any);
      expect(srv).toBe(fe);
    });
  }

  it('identical output — empty map', () => {
    expect(serverSerialize({ nodes: [], edges: [] })).toBe(feSerialize({ nodes: [], edges: [] }));
  });
});
