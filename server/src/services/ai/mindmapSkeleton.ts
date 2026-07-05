/**
 * mindmapSkeleton — MINIMAL, REAL mind-map graph builder (M06 Fala 2 · 2.3).
 *
 * Turns a chat `intent` ("zrób mapę myśli o transformacji cyfrowej: ludzie,
 * procesy, technologia") into a genuine `{nodes, edges}` graph in the shape the
 * Ideas mind-map runtime understands (center node + branch nodes, ReactFlow-like
 * `{id, type, data:{label}}` nodes and `{source,target}` edges). This is a
 * deterministic skeleton — NOT an LLM call — so it is cheap, testable in CI, and
 * never "fakes" work: every branch it emits is derived from real user text.
 *
 * SCOPE (deliberately minimal):
 *   - root = title (or first sentence of intent)
 *   - branches = parsed from the intent: bullet/newline/`:`-list/comma segments
 *   - if no structure is found, we still emit the root alone (a valid 1-node map)
 *
 * TODO (M06 Fala 2 · [REAL-AI] nightly): enrich branches + sub-branches with an
 * LLM pass (semantic grouping, 2nd-level children, per-node notes). The wiring
 * (handler → onDeliverable → FE mount) stays identical; only this builder is
 * swapped for/augmented by a model-backed generator. Tracked as R1 in the plan.
 */

export interface MindmapSkeletonNode {
  id: string;
  type: 'center' | 'branch';
  data: { label: string };
  position?: { x: number; y: number };
}

export interface MindmapSkeletonEdge {
  id: string;
  source: string;
  target: string;
}

export interface MindmapSkeletonGraph {
  nodes: MindmapSkeletonNode[];
  edges: MindmapSkeletonEdge[];
}

const MAX_BRANCHES = 8;
const MAX_LABEL_LEN = 80;

function clampLabel(raw: string): string {
  return String(raw || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_LABEL_LEN);
}

/**
 * Strip a leading "make a mind map of / zrób mapę myśli o" preamble so the root
 * label is the topic, not the instruction. Best-effort; falls through untouched.
 */
function stripMindmapPreamble(intent: string): string {
  const patterns: RegExp[] = [
    /^\s*(?:zr[oó]b|stw[oó]rz|przygotuj|narysuj)\s+map[eę]\s+my[sś]li\s*(?:o|na temat|dla|z)?\s*[:\-–]?\s*/i,
    /^\s*(?:make|create|draw|build|generate)\s+(?:a\s+)?mind\s*map\s*(?:of|about|for|on)?\s*[:\-–]?\s*/i,
  ];
  let out = intent;
  for (const re of patterns) out = out.replace(re, '');
  return out.trim() || intent.trim();
}

/**
 * Derive branch labels from the intent. Priority:
 *   1. explicit list after a colon ("...: a, b, c" or "...: a; b; c")
 *   2. newline / bullet separated lines
 *   3. comma separated segments
 * Returns [] when no structure is detectable (root-only map).
 */
function deriveBranches(intent: string): string[] {
  const text = intent.trim();
  if (!text) return [];

  // 1. list after the LAST colon (the topic usually precedes it)
  const colonIdx = text.lastIndexOf(':');
  if (colonIdx >= 0 && colonIdx < text.length - 1) {
    const tail = text.slice(colonIdx + 1);
    const parts = tail
      .split(/[,;]|\band\b|\boraz\b|\bi\b/i)
      .map(clampLabel)
      .filter(Boolean);
    if (parts.length >= 2) return parts.slice(0, MAX_BRANCHES);
  }

  // 2. newline / bullet separated
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-*•\d.)]+\s*/, ''))
    .map(clampLabel)
    .filter(Boolean);
  if (lines.length >= 2) return lines.slice(0, MAX_BRANCHES);

  // 3. comma separated (single line topic list)
  const commaParts = text
    .split(/[,;]/)
    .map(clampLabel)
    .filter(Boolean);
  if (commaParts.length >= 2) return commaParts.slice(0, MAX_BRANCHES);

  return [];
}

/**
 * Build a real skeleton graph from a chat intent + optional title.
 *
 * @param intent  User's restated request (topic + optional list).
 * @param title   Optional explicit title; falls back to the derived root.
 */
export function buildMindmapSkeleton(
  intent: string,
  title?: string
): MindmapSkeletonGraph {
  const topic = stripMindmapPreamble(String(intent || ''));
  const rootLabel =
    clampLabel(title || '') || clampLabel(topic.split(/[:\n]/)[0] || '') || 'Mapa myśli';

  const centerId = 'center';
  const nodes: MindmapSkeletonNode[] = [
    { id: centerId, type: 'center', data: { label: rootLabel }, position: { x: 0, y: 0 } },
  ];
  const edges: MindmapSkeletonEdge[] = [];

  const branches = deriveBranches(topic).filter((b) => b.toLowerCase() !== rootLabel.toLowerCase());

  branches.forEach((label, i) => {
    const id = `branch-${i + 1}`;
    // Fan the branches out around the center for a sensible initial layout.
    const angle = (2 * Math.PI * i) / Math.max(1, branches.length);
    nodes.push({
      id,
      type: 'branch',
      data: { label },
      position: { x: Math.round(Math.cos(angle) * 240), y: Math.round(Math.sin(angle) * 240) },
    });
    edges.push({ id: `e-${centerId}-${id}`, source: centerId, target: id });
  });

  return { nodes, edges };
}

export default { buildMindmapSkeleton };
