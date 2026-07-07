/**
 * naprawa-c1Graph — canvasGraphLlm LLM-backed graph generators + anti-fragment
 * validation. The real `llmService` is mocked so tests are deterministic and
 * offline. Covers, per tool:
 *   (1) a clean LLM object → a valid graph in the FE-facing shape,
 *   (2) anti-fragment validation rejects prompt-fragment labels (→ null fallback),
 *   (3) an LLM failure (throw / null) → null (caller falls back to skeleton).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { callMock } = vi.hoisted(() => ({ callMock: vi.fn() }));

vi.mock('../../../server/src/services/ai/llmService.js', () => ({
  llmService: { call: (...args: unknown[]) => callMock(...args) },
  default: { call: (...args: unknown[]) => callMock(...args) },
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  generateMindmapGraph,
  generateProcessFlowGraph,
  generateWhiteboardGraph,
  generateTableGraph,
  generateNoteContent,
  isFragmentLabel,
} from '../../../server/src/services/ai/canvasGraphLlm.js';

/** Make the mocked llmService.call return a structured `object`. */
function mockObject(obj: unknown) {
  callMock.mockResolvedValueOnce({ object: obj, usage: {} });
}
/** Make the mocked llmService.call return text `content`. */
function mockText(content: string) {
  callMock.mockResolvedValueOnce({ content, usage: {} });
}

beforeEach(() => {
  callMock.mockReset();
});

// ── isFragmentLabel unit ─────────────────────────────────────────────────────
describe('isFragmentLabel', () => {
  it('accepts clean semantic labels', () => {
    expect(isFragmentLabel('Ludzie i kompetencje')).toBe(false);
    expect(isFragmentLabel('Verify data')).toBe(false);
    expect(isFragmentLabel('DACH')).toBe(false);
  });

  it('rejects lowercase-start fragments', () => {
    expect(isFragmentLabel('ryzykami')).toBe(true);
    expect(isFragmentLabel('każdy z celami i ryzykami')).toBe(true);
  });

  it('rejects continuation-particle prefixes', () => {
    expect(isFragmentLabel('z celami i ryzykami')).toBe(true);
    expect(isFragmentLabel('aż do końca')).toBe(true);
    expect(isFragmentLabel('with goals and risks')).toBe(true);
  });

  it('rejects verbatim multi-word slices of the seed text', () => {
    const seed = 'diagram procesu obsługi klienta z punktami decyzyjnymi i pętlami zwrotnymi';
    expect(isFragmentLabel('Punktami decyzyjnymi i pętlami', seed)).toBe(true);
  });

  it('rejects labels that echo an instruction verb', () => {
    expect(isFragmentLabel('Diagram procesu z punktami decyzyjnymi')).toBe(false); // no verb
    expect(isFragmentLabel('Zrób diagram procesu')).toBe(true); // echoes "zrób"
  });

  it('allows a legitimately-reused topic phrase as the thesis/pillar', () => {
    const seed = 'transformacja cyfrowa: ludzie, procesy, technologia';
    expect(isFragmentLabel('Transformacja cyfrowa', seed)).toBe(false);
    expect(isFragmentLabel('Ludzie', seed)).toBe(false);
  });

  it('rejects empty / too-short labels', () => {
    expect(isFragmentLabel('')).toBe(true);
    expect(isFragmentLabel('x')).toBe(true);
  });
});

// ── MIND MAP ─────────────────────────────────────────────────────────────────
describe('generateMindmapGraph', () => {
  it('builds a 2-level hierarchy (center → pillars → sub-nodes) from a clean object', async () => {
    mockObject({
      center: 'Transformacja cyfrowa',
      branches: [
        { label: 'Ludzie', children: ['Cel: kompetencje', 'Ryzyko: opór'] },
        { label: 'Procesy', children: ['Cel: automatyzacja'] },
        { label: 'Technologia', children: [] },
      ],
    });

    const graph = await generateMindmapGraph('transformacja cyfrowa: ludzie, procesy, technologia', 'DT', true);
    expect(graph).toBeTruthy();
    const center = graph!.nodes.find((n) => n.type === 'center');
    expect(center?.data.label).toBe('Transformacja cyfrowa');

    const pillars = graph!.nodes.filter((n) => n.id.match(/^branch-\d+$/));
    expect(pillars).toHaveLength(3);

    // Sub-nodes carry parentId and edges from pillar → child.
    const subNodes = graph!.nodes.filter((n) => n.parentId);
    expect(subNodes.length).toBe(3);
    for (const sub of subNodes) {
      expect(graph!.edges.some((e) => e.source === sub.parentId && e.target === sub.id)).toBe(true);
    }
    // center → each pillar edge exists
    for (const p of pillars) {
      expect(graph!.edges.some((e) => e.source === 'center' && e.target === p.id)).toBe(true);
    }
  });

  it('rejects (null) when the center is a prompt fragment', async () => {
    mockObject({ center: 'z celami i ryzykami', branches: [{ label: 'A' }, { label: 'B' }] });
    const graph = await generateMindmapGraph('coś', undefined, true);
    expect(graph).toBeNull();
  });

  it('rejects (null) when a majority of pillars are fragments', async () => {
    mockObject({
      center: 'Temat',
      branches: [{ label: 'ryzykami' }, { label: 'z celami' }, { label: 'Ludzie' }],
    });
    const graph = await generateMindmapGraph('coś', undefined, true);
    expect(graph).toBeNull();
  });

  it('returns null when the LLM throws (skeleton fallback)', async () => {
    callMock.mockRejectedValueOnce(new Error('provider down'));
    const graph = await generateMindmapGraph('temat', undefined, true);
    expect(graph).toBeNull();
  });
});

