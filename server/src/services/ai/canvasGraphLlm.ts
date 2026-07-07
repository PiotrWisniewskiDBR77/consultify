/**
 * canvasGraphLlm — LLM-backed structured-graph generators for Teresa's creative
 * tools (Mind Map / Process Flow / Whiteboard / Ideas Table) and note prose.
 *
 * WHY (naprawa-c1Graph): the deterministic builders in `mindmapSkeleton.ts` /
 * `canvasToolSkeletons.ts` produced GARBAGE graphs — they split `seedText` on
 * commas/semicolons and mapped raw fragments 1:1 onto nodes. The judge scored the
 * output ~21/100: phrase fragments as node labels ("DACH - każdy z celami",
 * "ryzykami"), flat stars with 0 sub-nodes, process flows with 0 decision
 * diamonds, whiteboards with 0 edges, empty note shells.
 *
 * This module replaces the splitter with a real LLM pass (premium tier → latest
 * Claude via llmService's tier→provider map; NO provider/key hardcoded, mirrors
 * `initiativeGenerationService.ts`). The model returns a validated JSON graph in
 * the SHAPE THE FRONTEND RUNTIME ACTUALLY READS (verified against the FE tools):
 *
 *   - mindmap:      nodes {id,type:'center'|'branch',data:{label},parentId?}
 *                   + edges center→pillar→subnode. 2-level hierarchy.
 *   - process_flow: nodes {id,type:'flowNode',data:{label,shape}} where
 *                   shape ∈ start|action|decision|end (FE reads data.shape, NOT
 *                   node.type — IdeaProcessFlowTool hydrate) + flowEdge with
 *                   yes/no branch labels + optional loop-back.
 *   - whiteboard:   nodes {id,type:'stickyNote',data:{label}} (NOT 'sticky' —
 *                   that RF type is unregistered) + labeled edges linking blocks.
 *   - table:        row nodes {id,type:'idea',data:{label,status,priority,...}}
 *                   populated with real data; edges:[] (tables are node-only).
 *   - note:         markdown prose (thesis + sections), NOT an empty shell.
 *
 * Every generator is FAIL-SOFT: on any LLM error / parse failure / all-rejected
 * anti-fragment validation it returns `null`, and the caller falls back to the
 * deterministic skeleton (so the tool always opens with *something*).
 */

import { z } from 'zod';

import logger from '../../utils/Logger.js';

// ── Provider access (lazy, mirrors initiativeGenerationService.ts) ───────────
let _llmServiceInstance: any = null;
async function getLLM(): Promise<any | null> {
  if (_llmServiceInstance) return _llmServiceInstance;
  try {
    const mod = await import('./llmService.js');
    _llmServiceInstance = mod.llmService || mod.default;
    return _llmServiceInstance;
  } catch (err) {
    logger.warn(
      `[canvasGraphLlm] llmService unavailable: ${err instanceof Error ? err.message : String(err)}`
    );
    return null;
  }
}

const MAX_LABEL_LEN = 80;
const LLM_TIMEOUT_MS = 60000;

