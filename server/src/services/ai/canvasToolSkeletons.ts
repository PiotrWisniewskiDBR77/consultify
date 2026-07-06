/**
 * canvasToolSkeletons — MINIMAL, REAL skeleton builders for the 3 idea-workspace
 * canvas tools that follow the mind-map wiring pattern (M06 Fala 2 · 2.3):
 * process_flow, table (Ideas Table / M08), whiteboard.
 *
 * Mirrors `mindmapSkeleton.ts` deliberately: same deterministic, non-LLM
 * approach (cheap, testable, never "fakes" work — every node is derived from
 * real user text), same `{nodes, edges}` ReactFlow-like shape that the shared
 * idea-workspace graph validator (`ideaWorkspaceGraph.validators.ts` —
 * `normalizeNodeForStorage`) accepts via `node.type` / `node.data.label`.
 *
 * All three tools persist through the SAME generic contract as mind-map:
 * a real `my_ideas` + `my_idea_maps` row (POST /my-ideas, POST
 * /my-ideas/:id/map/sync) with `preferred_tool` set to the tool name — created
 * on the FE "new idea" mount path (IdeaMapWorkspace), not by this builder.
 * This module only builds the seed graph; persistence/materialization is
 * identical to the mind-map path already shipped.
 *
 * TODO ([REAL-AI] nightly): enrich with an LLM pass per tool (richer step
 * graphs, real column types, structured whiteboard clusters). Wiring stays
 * identical; only these builders are swapped/augmented later.
 */

export interface CanvasSkeletonNode {
  id: string;
  type: string;
  data: { label: string; [key: string]: unknown };
  position?: { x: number; y: number };
}

export interface CanvasSkeletonEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface CanvasSkeletonGraph {
  nodes: CanvasSkeletonNode[];
  edges: CanvasSkeletonEdge[];
}

const MAX_ITEMS = 8;
const MAX_LABEL_LEN = 80;

function clampLabel(raw: string): string {
  return String(raw || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_LABEL_LEN);
}

const PREAMBLE_PATTERNS: RegExp[] = [
  /^\s*(?:zr[oó]b|stw[oó]rz|przygotuj|narysuj|zbuduj)\s+(?:proces|przep[lł]yw|tabel[eę]|tablic[eę])\s*(?:o|na temat|dla|z)?\s*[:\-–]?\s*/i,
  /^\s*(?:make|create|draw|build|generate)\s+(?:a\s+)?(?:process|flow|table|board)\s*(?:of|about|for|on)?\s*[:\-–]?\s*/i,
];

function stripToolPreamble(intent: string): string {
  let out = intent;
  for (const re of PREAMBLE_PATTERNS) out = out.replace(re, '');
  return out.trim() || intent.trim();
}

/**
 * Derive a flat list of item labels from the intent text. Priority:
 *   1. explicit list after the last colon
 *   2. newline / bullet separated lines
 *   3. comma separated segments
 * Returns [] when no structure is detectable.
 */
function deriveItems(intent: string): string[] {
  const text = intent.trim();
  if (!text) return [];

  const colonIdx = text.lastIndexOf(':');
  if (colonIdx >= 0 && colonIdx < text.length - 1) {
    const tail = text.slice(colonIdx + 1);
    const parts = tail
      .split(/[,;]|\band\b|\boraz\b|\bi\b/i)
      .map(clampLabel)
      .filter(Boolean);
    if (parts.length >= 2) return parts.slice(0, MAX_ITEMS);
  }

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-*•\d.)]+\s*/, ''))
    .map(clampLabel)
    .filter(Boolean);
  if (lines.length >= 2) return lines.slice(0, MAX_ITEMS);

  const commaParts = text.split(/[,;]/).map(clampLabel).filter(Boolean);
  if (commaParts.length >= 2) return commaParts.slice(0, MAX_ITEMS);

  return [];
}

function deriveRootLabel(intent: string, title: string | undefined, fallback: string): string {
  const topic = stripToolPreamble(String(intent || ''));
  return clampLabel(title || '') || clampLabel(topic.split(/[:\n]/)[0] || '') || fallback;
}

/**
 * Process Flow skeleton: Start → step(s) parsed from intent → End.
 * Node `type` values ('start'|'step'|'end') mirror IdeaProcessFlowTool /
 * NodeKindEnum ('step'|'decision'...). Falls back to Start→End when no
 * structure is detectable (still a valid, openable 2-node flow).
 */