// ── PROCESS FLOW ─────────────────────────────────────────────────────────────
describe('generateProcessFlowGraph', () => {
  it('builds flowNodes with data.shape (incl. decision) + labeled edges', async () => {
    mockObject({
      steps: [
        { label: 'Start', shape: 'start' },
        { label: 'Zweryfikuj dane', shape: 'action' },
        { label: 'Dane poprawne?', shape: 'decision' },
        { label: 'Zapisz rekord', shape: 'action' },
        { label: 'Koniec', shape: 'end' },
      ],
      edges: [
        { from: 0, to: 1 },
        { from: 1, to: 2 },
        { from: 2, to: 3, label: 'tak' },
        { from: 2, to: 1, label: 'nie' },
        { from: 3, to: 4 },
      ],
    });

    const graph = await generateProcessFlowGraph('proces walidacji danych', 'Walidacja', true);
    expect(graph).toBeTruthy();
    // Every node is a flowNode carrying a shape; a decision diamond exists.
    expect(graph!.nodes.every((n) => n.type === 'flowNode')).toBe(true);
    expect(graph!.nodes.some((n) => n.data.shape === 'decision')).toBe(true);
    expect(graph!.nodes.some((n) => n.data.shape === 'start')).toBe(true);
    expect(graph!.nodes.some((n) => n.data.shape === 'end')).toBe(true);
    // yes/no branch labels + a loop-back edge (2→1) survive.
    expect(graph!.edges.some((e) => e.label === 'tak')).toBe(true);
    expect(graph!.edges.some((e) => e.label === 'nie')).toBe(true);
    expect(graph!.edges.every((e) => e.type === 'flowEdge')).toBe(true);
  });

  it('falls back to a linear chain when model edges are missing/invalid', async () => {
    mockObject({
      steps: [
        { label: 'Start', shape: 'start' },
        { label: 'Przetwórz zgłoszenie', shape: 'action' },
        { label: 'Koniec', shape: 'end' },
      ],
      edges: [{ from: 9, to: 12 }], // out of range → dropped → linear fallback
    });
    const graph = await generateProcessFlowGraph('proces', undefined, true);
    expect(graph).toBeTruthy();
    expect(graph!.edges).toHaveLength(2); // start→step→end
  });

  it('returns null on LLM failure', async () => {
    callMock.mockResolvedValueOnce(null);
    expect(await generateProcessFlowGraph('x', undefined, true)).toBeNull();
  });
});

// ── WHITEBOARD ───────────────────────────────────────────────────────────────
describe('generateWhiteboardGraph', () => {
  it('builds stickyNote nodes (not "sticky") + labeled edges between blocks', async () => {
    mockObject({
      blocks: ['Cel projektu', 'Ryzyka', 'Zasoby', 'Kamienie milowe'],
      links: [
        { from: 0, to: 1 },
        { from: 0, to: 2 },
      ],
    });
    const graph = await generateWhiteboardGraph('tablica projektu', 'Projekt', true);
    expect(graph).toBeTruthy();
    // Correct RF node type is 'stickyNote' (registry key) — NOT 'sticky'.
    expect(graph!.nodes.every((n) => n.type === 'stickyNote')).toBe(true);
    expect(graph!.nodes.length).toBe(4);
    // Edges are non-zero and typed 'labeled'.
    expect(graph!.edges.length).toBe(2);
    expect(graph!.edges.every((e) => e.type === 'labeled')).toBe(true);
  });

  it('rejects (null) when a majority of blocks are fragments', async () => {
    mockObject({ blocks: ['z celami', 'ryzykami', 'Zasoby'], links: [] });
    expect(await generateWhiteboardGraph('x', undefined, true)).toBeNull();
  });
});

// ── IDEAS TABLE ──────────────────────────────────────────────────────────────
describe('generateTableGraph', () => {
  it('builds populated row nodes (label/status/priority) with no edges', async () => {
    mockObject({
      rows: [
        { label: 'Przygotować brief', status: 'todo', priority: 'High' },
        { label: 'Zebrać dane', status: 'in_progress', priority: 'Medium', notes: 'z 3 źródeł' },
      ],
    });
    const graph = await generateTableGraph('lista zadań projektu', 'Zadania', true);
    expect(graph).toBeTruthy();
    expect(graph!.edges).toEqual([]);
    expect(graph!.nodes.length).toBe(2);
    for (const n of graph!.nodes) {
      expect(n.type).toBe('idea');
      expect(typeof n.data.label).toBe('string');
      expect(n.data.label.length).toBeGreaterThan(0);
      expect(['todo', 'in_progress', 'done', 'blocked']).toContain(n.data.status);
    }
  });

  it('returns null on LLM failure', async () => {
    callMock.mockRejectedValueOnce(new Error('down'));
    expect(await generateTableGraph('x', undefined, true)).toBeNull();
  });
});

// ── NOTE prose ───────────────────────────────────────────────────────────────
describe('generateNoteContent', () => {
  it('returns generated markdown prose', async () => {
    mockText('## Teza\nKrótka teza.\n\n## Sekcja\n- punkt jeden\n- punkt dwa');
    const content = await generateNoteContent('notatka o strategii', 'Strategia', true);
    expect(content).toContain('## Teza');
    expect(content!.length).toBeGreaterThan(40);
  });

  it('returns null on a too-short body (fall back to intent)', async () => {
    mockText('ok');
    expect(await generateNoteContent('x', undefined, true)).toBeNull();
  });

  it('returns null on LLM failure', async () => {
    callMock.mockRejectedValueOnce(new Error('down'));
    expect(await generateNoteContent('x', undefined, true)).toBeNull();
  });
});