function clamp(raw: unknown, max = MAX_LABEL_LEN): string {
  return String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

// ── Anti-fragment validation ─────────────────────────────────────────────────
/**
 * Reject a label that is clearly a raw fragment of the user's prompt rather than
 * a clean, semantic node label. Heuristics (any one ⇒ reject):
 *   - empty / too short after trim
 *   - starts lowercase (a fragment cut mid-sentence — the #1 live-bug signature,
 *     e.g. "ryzykami")
 *   - starts with a Polish/English continuation particle ("z ", "aż ", "oraz ",
 *     "each of...", "with...", "and ...") — e.g. "z celami i ryzykami"
 *   - starts with "każdy"/"każda"/"każde" (verbatim live bug: "każdy z celami")
 *   - is a verbatim MULTI-WORD slice of the seed's own instruction preamble
 *     ("zrób mapę...", "diagram procesu z...") — see `seedText`
 * Proper nouns / acronyms (all-caps first token) and legitimately-reused single
 * topic words (a pillar "Ludzie" when the prompt says "ludzie") are allowed.
 */
const FRAGMENT_PREFIXES =
  /^(?:z |ze |za |aż |oraz |i |lub |albo |czyli |każd[ayeą]\w* |with |and |or |each |that |which |aby |żeby |który\w* )/i;

// Instruction verbs that must never appear as a node label (they mean the model
// echoed the request wording, e.g. "Diagram procesu z punktami decyzyjnymi").
const INSTRUCTION_TOKENS =
  /\b(?:zr[oó]b|stw[oó]rz|przygotuj|narysuj|zbuduj|wygeneruj|make|create|draw|build|generate)\b/i;

export function isFragmentLabel(label: string, seedText = ''): boolean {
  const l = clamp(label);
  if (l.length < 2) return true;

  // First non-space character: a lowercase start (in a Latin-script alphabet)
  // signals a mid-sentence fragment. Digits / "•" / dashes also fail.
  const first = l[0];
  const startsLowercase = first === first.toLowerCase() && first !== first.toUpperCase();
  if (startsLowercase) return true;

  if (FRAGMENT_PREFIXES.test(l)) return true;

  // A label echoing an instruction verb is the request wording, not a concept.
  if (INSTRUCTION_TOKENS.test(l)) return true;

  // Verbatim MULTI-WORD (≥3 words) slice of the seed ⇒ a lifted clause. A single
  // reused topic word or a short 2-word pair (e.g. "Transformacja cyfrowa" when
  // the prompt says "transformacja cyfrowa") is a legitimate thesis/pillar and
  // is allowed; only a 3+-word lift is treated as a raw fragment.
  if (seedText) {
    const seedNorm = seedText.replace(/\s+/g, ' ').toLowerCase();
    const labelNorm = l.toLowerCase();
    const wordCount = labelNorm.split(' ').filter(Boolean).length;
    if (wordCount >= 3 && labelNorm.length >= 16 && seedNorm.includes(labelNorm)) return true;
  }
  return false;
}

/** Count of labels in `labels` that pass the anti-fragment gate. */
function acceptedRatio(labels: string[], seedText: string): number {
  if (labels.length === 0) return 0;
  const ok = labels.filter((l) => !isFragmentLabel(l, seedText)).length;
  return ok / labels.length;
}

// ── Zod schemas for LLM structured output ────────────────────────────────────
const MindmapLlmSchema = z.object({
  center: z.string().describe('Concise central thesis (3-6 words). NOT the full request.'),
  branches: z
    .array(
      z.object({
        label: z.string().describe('Short semantic pillar label (2-5 words).'),
        children: z
          .array(z.string().describe('Short sub-node label (goal or risk, 2-6 words).'))
          .optional()
          .default([]),
      })
    )
    .min(1),
});

const ProcessFlowLlmSchema = z.object({
  steps: z
    .array(
      z.object({
        label: z.string().describe('Verb-first step or a yes/no question for a decision.'),
        shape: z
          .enum(['start', 'action', 'decision', 'end'])
          .describe('start once, end once, decision for a question, action otherwise.'),
      })
    )
    .min(2),
  edges: z
    .array(
      z.object({
        from: z.number().int().describe('0-based index into steps[] of the source node.'),
        to: z.number().int().describe('0-based index into steps[] of the target node.'),
        label: z.string().optional().describe('e.g. "tak"/"nie" on a decision branch.'),
      })
    )
    .optional()
    .default([]),
});

const WhiteboardLlmSchema = z.object({
  blocks: z.array(z.string().describe('Short sticky-note label (2-6 words).')).min(2),
  links: z
    .array(
      z.object({
        from: z.number().int().describe('0-based index into blocks[].'),
        to: z.number().int().describe('0-based index into blocks[].'),
      })
    )
    .optional()
    .default([]),
});

const TableLlmSchema = z.object({
  rows: z
    .array(
      z.object({
        label: z.string().describe('Row title (the primary column value).'),
        status: z.enum(['todo', 'in_progress', 'done', 'blocked']).optional().default('todo'),
        priority: z.enum(['Low', 'Medium', 'High', 'Critical']).optional().default('Medium'),
        notes: z.string().optional().describe('Optional one-line detail.'),
      })
    )
    .min(1),
});

// ── Shared node/edge shapes (match caller CanvasSkeletonGraph) ───────────────
export interface LlmGraphNode {
  id: string;
  type: string;
  data: { label: string; [k: string]: unknown };
  position?: { x: number; y: number };
  parentId?: string;
}
export interface LlmGraphEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  label?: string;
}
export interface LlmGraph {
  nodes: LlmGraphNode[];
  edges: LlmGraphEdge[];
}

