/**
 * V10-ART-005 — version lineage graph (Wave A seed).
 *
 * Implements R-ARTIFACT-5 from
 * `docs/Chat V9/ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md#v10-art-005`.
 *
 * Scope (Wave A seed)
 * -------------------
 * The `Artifact` schema (V10-ART-001) already carries three lineage
 * fields: `lineageRootId`, `parentArtifactId`, `derivedFromVersionId`.
 * This file promotes those raw fields into a first-class graph with
 * typed ancestor/descendant resolvers and an invariant bundle that
 * asserts DAG consistency.
 *
 * What lands here
 * ---------------
 *   - `LineageNode` — the minimum projection of an Artifact needed to
 *     reason about lineage (id, lineageRootId, parentArtifactId,
 *     derivedFromVersionId, currentVersionId)
 *   - `LineageGraph` — an immutable index over a set of LineageNodes,
 *     built by `buildLineageGraph`
 *   - Resolvers:
 *       resolveLineageRoot(node, graph)        → ArtifactId
 *       getAncestors(node, graph)              → Iterable<LineageNode>
 *       getDescendants(node, graph)            → Iterable<LineageNode>
 *       sharesLineageRoot(a, b, graph)         → boolean
 *   - Invariant bundle (`assertLineageInvariant`):
 *       (i)   every node resolves its lineageRootId to a node in the
 *             graph (or is itself the root)
 *       (ii)  parentArtifactId chain terminates at the lineage root
 *             (no dangling parents, no cycles)
 *       (iii) parentArtifactId !== null ⇒ derivedFromVersionId !== null
 *             ("can't be derived from nothing")
 *       (iv)  root nodes have parentArtifactId === null AND
 *             derivedFromVersionId === null
 *
 * What does NOT land here
 * -----------------------
 *   - Persistence (graph is built in-memory from a store projection;
 *     the store lands at V10-ART-022)
 *   - `transformArtifact(...)` (V10-ART-015) — this file only enforces
 *     the shape that a transform writes
 *   - Comment anchor re-attachment (V10-ART-011) — consumes the graph
 *     via `getAncestors` but implements its own logic
 */

import type { Artifact, ArtifactId, ArtifactVersionId } from './Artifact';

// ---------------------------------------------------------------------------
// §1 — LineageNode (minimum shape the resolvers read).
// ---------------------------------------------------------------------------

/**
 * Minimum projection of an `Artifact` that the lineage resolvers
 * need. A full `Artifact` is assignable to a `LineageNode` (structural
 * subtype), so callers can pass raw artifacts directly. We don't
 * widen the type to the full Artifact here so test fixtures stay
 * small and future non-Artifact lineage carriers (e.g. evidence
 * fragments in V10-ART-009) can reuse this machinery.
 */
export interface LineageNode {
  readonly id: ArtifactId;
  readonly lineageRootId: ArtifactId | null;
  readonly parentArtifactId: ArtifactId | null;
  readonly derivedFromVersionId: ArtifactVersionId | null;
  readonly currentVersionId: ArtifactVersionId;
}

// ---------------------------------------------------------------------------
// §2 — LineageGraph.
// ---------------------------------------------------------------------------

/**
 * Immutable index over a set of LineageNodes. Exposed as an object
 * (rather than a class) so it round-trips through `JSON.parse`
 * without losing methods; all resolvers are free functions that take
 * the graph as a parameter.
 */
export interface LineageGraph {
  readonly nodesById: ReadonlyMap<ArtifactId, LineageNode>;
  /** Children index: parent id → set of direct children ids. */
  readonly childrenByParent: ReadonlyMap<ArtifactId, ReadonlySet<ArtifactId>>;
}

export function buildLineageGraph(nodes: readonly LineageNode[]): LineageGraph {
  const nodesById = new Map<ArtifactId, LineageNode>();
  for (const node of nodes) {
    if (nodesById.has(node.id)) {
      throw new LineageInvariantError(
        `Duplicate node id in lineage graph: ${String(node.id)}`,
      );
    }
    nodesById.set(node.id, node);
  }

  const childrenByParent = new Map<ArtifactId, Set<ArtifactId>>();
  for (const node of nodesById.values()) {
    if (node.parentArtifactId === null) continue;
    const bucket = childrenByParent.get(node.parentArtifactId);
    if (bucket) {
      bucket.add(node.id);
    } else {
      childrenByParent.set(node.parentArtifactId, new Set([node.id]));
    }
  }

  return { nodesById, childrenByParent };
}

// ---------------------------------------------------------------------------
// §3 — Resolvers.
// ---------------------------------------------------------------------------

export function resolveLineageRoot(
  node: LineageNode,
  graph: LineageGraph,
): ArtifactId {
  if (node.lineageRootId !== null) return node.lineageRootId;
  return walkToRootId(node, graph);
}

function walkToRootId(node: LineageNode, graph: LineageGraph): ArtifactId {
  const seen = new Set<ArtifactId>();
  let cursor: LineageNode | undefined = node;
  while (cursor) {
    if (seen.has(cursor.id)) {
      throw new LineageInvariantError(
        `Cycle detected while resolving lineage root at ${String(cursor.id)}`,
      );
    }
    seen.add(cursor.id);
    if (cursor.parentArtifactId === null) return cursor.id;
    cursor = graph.nodesById.get(cursor.parentArtifactId);
  }
  throw new LineageInvariantError('Dangling parent reference while resolving lineage root');
}

