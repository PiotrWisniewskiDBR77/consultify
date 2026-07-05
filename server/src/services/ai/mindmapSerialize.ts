/**
 * mindmapSerialize — SERVER-SIDE duplicate of the front-end
 * `src/components/MyWork/ideaMapToMarkdown.ts` pure serializer.
 *
 * WHY A DUPLICATE (decision, M06 Fala 2 · §0.3/§3):
 * The canonical serializer lives in `src/` (front-end). It is pure and
 * isomorphic (no DOM, TextEncoder with a fallback), so it *could* be imported
 * from server code — but the server build does not include `src/` in its
 * module graph, and re-pathing the FE import in two component call-sites
 * carries a higher regression risk than a small verbatim copy. We therefore
 * duplicate it here and guarantee byte-for-byte parity with a dedicated test
 * (`tests/unit/backend/mindmapSerialize.parity.test.ts`) that runs both
 * implementations on the same graphs and asserts identical output.
 *
 * Keep this file in lock-step with the FE version. If you change one, change
 * the other and the parity test will fail loudly if they drift.
 */

export interface IdeaMapNodeLike {
  id?: string | number;
  data?: { label?: string; text?: string } | null;
  label?: string;
  text?: string;
  [key: string]: unknown;
}

export interface IdeaMapEdgeLike {
  source?: string | number;
  sourceId?: string | number;
  target?: string | number;
  targetId?: string | number;
  [key: string]: unknown;
}

export interface IdeaMapToMarkdownOptions {
  /** Title rendered as the first H2 line. */
  title?: string;
  /** Polish (true) vs English (false) for the fixed labels. */
  isPolish?: boolean;
  /** Max nesting depth before children are flattened. Default 6. */
  maxDepth?: number;
  /** Soft cap on output size in bytes. Default ~8192. */
  maxBytes?: number;
}

const DEFAULT_MAX_DEPTH = 6;
const DEFAULT_MAX_BYTES = 8192;

/** Browser- and Node-safe UTF-8 byte length (no Buffer dependency). */
function utf8ByteLength(value: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value).length;
  }
  // Fallback approximation (very old runtimes) — counts code units.
  return unescape(encodeURIComponent(value)).length;
}

function nodeLabel(node: IdeaMapNodeLike, isPolish: boolean): string {
  const raw =
    (node?.data?.label ?? node?.data?.text ?? node?.label ?? node?.text ?? '') + '';
  const trimmed = raw.trim();
  if (trimmed) return trimmed;
  const id = node?.id != null ? String(node.id) : '';
  if (id) return id;
  return isPolish ? '(bez nazwy)' : '(untitled)';
}

function edgeSource(edge: IdeaMapEdgeLike): string | null {
  const v = edge?.source ?? edge?.sourceId;
  return v != null ? String(v) : null;
}

function edgeTarget(edge: IdeaMapEdgeLike): string | null {
  const v = edge?.target ?? edge?.targetId;
  return v != null ? String(v) : null;
}

/**
 * Serialize an idea-map graph into a hierarchical markdown outline.
 * Pure function — no side effects, safe to unit-test.
 */
export function ideaMapToMarkdown(
  input: { nodes?: IdeaMapNodeLike[] | null; edges?: IdeaMapEdgeLike[] | null },
  options: IdeaMapToMarkdownOptions = {}
): string {
  const isPolish = options.isPolish ?? true;
  const maxDepth = Math.max(1, options.maxDepth ?? DEFAULT_MAX_DEPTH);
  const maxBytes = Math.max(512, options.maxBytes ?? DEFAULT_MAX_BYTES);

  const nodes = Array.isArray(input?.nodes) ? input.nodes : [];
  const edges = Array.isArray(input?.edges) ? input.edges : [];

  const title = (options.title || '').trim() || (isPolish ? 'Mapa myśli' : 'Mind map');

  if (nodes.length === 0) {
    return `## ${title}\n\n${isPolish ? '_(mapa jest pusta)_' : '_(the map is empty)_'}`;
  }

  // Index nodes by id (ignore nodes without a usable id for graph traversal,
  // but still surface them as orphans).
  const nodeById = new Map<string, IdeaMapNodeLike>();
  for (const n of nodes) {
    if (n?.id != null) nodeById.set(String(n.id), n);
  }

  // Build adjacency + incoming-degree from edges.
  const childrenOf = new Map<string, string[]>();
  const hasIncoming = new Set<string>();
  for (const e of edges) {
    const src = edgeSource(e);
    const tgt = edgeTarget(e);
    if (src == null || tgt == null) continue;
    if (!nodeById.has(src) || !nodeById.has(tgt)) continue;
    const list = childrenOf.get(src) || [];
    list.push(tgt);
    childrenOf.set(src, list);
    hasIncoming.add(tgt);
  }

  // Roots: nodes with a usable id and no incoming edge. Preserve input order.
  const roots: string[] = [];
  for (const n of nodes) {
    if (n?.id == null) continue;
    const id = String(n.id);
    if (!hasIncoming.has(id)) roots.push(id);
  }

  const lines: string[] = [`## ${title}`, ''];
  const visited = new Set<string>();

  const renderNode = (id: string, depth: number) => {
    const node = nodeById.get(id);
    if (!node) return;
    if (visited.has(id)) return; // cycle / shared child guard
    visited.add(id);

    const indent = '  '.repeat(Math.max(0, depth));
    lines.push(`${indent}- ${nodeLabel(node, isPolish)}`);

    if (depth + 1 >= maxDepth) return;
    const children = childrenOf.get(id) || [];
    for (const childId of children) {
      renderNode(childId, depth + 1);
    }
  };

  for (const rootId of roots) {
    renderNode(rootId, 0);
  }

  // Orphans: nodes never visited (unreachable, or cycle members with no root).
  const orphans = nodes.filter((n) => {
    if (n?.id == null) return true; // no id → could not be traversed
    return !visited.has(String(n.id));
  });

  if (orphans.length > 0) {
    lines.push('');
    lines.push(`### ${isPolish ? 'Pozostałe' : 'Other'}`);
    for (const n of orphans) {
      lines.push(`- ${nodeLabel(n, isPolish)}`);
    }
  }

  let out = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();

  // Soft byte cap — truncate cleanly at a line boundary.
  if (utf8ByteLength(out) > maxBytes) {
    const truncatedMarker = isPolish ? '\n\n_(skrócono…)_' : '\n\n_(truncated…)_';
    const budget = maxBytes - utf8ByteLength(truncatedMarker);
    const outLines = out.split('\n');
    const kept: string[] = [];
    let size = 0;
    for (const line of outLines) {
      const lineSize = utf8ByteLength(line + '\n');
      if (size + lineSize > budget) break;
      kept.push(line);
      size += lineSize;
    }
    out = kept.join('\n').trim() + truncatedMarker;
  }

  return out;
}

export default ideaMapToMarkdown;
