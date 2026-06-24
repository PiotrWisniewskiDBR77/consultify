/**
 * benefitsDependencyNetworkService — Cranfield Benefits Dependency Network (BDN).
 *
 * Czyste funkcje (bez DB, bez I/O) budujące mapę zależności korzyści wg
 * łańcucha Cranfield: enabler → change → benefit → objective.
 *
 * W tej wersji modelujemy uproszczony łańcuch enabler → benefit → objective:
 *  - inicjatywa = enabler (to, co umożliwia zmianę),
 *  - KPI        = benefit (mierzalna korzyść),
 *  - objective  = objective (cel biznesowy).
 *
 * Syntetyczne węzły "change" są opcjonalne i domyślnie pomijane — pełny model
 * Cranfielda zna typ 'change', ale dane wejściowe (inicjatywa↔KPI↔cel) nie
 * niosą informacji o pośrednich zmianach organizacyjnych, więc nie zmyślamy ich.
 */

export type BdnNodeType = 'enabler' | 'change' | 'benefit' | 'objective';

export interface BdnNode {
  id: string;
  type: BdnNodeType;
  label: string;
}

export interface BdnEdge {
  fromId: string;
  toId: string;
}

export interface BdnGraph {
  nodes: BdnNode[];
  edges: BdnEdge[];
}

export interface BuildBdnInput {
  initiatives: Array<{ id: string; name: string }>;
  kpis: Array<{ id: string; name: string }>;
  objectives?: Array<{ id: string; label: string }>;
  initiativeToKpi: Array<{ initiativeId: string; kpiId: string }>;
  kpiToObjective?: Array<{ kpiId: string; objectiveId: string }>;
}

export interface BdnStats {
  nodeCount: number;
  edgeCount: number;
  byType: Record<BdnNodeType, number>;
  /** Benefity (KPI), które nie mają żadnej krawędzi do węzła objective. */
  orphanBenefits: string[];
}

/** Stabilne, deterministyczne prefiksy id węzłów po typie. */
const NODE_PREFIX: Record<BdnNodeType, string> = {
  enabler: 'enabler',
  change: 'change',
  benefit: 'benefit',
  objective: 'objective',
};

function nodeId(type: BdnNodeType, sourceId: string): string {
  return `${NODE_PREFIX[type]}:${sourceId}`;
}

/**
 * Buduje graf BDN z encji M15.
 *
 * Reguły:
 *  - inicjatywa → węzeł typu 'enabler',
 *  - KPI        → węzeł typu 'benefit',
 *  - objective  → węzeł typu 'objective',
 *  - krawędź enabler→benefit dla każdej pary initiativeToKpi,
 *  - krawędź benefit→objective dla każdej pary kpiToObjective.
 *
 * Krawędzie odwołujące się do nieznanych encji są pomijane (graf spójny po id).
 * Krawędzie są deduplikowane.
 */
export function buildBdn(input: BuildBdnInput): BdnGraph {
  const {
    initiatives,
    kpis,
    objectives = [],
    initiativeToKpi,
    kpiToObjective = [],
  } = input;

  const nodes: BdnNode[] = [];
  const knownNodeIds = new Set<string>();

  const addNode = (type: BdnNodeType, sourceId: string, label: string): void => {
    const id = nodeId(type, sourceId);
    if (knownNodeIds.has(id)) return;
    knownNodeIds.add(id);
    nodes.push({ id, type, label });
  };

  for (const initiative of initiatives) {
    addNode('enabler', initiative.id, initiative.name);
  }
  for (const kpi of kpis) {
    addNode('benefit', kpi.id, kpi.name);
  }
  for (const objective of objectives) {
    addNode('objective', objective.id, objective.label);
  }

  const edges: BdnEdge[] = [];
  const seenEdges = new Set<string>();

  const addEdge = (fromId: string, toId: string): void => {
    // Pomijamy krawędzie do/od nieznanych węzłów oraz pętle własne.
    if (!knownNodeIds.has(fromId) || !knownNodeIds.has(toId)) return;
    if (fromId === toId) return;
    const key = `${fromId}->${toId}`;
    if (seenEdges.has(key)) return;
    seenEdges.add(key);
    edges.push({ fromId, toId });
  };

  for (const link of initiativeToKpi) {
    addEdge(nodeId('enabler', link.initiativeId), nodeId('benefit', link.kpiId));
  }
  for (const link of kpiToObjective) {
    addEdge(nodeId('benefit', link.kpiId), nodeId('objective', link.objectiveId));
  }

  return { nodes, edges };
}