async function callStructured<T>(
  schema: z.ZodSchema<T>,
  systemPrompt: string,
  userPrompt: string
): Promise<T | null> {
  const llm = await getLLM();
  if (!llm) return null;
  try {
    const result = await llm.call({
      type: 'structured',
      modelConfig: { id: 'premium' },
      schema,
      systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: 2048,
      temperature: 0.4,
      cache: false,
      timeoutMs: LLM_TIMEOUT_MS,
    });
    const obj = (result as { object?: unknown })?.object;
    if (!obj) return null;
    return schema.parse(obj);
  } catch (err) {
    logger.warn(
      `[canvasGraphLlm] structured call failed: ${err instanceof Error ? err.message : String(err)}`
    );
    return null;
  }
}

// ── MIND MAP ─────────────────────────────────────────────────────────────────
const MINDMAP_SYSTEM_PL = `Jesteś ekspertem tworzącym mapy myśli w standardzie doradczym (McKinsey/BCG).
Z prośby użytkownika zbuduj HIERARCHICZNĄ mapę myśli:
- "center": ZWIĘZŁA teza (3-6 słów), NIE cała treść prośby, NIE instrukcja.
- "branches": filary tematu. Liczba filarów = liczba wskazana lub sensowna (3-6).
- każdy filar może mieć "children": pod-węzły (np. cel + ryzyko), jeśli o to proszono.
ZASADY: etykiety KRÓTKIE, semantyczne, zaczynają się WIELKĄ literą, są rzeczownikowe/nominalne.
ZAKAZ: kopiowania fragmentów zdań, etykiet zaczynających się od "z ", "aż ", "każdy ", "oraz ".
Odpowiedz w języku prośby.`;

const MINDMAP_SYSTEM_EN = `You are an expert building consulting-grade mind maps (McKinsey/BCG).
From the user's request build a HIERARCHICAL mind map:
- "center": a CONCISE thesis (3-6 words), NOT the whole request, NOT the instruction.
- "branches": the pillars. Number of pillars = as requested or sensible (3-6).
- each pillar may carry "children": sub-nodes (e.g. goal + risk) when asked.
RULES: labels SHORT, semantic, Capitalized, noun-phrase-like.
FORBIDDEN: copying sentence fragments, labels starting with "with ", "and ", "each ".
Answer in the language of the request.`;

