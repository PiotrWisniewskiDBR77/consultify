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
 * A skeleton branch candidate is JUNK when it is not a clean pillar but a sliced
 * instruction fragment. Without this filter the deterministic splitter emitted the
 * live-bug garbage the judge flagged ("centrum teza", "6 filarów (Kapitał",
 * "DACH)", "każdy z celami", "ryzykami", "Do pracy jako mapa myśli") — because it
 * naively split the WHOLE prompt (including the instruction preamble and the
 * "każdy z 2-3 pod-węzłami (cel + ryzyko)" clause) on commas/`i`. Rule of thumb:
 * 6 clean pillars with no sub-nodes beat 8 with a "ryzykami" node.
 */
const SKELETON_JUNK =
  /(?:^|\b)(?:centrum|teza|filar[oó]w|filary|pod[- ]?w[eę]z[lł]\w*|w[eę]z[lł]\w*|cel(?:e|em|ów)?|ryzyk\w*|goal|risk|node|sub[- ]?node|ka[zż]d\w*|do pracy|jako map\w*|map[aęy]\b|mind ?map)\b/i;

// A leading continuation particle / lowercase start ⇒ a mid-sentence fragment.
const SKELETON_FRAGMENT_PREFIX =
  /^(?:z |ze |za |a[zż] |oraz |i |lub |albo |czyli |ka[zż]d\w* |with |and |or |each |aby |[zż]eby |kt[oó]r\w* )/i;

/**
 * Keep only clean pillar labels: drop empties, instruction/structure junk, and
 * mid-sentence fragments. Also strip a leading digit-count ("6 filarów X" → "X")
 * and dangling parentheses so a survivor reads cleanly.
 */
function cleanBranch(raw: string): string {
  const l = clampLabel(raw)
    // Strip a leading "N filarów"/"N pod-węzłów" counter that leaked in.
    .replace(/^\d+\s+(?:filar\w*|pod[- ]?w[eę]z\w*)\s*/i, '')
    // Drop an unbalanced trailing ")" or leading "(" from split parentheticals.
    .replace(/^\(+/, '')
    .replace(/\)+$/, '')
    .trim();
  return l;
}

function isCleanBranch(label: string): boolean {
  const l = label.trim();
  if (l.length < 2) return false;
  if (SKELETON_FRAGMENT_PREFIX.test(l)) return false;
  if (SKELETON_JUNK.test(l)) return false;
  // A lowercase Latin start signals a cut mid-sentence fragment ONLY when the
  // segment is multi-word (a clause). A single lowercase topic word ("ludzie",
  // "procesy") in a colon-list is a legitimate pillar and must be kept.
  const first = l[0];
  const startsLower = first === first.toLowerCase() && first !== first.toUpperCase();
  const wordCount = l.split(/\s+/).filter(Boolean).length;
  if (startsLower && wordCount >= 2) return false;
  return true;
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

  // Helper: split a candidate list, clean each part, keep only clean pillars.
  // Split on commas/semicolons FIRST (the primary separator in enumerations); only
  // fall back to the "i"/"and"/"oraz" conjunction split when commas yield <2 parts.
  // This preserves multi-word pillars like "Produkt i Moat" instead of shredding
  // them into "Produkt" + "Moat" (the live "lost Moat" bug the judge flagged).
  const splitClean = (segment: string): string[] => {
    let raw = segment.split(/[,;]/);
    if (raw.filter((s) => s.trim()).length < 2) {
      raw = segment.split(/\band\b|\boraz\b|\bi\b/i);
    }
    return raw.map(cleanBranch).filter((l) => l && isCleanBranch(l));
  };

  // 0. A PARENTHETICAL enumeration is the highest-signal pillar list — the DBR77
  //    prompt hides the real pillars there ("6 filarów (Kapitał, …, DACH), każdy
  //    z …"). Prefer the LONGEST bracketed list that yields ≥2 clean pillars, so
  //    we never split on the surrounding instruction wording.
  const parenLists = [...text.matchAll(/\(([^)]{3,})\)/g)].map((m) => m[1]);
  let bestParen: string[] = [];
  for (const seg of parenLists) {
    const parts = splitClean(seg);
    if (parts.length > bestParen.length) bestParen = parts;
  }
  if (bestParen.length >= 2) return bestParen.slice(0, MAX_BRANCHES);

  // 1. list after the LAST colon (the topic usually precedes it)
  const colonIdx = text.lastIndexOf(':');
  if (colonIdx >= 0 && colonIdx < text.length - 1) {
    const parts = splitClean(text.slice(colonIdx + 1));
    if (parts.length >= 2) return parts.slice(0, MAX_BRANCHES);
  }

  // 2. newline / bullet separated
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-*•\d.)]+\s*/, ''))
    .map(cleanBranch)
    .filter((l) => l && isCleanBranch(l));
  if (lines.length >= 2) return lines.slice(0, MAX_BRANCHES);

  // 3. comma separated (single line topic list)
  const commaParts = text
    .split(/[,;]/)
    .map(cleanBranch)
    .filter((l) => l && isCleanBranch(l));
  if (commaParts.length >= 2) return commaParts.slice(0, MAX_BRANCHES);

  return [];
}

/**
 * Build a real skeleton graph from a chat intent + optional title.
 *
 * @param intent  User's restated request (topic + optional list).
 * @param title   Optional explicit title; falls back to the derived root.
 */
export function buildMindmapSkeleton(intent: string, title?: string): MindmapSkeletonGraph {
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
