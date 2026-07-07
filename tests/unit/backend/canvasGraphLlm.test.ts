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

  // ── naprawa-c3: the DBR77 "6 pillars × (cel+ryzyko)" prompt was falling back to
  // the skeleton. Root cause = (a) schema rejected the child SHAPES Claude emits
  // (objects / alt keys / goal-risk fields) → whole parse null; (b) the strict
  // pillar anti-fragment gate dropped legitimate lowercase "cel:"/"ryzyko:" sub-
  // nodes → flat star. These lock the fixes.
  const DBR77 =
    'Stwórz mapę myśli DBR77: centrum 3x revenue, 6 filarów (Kapitał, Talent, Produkt+Moat, Delivery, Popyt, DACH), 2-3 pod-węzły (cel+ryzyko) każdy';

  it('keeps lowercase "cel:"/"ryzyko:" sub-nodes (no flat star)', async () => {
    mockObject({
      center: '3x revenue w 30-36 miesięcy',
      branches: [
        { label: 'Kapitał', children: ['cel: runda A na skalowanie', 'ryzyko: rozwodnienie'] },
        { label: 'Talent', children: ['cel: 20 seniorów AI/ML', 'ryzyko: rotacja'] },
        { label: 'DACH', children: ['cel: 5 klientów', 'ryzyko: regulacje'] },
      ],
    });
    const graph = await generateMindmapGraph(DBR77, undefined, true);
    expect(graph).toBeTruthy();
    const subs = graph!.nodes.filter((n) => n.parentId);
    expect(subs.length).toBe(6); // all cel/ryzyko preserved, NOT dropped
    // Lead word tidied to Capitalized.
    expect(subs.every((s) => /^(Cel|Ryzyko):/.test(s.data.label))).toBe(true);
  });

  it('accepts child OBJECTS {label,kind} (schema no longer parse-fails → skeleton)', async () => {
    mockObject({
      center: 'Wzrost 3x',
      branches: [
        {
          label: 'Kapitał',
          children: [
            { label: 'runda A', kind: 'goal' },
            { label: 'rozwodnienie', kind: 'risk' },
          ],
        },
      ],
    });
    const graph = await generateMindmapGraph(DBR77, undefined, true);
    expect(graph).toBeTruthy();
    const subs = graph!.nodes.filter((n) => n.parentId).map((n) => n.data.label);
    expect(subs).toContain('Cel: runda A');
    expect(subs).toContain('Ryzyko: rozwodnienie');
  });

  it('folds alternate keys (subnodes / goal+risk) into children', async () => {
    mockObject({
      center: 'Wzrost 3x',
      branches: [
        { label: 'Kapitał', subnodes: ['Cel: runda A', 'Ryzyko: rozwodnienie'] },
        { label: 'Talent', goal: 'seniorzy AI', risk: 'rotacja' },
      ],
    });
    const graph = await generateMindmapGraph(DBR77, undefined, true);
    expect(graph).toBeTruthy();
    const subs = graph!.nodes.filter((n) => n.parentId).map((n) => n.data.label);
    expect(subs).toContain('Cel: runda A');
    expect(subs).toContain('Cel: seniorzy AI');
    expect(subs).toContain('Ryzyko: rotacja');
  });

  it('accepts an alternate center key ("thesis") + "pillars" array', async () => {
    mockObject({
      thesis: 'Wzrost 3x',
      pillars: [{ label: 'Kapitał', children: ['Cel: runda A'] }],
    });
    const graph = await generateMindmapGraph(DBR77, undefined, true);
    expect(graph).toBeTruthy();
    expect(graph!.nodes.find((n) => n.type === 'center')?.data.label).toBe('Wzrost 3x');
    expect(graph!.nodes.filter((n) => n.parentId).length).toBe(1);
  });

  // ── naprawa-c4 (DEFEKT #1): the LONG DBR77 prompt was STILL falling to skeleton
  // intermittently. Diagnosed remaining null paths: (a) center returned as an
  // OBJECT ({label|text:…}); (b) pillars returned as BARE STRINGS. Both failed the
  // rigid schema → whole parse null. Plus: no retry on transient failure.
  it('c4: coerces a center returned as an OBJECT ({label}) instead of null→skeleton', async () => {
    mockObject({
      center: { label: 'DBR77: 3x wzrost' },
      branches: [
        { label: 'Kapitał', children: ['Cel: runda A'] },
        { label: 'Talent', children: ['Cel: 40 inżynierów'] },
      ],
    });
    const graph = await generateMindmapGraph(DBR77, undefined, true);
    expect(graph).toBeTruthy();
    expect(graph!.nodes.find((n) => n.type === 'center')?.data.label).toBe('DBR77: 3x wzrost');
  });

  it('c4: coerces pillars returned as BARE STRINGS instead of null→skeleton', async () => {
    mockObject({
      center: 'DBR77: 3x wzrost',
      branches: ['Kapitał', 'Talent', 'Produkt i Moat', 'Delivery', 'Popyt', 'DACH'],
    });
    const graph = await generateMindmapGraph(DBR77, undefined, true);
    expect(graph).toBeTruthy();
    const pillars = graph!.nodes.filter((n) => n.id.match(/^branch-\d+$/)).map((n) => n.data.label);
    expect(pillars).toEqual(['Kapitał', 'Talent', 'Produkt i Moat', 'Delivery', 'Popyt', 'DACH']);
  });

  it('c4: RETRIES once on a transient throw, then succeeds (no skeleton fallback)', async () => {
    callMock.mockRejectedValueOnce(new Error('transient timeout'));
    callMock.mockResolvedValueOnce({
      object: {
        center: 'DBR77: 3x wzrost',
        branches: [
          { label: 'Kapitał', children: ['Cel: runda A'] },
          { label: 'Talent', children: ['Cel: 40 inż'] },
        ],
      },
    });
    const graph = await generateMindmapGraph(DBR77, undefined, true);
    expect(graph).toBeTruthy();
    expect(callMock).toHaveBeenCalledTimes(2);
    expect(graph!.nodes.find((n) => n.type === 'center')?.data.label).toBe('DBR77: 3x wzrost');
  });

  it('c4: RETRIES once on a soft null (empty object), then succeeds', async () => {
    callMock.mockResolvedValueOnce({ object: undefined });
    callMock.mockResolvedValueOnce({
      object: {
        center: 'Wzrost 3x',
        branches: [{ label: 'Kapitał', children: ['Cel: runda A'] }],
      },
    });
    const graph = await generateMindmapGraph(DBR77, undefined, true);
    expect(graph).toBeTruthy();
    expect(callMock).toHaveBeenCalledTimes(2);
  });

  it('c4: gives up after the retry ALSO fails (→ null so skeleton takes over)', async () => {
    callMock.mockRejectedValueOnce(new Error('down'));
    callMock.mockRejectedValueOnce(new Error('still down'));
    const graph = await generateMindmapGraph(DBR77, undefined, true);
    expect(graph).toBeNull();
    expect(callMock).toHaveBeenCalledTimes(2);
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
  it('groups stickies under frameNode containers + relation-labeled edges (data.label filled)', async () => {
    mockObject({
      groups: [
        { title: 'Propozycja wartości', blocks: ['PdM AI', 'OEE AI'] },
        { title: 'Segmenty', blocks: ['Producenci OEM', 'Integratorzy'] },
      ],
      links: [{ from: 'PdM AI', to: 'Producenci OEM', relation: 'dla' }],
    });
    const graph = await generateWhiteboardGraph('tablica wartości', 'VPC', true);
    expect(graph).toBeTruthy();

    // Container grouping: two frameNode containers + four child stickies.
    const frames = graph!.nodes.filter((n) => n.type === 'frameNode');
    const stickies = graph!.nodes.filter((n) => n.type === 'stickyNote');
    expect(frames.length).toBe(2);
    expect(stickies.length).toBe(4);
    // Every sticky is parented to a frame (grouped, not loose atoms).
    expect(stickies.every((s) => typeof s.parentId === 'string' && s.parentId!.length > 0)).toBe(
      true
    );

    // Relation edge carries a NON-EMPTY label in BOTH top-level + data.label
    // (FE LabeledEdge reads data.label — the empty-label visual bug we fixed).
    const labeled = graph!.edges.filter((e) => e.type === 'labeled');
    expect(labeled.length).toBe(1);
    const e = labeled[0]!;
    expect(e.label).toBe('dla');
    expect((e.data as { label?: string })?.label).toBe('dla');

    // naprawa-c4 (DEFEKT #3): connectivity guarantee — NO sticky floats alone.
    // The model linked only 1 of 4 stickies; the fill pass wires the other 3 so
    // every sticky has ≥1 edge (the judge flagged "blocks hang with no links").
    const degree = new Map<string, number>();
    for (const ed of graph!.edges) {
      degree.set(ed.source, (degree.get(ed.source) || 0) + 1);
      degree.set(ed.target, (degree.get(ed.target) || 0) + 1);
    }
    for (const s of stickies) expect(degree.get(s.id) || 0).toBeGreaterThan(0);
  });

  it('drops an edge that would carry an empty relation label (no empty labeled box)', async () => {
    mockObject({
      groups: [{ title: 'Grupa', blocks: ['Alfa', 'Beta'] }],
      // relation is whitespace-only ⇒ must NOT emit a 'labeled' edge with empty label.
      links: [{ from: 'Alfa', to: 'Beta', relation: '   ' }],
    });
    const graph = await generateWhiteboardGraph('x', undefined, true);
    expect(graph).toBeTruthy();
    // A plain (non-'labeled') edge or no edge — never an empty-labeled one.
    for (const e of graph!.edges) {
      expect(e.type).not.toBe('labeled');
    }
  });

  it('rejects (null) when a majority of block labels are fragments', async () => {
    mockObject({ groups: [{ title: 'G', blocks: ['z celami', 'ryzykami', 'Zasoby'] }], links: [] });
    expect(await generateWhiteboardGraph('x', undefined, true)).toBeNull();
  });

  // ── naprawa-c4 (DEFEKT #3): whiteboard density — no sticky may float alone.
  it('c4: wires EVERY sticky (no orphans) even when the model supplies zero links', async () => {
    mockObject({
      groups: [
        { title: 'Propozycja wartości', blocks: ['PdM AI', 'OEE AI'] },
        { title: 'Segmenty klientów', blocks: ['Mittelstand', 'Fabryki'] },
        { title: 'Kanały', blocks: ['Sprzedaż bezpośrednia'] },
        { title: 'Przychody', blocks: ['Subskrypcja SaaS'] },
      ],
      links: [], // model gave NO links → fill pass must connect all 6 stickies
    });
    const graph = await generateWhiteboardGraph('BMC dla DBR77', 'BMC', true);
    expect(graph).toBeTruthy();
    const stickies = graph!.nodes.filter((n) => n.type === 'stickyNote');
    expect(stickies.length).toBe(6);
    const degree = new Map<string, number>();
    for (const e of graph!.edges) {
      degree.set(e.source, (degree.get(e.source) || 0) + 1);
      degree.set(e.target, (degree.get(e.target) || 0) + 1);
    }
    for (const s of stickies) expect(degree.get(s.id) || 0).toBeGreaterThan(0);
    // Frames stay exactly as the model named them — no invented 5th cluster.
    expect(graph!.nodes.filter((n) => n.type === 'frameNode').length).toBe(4);
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

  // ── naprawa-c3 (DEFEKT #2): table must reflect the prompt's OWN entities. This
  // verifies the fidelity plumbing carries the real INI-0..5 portfolio rows
  // through (and the anti-fragment gate does not drop identifier-prefixed rows).
  it('preserves the prompt portfolio entities as rows (INI-0..5 DBR77)', async () => {
    mockObject({
      rows: [
        { label: 'INI-0 Kapitał', status: 'in_progress', priority: 'High' },
        { label: 'INI-1 Talent', status: 'todo', priority: 'High' },
        { label: 'INI-2 Produkt+Moat', status: 'todo', priority: 'Critical' },
        { label: 'INI-3 Delivery', status: 'todo', priority: 'Medium' },
        { label: 'INI-4 Popyt', status: 'todo', priority: 'High' },
        { label: 'INI-5 DACH', status: 'todo', priority: 'Medium' },
      ],
    });
    const graph = await generateTableGraph(
      'Tabela portfela DBR77: INI-0 Kapitał, INI-1 Talent, INI-2 Produkt+Moat, INI-3 Delivery, INI-4 Popyt, INI-5 DACH',
      'Portfel DBR77',
      true
    );
    expect(graph).toBeTruthy();
    const labels = graph!.nodes.map((n) => n.data.label);
    for (const id of ['INI-0', 'INI-1', 'INI-2', 'INI-3', 'INI-4', 'INI-5']) {
      expect(labels.some((l) => l.includes(id))).toBe(true);
    }
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

  // ── naprawa-c4 (DEFEKT #2): the note must use the input's OWN named pillars as
  // headings (verbatim), not MBA paraphrases ("Popyt"→"Rynek i ekspansja"). We
  // assert the plumbing: (a) the strengthened system prompt forbids paraphrase
  // and mandates verbatim headings; (b) the user message carries the named
  // pillars + numbers + the fidelity reminder; (c) temperature is low (fidelity).
  it('c4: sends verbatim-heading fidelity instructions + named entities to the model', async () => {
    mockText(
      '## Kapitał\n- runda A\n\n## Popyt\n- Mittelstand\n\n## DACH\n- ekspansja'
    );
    const seed =
      'Notatka DBR77: 3x revenue w 30-36 miesięcy. Filary: Kapitał, Talent, Produkt i Moat, Delivery, Popyt, DACH. Rynek: Mittelstand, Industrial Intelligence.';
    const content = await generateNoteContent(seed, 'DBR77', true);
    expect(content).toContain('## Popyt');
    expect(content).toContain('## DACH');

    const args = callMock.mock.calls[0]![0] as {
      systemPrompt: string;
      messages: { content: string }[];
      temperature: number;
    };
    // System prompt mandates verbatim pillar headings and forbids name paraphrase.
    expect(args.systemPrompt).toMatch(/DOKŁADNE NAZWY|SŁOWO W SŁOWO/);
    expect(args.systemPrompt).toMatch(/Moat/);
    expect(args.systemPrompt).toMatch(/Rynek i ekspansja/); // the forbidden paraphrase, named as a ban
    // User message carries the real named entities + numbers verbatim.
    const userMsg = args.messages[0]!.content;
    expect(userMsg).toContain('Popyt');
    expect(userMsg).toContain('DACH');
    expect(userMsg).toContain('Mittelstand');
    expect(userMsg).toContain('30-36');
    // Low temperature for fidelity.
    expect(args.temperature).toBeLessThanOrEqual(0.2);
  });
});