export function buildProcessFlowSkeleton(
  intent: string,
  title?: string,
  isPolish = true
): CanvasSkeletonGraph {
  const rootLabel = deriveRootLabel(intent, title, isPolish ? 'Przepływ procesu' : 'Process flow');
  const topic = stripToolPreamble(String(intent || ''));
  const steps = deriveItems(topic).filter((s) => s.toLowerCase() !== rootLabel.toLowerCase());

  const nodes: CanvasSkeletonNode[] = [];
  const edges: CanvasSkeletonEdge[] = [];

  const startId = 'start';
  const endId = 'end';
  nodes.push({
    id: startId,
    type: 'start',
    data: { label: isPolish ? 'Start' : 'Start' },
    position: { x: 0, y: 0 },
  });

  let prevId = startId;
  steps.forEach((label, i) => {
    const id = `step-${i + 1}`;
    nodes.push({
      id,
      type: 'step',
      data: { label },
      position: { x: (i + 1) * 220, y: 0 },
    });
    edges.push({ id: `e-${prevId}-${id}`, source: prevId, target: id });
    prevId = id;
  });

  nodes.push({
    id: endId,
    type: 'end',
    data: { label: isPolish ? 'Koniec' : 'End' },
    position: { x: (steps.length + 1) * 220, y: 0 },
  });
  edges.push({ id: `e-${prevId}-${endId}`, source: prevId, target: endId });

  // The rootLabel becomes the flow title (carried via generate_deliverable's
  // own `title`, not a node) — the flow itself needs no separate "center" node.
  void rootLabel;

  return { nodes, edges };
}

/**
 * Ideas Table (M08) skeleton: a set of row nodes derived from the intent,
 * each carrying `data.label` (+ default `status`) so the table view (which
 * reads generic idea-workspace nodes as rows — see useTableSchema.ts
 * DEFAULT_COLUMNS: type/label/status/priority) renders real seeded rows
 * instead of an empty grid. No edges (tables are node-only).
 */
export function buildIdeasTableSkeleton(
  intent: string,
  title?: string,
  isPolish = true
): CanvasSkeletonGraph {
  const topic = stripToolPreamble(String(intent || ''));
  const items = deriveItems(topic);
  const nodes: CanvasSkeletonNode[] = [];

  const seedRows =
    items.length > 0
      ? items
      : [deriveRootLabel(intent, title, isPolish ? 'Nowy wiersz' : 'New row')];

  seedRows.forEach((label, i) => {
    nodes.push({
      id: `row-${i + 1}`,
      type: 'row',
      data: { label, status: 'todo' },
      position: { x: 0, y: i * 60 },
    });
  });

  return { nodes, edges: [] };
}

/**
 * Whiteboard skeleton: sticky notes fanned out from a center topic sticky,
 * mirroring the mind-map layout but with `type:'sticky'` (NodeKindEnum) so
 * the whiteboard tool renders them as sticky notes, not mind-map bubbles.
 */
export function buildWhiteboardSkeleton(
  intent: string,
  title?: string,
  isPolish = true
): CanvasSkeletonGraph {
  const rootLabel = deriveRootLabel(intent, title, isPolish ? 'Tablica' : 'Whiteboard');
  const topic = stripToolPreamble(String(intent || ''));
  const items = deriveItems(topic).filter((s) => s.toLowerCase() !== rootLabel.toLowerCase());

  const centerId = 'center';
  const nodes: CanvasSkeletonNode[] = [
    { id: centerId, type: 'sticky', data: { label: rootLabel }, position: { x: 0, y: 0 } },
  ];
  const edges: CanvasSkeletonEdge[] = [];

  items.forEach((label, i) => {
    const id = `sticky-${i + 1}`;
    const angle = (2 * Math.PI * i) / Math.max(1, items.length);
    nodes.push({
      id,
      type: 'sticky',
      data: { label },
      position: { x: Math.round(Math.cos(angle) * 240), y: Math.round(Math.sin(angle) * 240) },
    });
    // Whiteboard stickies are independent notes — no forced edges, unlike
    // mind-map branches. Kept edge-free to match how a real whiteboard starts.
  });

  return { nodes, edges };
}

export default {
  buildProcessFlowSkeleton,
  buildIdeasTableSkeleton,
  buildWhiteboardSkeleton,
};
