import type { Edge, Node } from 'reactflow';

export interface MindMapTemplate {
  id: string;
  labelPl: string;
  labelEn: string;
  descriptionPl: string;
  descriptionEn: string;
  branches: Array<{ key: string; labelPl: string; labelEn: string }>;
}

function buildTemplateGraph(
  ideaTitle: string,
  branches: Array<{ key: string; labelPl: string; labelEn: string }>,
  isPl: boolean
): { nodes: Node[]; edges: Edge[] } {
  const centerId = 'root';
  const branchRadius = 320;
  const angleStep = (2 * Math.PI) / branches.length;

  const nodes: Node[] = [
    {
      id: centerId,
      type: 'center',
      position: { x: 0, y: 0 },
      data: {
        label: ideaTitle || (isPl ? 'Mój pomysł' : 'My idea'),
        hint: isPl ? 'Kliknij, aby edytować' : 'Click to edit',
      },
      draggable: false,
    } as any,
  ];
  const edges: Edge[] = [];

  branches.forEach((b, i) => {
    const angle = angleStep * i - Math.PI / 2;
    const bx = Math.cos(angle) * branchRadius;
    const by = Math.sin(angle) * branchRadius;
    const branchId = `branch-${b.key}`;

    nodes.push({
      id: branchId,
      type: 'branch',
      position: { x: bx - 50, y: by - 20 },
      data: { label: isPl ? b.labelPl : b.labelEn, branchKey: b.key, count: 0 },
      draggable: false,
    } as any);

    edges.push({
      id: `edge-${centerId}-${branchId}`,
      source: centerId,
      target: branchId,
      type: 'smoothstep',
      animated: true,
      style: { stroke: 'var(--c-tag-8)', strokeWidth: 2.5, opacity: 0.35 },
      data: { system: true, kind: 'frames' },
    } as any);
  });

  return { nodes, edges };
}

export const MIND_MAP_TEMPLATES: MindMapTemplate[] = [
  {
    id: 'default',
    labelPl: 'Domyślna',
    labelEn: 'Default',
    descriptionPl: 'Problem, Cel, Opcje, Dowody, Ryzyka, Eksperymenty',
    descriptionEn: 'Problem, Goal, Options, Evidence, Risks, Experiments',
    branches: [
      { key: 'problem', labelPl: 'Problem', labelEn: 'Problem' },
      { key: 'goal', labelPl: 'Cel / KPI', labelEn: 'Goal / KPI' },
      { key: 'options', labelPl: 'Opcje', labelEn: 'Options' },
      { key: 'evidence', labelPl: 'Dowody', labelEn: 'Evidence' },
      { key: 'risks', labelPl: 'Ryzyka', labelEn: 'Risks' },
      { key: 'experiments', labelPl: 'Eksperymenty', labelEn: 'Experiments' },
    ],
  },
  {
    id: 'swot',
    labelPl: 'Analiza SWOT',
    labelEn: 'SWOT Analysis',
    descriptionPl: 'Mocne strony, Słabe strony, Szanse, Zagrożenia',
    descriptionEn: 'Strengths, Weaknesses, Opportunities, Threats',
    branches: [
      { key: 'strengths', labelPl: 'Mocne strony', labelEn: 'Strengths' },
      { key: 'weaknesses', labelPl: 'Słabe strony', labelEn: 'Weaknesses' },
      { key: 'opportunities', labelPl: 'Szanse', labelEn: 'Opportunities' },
      { key: 'threats', labelPl: 'Zagrożenia', labelEn: 'Threats' },
    ],
  },
  {
    id: 'porter5',
    labelPl: '5 Sił Portera',
    labelEn: "Porter's 5 Forces",
    descriptionPl: 'Rywalizacja, Nowi gracze, Substytuty, Siła nabywców, Siła dostawców',
    descriptionEn: 'Rivalry, New Entrants, Substitutes, Buyer Power, Supplier Power',
    branches: [
      { key: 'rivalry', labelPl: 'Rywalizacja', labelEn: 'Competitive Rivalry' },
      { key: 'new_entrants', labelPl: 'Nowi gracze', labelEn: 'New Entrants' },
      { key: 'substitutes', labelPl: 'Substytuty', labelEn: 'Substitutes' },
      { key: 'buyer_power', labelPl: 'Siła nabywców', labelEn: 'Buyer Power' },
      { key: 'supplier_power', labelPl: 'Siła dostawców', labelEn: 'Supplier Power' },
    ],
  },
  {
    id: 'value_chain',
    labelPl: 'Łańcuch Wartości',
    labelEn: 'Value Chain',
    descriptionPl: 'Logistyka, Operacje, Dystrybucja, Marketing, Serwis, Wsparcie',
    descriptionEn: 'Inbound, Operations, Outbound, Marketing, Service, Support',
    branches: [
      { key: 'inbound', labelPl: 'Logistyka wejściowa', labelEn: 'Inbound Logistics' },
      { key: 'operations', labelPl: 'Operacje', labelEn: 'Operations' },
      { key: 'outbound', labelPl: 'Dystrybucja', labelEn: 'Outbound Logistics' },
      { key: 'marketing', labelPl: 'Marketing i Sprzedaż', labelEn: 'Marketing & Sales' },
      { key: 'service', labelPl: 'Serwis', labelEn: 'Service' },
      { key: 'support', labelPl: 'Infrastruktura wsparcia', labelEn: 'Support Activities' },
    ],
  },
  {
    id: 'mckinsey7s',
    labelPl: 'McKinsey 7S',
    labelEn: 'McKinsey 7S',
    descriptionPl: 'Strategia, Struktura, Systemy, Wartości, Umiejętności, Styl, Kadry',
    descriptionEn: 'Strategy, Structure, Systems, Shared Values, Skills, Style, Staff',
    branches: [
      { key: 'strategy', labelPl: 'Strategia', labelEn: 'Strategy' },
      { key: 'structure', labelPl: 'Struktura', labelEn: 'Structure' },
      { key: 'systems', labelPl: 'Systemy', labelEn: 'Systems' },
      { key: 'shared_values', labelPl: 'Wspólne wartości', labelEn: 'Shared Values' },
      { key: 'skills', labelPl: 'Umiejętności', labelEn: 'Skills' },
      { key: 'style', labelPl: 'Styl zarządzania', labelEn: 'Style' },
      { key: 'staff', labelPl: 'Kadry', labelEn: 'Staff' },
    ],
  },
];

export function buildTemplateForIdea(
  templateId: string,
  ideaTitle: string,
  isPl: boolean
): { nodes: Node[]; edges: Edge[] } | null {
  const tpl = MIND_MAP_TEMPLATES.find((t) => t.id === templateId);
  if (!tpl) return null;
  return buildTemplateGraph(ideaTitle, tpl.branches, isPl);
}