/**
 * Zwraca wszystkie ścieżki (jako listy id węzłów) od `fromId` w stronę liści,
 * podążając za krawędziami skierowanymi. Bezpieczne na cykle — żaden węzeł nie
 * pojawia się w danej ścieżce dwa razy, więc rekurencja zawsze się kończy.
 *
 * - Jeśli `fromId` nie istnieje w grafie → [].
 * - Jeśli `fromId` nie ma wychodzących krawędzi → [[fromId]] (sam węzeł jako liść).
 * - Krawędź zamykająca cykl jest pomijana; ścieżka kończy się na ostatnim
 *   nowym węźle.
 */
export function tracePaths(
  nodes: BdnNode[],
  edges: BdnEdge[],
  fromId: string,
): string[][] {
  const nodeIds = new Set(nodes.map((n) => n.id));
  if (!nodeIds.has(fromId)) return [];

  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    if (!nodeIds.has(edge.fromId) || !nodeIds.has(edge.toId)) continue;
    const list = adjacency.get(edge.fromId);
    if (list) list.push(edge.toId);
    else adjacency.set(edge.fromId, [edge.toId]);
  }

  const paths: string[][] = [];

  const walk = (current: string, path: string[], visited: Set<string>): void => {
    // Następniki, które nie zamykają cyklu w bieżącej ścieżce.
    const nexts = (adjacency.get(current) ?? []).filter((next) => !visited.has(next));
    if (nexts.length === 0) {
      // Liść (lub wszystkie wyjścia prowadzą z powrotem w cykl) → koniec ścieżki.
      paths.push([...path]);
      return;
    }
    for (const next of nexts) {
      visited.add(next);
      path.push(next);
      walk(next, path, visited);
      path.pop();
      visited.delete(next);
    }
  };

  walk(fromId, [fromId], new Set([fromId]));
  return paths;
}

/**
 * Statystyki grafu BDN. `orphanBenefits` = id węzłów typu 'benefit', które nie
 * mają żadnej wychodzącej krawędzi do węzła typu 'objective' (korzyść nie jest
 * powiązana z żadnym celem — sygnał luki w łańcuchu wartości).
 */
export function bdnStats(nodes: BdnNode[], edges: BdnEdge[]): BdnStats {
  const byType: Record<BdnNodeType, number> = {
    enabler: 0,
    change: 0,
    benefit: 0,
    objective: 0,
  };

  const nodeById = new Map<string, BdnNode>();
  for (const node of nodes) {
    nodeById.set(node.id, node);
    byType[node.type] += 1;
  }

  // Benefity, które mają krawędź do jakiegoś węzła objective.
  const benefitsWithObjective = new Set<string>();
  for (const edge of edges) {
    const from = nodeById.get(edge.fromId);
    const to = nodeById.get(edge.toId);
    if (from?.type === 'benefit' && to?.type === 'objective') {
      benefitsWithObjective.add(from.id);
    }
  }

  const orphanBenefits = nodes
    .filter((n) => n.type === 'benefit' && !benefitsWithObjective.has(n.id))
    .map((n) => n.id);

  return {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    byType,
    orphanBenefits,
  };
}

export default { buildBdn, tracePaths, bdnStats };