/**
 * Walks from the given node up toward the root via `parentArtifactId`.
 * Yields ancestors in order from immediate parent to root. Does NOT
 * include `node` itself.
 */
export function* getAncestors(
  node: LineageNode,
  graph: LineageGraph,
): Iterable<LineageNode> {
  const seen = new Set<ArtifactId>([node.id]);
  let cursor: LineageNode | undefined =
    node.parentArtifactId === null
      ? undefined
      : graph.nodesById.get(node.parentArtifactId);
  while (cursor) {
    if (seen.has(cursor.id)) {
      throw new LineageInvariantError(
        `Cycle detected walking ancestors of ${String(node.id)} at ${String(cursor.id)}`,
      );
    }
    seen.add(cursor.id);
    yield cursor;
    if (cursor.parentArtifactId === null) break;
    cursor = graph.nodesById.get(cursor.parentArtifactId);
  }
}

/**
 * Depth-first walk from `node` downward via the children index.
 * Yields descendants in DFS-pre order. Does NOT include `node` itself.
 */
export function* getDescendants(
  node: LineageNode,
  graph: LineageGraph,
): Iterable<LineageNode> {
  const seen = new Set<ArtifactId>([node.id]);
  const stack: ArtifactId[] = [...(graph.childrenByParent.get(node.id) ?? [])];
  while (stack.length > 0) {
    const nextId = stack.pop()!;
    if (seen.has(nextId)) {
      throw new LineageInvariantError(
        `Cycle detected walking descendants of ${String(node.id)} at ${String(nextId)}`,
      );
    }
    seen.add(nextId);
    const child = graph.nodesById.get(nextId);
    if (!child) continue;
    yield child;
    for (const grandchildId of graph.childrenByParent.get(nextId) ?? []) {
      stack.push(grandchildId);
    }
  }
}

export function sharesLineageRoot(
  a: LineageNode,
  b: LineageNode,
  graph: LineageGraph,
): boolean {
  return resolveLineageRoot(a, graph) === resolveLineageRoot(b, graph);
}

// ---------------------------------------------------------------------------
// §4 — Invariant bundle.
// ---------------------------------------------------------------------------

export class LineageInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LineageInvariantError';
  }
}

/**
 * Asserts the four lineage invariants on the full graph. Throws
 * `LineageInvariantError` on the first violation (so the message
 * points at the offending node). Callers at the ArtifactStore
 * boundary (V10-ART-022) run this after every write.
 */
export function assertLineageInvariant(graph: LineageGraph): void {
  for (const node of graph.nodesById.values()) {
    assertDerivedFromVersionCoherence(node);
    assertRootCoherence(node);
    assertNoSelfCycle(node);
  }

  for (const node of graph.nodesById.values()) {
    assertResolvableParent(node, graph);
  }

  // Cycle detection via root walk — touches every node exactly once.
  for (const node of graph.nodesById.values()) {
    resolveLineageRoot(node, graph);
  }
}

function assertDerivedFromVersionCoherence(node: LineageNode): void {
  if (node.parentArtifactId !== null && node.derivedFromVersionId === null) {
    throw new LineageInvariantError(
      `Node ${String(node.id)} has parentArtifactId but no derivedFromVersionId`,
    );
  }
  if (node.parentArtifactId === null && node.derivedFromVersionId !== null) {
    throw new LineageInvariantError(
      `Node ${String(node.id)} has derivedFromVersionId but no parentArtifactId ("derived from whom?")`,
    );
  }
}

function assertRootCoherence(node: LineageNode): void {
  if (node.parentArtifactId === null && node.lineageRootId !== null && node.lineageRootId !== node.id) {
    throw new LineageInvariantError(
      `Root node ${String(node.id)} declares lineageRootId=${String(node.lineageRootId)} (must be null or self)`,
    );
  }
}

function assertNoSelfCycle(node: LineageNode): void {
  if (node.parentArtifactId !== null && node.parentArtifactId === node.id) {
    throw new LineageInvariantError(`Node ${String(node.id)} is its own parent`);
  }
}

function assertResolvableParent(node: LineageNode, graph: LineageGraph): void {
  if (node.parentArtifactId !== null && !graph.nodesById.has(node.parentArtifactId)) {
    throw new LineageInvariantError(
      `Node ${String(node.id)} has dangling parentArtifactId=${String(node.parentArtifactId)}`,
    );
  }
  if (node.lineageRootId !== null && !graph.nodesById.has(node.lineageRootId) && node.lineageRootId !== node.id) {
    throw new LineageInvariantError(
      `Node ${String(node.id)} has dangling lineageRootId=${String(node.lineageRootId)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// §5 — Adapter for Artifact ↔ LineageNode (test + store conveniences).
// ---------------------------------------------------------------------------

export function artifactToLineageNode(artifact: Artifact): LineageNode {
  return {
    id: artifact.id,
    lineageRootId: artifact.lineageRootId,
    parentArtifactId: artifact.parentArtifactId,
    derivedFromVersionId: artifact.derivedFromVersionId,
    currentVersionId: artifact.currentVersionId,
  };
}