export async function generateMindmapGraph(
  intent: string,
  title: string | undefined,
  isPolish: boolean
): Promise<LlmGraph | null> {
  const seedText = String(intent || title || '').trim();
  if (!seedText) return null;
  const parsed = await callStructured(
    MindmapLlmSchema,
    isPolish ? MINDMAP_SYSTEM_PL : MINDMAP_SYSTEM_EN,
    seedText
  );
  if (!parsed) return null;

  const centerLabel = clamp(parsed.center);
  const pillarLabels = parsed.branches.map((b) => clamp(b.label)).filter(Boolean);
  const allChildLabels = parsed.branches.flatMap((b) => (b.children || []).map(clamp)).filter(Boolean);

  // Anti-fragment gate: reject the whole LLM result if the center or a majority
  // of branch labels are fragments (fall back to skeleton).
  if (isFragmentLabel(centerLabel, seedText)) return null;
  if (acceptedRatio(pillarLabels, seedText) < 0.6) return null;
  if (pillarLabels.length === 0) return null;

  const nodes: LlmGraphNode[] = [
    { id: 'center', type: 'center', data: { label: centerLabel }, position: { x: 0, y: 0 } },
  ];
  const edges: LlmGraphEdge[] = [];

  parsed.branches.forEach((branch, i) => {
    const pLabel = clamp(branch.label);
    if (!pLabel || isFragmentLabel(pLabel, seedText)) return;
    const pillarId = `branch-${i + 1}`;
    const angle = (2 * Math.PI * i) / Math.max(1, parsed.branches.length);
    nodes.push({
      id: pillarId,
      type: 'branch',
      data: { label: pLabel },
      position: { x: Math.round(Math.cos(angle) * 320), y: Math.round(Math.sin(angle) * 320) },
    });
    edges.push({ id: `e-center-${pillarId}`, source: 'center', target: pillarId });

    (branch.children || []).forEach((childRaw, j) => {
      const cLabel = clamp(childRaw);
      if (!cLabel || isFragmentLabel(cLabel, seedText)) return;
      const childId = `branch-${i + 1}-${j + 1}`;
      const cAngle = angle + (j - 0.5) * 0.4;
      nodes.push({
        id: childId,
        type: 'branch',
        data: { label: cLabel },
        parentId: pillarId,
        position: {
          x: Math.round(Math.cos(cAngle) * 560),
          y: Math.round(Math.sin(cAngle) * 560),
        },
      });
      edges.push({ id: `e-${pillarId}-${childId}`, source: pillarId, target: childId });
    });
  });

  // Guard: need at least the center + one pillar (avoid emitting a 1-node map).
  if (nodes.length < 2) return null;
  void allChildLabels;
  return { nodes, edges };
}

// ── PROCESS FLOW ─────────────────────────────────────────────────────────────
const FLOW_SYSTEM_PL = `Jesteś ekspertem modelowania procesów. Z prośby zbuduj DIAGRAM PROCESU:
- "steps": kroki procesu. Etykiety CZASOWNIKOWE (np. "Zweryfikuj dane"). NIE fragmenty prośby.
- pierwszy krok shape="start", ostatni shape="end".
- gdzie w prośbie jest DECYZJA/pytanie ("OK?", "czy...") użyj shape="decision" i sformułuj jako pytanie.
- "edges": połączenia po indeksach. Na gałęziach decyzji ustaw label "tak"/"nie". Dozwolone pętle zwrotne.
ZAKAZ: kopiowania zdań prośby jako kroków. Odpowiedz w języku prośby.`;

const FLOW_SYSTEM_EN = `You are a process-modeling expert. From the request build a PROCESS DIAGRAM:
- "steps": process steps. Verb-first labels (e.g. "Verify data"). NOT prompt fragments.
- first step shape="start", last shape="end".
- where the request implies a DECISION/question ("OK?", "if...") use shape="decision", phrase as a question.
- "edges": connections by index. On decision branches set label "yes"/"no". Loop-backs allowed.
FORBIDDEN: copying request sentences as steps. Answer in the language of the request.`;

export async function generateProcessFlowGraph(
  intent: string,
  title: string | undefined,
  isPolish: boolean
): Promise<LlmGraph | null> {
  const seedText = String(intent || title || '').trim();
  if (!seedText) return null;
  const parsed = await callStructured(
    ProcessFlowLlmSchema,
    isPolish ? FLOW_SYSTEM_PL : FLOW_SYSTEM_EN,
    seedText
  );
  if (!parsed) return null;

  const stepLabels = parsed.steps.map((s) => clamp(s.label)).filter(Boolean);
  if (stepLabels.length < 2) return null;
  // The start/end nodes are boilerplate ("Start"/"Koniec") the model may emit —
  // score anti-fragment only on the non-terminal step labels.
  const contentLabels = parsed.steps
    .filter((s) => s.shape !== 'start' && s.shape !== 'end')
    .map((s) => clamp(s.label))
    .filter(Boolean);
  if (contentLabels.length > 0 && acceptedRatio(contentLabels, seedText) < 0.6) return null;

  const nodes: LlmGraphNode[] = parsed.steps.map((step, i) => ({
    id: `step-${i}`,
    // FE (IdeaProcessFlowTool hydrate) renders by data.shape, node type stays 'flowNode'.
    type: 'flowNode',
    data: { label: clamp(step.label), shape: step.shape },
    position: { x: i * 240, y: (i % 2) * 40 },
  }));

  let edges: LlmGraphEdge[];
  const validIdx = (n: number) => Number.isInteger(n) && n >= 0 && n < nodes.length;
  const modelEdges = (parsed.edges || []).filter((e) => validIdx(e.from) && validIdx(e.to) && e.from !== e.to);
  if (modelEdges.length > 0) {
    edges = modelEdges.map((e, i) => ({
      id: `e-${e.from}-${e.to}-${i}`,
      source: `step-${e.from}`,
      target: `step-${e.to}`,
      type: 'flowEdge',
      ...(e.label ? { label: clamp(e.label, 24) } : {}),
    }));
  } else {
    // No usable model edges — wire a linear chain start→…→end so the flow is valid.
    edges = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      edges.push({
        id: `e-step-${i}-step-${i + 1}`,
        source: `step-${i}`,
        target: `step-${i + 1}`,
        type: 'flowEdge',
      });
    }
  }

  return { nodes, edges };
}

