/**
 * canvasEdgeKindVocabulary — CB-05 (RB-018).
 *
 * Idea Table's Edges view showed `e.data.kind || e.type || 'edge'` verbatim —
 * raw ReactFlow edge type/kind strings, not domain language. Maps the known
 * edge kinds to a PL/EN pair with a localized generic fallback.
 */
const EDGE_KIND_LABELS: Record<string, { pl: string; en: string }> = {
  labeled: { pl: 'Powiązanie', en: 'Connection' },
  flow: { pl: 'Przepływ', en: 'Flow' },
  structural: { pl: 'Struktura', en: 'Structural' },
  hierarchy: { pl: 'Hierarchia', en: 'Hierarchy' },
  dependency: { pl: 'Zależność', en: 'Dependency' },
};

const GENERIC_FALLBACK = { pl: 'Połączenie', en: 'Connection' };

export function getCanvasEdgeKindLabel(kind: string | undefined, isPl: boolean): string {
  const entry = (kind && EDGE_KIND_LABELS[kind]) || GENERIC_FALLBACK;
  return isPl ? entry.pl : entry.en;
}
