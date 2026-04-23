export type LineageNode = {
  readonly id: string;
  readonly lineageRootId: string | null;
  readonly parentArtifactId: string | null;
  readonly derivedFromVersionId: string | null;
  readonly currentVersionId: string;
};

export type LineageGraph = {
  readonly nodes: readonly LineageNode[];
  readonly nodesById: ReadonlyMap<string, LineageNode>;
};

export function buildLineageGraph(nodes: readonly LineageNode[]): LineageGraph {
  const nodesById = new Map<string, LineageNode>();
  for (const node of nodes) {
    nodesById.set(String(node.id), node);
  }
  return { nodes, nodesById };
}

export function assertLineageInvariant(graph: LineageGraph): void {
  if (graph.nodesById.size !== graph.nodes.length) {
    throw new Error('Lineage nodes must be unique by id');
  }
}