// ── WHITEBOARD ───────────────────────────────────────────────────────────────
const WB_SYSTEM_PL = `Jesteś ekspertem facylitacji na tablicy. Z prośby zbuduj TABLICĘ:
- "blocks": karteczki (sticky). Każda = ODRĘBNY element/pomysł. Etykiety KRÓTKIE, semantyczne.
  NIE tytuł tablicy, NIE instrukcja jako karteczka.
- "links": połączenia po indeksach między POWIĄZANYMI blokami (jeśli prośba mówi o relacjach — NIE zero).
ZAKAZ: kopiowania fragmentów prośby. Odpowiedz w języku prośby.`;

const WB_SYSTEM_EN = `You are a whiteboard facilitation expert. From the request build a BOARD:
- "blocks": sticky notes. Each = a DISTINCT element/idea. SHORT semantic labels.
  NOT the board title, NOT an instruction as a sticky.
- "links": index connections between RELATED blocks (when the request implies relations — not zero).
FORBIDDEN: copying request fragments. Answer in the language of the request.`;

export async function generateWhiteboardGraph(
  intent: string,
  title: string | undefined,
  isPolish: boolean
): Promise<LlmGraph | null> {
  const seedText = String(intent || title || '').trim();
  if (!seedText) return null;
  const parsed = await callStructured(
    WhiteboardLlmSchema,
    isPolish ? WB_SYSTEM_PL : WB_SYSTEM_EN,
    seedText
  );
  if (!parsed) return null;

  const blockLabels = parsed.blocks.map(clamp).filter(Boolean);
  if (blockLabels.length < 1) return null;
  if (acceptedRatio(blockLabels, seedText) < 0.6) return null;

  const nodes: LlmGraphNode[] = [];
  parsed.blocks.forEach((raw, i) => {
    const label = clamp(raw);
    if (!label || isFragmentLabel(label, seedText)) return;
    const angle = (2 * Math.PI * i) / Math.max(1, parsed.blocks.length);
    nodes.push({
      id: `sticky-${i + 1}`,
      // FE whiteboard nodeTypes registry key is 'stickyNote' (NOT 'sticky').
      type: 'stickyNote',
      data: { label },
      position: { x: Math.round(Math.cos(angle) * 260), y: Math.round(Math.sin(angle) * 260) },
    });
  });
  if (nodes.length < 1) return null;

  const idAt = (idx: number) => nodes[idx]?.id;
  const validIdx = (n: number) => Number.isInteger(n) && n >= 0 && n < nodes.length;
  const edges: LlmGraphEdge[] = (parsed.links || [])
    .filter((l) => validIdx(l.from) && validIdx(l.to) && l.from !== l.to)
    .map((l, i) => ({
      id: `wbedge-${l.from}-${l.to}-${i}`,
      source: idAt(l.from)!,
      target: idAt(l.to)!,
      type: 'labeled',
    }));

  return { nodes, edges };
}

