/**
 * canvasNodeTypeVocabulary — CB-05 (RB-045).
 *
 * The node context menu header used to show `target.nodeType || 'Node'` —
 * raw graph type/semanticType strings (e.g. `shape_rectangle`, `stickyNote`)
 * mixed with a hardcoded English fallback that never localized. This maps
 * every known Whiteboard/Mind Map node type to a domain label and gives the
 * unknown-type fallback a real PL/EN pair instead of the literal word "Node".
 */
const NODE_TYPE_LABELS: Record<string, { pl: string; en: string }> = {
  sticky: { pl: 'Karteczka', en: 'Sticky note' },
  stickyNote: { pl: 'Karteczka', en: 'Sticky note' },
  text: { pl: 'Tekst', en: 'Text' },
  shape_rectangle: { pl: 'Kształt: prostokąt', en: 'Shape: rectangle' },
  shape_circle: { pl: 'Kształt: koło', en: 'Shape: circle' },
  shape_diamond: { pl: 'Kształt: romb', en: 'Shape: diamond' },
  shape_hexagon: { pl: 'Kształt: sześciokąt', en: 'Shape: hexagon' },
  frame: { pl: 'Ramka', en: 'Frame' },
  area: { pl: 'Obszar', en: 'Area' },
  cluster: { pl: 'Klaster', en: 'Cluster' },
  image: { pl: 'Obraz', en: 'Image' },
  link: { pl: 'Link', en: 'Link' },
  group: { pl: 'Grupa', en: 'Group' },
  summary: { pl: 'Podsumowanie', en: 'Summary' },
  table: { pl: 'Tabela', en: 'Table' },
  theme: { pl: 'Temat', en: 'Theme' },
  outcome: { pl: 'Wynik', en: 'Outcome' },
  decision: { pl: 'Decyzja', en: 'Decision' },
  action: { pl: 'Akcja', en: 'Action' },
  icon: { pl: 'Ikona', en: 'Icon' },
  knowledgeCard: { pl: 'Wiedza', en: 'Knowledge' },
  noteCard: { pl: 'Notatka', en: 'Note' },
  evidenceCard: { pl: 'Dowód', en: 'Evidence' },
  kpiBadge: { pl: 'Wskaźnik KPI', en: 'KPI badge' },
  // RB-018 (Idea Table): the table's Type column shows rows from every
  // representation's unified graph, so it also needs Mind Map/Process Flow
  // node types, not just Whiteboard's.
  idea: { pl: 'Pomysł', en: 'Idea' },
  root: { pl: 'Temat główny', en: 'Root topic' },
  default: { pl: 'Gałąź', en: 'Branch' },
  start: { pl: 'Start/Koniec', en: 'Start/End' },
  end: { pl: 'Koniec', en: 'End' },
  lane: { pl: 'Tor', en: 'Lane' },
};

const GENERIC_FALLBACK = { pl: 'Element', en: 'Element' };

export function getCanvasNodeTypeLabel(nodeType: string | undefined, isPl: boolean): string {
  const entry = (nodeType && NODE_TYPE_LABELS[nodeType]) || GENERIC_FALLBACK;
  return isPl ? entry.pl : entry.en;
}