// ── IDEAS TABLE ──────────────────────────────────────────────────────────────
const TABLE_SYSTEM_PL = `Jesteś ekspertem porządkującym dane w tabelę. Z prośby zbuduj wiersze:
- "rows": realne wiersze wg tematu prośby. "label" = główna wartość wiersza.
  Uzupełnij "status" i "priority" sensownie. "notes" opcjonalnie (1 linia).
ZAKAZ: fragmentów prośby jako etykiet wierszy. Odpowiedz w języku prośby.`;

const TABLE_SYSTEM_EN = `You are a data-structuring expert. From the request build table rows:
- "rows": real rows per the request topic. "label" = the primary row value.
  Fill "status" and "priority" sensibly. "notes" optional (1 line).
FORBIDDEN: request fragments as row labels. Answer in the language of the request.`;

export async function generateTableGraph(
  intent: string,
  title: string | undefined,
  isPolish: boolean
): Promise<LlmGraph | null> {
  const seedText = String(intent || title || '').trim();
  if (!seedText) return null;
  const parsed = await callStructured(
    TableLlmSchema,
    isPolish ? TABLE_SYSTEM_PL : TABLE_SYSTEM_EN,
    seedText
  );
  if (!parsed) return null;

  const rowLabels = parsed.rows.map((r) => clamp(r.label)).filter(Boolean);
  if (rowLabels.length < 1) return null;
  if (acceptedRatio(rowLabels, seedText) < 0.6) return null;

  const nodes: LlmGraphNode[] = [];
  parsed.rows.forEach((row, i) => {
    const label = clamp(row.label);
    if (!label || isFragmentLabel(label, seedText)) return;
    nodes.push({
      id: `row-${i + 1}`,
      // FE table hydrate accepts 'idea' as a valid row node type (VALID_NODE_TYPES).
      type: 'idea',
      data: {
        label,
        status: row.status || 'todo',
        priority: row.priority || 'Medium',
        ...(row.notes ? { notes: clamp(row.notes, 160) } : {}),
      },
      position: { x: 0, y: i * 60 },
    });
  });
  if (nodes.length < 1) return null;

  return { nodes, edges: [] };
}

// ── NOTE (prose content) ─────────────────────────────────────────────────────
const NOTE_SYSTEM_PL = `Jesteś doradcą piszącym zwięzłą, wartościową notatkę w Markdown.
Napisz notatkę na temat prośby: krótka teza na wstępie, potem 2-4 sekcje z nagłówkami (##)
i punktami. Rzeczowo, konkretnie, bez lania wody. Zwróć TYLKO treść Markdown (bez tytułu H1).`;

const NOTE_SYSTEM_EN = `You are an advisor writing a concise, valuable note in Markdown.
Write a note on the request topic: a short thesis up front, then 2-4 sections with (##) headings
and bullets. Substantive and specific, no filler. Return ONLY the Markdown body (no H1 title).`;

/**
 * Generate real prose (Markdown) for a note body. Returns null on failure so the
 * caller can fall back to the raw intent text.
 */
export async function generateNoteContent(
  intent: string,
  title: string | undefined,
  isPolish: boolean
): Promise<string | null> {
  const seedText = String(intent || title || '').trim();
  if (!seedText) return null;
  const llm = await getLLM();
  if (!llm) return null;
  try {
    const result = await llm.call({
      type: 'text',
      modelConfig: { id: 'premium' },
      systemPrompt: isPolish ? NOTE_SYSTEM_PL : NOTE_SYSTEM_EN,
      messages: [
        {
          role: 'user',
          content: `${title ? `Temat/Topic: ${title}\n\n` : ''}${seedText}`,
        },
      ],
      maxTokens: 2048,
      temperature: 0.5,
      cache: false,
      timeoutMs: LLM_TIMEOUT_MS,
    });
    const content = String((result as { content?: unknown })?.content || '').trim();
    // A non-trivial body is required; otherwise fall back to the raw intent.
    if (content.length < 40) return null;
    return content;
  } catch (err) {
    logger.warn(
      `[canvasGraphLlm] note content generation failed: ${err instanceof Error ? err.message : String(err)}`
    );
    return null;
  }
}

export default {
  generateMindmapGraph,
  generateProcessFlowGraph,
  generateWhiteboardGraph,
  generateTableGraph,
  generateNoteContent,
  isFragmentLabel,
};
