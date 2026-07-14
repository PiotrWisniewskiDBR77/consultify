/**
 * ideaConsultingTemplates — #10-AB baza ~40 startowych szablonów konsultingowych.
 *
 * Treść McKinsey/BCG-grade: każdy szablon = użyteczny punkt startu z realnym
 * seedem frameworka (węzły / kolumny / sekcje), nie placeholder. Nazwy PL+EN,
 * opis "po co i kiedy", seed z podpowiedziami (sticky/prompt) tam gdzie pomaga.
 *
 * Reużywa DOKŁADNIE schemat `TemplateDefinition` z IdeaTemplateGallery — te same
 * pola nodes/edges/extensions co legacy szablony canvas. Nowe pole `catalogGroup`
 * (opcjonalne, additive) nadaje 7 kategorii biznesowych zatwierdzonych przez Piotra:
 *   strategy · operations · finance · digital · people · growth · pmo
 *
 * Seed per typ canvas:
 *   whiteboard → frameNode (ramki/kwadranty) + stickyNote (podpowiedzi/prompt)
 *   mindmap    → root/branch/leaf + edges
 *   process_flow → flowNode (shape start/action/decision/end) + lanes w extensions
 *   table      → nodes(rows, type:'idea', data=cell values) + extensions.table.columns
 */
import {
  Anchor,
  Bot,
  Boxes,
  Calculator,
  ClipboardList,
  Coins,
  Compass,
  Cpu,
  Database,
  DollarSign,
  Flag,
  Gauge,
  GitBranch,
  Grid3x3,
  Handshake,
  LayoutGrid,
  LineChart,
  Map as MapIcon,
  MessageSquare,
  Milestone,
  Network,
  Route,
  ShieldAlert,
  Table2,
  Tag,
  Target,
  TrendingUp,
  UserCog,
  Users,
  Waypoints,
  Workflow,
} from 'lucide-react';

import type { TemplateDefinition } from './IdeaTemplateGallery';

// ── 7 kategorii biznesowych (catalogGroup) + etykiety do galerii-akcept ───────
export type ConsultingCategory =
  | 'strategy'
  | 'operations'
  | 'finance'
  | 'digital'
  | 'people'
  | 'growth'
  | 'pmo';

export const CONSULTING_CATEGORY_LABELS: Record<ConsultingCategory, { pl: string; en: string }> = {
  strategy: { pl: 'Strategia', en: 'Strategy' },
  operations: { pl: 'Operacje / Lean', en: 'Operations / Lean' },
  finance: { pl: 'Finanse', en: 'Finance' },
  digital: { pl: 'Cyfryzacja / AI', en: 'Digital / AI' },
  people: { pl: 'Ludzie / Zmiana', en: 'People / Change' },
  growth: { pl: 'Klient / Wzrost', en: 'Customer / Growth' },
  pmo: { pl: 'PMO', en: 'PMO' },
};

export const CONSULTING_CATEGORY_ORDER: ConsultingCategory[] = [
  'strategy',
  'operations',
  'finance',
  'digital',
  'people',
  'growth',
  'pmo',
];

// Mapowanie 7 kategorii → gruba governance.category (istniejący union w kontrakcie).
const GOV_CATEGORY: Record<
  ConsultingCategory,
  'strategy' | 'process' | 'org' | 'workshop' | 'system'
> = {
  strategy: 'strategy',
  operations: 'process',
  finance: 'strategy',
  digital: 'system',
  people: 'org',
  growth: 'strategy',
  pmo: 'workshop',
};

// Paleta tła ramek (spójna z legacy whiteboard) ------------------------------
const BG = {
  blue: 'rgba(219,234,254,0.45)',
  green: 'rgba(209,250,229,0.45)',
  amber: 'rgba(254,243,199,0.45)',
  pink: 'rgba(252,231,243,0.45)',
  violet: 'rgba(237,233,254,0.45)',
  cyan: 'rgba(207,250,254,0.45)',
  red: 'rgba(254,226,226,0.45)',
  slate: 'rgba(241,245,249,0.45)',
} as const;

const LANE = {
  blue: '#dbeafe',
  green: '#d1fae5',
  amber: '#fef3c7',
  pink: '#fce7f3',
  violet: '#ede9fe',
  cyan: '#cffafe',
  indigo: '#e0e7ff',
} as const;

// ── Buildery (DRY, ograniczają literówki) ────────────────────────────────────
type AnyNode = Record<string, unknown>;

const frame = (
  id: string,
  label: string,
  x: number,
  y: number,
  w: number,
  h: number,
  bgColor?: string
): AnyNode => ({
  id,
  type: 'frameNode',
  position: { x, y },
  data: { label, width: w, height: h, ...(bgColor ? { bgColor } : {}) },
});

const sticky = (
  id: string,
  label: string,
  x: number,
  y: number,
  semanticLabel?: string
): AnyNode => ({
  id,
  type: 'stickyNote',
  position: { x, y },
  data: { label, ...(semanticLabel ? { semanticLabel } : {}) },
});

const mroot = (label: string, x = 460, y = 320): AnyNode => ({
  id: 'root',
  type: 'root',
  position: { x, y },
  data: { label, branchKey: 'root' },
});

const mbranch = (id: string, label: string, x: number, y: number, key: string): AnyNode => ({
  id,
  type: 'branch',
  position: { x, y },
  data: { label, branchKey: key },
});

const mleaf = (id: string, label: string, x: number, y: number, key: string): AnyNode => ({
  id,
  type: 'leaf',
  position: { x, y },
  data: { label, branchKey: key },
});

const medge = (source: string, target: string): AnyNode => ({
  id: `e-${source}-${target}`,
  source,
  target,
});

const pf = (
  id: string,
  label: string,
  x: number,
  y: number,
  shape: 'start' | 'action' | 'decision' | 'end',
  laneId: string,
  laneColor: string
): AnyNode => ({
  id,
  type: 'flowNode',
  position: { x, y },
  data: { label, shape, laneId, laneColor },
});

const pfe = (
  source: string,
  target: string,
  label?: string,
  cond?: 'yes' | 'no' | 'default'
): AnyNode => ({
  id: `e-${source}-${target}`,
  source,
  target,
  type: 'flowEdge',
  ...(label ? { label } : {}),
  ...(cond ? { data: { conditionType: cond } } : {}),
});

interface ColumnSeed {
  key: string;
  header: string;
  type?: string;
  width?: number;
  options?: string[];
  optionColors?: Record<string, string>;
}
const col = (
  key: string,
  header: string,
  type: string = 'text',
  extra: Partial<ColumnSeed> = {}
): AnyNode => ({ key, header, type, visible: true, width: extra.width ?? 160, ...extra });

// row: node-wiersz tabeli (type 'idea'); data = wartości komórek + label (primary)
const row = (id: string, cells: Record<string, unknown>, primaryKey: string): AnyNode => ({
  id,
  type: 'idea',
  data: { ...cells, label: cells[primaryKey] ?? '' },
});

interface Meta {
  id: string;
  nameEn: string;
  namePl: string;
  descEn: string;
  descPl: string;
  icon: TemplateDefinition['icon'];
  group: ConsultingCategory;
}

const wb = (m: Meta, nodes: AnyNode[], edges: AnyNode[] = []): TemplateDefinition =>
  make(m, 'whiteboard', nodes, edges, {});

const mm = (m: Meta, nodes: AnyNode[], edges: AnyNode[]): TemplateDefinition =>
  make(m, 'mindmap', nodes, edges, {});

const flow = (
  m: Meta,
  nodes: AnyNode[],
  edges: AnyNode[],
  lanes: { id: string; label: string; color: string }[]
): TemplateDefinition => make(m, 'process_flow', nodes, edges, { processFlow: { lanes } });

const table = (m: Meta, columns: AnyNode[], rows: AnyNode[]): TemplateDefinition =>
  make(m, 'table', rows, [], { table: { columns } });

function make(
  m: Meta,
  tool: TemplateDefinition['tool'],
  nodes: AnyNode[],
  edges: AnyNode[],
  extensions: Record<string, unknown>
): TemplateDefinition {
  return {
    id: m.id,
    nameEn: m.nameEn,
    namePl: m.namePl,
    descEn: m.descEn,
    descPl: m.descPl,
    icon: m.icon,
    tool,
    nodes,
    edges,
    extensions,
    catalogGroup: m.group,
    governance: {
      category: GOV_CATEGORY[m.group],
      library: 'core',
      version: '1.0.0',
      scope: 'global',
      capability: 'real',
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. STRATEGIA (8)
// ═══════════════════════════════════════════════════════════════════════════
const STRATEGY: TemplateDefinition[] = [
  // 1.1 Business Model Canvas (Osterwalder) — 9 bloków
  wb(
    {
      id: 'cx-bmc',
      nameEn: 'Business Model Canvas',
      namePl: 'Business Model Canvas',
      descEn:
        '9 building blocks of a business model — use to design or challenge how the company creates, delivers and captures value.',
      descPl:
        '9 bloków modelu biznesowego — użyj do zaprojektowania lub podważenia jak firma tworzy, dostarcza i przechwytuje wartość.',
      icon: LayoutGrid,
      group: 'strategy',
    },
    [
      frame('kp', 'Key Partners', 0, 0, 210, 320, BG.blue),
      sticky('kp-h', 'Kto? Dostawcy, alianse, kluczowi partnerzy i motyw współpracy.', 12, 44),
      frame('ka', 'Key Activities', 220, 0, 210, 155, BG.blue),
      sticky('ka-h', 'Co musimy robić najlepiej? Produkcja, platforma, rozwój.', 232, 44),
      frame('kr', 'Key Resources', 220, 165, 210, 155, BG.blue),
      sticky('kr-h', 'Aktywa: ludzie, IP, technologia, kapitał, marka.', 232, 209),
      frame('vp', 'Value Propositions', 440, 0, 220, 320, BG.violet),
      sticky('vp-h', 'Jaki ból rozwiązujemy / jaki zysk dajemy? Dlaczego my.', 452, 44),
      frame('cr', 'Customer Relationships', 670, 0, 210, 155, BG.green),
      sticky('cr-h', 'Self-service, dedykowany opiekun, społeczność, automatyzacja.', 682, 44),
      frame('ch', 'Channels', 670, 165, 210, 155, BG.green),
      sticky('ch-h', 'Jak docieramy i dostarczamy? Świadomość → zakup → obsługa.', 682, 209),
      frame('cseg', 'Customer Segments', 890, 0, 210, 320, BG.amber),
      sticky('cs-h', 'Dla kogo? Segmenty, persona, rynek masowy vs nisza.', 902, 44),
      frame('cost', 'Cost Structure', 0, 330, 540, 150, BG.pink),
      sticky('cost-h', 'Największe koszty; stałe vs zmienne; cost- vs value-driven.', 12, 374),
      frame('rev', 'Revenue Streams', 560, 330, 540, 150, BG.green),
      sticky('rev-h', 'Za co i jak płacą? Modele: subskrypcja, transakcja, licencja.', 572, 374),
    ]
  ),
  // 1.2 SWOT
  wb(
    {
      id: 'cx-swot',
      nameEn: 'SWOT Analysis',
      namePl: 'Analiza SWOT',
      descEn:
        'Strengths, Weaknesses (internal) vs Opportunities, Threats (external) — a fast situational baseline before strategy choices.',
      descPl:
        'Mocne i słabe strony (wewnętrzne) vs Szanse i Zagrożenia (zewnętrzne) — szybka baza sytuacyjna przed wyborami strategicznymi.',
      icon: Grid3x3,
      group: 'strategy',
    },
    [
      frame('s', 'Strengths (internal +)', 0, 0, 360, 260, BG.green),
      sticky('s-h', 'Przewagi: co robimy lepiej, unikalne aktywa, kompetencje.', 14, 46),
      frame('w', 'Weaknesses (internal −)', 380, 0, 360, 260, BG.amber),
      sticky('w-h', 'Luki: braki, długi technologiczne, koszty, zależności.', 394, 46),
      frame('o', 'Opportunities (external +)', 0, 280, 360, 260, BG.blue),
      sticky('o-h', 'Trendy, nowe segmenty, deregulacja, technologia, partnerstwa.', 14, 326),
      frame('t', 'Threats (external −)', 380, 280, 360, 260, BG.pink),
      sticky('t-h', 'Konkurencja, substytuty, regulacje, ryzyka rynkowe.', 394, 326),
    ]
  ),
  // 1.3 Porter 5 Forces
  wb(
    {
      id: 'cx-porter5',
      nameEn: "Porter's Five Forces",
      namePl: '5 Sił Portera',
      descEn:
        'Assess industry attractiveness through five competitive forces — use to judge profit potential and positioning.',
      descPl:
        'Oceń atrakcyjność branży przez pięć sił konkurencyjnych — użyj do oceny potencjału zysku i pozycjonowania.',
      icon: Compass,
      group: 'strategy',
    },
    [
      frame('rivalry', 'Competitive Rivalry (core)', 380, 200, 300, 160, BG.violet),
      sticky(
        'rivalry-h',
        'Liczba i siła rywali, tempo wzrostu, różnicowanie, bariery wyjścia.',
        394,
        246
      ),
      frame('entrants', 'Threat of New Entrants', 380, 0, 300, 150, BG.blue),
      sticky('entrants-h', 'Bariery wejścia: kapitał, skala, marka, dostęp do kanałów.', 394, 44),
      frame('suppliers', 'Supplier Power', 0, 200, 320, 160, BG.amber),
      sticky('sup-h', 'Koncentracja dostawców, koszty zmiany, unikalność wsadu.', 14, 246),
      frame('buyers', 'Buyer Power', 740, 200, 320, 160, BG.green),
      sticky('buy-h', 'Wrażliwość cenowa, koncentracja nabywców, koszt zmiany.', 754, 246),
      frame('subs', 'Threat of Substitutes', 380, 400, 300, 150, BG.pink),
      sticky(
        'subs-h',
        'Alternatywy zaspokajające tę samą potrzebę; relacja cena/wartość.',
        394,
        444
      ),
    ]
  ),
  // 1.4 Blue Ocean ERRC grid
  wb(
    {
      id: 'cx-blueocean',
      nameEn: 'Blue Ocean — ERRC Grid',
      namePl: 'Blue Ocean — Siatka ERRC',
      descEn:
        'Eliminate-Reduce-Raise-Create grid to break the value/cost trade-off and open uncontested market space.',
      descPl:
        'Siatka Wyeliminuj-Ogranicz-Podnieś-Stwórz — przełam kompromis wartość/koszt i otwórz nową przestrzeń rynkową.',
      icon: Waypoints,
      group: 'strategy',
    },
    [
      frame('elim', 'Eliminate', 0, 0, 360, 240, BG.red),
      sticky('elim-h', 'Które czynniki oczywiste dla branży całkowicie usunąć?', 14, 46),
      frame('reduce', 'Reduce (below standard)', 380, 0, 360, 240, BG.amber),
      sticky('reduce-h', 'Co obniżyć poniżej standardu branżowego (przeinwestowane)?', 394, 46),
      frame('raise', 'Raise (above standard)', 0, 260, 360, 240, BG.blue),
      sticky('raise-h', 'Co podnieść znacznie powyżej standardu branży?', 14, 306),
      frame('create', 'Create (new)', 380, 260, 360, 240, BG.green),
      sticky(
        'create-h',
        'Jakie nowe czynniki stworzyć, których branża nigdy nie oferowała?',
        394,
        306
      ),
    ]
  ),
  // 1.5 Ansoff Matrix 2x2
  wb(
    {
      id: 'cx-ansoff',
      nameEn: 'Ansoff Growth Matrix',
      namePl: 'Macierz wzrostu Ansoffa',
      descEn:
        'Products × Markets 2×2 (Penetration, Development, New Products, Diversification) — frame growth options by risk.',
      descPl:
        'Produkty × Rynki 2×2 (Penetracja, Rozwój rynku, Nowe produkty, Dywersyfikacja) — uporządkuj opcje wzrostu wg ryzyka.',
      icon: TrendingUp,
      group: 'strategy',
    },
    [
      frame('pen', 'Market Penetration (existing × existing)', 0, 0, 380, 230, BG.green),
      sticky('pen-h', 'Najniższe ryzyko: więcej udziału, częstotliwość, up/cross-sell.', 14, 46),
      frame('prod', 'Product Development (new prod × existing mkt)', 400, 0, 380, 230, BG.amber),
      sticky('prod-h', 'Nowe produkty dla obecnych klientów; innowacja, warianty.', 414, 46),
      frame('mkt', 'Market Development (existing prod × new mkt)', 0, 250, 380, 230, BG.blue),
      sticky('mkt-h', 'Nowe geografie/segmenty/kanały dla obecnego produktu.', 14, 296),
      frame('div', 'Diversification (new × new)', 400, 250, 380, 230, BG.pink),
      sticky('div-h', 'Najwyższe ryzyko: nowy produkt na nowym rynku; M&A, greenfield.', 414, 296),
    ]
  ),
  // 1.6 PESTEL (mindmap 6 branch)
  mm(
    {
      id: 'cx-pestel',
      nameEn: 'PESTEL Scan',
      namePl: 'Skan PESTEL',
      descEn:
        'Macro-environment scan — Political, Economic, Social, Technological, Environmental, Legal drivers shaping the market.',
      descPl:
        'Skan makrootoczenia — czynniki Polityczne, Ekonomiczne, Społeczne, Technologiczne, Środowiskowe, Prawne kształtujące rynek.',
      icon: Network,
      group: 'strategy',
    },
    [
      mroot('PESTEL', 460, 320),
      mbranch('b-p', 'Political — regulacje, polityka, stabilność', 180, 120, 'political'),
      mbranch('b-e', 'Economic — wzrost, inflacja, kursy, stopy', 740, 120, 'economic'),
      mbranch('b-s', 'Social — demografia, styl życia, wartości', 120, 320, 'social'),
      mbranch('b-t', 'Technological — innowacje, automatyzacja, AI', 800, 320, 'technological'),
      mbranch('b-env', 'Environmental — klimat, ESG, zasoby', 180, 520, 'environmental'),
      mbranch('b-l', 'Legal — prawo pracy, ochrona danych, compliance', 740, 520, 'legal'),
    ],
    [
      medge('root', 'b-p'),
      medge('root', 'b-e'),
      medge('root', 'b-s'),
      medge('root', 'b-t'),
      medge('root', 'b-env'),
      medge('root', 'b-l'),
    ]
  ),
  // 1.7 Value Proposition Canvas
  wb(
    {
      id: 'cx-vpc',
      nameEn: 'Value Proposition Canvas',
      namePl: 'Value Proposition Canvas',
      descEn:
        'Fit between customer profile (jobs, pains, gains) and the value map (products, pain relievers, gain creators).',
      descPl:
        'Dopasowanie profilu klienta (zadania, bóle, zyski) do mapy wartości (produkty, uśmierzacze bólu, generatory zysków).',
      icon: Target,
      group: 'strategy',
    },
    [
      frame('vp-map', 'VALUE MAP', 0, 0, 430, 470, BG.violet),
      frame('vp-prod', 'Products & Services', 20, 44, 390, 120),
      sticky('vp-prod-h', 'Co oferujemy, wokół czego budujemy wartość.', 32, 80),
      frame('vp-pain', 'Pain Relievers', 20, 174, 390, 130),
      sticky('vp-pain-h', 'Jak eliminujemy konkretne bóle klienta.', 32, 210),
      frame('vp-gain', 'Gain Creators', 20, 314, 390, 130),
      sticky('vp-gain-h', 'Jak tworzymy oczekiwane i nieoczekiwane korzyści.', 32, 350),
      frame('cp-profile', 'CUSTOMER PROFILE', 460, 0, 430, 470, BG.amber),
      frame('cp-jobs', 'Customer Jobs', 480, 44, 390, 120),
      sticky('cp-jobs-h', 'Zadania funkcjonalne, społeczne, emocjonalne klienta.', 492, 80),
      frame('cp-pains', 'Pains', 480, 174, 390, 130),
      sticky('cp-pains-h', 'Frustracje, ryzyka, przeszkody, koszty niechciane.', 492, 210),
      frame('cp-gains', 'Gains', 480, 314, 390, 130),
      sticky('cp-gains-h', 'Rezultaty i korzyści, których klient pragnie.', 492, 350),
    ]
  ),
  // 1.8 Strategic Roadmap (Now/Next/Later horizons) — process_flow lanes
  flow(
    {
      id: 'cx-strategic-roadmap',
      nameEn: 'Strategic Roadmap (Horizons)',
      namePl: 'Roadmapa strategiczna (Horyzonty)',
      descEn:
        'Now / Next / Later horizons sequencing strategic bets from core optimization to future options.',
      descPl:
        'Horyzonty Teraz / Dalej / Później — sekwencja strategicznych zakładów od optymalizacji rdzenia po opcje przyszłości.',
      icon: Route,
      group: 'strategy',
    },
    [
      pf('h1-a', 'Horizon 1: obroń i rozwiń rdzeń', 60, 60, 'start', 'lane-now', LANE.green),
      pf('h1-b', 'Quick wins & efektywność', 320, 60, 'action', 'lane-now', LANE.green),
      pf(
        'h2-a',
        'Horizon 2: skaluj nowe silniki wzrostu',
        320,
        220,
        'action',
        'lane-next',
        LANE.amber
      ),
      pf('h2-b', 'Nowe segmenty / oferty', 600, 220, 'action', 'lane-next', LANE.amber),
      pf(
        'h3-a',
        'Horizon 3: zasiej opcje przyszłości',
        600,
        380,
        'action',
        'lane-later',
        LANE.blue
      ),
      pf('h3-b', 'Wizja docelowa', 880, 380, 'end', 'lane-later', LANE.blue),
    ],
    [
      pfe('h1-a', 'h1-b'),
      pfe('h1-b', 'h2-a'),
      pfe('h2-a', 'h2-b'),
      pfe('h2-b', 'h3-a'),
      pfe('h3-a', 'h3-b'),
    ],
    [
      { id: 'lane-now', label: 'Now (0–6 mies.)', color: LANE.green },
      { id: 'lane-next', label: 'Next (6–18 mies.)', color: LANE.amber },
      { id: 'lane-later', label: 'Later (18+ mies.)', color: LANE.blue },
    ]
  ),
];

// ═══════════════════════════════════════════════════════════════════════════
// 2. OPERACJE / LEAN (7)
// ═══════════════════════════════════════════════════════════════════════════
const OPERATIONS: TemplateDefinition[] = [
  // 2.1 Value Stream Mapping
  flow(
    {
      id: 'cx-vsm',
      nameEn: 'Value Stream Mapping',
      namePl: 'Value Stream Mapping (VSM)',
      descEn:
        'End-to-end material & information flow with process boxes and lead/cycle times — expose waste and improvement targets.',
      descPl:
        'Przepływ materiału i informacji end-to-end z boksami procesów i czasami — obnaża marnotrawstwo i cele usprawnień.',
      icon: Workflow,
      group: 'operations',
    },
    [
      pf('vsm-sup', 'Supplier', 40, 60, 'start', 'lane-flow', LANE.blue),
      pf('vsm-p1', 'Process 1\nC/T · C/O · uptime', 240, 60, 'action', 'lane-flow', LANE.blue),
      pf('vsm-i1', 'Inventory (WIP)', 460, 60, 'decision', 'lane-flow', LANE.amber),
      pf('vsm-p2', 'Process 2\nC/T · C/O · uptime', 660, 60, 'action', 'lane-flow', LANE.blue),
      pf('vsm-p3', 'Process 3\nC/T · C/O · uptime', 880, 60, 'action', 'lane-flow', LANE.blue),
      pf('vsm-cust', 'Customer', 1100, 60, 'end', 'lane-flow', LANE.green),
      pf(
        'vsm-tl',
        'Timeline: lead time vs value-added time',
        240,
        240,
        'action',
        'lane-time',
        LANE.pink
      ),
    ],
    [
      pfe('vsm-sup', 'vsm-p1'),
      pfe('vsm-p1', 'vsm-i1'),
      pfe('vsm-i1', 'vsm-p2'),
      pfe('vsm-p2', 'vsm-p3'),
      pfe('vsm-p3', 'vsm-cust'),
    ],
    [
      { id: 'lane-flow', label: 'Value stream', color: LANE.blue },
      { id: 'lane-time', label: 'Lead / cycle time', color: LANE.pink },
    ]
  ),
  // 2.2 SIPOC
  wb(
    {
      id: 'cx-sipoc',
      nameEn: 'SIPOC Diagram',
      namePl: 'Diagram SIPOC',
      descEn:
        'Suppliers-Inputs-Process-Outputs-Customers — high-level scope of a process before a deep dive (Six Sigma Define).',
      descPl:
        'Dostawcy-Wejścia-Proces-Wyjścia-Klienci — wysokopoziomowy zakres procesu przed analizą (faza Define w Six Sigma).',
      icon: Boxes,
      group: 'operations',
    },
    [
      frame('sip-s', 'Suppliers', 0, 0, 210, 420, BG.blue),
      sticky('sip-s-h', 'Kto dostarcza wejścia do procesu?', 12, 44),
      frame('sip-i', 'Inputs', 220, 0, 210, 420, BG.cyan),
      sticky('sip-i-h', 'Materiały, dane, zasoby wchodzące.', 232, 44),
      frame('sip-p', 'Process (5–7 kroków)', 440, 0, 210, 420, BG.violet),
      sticky('sip-p-h', 'Start → …5–7 kroków… → koniec (wysokopoziomowo).', 452, 44),
      frame('sip-o', 'Outputs', 660, 0, 210, 420, BG.amber),
      sticky('sip-o-h', 'Produkty/rezultaty wychodzące z procesu.', 672, 44),
      frame('sip-c', 'Customers', 880, 0, 210, 420, BG.green),
      sticky('sip-c-h', 'Kto odbiera wyjścia? Wewnętrzni i zewnętrzni.', 892, 44),
    ]
  ),
  // 2.3 Root Cause: Ishikawa + 5 Why (mindmap fishbone)
  mm(
    {
      id: 'cx-rootcause',
      nameEn: 'Root Cause — Ishikawa + 5 Whys',
      namePl: 'Analiza przyczyn — Ishikawa + 5 Dlaczego',
      descEn:
        'Fishbone 6M categories with a 5-Whys drill on the leading cause — move from symptom to true root cause.',
      descPl:
        'Diagram Ishikawy (6M) z pogłębieniem 5×Dlaczego na wiodącej przyczynie — od objawu do prawdziwej przyczyny źródłowej.',
      icon: GitBranch,
      group: 'operations',
    },
    [
      mroot('Problem / Effect', 820, 320),
      mbranch('c-man', 'Man (ludzie / kompetencje)', 220, 120, 'man'),
      mbranch('c-machine', 'Machine (maszyny / systemy)', 520, 120, 'machine'),
      mbranch('c-material', 'Material (materiały / dane)', 820, 120, 'material'),
      mbranch('c-method', 'Method (proces / procedura)', 220, 520, 'method'),
      mbranch('c-measure', 'Measurement (pomiar / KPI)', 520, 520, 'measurement'),
      mbranch('c-env', 'Environment (otoczenie)', 820, 520, 'environment'),
      mleaf('why1', 'Why 1?', 1080, 220, 'why'),
      mleaf('why2', 'Why 2?', 1080, 300, 'why'),
      mleaf('why3', 'Why 3?', 1080, 380, 'why'),
      mleaf('why4', 'Why 4?', 1080, 460, 'why'),
      mleaf('why5', 'Root cause', 1080, 540, 'why'),
    ],
    [
      medge('c-man', 'root'),
      medge('c-machine', 'root'),
      medge('c-material', 'root'),
      medge('c-method', 'root'),
      medge('c-measure', 'root'),
      medge('c-env', 'root'),
      medge('root', 'why1'),
      medge('why1', 'why2'),
      medge('why2', 'why3'),
      medge('why3', 'why4'),
      medge('why4', 'why5'),
    ]
  ),
  // 2.4 RACI (table)
  table(
    {
      id: 'cx-raci',
      nameEn: 'RACI Matrix',
      namePl: 'Macierz RACI',
      descEn:
        'Tasks × roles with R/A/C/I — remove ownership ambiguity (exactly one Accountable per row).',
      descPl:
        'Zadania × role z R/A/C/I — usuwa niejasność odpowiedzialności (dokładnie jedno A na wiersz).',
      icon: Users,
      group: 'operations',
    },
    [
      col('label', 'Zadanie / Deliverable', 'text', { width: 260 }),
      col('sponsor', 'Sponsor', 'select', { width: 100, options: ['R', 'A', 'C', 'I'] }),
      col('pm', 'PM', 'select', { width: 100, options: ['R', 'A', 'C', 'I'] }),
      col('lead', 'Team Lead', 'select', { width: 100, options: ['R', 'A', 'C', 'I'] }),
      col('member', 'Członek zespołu', 'select', { width: 120, options: ['R', 'A', 'C', 'I'] }),
      col('stakeholder', 'Interesariusz', 'select', { width: 120, options: ['R', 'A', 'C', 'I'] }),
    ],
    [
      row(
        'r1',
        {
          label: 'Zdefiniuj zakres i cele',
          sponsor: 'A',
          pm: 'R',
          lead: 'C',
          member: 'I',
          stakeholder: 'C',
        },
        'label'
      ),
      row(
        'r2',
        {
          label: 'Zaplanuj harmonogram i budżet',
          sponsor: 'A',
          pm: 'R',
          lead: 'C',
          member: 'I',
          stakeholder: 'I',
        },
        'label'
      ),
      row(
        'r3',
        {
          label: 'Zrealizuj kluczowe zadania',
          sponsor: 'I',
          pm: 'A',
          lead: 'R',
          member: 'R',
          stakeholder: 'I',
        },
        'label'
      ),
      row(
        'r4',
        {
          label: 'Kontrola jakości / odbiór',
          sponsor: 'A',
          pm: 'R',
          lead: 'C',
          member: 'I',
          stakeholder: 'C',
        },
        'label'
      ),
      row(
        'r5',
        {
          label: 'Komunikacja statusu',
          sponsor: 'I',
          pm: 'R',
          lead: 'C',
          member: 'I',
          stakeholder: 'A',
        },
        'label'
      ),
    ]
  ),
  // 2.5 Kaizen board (whiteboard)
  wb(
    {
      id: 'cx-kaizen',
      nameEn: 'Kaizen Improvement Board',
      namePl: 'Tablica Kaizen',
      descEn:
        'Continuous-improvement board (Ideas → To Try → Doing → Done) with a PDCA lane — capture and run small experiments.',
      descPl:
        'Tablica ciągłego doskonalenia (Pomysły → Do przetestowania → W toku → Zrobione) z pasem PDCA — łap i realizuj małe eksperymenty.',
      icon: Gauge,
      group: 'operations',
    },
    [
      frame('kz-ideas', 'Improvement Ideas', 0, 0, 260, 380, BG.slate),
      sticky('kz-ideas-h', 'Zgłoszone usprawnienia — źródło: gemba, dane, zespół.', 12, 44),
      frame('kz-try', 'To Try (hypothesis)', 280, 0, 260, 380, BG.blue),
      sticky('kz-try-h', 'Hipoteza: jeśli zmienimy X, to Y poprawi się o Z.', 292, 44),
      frame('kz-doing', 'Doing (PDCA)', 560, 0, 260, 380, BG.amber),
      sticky('kz-doing-h', 'Plan-Do-Check-Act w toku; mierz baseline vs efekt.', 572, 44),
      frame('kz-done', 'Done & Standardized', 840, 0, 260, 380, BG.green),
      sticky('kz-done-h', 'Zadopcja jako standard; SOP zaktualizowany.', 852, 44),
    ]
  ),
  // 2.6 Capacity Plan (table)
  table(
    {
      id: 'cx-capacity',
      nameEn: 'Capacity Plan',
      namePl: 'Plan zdolności (Capacity)',
      descEn:
        'Resource demand vs available capacity with the gap — surface over/under-utilization before it bites.',
      descPl:
        'Zapotrzebowanie vs dostępna zdolność z luką — pokazuje prze/niedociążenie zanim uderzy.',
      icon: Gauge,
      group: 'operations',
    },
    [
      col('label', 'Zasób / Zespół', 'text', { width: 200 }),
      col('demand', 'Zapotrzebowanie (FTE/h)', 'number', { width: 170 }),
      col('capacity', 'Dostępna zdolność', 'number', { width: 160 }),
      col('util', 'Wykorzystanie %', 'number', { width: 140 }),
      col('gap', 'Luka (+/−)', 'number', { width: 120 }),
      col('action', 'Działanie', 'text', { width: 220 }),
    ],
    [
      row(
        'c1',
        {
          label: 'Zespół A',
          demand: 120,
          capacity: 100,
          util: 120,
          gap: -20,
          action: 'Rekrutacja / outsourcing',
        },
        'label'
      ),
      row(
        'c2',
        {
          label: 'Zespół B',
          demand: 80,
          capacity: 100,
          util: 80,
          gap: 20,
          action: 'Realokacja do A',
        },
        'label'
      ),
      row(
        'c3',
        {
          label: 'Maszyna / linia',
          demand: 160,
          capacity: 150,
          util: 107,
          gap: -10,
          action: 'Dodatkowa zmiana',
        },
        'label'
      ),
    ]
  ),
  // 2.7 Kanban board (whiteboard)
  wb(
    {
      id: 'cx-kanban',
      nameEn: 'Kanban Board (WIP-limited)',
      namePl: 'Tablica Kanban (limity WIP)',
      descEn:
        'Backlog → Ready → In Progress → Review → Done with WIP limits — visualize flow and stop overloading.',
      descPl:
        'Backlog → Gotowe → W toku → Przegląd → Zrobione z limitami WIP — wizualizuj przepływ i przestań przeciążać.',
      icon: LayoutGrid,
      group: 'operations',
    },
    [
      frame('kb-backlog', 'Backlog', 0, 0, 210, 400, BG.slate),
      frame('kb-ready', 'Ready (WIP 5)', 220, 0, 210, 400, BG.blue),
      frame('kb-doing', 'In Progress (WIP 3)', 440, 0, 210, 400, BG.amber),
      frame('kb-review', 'Review (WIP 2)', 660, 0, 210, 400, BG.violet),
      frame('kb-done', 'Done', 880, 0, 210, 400, BG.green),
      sticky('kb-h', 'Ustaw limit WIP nad każdą kolumną; ciągnij pracę, nie pchaj.', 12, 44),
    ]
  ),
];

// ═══════════════════════════════════════════════════════════════════════════
// 3. FINANSE (6)
// ═══════════════════════════════════════════════════════════════════════════
const FINANCE: TemplateDefinition[] = [
  // 3.1 Business Case / ROI
  wb(
    {
      id: 'cx-business-case',
      nameEn: 'Business Case / ROI',
      namePl: 'Business Case / ROI',
      descEn:
        'Structured investment case: Problem → Options → Costs → Benefits → ROI/Payback → Recommendation.',
      descPl:
        'Ustrukturyzowany case inwestycyjny: Problem → Opcje → Koszty → Korzyści → ROI/Payback → Rekomendacja.',
      icon: DollarSign,
      group: 'finance',
    },
    [
      frame('bc-prob', '1. Problem & kontekst', 0, 0, 360, 180, BG.slate),
      sticky('bc-prob-h', 'Jaki problem/okazja? Koszt bezczynności (status quo).', 14, 44),
      frame('bc-opt', '2. Opcje (min. 3)', 380, 0, 360, 180, BG.blue),
      sticky('bc-opt-h', 'Do-nothing · rozwiązanie A · rozwiązanie B; kryteria wyboru.', 394, 44),
      frame('bc-cost', '3. Koszty (TCO)', 0, 200, 360, 180, BG.amber),
      sticky('bc-cost-h', 'CAPEX + OPEX, wdrożenie, ryzyka, koszt zmiany.', 14, 244),
      frame('bc-ben', '4. Korzyści', 380, 200, 360, 180, BG.green),
      sticky('bc-ben-h', 'Twarde (oszczędności, przychód) + miękkie (ryzyko, jakość).', 394, 244),
      frame('bc-roi', '5. ROI / NPV / Payback', 0, 400, 360, 180, BG.violet),
      sticky('bc-roi-h', 'ROI = (korzyść−koszt)/koszt; NPV; okres zwrotu; wrażliwość.', 14, 444),
      frame('bc-rec', '6. Rekomendacja', 380, 400, 360, 180, BG.pink),
      sticky('bc-rec-h', 'Jednoznaczna rekomendacja + warunki i następne kroki.', 394, 444),
    ]
  ),
  // 3.2 Cost-Benefit Analysis (table)
  table(
    {
      id: 'cx-cba',
      nameEn: 'Cost-Benefit Analysis',
      namePl: 'Analiza kosztów i korzyści',
      descEn:
        'Line-item costs vs quantified benefits with net value and timing — compare options on one page.',
      descPl:
        'Pozycje kosztów vs skwantyfikowane korzyści z wartością netto i horyzontem — porównaj opcje na jednej stronie.',
      icon: Calculator,
      group: 'finance',
    },
    [
      col('label', 'Pozycja', 'text', { width: 240 }),
      col('type', 'Typ', 'select', { width: 120, options: ['Koszt', 'Korzyść'] }),
      col('year1', 'Rok 1', 'currency', { width: 120 }),
      col('year2', 'Rok 2', 'currency', { width: 120 }),
      col('year3', 'Rok 3', 'currency', { width: 120 }),
      col('net', 'Wartość netto', 'currency', { width: 140 }),
    ],
    [
      row(
        'cb1',
        {
          label: 'Licencje / wdrożenie',
          type: 'Koszt',
          year1: -200000,
          year2: -40000,
          year3: -40000,
          net: -280000,
        },
        'label'
      ),
      row(
        'cb2',
        {
          label: 'Oszczędność pracy',
          type: 'Korzyść',
          year1: 120000,
          year2: 180000,
          year3: 200000,
          net: 500000,
        },
        'label'
      ),
      row(
        'cb3',
        {
          label: 'Wzrost przychodu',
          type: 'Korzyść',
          year1: 0,
          year2: 90000,
          year3: 150000,
          net: 240000,
        },
        'label'
      ),
      row(
        'cb4',
        {
          label: 'Redukcja ryzyka',
          type: 'Korzyść',
          year1: 30000,
          year2: 30000,
          year3: 30000,
          net: 90000,
        },
        'label'
      ),
    ]
  ),
  // 3.3 Unit Economics (table)
  table(
    {
      id: 'cx-unit-economics',
      nameEn: 'Unit Economics',
      namePl: 'Unit Economics',
      descEn:
        'Per-customer/unit metrics — CAC, LTV, contribution margin, payback — to test whether growth is profitable.',
      descPl:
        'Metryki na klienta/jednostkę — CAC, LTV, marża, payback — by sprawdzić czy wzrost jest rentowny.',
      icon: Coins,
      group: 'finance',
    },
    [
      col('label', 'Metryka', 'text', { width: 240 }),
      col('value', 'Wartość', 'number', { width: 140 }),
      col('unit', 'Jednostka', 'text', { width: 120 }),
      col('note', 'Komentarz / benchmark', 'text', { width: 280 }),
    ],
    [
      row(
        'ue1',
        {
          label: 'CAC (koszt pozyskania)',
          value: 1200,
          unit: 'PLN',
          note: 'Cały marketing+sprzedaż / nowi klienci',
        },
        'label'
      ),
      row(
        'ue2',
        {
          label: 'ARPU / przychód mies.',
          value: 350,
          unit: 'PLN',
          note: 'Średni przychód na klienta',
        },
        'label'
      ),
      row(
        'ue3',
        { label: 'Marża brutto %', value: 70, unit: '%', note: 'Cel SaaS: >70%' },
        'label'
      ),
      row(
        'ue4',
        { label: 'Churn miesięczny %', value: 3, unit: '%', note: 'Niżej = dłuższe życie klienta' },
        'label'
      ),
      row('ue5', { label: 'LTV', value: 8166, unit: 'PLN', note: 'ARPU×marża / churn' }, 'label'),
      row('ue6', { label: 'LTV : CAC', value: 6.8, unit: 'x', note: 'Zdrowo: >3x' }, 'label'),
      row(
        'ue7',
        { label: 'CAC Payback', value: 4.9, unit: 'mies.', note: 'Cel: <12 mies.' },
        'label'
      ),
    ]
  ),
  // 3.4 Budget vs Actual (table)
  table(
    {
      id: 'cx-budget-actual',
      nameEn: 'Budget vs Actual',
      namePl: 'Budżet vs Wykonanie',
      descEn:
        'Line items with budget, actual, variance and % — the core of financial control and forecasting.',
      descPl:
        'Pozycje z budżetem, wykonaniem, odchyleniem i % — rdzeń kontroli finansowej i prognozowania.',
      icon: LineChart,
      group: 'finance',
    },
    [
      col('label', 'Pozycja', 'text', { width: 220 }),
      col('budget', 'Budżet', 'currency', { width: 130 }),
      col('actual', 'Wykonanie', 'currency', { width: 130 }),
      col('forecast', 'Prognoza', 'currency', { width: 130 }),
      col('variance', 'Odchylenie', 'currency', { width: 130 }),
      col('status', 'Status', 'status', { width: 130, options: ['on_track', 'watch', 'over'] }),
    ],
    [
      row(
        'ba1',
        {
          label: 'Przychód',
          budget: 1000000,
          actual: 940000,
          forecast: 980000,
          variance: -60000,
          status: 'watch',
        },
        'label'
      ),
      row(
        'ba2',
        {
          label: 'COGS',
          budget: 400000,
          actual: 410000,
          forecast: 415000,
          variance: -10000,
          status: 'watch',
        },
        'label'
      ),
      row(
        'ba3',
        {
          label: 'Marketing',
          budget: 150000,
          actual: 130000,
          forecast: 145000,
          variance: 20000,
          status: 'on_track',
        },
        'label'
      ),
      row(
        'ba4',
        {
          label: 'Personel',
          budget: 300000,
          actual: 305000,
          forecast: 305000,
          variance: -5000,
          status: 'on_track',
        },
        'label'
      ),
      row(
        'ba5',
        {
          label: 'EBITDA',
          budget: 150000,
          actual: 95000,
          forecast: 115000,
          variance: -55000,
          status: 'over',
        },
        'label'
      ),
    ]
  ),
  // 3.5 Scenarios / Sensitivity (table)
  table(
    {
      id: 'cx-scenarios',
      nameEn: 'Scenarios & Sensitivity',
      namePl: 'Scenariusze i wrażliwość',
      descEn:
        'Key drivers across Pessimistic / Base / Optimistic cases — see which assumption moves the outcome most.',
      descPl:
        'Kluczowe drivery w wariantach Pesymistyczny / Bazowy / Optymistyczny — które założenie najmocniej rusza wynikiem.',
      icon: TrendingUp,
      group: 'finance',
    },
    [
      col('label', 'Driver / założenie', 'text', { width: 240 }),
      col('pess', 'Pesymistyczny', 'text', { width: 150 }),
      col('base', 'Bazowy', 'text', { width: 150 }),
      col('opt', 'Optymistyczny', 'text', { width: 150 }),
      col('impact', 'Wpływ na wynik', 'rating', { width: 140 }),
    ],
    [
      row(
        'sc1',
        { label: 'Wzrost przychodu %', pess: '+2%', base: '+8%', opt: '+15%', impact: 5 },
        'label'
      ),
      row(
        'sc2',
        { label: 'Churn / retencja', pess: '5%', base: '3%', opt: '1.5%', impact: 4 },
        'label'
      ),
      row(
        'sc3',
        { label: 'Koszt pozyskania (CAC)', pess: '+20%', base: '0%', opt: '−15%', impact: 4 },
        'label'
      ),
      row(
        'sc4',
        { label: 'Marża brutto', pess: '60%', base: '70%', opt: '76%', impact: 5 },
        'label'
      ),
      row(
        'sc5',
        { label: 'Wynik (EBITDA)', pess: 'strata', base: 'próg', opt: 'zysk', impact: 5 },
        'label'
      ),
    ]
  ),
  // 3.6 Payback model (table)
  table(
    {
      id: 'cx-payback',
      nameEn: 'Payback Model',
      namePl: 'Model okresu zwrotu',
      descEn:
        'Yearly cash flows with cumulative balance — read the break-even year and cumulative return.',
      descPl:
        'Roczne przepływy z bilansem skumulowanym — odczytaj rok progu rentowności i skumulowany zwrot.',
      icon: Calculator,
      group: 'finance',
    },
    [
      col('label', 'Okres', 'text', { width: 140 }),
      col('outflow', 'Wydatki', 'currency', { width: 140 }),
      col('inflow', 'Wpływy', 'currency', { width: 140 }),
      col('net', 'Netto', 'currency', { width: 140 }),
      col('cumulative', 'Skumulowane', 'currency', { width: 160 }),
    ],
    [
      row(
        'pb0',
        {
          label: 'Rok 0 (inwestycja)',
          outflow: 300000,
          inflow: 0,
          net: -300000,
          cumulative: -300000,
        },
        'label'
      ),
      row(
        'pb1',
        { label: 'Rok 1', outflow: 20000, inflow: 120000, net: 100000, cumulative: -200000 },
        'label'
      ),
      row(
        'pb2',
        { label: 'Rok 2', outflow: 20000, inflow: 160000, net: 140000, cumulative: -60000 },
        'label'
      ),
      row(
        'pb3',
        {
          label: 'Rok 3 (break-even)',
          outflow: 20000,
          inflow: 180000,
          net: 160000,
          cumulative: 100000,
        },
        'label'
      ),
      row(
        'pb4',
        { label: 'Rok 4', outflow: 20000, inflow: 200000, net: 180000, cumulative: 280000 },
        'label'
      ),
    ]
  ),
];

// ═══════════════════════════════════════════════════════════════════════════
// 4. CYFRYZACJA / AI (6)
// ═══════════════════════════════════════════════════════════════════════════
const DIGITAL: TemplateDefinition[] = [
  // 4.1 Digital Maturity Scan (table)
  table(
    {
      id: 'cx-digital-maturity',
      nameEn: 'Digital Maturity Scan',
      namePl: 'Skan dojrzałości cyfrowej',
      descEn:
        'Score dimensions (strategy, data, tech, talent, culture) on a 1–5 maturity scale — baseline the transformation.',
      descPl:
        'Oceń wymiary (strategia, dane, technologia, kompetencje, kultura) na skali 1–5 — baza transformacji cyfrowej.',
      icon: Cpu,
      group: 'digital',
    },
    [
      col('label', 'Wymiar', 'text', { width: 220 }),
      col('current', 'Poziom obecny (1–5)', 'rating', { width: 170 }),
      col('target', 'Poziom docelowy', 'rating', { width: 150 }),
      col('gap', 'Luka', 'number', { width: 100 }),
      col('priority', 'Priorytet', 'select', { width: 120, options: ['Low', 'Medium', 'High'] }),
    ],
    [
      row(
        'dm1',
        { label: 'Strategia cyfrowa', current: 2, target: 4, gap: 2, priority: 'High' },
        'label'
      ),
      row(
        'dm2',
        { label: 'Dane i analityka', current: 2, target: 4, gap: 2, priority: 'High' },
        'label'
      ),
      row(
        'dm3',
        { label: 'Technologia / architektura', current: 3, target: 4, gap: 1, priority: 'Medium' },
        'label'
      ),
      row(
        'dm4',
        { label: 'Procesy i automatyzacja', current: 2, target: 4, gap: 2, priority: 'High' },
        'label'
      ),
      row(
        'dm5',
        { label: 'Kompetencje / talenty', current: 3, target: 4, gap: 1, priority: 'Medium' },
        'label'
      ),
      row(
        'dm6',
        { label: 'Kultura i przywództwo', current: 2, target: 4, gap: 2, priority: 'High' },
        'label'
      ),
      row(
        'dm7',
        { label: 'Doświadczenie klienta', current: 3, target: 5, gap: 2, priority: 'High' },
        'label'
      ),
    ]
  ),
  // 4.2 RPA Candidate Finder (table)
  table(
    {
      id: 'cx-rpa-finder',
      nameEn: 'RPA Candidate Finder',
      namePl: 'Wyszukiwarka kandydatów RPA',
      descEn:
        'Score processes by volume, rule-based-ness, stability and ROI — prioritize automation candidates.',
      descPl:
        'Oceń procesy wg wolumenu, regułowości, stabilności i ROI — priorytetyzuj kandydatów do automatyzacji.',
      icon: Bot,
      group: 'digital',
    },
    [
      col('label', 'Proces', 'text', { width: 240 }),
      col('volume', 'Wolumen', 'rating', { width: 120 }),
      col('rules', 'Regułowość', 'rating', { width: 130 }),
      col('stability', 'Stabilność', 'rating', { width: 130 }),
      col('roi', 'ROI', 'rating', { width: 100 }),
      col('score', 'Wynik', 'number', { width: 100 }),
    ],
    [
      row(
        'rpa1',
        { label: 'Wprowadzanie faktur', volume: 5, rules: 5, stability: 4, roi: 5, score: 19 },
        'label'
      ),
      row(
        'rpa2',
        { label: 'Rekoncyliacja płatności', volume: 4, rules: 5, stability: 4, roi: 4, score: 17 },
        'label'
      ),
      row(
        'rpa3',
        { label: 'Onboarding pracownika', volume: 3, rules: 3, stability: 3, roi: 3, score: 12 },
        'label'
      ),
      row(
        'rpa4',
        { label: 'Raporty zarządcze', volume: 4, rules: 4, stability: 5, roi: 4, score: 17 },
        'label'
      ),
    ]
  ),
  // 4.3 Data Readiness (table)
  table(
    {
      id: 'cx-data-readiness',
      nameEn: 'Data Readiness Assessment',
      namePl: 'Ocena gotowości danych',
      descEn:
        'Assess availability, quality, governance and access per data domain — the gate before analytics/AI.',
      descPl:
        'Oceń dostępność, jakość, governance i dostęp per domena danych — bramka przed analityką/AI.',
      icon: Database,
      group: 'digital',
    },
    [
      col('label', 'Domena danych', 'text', { width: 200 }),
      col('availability', 'Dostępność', 'status', {
        width: 130,
        options: ['ready', 'partial', 'missing'],
      }),
      col('quality', 'Jakość', 'rating', { width: 110 }),
      col('governance', 'Governance', 'status', {
        width: 130,
        options: ['ready', 'partial', 'missing'],
      }),
      col('owner', 'Właściciel', 'person', { width: 140 }),
    ],
    [
      row(
        'dr1',
        {
          label: 'Klienci / CRM',
          availability: 'ready',
          quality: 4,
          governance: 'partial',
          owner: '',
        },
        'label'
      ),
      row(
        'dr2',
        {
          label: 'Transakcje / ERP',
          availability: 'ready',
          quality: 4,
          governance: 'ready',
          owner: '',
        },
        'label'
      ),
      row(
        'dr3',
        {
          label: 'Produkty / katalog',
          availability: 'partial',
          quality: 3,
          governance: 'partial',
          owner: '',
        },
        'label'
      ),
      row(
        'dr4',
        {
          label: 'Web / behawioralne',
          availability: 'partial',
          quality: 2,
          governance: 'missing',
          owner: '',
        },
        'label'
      ),
    ]
  ),
  // 4.4 AI Use-Case Canvas (whiteboard)
  wb(
    {
      id: 'cx-ai-usecase',
      nameEn: 'AI Use-Case Canvas',
      namePl: 'AI Use-Case Canvas',
      descEn:
        'One-page frame for an AI use case: Problem, Data, Model/Approach, Value, Risks & Ethics, Success KPIs.',
      descPl:
        'Jednostronicowa rama use-case AI: Problem, Dane, Model/Podejście, Wartość, Ryzyka i etyka, KPI sukcesu.',
      icon: Bot,
      group: 'digital',
    },
    [
      frame('ai-prob', 'Problem / decyzja', 0, 0, 360, 180, BG.slate),
      sticky('ai-prob-h', 'Jaką decyzję/proces wspiera AI? Kto użytkownik?', 14, 44),
      frame('ai-data', 'Dane (wejście)', 380, 0, 360, 180, BG.cyan),
      sticky('ai-data-h', 'Źródła, wolumen, jakość, etykiety, prywatność.', 394, 44),
      frame('ai-model', 'Model / podejście', 0, 200, 360, 180, BG.violet),
      sticky('ai-model-h', 'Reguły vs ML vs LLM; make/buy; human-in-the-loop.', 14, 244),
      frame('ai-value', 'Wartość biznesowa', 380, 200, 360, 180, BG.green),
      sticky('ai-value-h', 'Oszczędność/przychód/jakość; jak mierzymy?', 394, 244),
      frame('ai-risk', 'Ryzyka i etyka', 0, 400, 360, 180, BG.pink),
      sticky('ai-risk-h', 'Bias, wyjaśnialność, compliance, tryb awaryjny.', 14, 444),
      frame('ai-kpi', 'KPI sukcesu', 380, 400, 360, 180, BG.amber),
      sticky('ai-kpi-h', 'Metryki modelu + metryki biznesowe + próg go/no-go.', 394, 444),
    ]
  ),
  // 4.5 Tech Stack Map (whiteboard layers)
  wb(
    {
      id: 'cx-tech-stack',
      nameEn: 'Tech Stack Map',
      namePl: 'Mapa stosu technologicznego',
      descEn:
        'Layered map (experience, applications, integration, data, infrastructure, security) — see coverage and gaps.',
      descPl:
        'Warstwowa mapa (doświadczenie, aplikacje, integracja, dane, infrastruktura, bezpieczeństwo) — pokaż pokrycie i luki.',
      icon: Boxes,
      group: 'digital',
    },
    [
      frame('ts-exp', 'Experience (web · mobile · portal)', 0, 0, 900, 80, BG.blue),
      frame('ts-app', 'Applications (CRM · ERP · Tools)', 0, 90, 900, 90, BG.violet),
      frame('ts-int', 'Integration (API · iPaaS · events)', 0, 190, 900, 80, BG.cyan),
      frame('ts-data', 'Data (DW · lake · BI · ML)', 0, 280, 900, 90, BG.amber),
      frame('ts-infra', 'Infrastructure (cloud · network)', 0, 380, 900, 80, BG.green),
      frame('ts-sec', 'Security & Identity (IAM · zero-trust)', 0, 470, 900, 70, BG.pink),
    ]
  ),
  // 4.6 Digital Roadmap (process_flow horizons)
  flow(
    {
      id: 'cx-digital-roadmap',
      nameEn: 'Digital Transformation Roadmap',
      namePl: 'Roadmapa transformacji cyfrowej',
      descEn:
        'Foundation → Scale → Innovate waves sequencing digital initiatives against readiness and value.',
      descPl:
        'Fale Fundament → Skala → Innowacja — sekwencja inicjatyw cyfrowych wobec gotowości i wartości.',
      icon: Route,
      group: 'digital',
    },
    [
      pf('dr-f1', 'Fundament: dane, chmura, ład', 60, 60, 'start', 'lane-found', LANE.blue),
      pf('dr-f2', 'Core systems & integracje', 320, 60, 'action', 'lane-found', LANE.blue),
      pf('dr-s1', 'Skala: automatyzacja procesów', 320, 220, 'action', 'lane-scale', LANE.amber),
      pf('dr-s2', 'Analityka & self-service BI', 600, 220, 'action', 'lane-scale', LANE.amber),
      pf('dr-i1', 'Innowacja: AI/ML use-cases', 600, 380, 'action', 'lane-innov', LANE.green),
      pf('dr-i2', 'Nowe modele cyfrowe', 880, 380, 'end', 'lane-innov', LANE.green),
    ],
    [
      pfe('dr-f1', 'dr-f2'),
      pfe('dr-f2', 'dr-s1'),
      pfe('dr-s1', 'dr-s2'),
      pfe('dr-s2', 'dr-i1'),
      pfe('dr-i1', 'dr-i2'),
    ],
    [
      { id: 'lane-found', label: 'Foundation', color: LANE.blue },
      { id: 'lane-scale', label: 'Scale', color: LANE.amber },
      { id: 'lane-innov', label: 'Innovate', color: LANE.green },
    ]
  ),
];

// ═══════════════════════════════════════════════════════════════════════════
// 5. LUDZIE / ZMIANA (5)
// ═══════════════════════════════════════════════════════════════════════════
const PEOPLE: TemplateDefinition[] = [
  // 5.1 ADKAR Change Plan (process_flow)
  flow(
    {
      id: 'cx-adkar',
      nameEn: 'ADKAR Change Plan',
      namePl: 'Plan zmiany ADKAR',
      descEn:
        'Awareness → Desire → Knowledge → Ability → Reinforcement — the individual change journey Prosci model.',
      descPl:
        'Świadomość → Chęć → Wiedza → Umiejętność → Utrwalenie — indywidualna ścieżka zmiany (model Prosci).',
      icon: Milestone,
      group: 'people',
    },
    [
      pf('ad-a', 'Awareness\ndlaczego zmiana?', 40, 80, 'start', 'lane-adkar', LANE.blue),
      pf('ad-d', 'Desire\nchcę wziąć udział', 280, 80, 'action', 'lane-adkar', LANE.violet),
      pf('ad-k', 'Knowledge\njak się zmienić', 520, 80, 'action', 'lane-adkar', LANE.cyan),
      pf('ad-ab', 'Ability\nwdrożenie w praktyce', 760, 80, 'action', 'lane-adkar', LANE.amber),
      pf('ad-r', 'Reinforcement\nutrwalenie zmiany', 1000, 80, 'end', 'lane-adkar', LANE.green),
    ],
    [pfe('ad-a', 'ad-d'), pfe('ad-d', 'ad-k'), pfe('ad-k', 'ad-ab'), pfe('ad-ab', 'ad-r')],
    [{ id: 'lane-adkar', label: 'ADKAR journey', color: LANE.blue }]
  ),
  // 5.2 Stakeholder Map (power/interest 2x2)
  wb(
    {
      id: 'cx-stakeholder-grid',
      nameEn: 'Stakeholder Power / Interest Grid',
      namePl: 'Siatka Wpływ / Zainteresowanie',
      descEn:
        'Map stakeholders on power × interest to choose engagement strategy (manage closely, keep satisfied/informed, monitor).',
      descPl:
        'Zmapuj interesariuszy na osi wpływ × zainteresowanie by dobrać strategię (zarządzaj blisko, informuj, monitoruj).',
      icon: Users,
      group: 'people',
    },
    [
      frame('sk-manage', 'High Power / High Interest — Manage Closely', 380, 0, 360, 230, BG.green),
      sticky('sk-manage-h', 'Kluczowi gracze: angażuj blisko, współtwórz.', 394, 46),
      frame('sk-satisfy', 'High Power / Low Interest — Keep Satisfied', 0, 0, 360, 230, BG.amber),
      sticky('sk-satisfy-h', 'Zaspokajaj potrzeby; nie przeciążaj komunikacją.', 14, 46),
      frame('sk-inform', 'Low Power / High Interest — Keep Informed', 380, 250, 360, 230, BG.blue),
      sticky('sk-inform-h', 'Informuj regularnie; mogą być ambasadorami.', 394, 296),
      frame('sk-monitor', 'Low Power / Low Interest — Monitor', 0, 250, 360, 230, BG.slate),
      sticky('sk-monitor-h', 'Minimalny wysiłek; obserwuj zmiany pozycji.', 14, 296),
    ]
  ),
  // 5.3 Org Design (mindmap hierarchy)
  mm(
    {
      id: 'cx-org-design',
      nameEn: 'Organization Design',
      namePl: 'Projekt organizacji',
      descEn:
        'Target operating-model hierarchy — leadership, functions and teams with owners and mandates.',
      descPl:
        'Hierarchia docelowego modelu operacyjnego — przywództwo, funkcje i zespoły z właścicielami i mandatem.',
      icon: UserCog,
      group: 'people',
    },
    [
      mroot('CEO / Leadership', 460, 60),
      mbranch('od-ops', 'Operations', 160, 220, 'operations'),
      mbranch('od-comm', 'Commercial (Sales & Mktg)', 460, 220, 'commercial'),
      mbranch('od-fin', 'Finance & Admin', 760, 220, 'finance'),
      mleaf('od-ops-1', 'Delivery', 60, 380, 'operations'),
      mleaf('od-ops-2', 'Supply / IT', 260, 380, 'operations'),
      mleaf('od-comm-1', 'Sales', 400, 380, 'commercial'),
      mleaf('od-comm-2', 'Marketing', 560, 380, 'commercial'),
      mleaf('od-fin-1', 'Controlling', 700, 380, 'finance'),
      mleaf('od-fin-2', 'HR / People', 880, 380, 'finance'),
    ],
    [
      medge('root', 'od-ops'),
      medge('root', 'od-comm'),
      medge('root', 'od-fin'),
      medge('od-ops', 'od-ops-1'),
      medge('od-ops', 'od-ops-2'),
      medge('od-comm', 'od-comm-1'),
      medge('od-comm', 'od-comm-2'),
      medge('od-fin', 'od-fin-1'),
      medge('od-fin', 'od-fin-2'),
    ]
  ),
  // 5.4 Competency Matrix (table)
  table(
    {
      id: 'cx-competency-matrix',
      nameEn: 'Competency Matrix',
      namePl: 'Macierz kompetencji',
      descEn:
        'People × competencies scored 0–4 (skills matrix) — reveal single points of failure and training needs.',
      descPl:
        'Ludzie × kompetencje w skali 0–4 — pokazuje wąskie gardła wiedzy i potrzeby szkoleniowe.',
      icon: UserCog,
      group: 'people',
    },
    [
      col('label', 'Osoba', 'text', { width: 180 }),
      col('c1', 'Analiza danych', 'rating', { width: 140 }),
      col('c2', 'Zarządzanie proj.', 'rating', { width: 150 }),
      col('c3', 'Komunikacja', 'rating', { width: 140 }),
      col('c4', 'Wiedza domenowa', 'rating', { width: 160 }),
      col('gap', 'Luka / plan', 'text', { width: 180 }),
    ],
    [
      row('cm1', { label: 'Anna K.', c1: 4, c2: 3, c3: 4, c4: 3, gap: 'Mentoring PM' }, 'label'),
      row('cm2', { label: 'Marek W.', c1: 2, c2: 4, c3: 3, c4: 4, gap: 'Kurs analityki' }, 'label'),
      row(
        'cm3',
        { label: 'Ola P.', c1: 3, c2: 2, c3: 4, c4: 2, gap: 'Shadowing + domena' },
        'label'
      ),
    ]
  ),
  // 5.5 Communication Plan (table)
  table(
    {
      id: 'cx-comms-plan',
      nameEn: 'Communication Plan',
      namePl: 'Plan komunikacji',
      descEn:
        'Audience × message × channel × frequency × owner — keep change stakeholders aligned and informed.',
      descPl:
        'Odbiorca × komunikat × kanał × częstotliwość × właściciel — utrzymaj interesariuszy zmiany w jednym rytmie.',
      icon: MessageSquare,
      group: 'people',
    },
    [
      col('label', 'Odbiorca / grupa', 'text', { width: 180 }),
      col('message', 'Kluczowy komunikat', 'text', { width: 240 }),
      col('channel', 'Kanał', 'select', {
        width: 150,
        options: ['E-mail', 'Spotkanie', 'Intranet', 'Warsztat', 'Newsletter'],
      }),
      col('freq', 'Częstotliwość', 'text', { width: 130 }),
      col('owner', 'Właściciel', 'person', { width: 140 }),
    ],
    [
      row(
        'cp1',
        {
          label: 'Zarząd',
          message: 'Postęp vs cele, ryzyka, decyzje',
          channel: 'Spotkanie',
          freq: 'Co 2 tyg.',
          owner: '',
        },
        'label'
      ),
      row(
        'cp2',
        {
          label: 'Menedżerowie',
          message: 'Co zmienia się w zespołach',
          channel: 'Warsztat',
          freq: 'Miesięcznie',
          owner: '',
        },
        'label'
      ),
      row(
        'cp3',
        {
          label: 'Pracownicy',
          message: 'Dlaczego zmiana i co dla mnie',
          channel: 'Intranet',
          freq: 'Tygodniowo',
          owner: '',
        },
        'label'
      ),
      row(
        'cp4',
        {
          label: 'Klienci',
          message: 'Korzyści i harmonogram',
          channel: 'Newsletter',
          freq: 'Kwartalnie',
          owner: '',
        },
        'label'
      ),
    ]
  ),
];

// ═══════════════════════════════════════════════════════════════════════════
// 6. KLIENT / WZROST (5)
// ═══════════════════════════════════════════════════════════════════════════
const GROWTH: TemplateDefinition[] = [
  // 6.1 Customer Journey Map (whiteboard stages × rows)
  wb(
    {
      id: 'cx-cjm',
      nameEn: 'Customer Journey Map',
      namePl: 'Mapa podróży klienta',
      descEn:
        'Stages (Awareness→Advocacy) × lanes (touchpoints, emotions, pain points, opportunities) — design the experience.',
      descPl:
        'Etapy (Świadomość→Rzecznictwo) × pasy (punkty styku, emocje, bóle, szanse) — projektuj doświadczenie klienta.',
      icon: MapIcon,
      group: 'growth',
    },
    [
      frame('cj-h-aw', 'Awareness', 0, 0, 220, 60, BG.blue),
      frame('cj-h-con', 'Consideration', 240, 0, 220, 60, BG.green),
      frame('cj-h-pur', 'Purchase', 480, 0, 220, 60, BG.amber),
      frame('cj-h-ret', 'Retention', 720, 0, 220, 60, BG.pink),
      frame('cj-h-adv', 'Advocacy', 960, 0, 220, 60, BG.violet),
      frame('cj-tp', 'Touchpoints', 0, 80, 1180, 90, BG.slate),
      sticky('cj-tp-h', 'Gdzie klient styka się z marką na każdym etapie?', 12, 116),
      frame('cj-em', 'Emotions', 0, 180, 1180, 90, BG.slate),
      sticky('cj-em-h', 'Co czuje? Zaznacz szczyty i doliny emocji.', 12, 216),
      frame('cj-pp', 'Pain Points', 0, 280, 1180, 90, BG.slate),
      sticky('cj-pp-h', 'Tarcia i frustracje — kandydaci do usprawnień.', 12, 316),
      frame('cj-op', 'Opportunities', 0, 380, 1180, 90, BG.slate),
      sticky('cj-op-h', 'Pomysły: usuń tarcie, zachwyć, dosprzedaj.', 12, 416),
    ]
  ),
  // 6.2 Persona Canvas (whiteboard)
  wb(
    {
      id: 'cx-persona',
      nameEn: 'Persona Canvas',
      namePl: 'Persona Canvas',
      descEn:
        'One-page buyer persona: profile, goals, frustrations, behaviors, watering holes and a defining quote.',
      descPl:
        'Jednostronicowa persona kupującego: profil, cele, frustracje, zachowania, źródła i cytat definiujący.',
      icon: Tag,
      group: 'growth',
    },
    [
      frame('pe-bio', 'Profil & rola', 0, 0, 360, 190, BG.blue),
      sticky('pe-bio-h', 'Stanowisko, kontekst, cele firmy, cele osobiste.', 14, 44),
      frame('pe-goals', 'Cele / Jobs-to-be-done', 380, 0, 360, 190, BG.green),
      sticky('pe-goals-h', 'Co chce osiągnąć? Kryteria sukcesu.', 394, 44),
      frame('pe-frus', 'Frustracje / bóle', 0, 210, 360, 190, BG.pink),
      sticky('pe-frus-h', 'Co go blokuje, denerwuje, ryzykuje.', 14, 254),
      frame('pe-behav', 'Zachowania / kanały', 380, 210, 360, 190, BG.amber),
      sticky('pe-behav-h', 'Gdzie szuka info, jak decyduje, kto wpływa.', 394, 254),
      frame('pe-quote', 'Cytat definiujący', 0, 420, 740, 110, BG.violet),
      sticky('pe-quote-h', '„…” — jedno zdanie oddające sedno persony.', 14, 464),
    ]
  ),
  // 6.3 Go-To-Market Plan (whiteboard)
  wb(
    {
      id: 'cx-gtm',
      nameEn: 'Go-To-Market Plan',
      namePl: 'Plan Go-To-Market',
      descEn:
        'Segment, positioning, offer, pricing, channels and launch motion on one canvas — align the market entry.',
      descPl:
        'Segment, pozycjonowanie, oferta, cennik, kanały i mechanika startu na jednym płótnie — zgraj wejście na rynek.',
      icon: Flag,
      group: 'growth',
    },
    [
      frame('gtm-seg', 'Target Segment & ICP', 0, 0, 360, 170, BG.blue),
      sticky('gtm-seg-h', 'Idealny profil klienta; kryteria kwalifikacji.', 14, 44),
      frame('gtm-pos', 'Positioning & Message', 380, 0, 360, 170, BG.violet),
      sticky(
        'gtm-pos-h',
        'Dla [kogo], którzy [potrzeba], jesteśmy [kategoria] który [wartość].',
        394,
        44
      ),
      frame('gtm-offer', 'Offer & Pricing', 0, 190, 360, 170, BG.green),
      sticky('gtm-offer-h', 'Pakiety, model cenowy, oferta wejścia.', 14, 234),
      frame('gtm-chan', 'Channels & Motion', 380, 190, 360, 170, BG.amber),
      sticky('gtm-chan-h', 'Sales-led / product-led / partner; kanały akwizycji.', 394, 234),
      frame('gtm-launch', 'Launch plan & KPIs', 0, 380, 740, 150, BG.pink),
      sticky(
        'gtm-launch-h',
        'Kamienie milowe, właściciele, metryki (pipeline, CAC, konwersja).',
        14,
        424
      ),
    ]
  ),
  // 6.4 Pricing Strategy (whiteboard)
  wb(
    {
      id: 'cx-pricing',
      nameEn: 'Pricing Strategy',
      namePl: 'Strategia cenowa',
      descEn:
        'Compare pricing logics (cost-plus, value-based, competitive) and tier design against willingness-to-pay.',
      descPl:
        'Porównaj logiki cenowe (koszt+, wartościowa, konkurencyjna) i projekt pakietów wobec gotowości do zapłaty.',
      icon: Coins,
      group: 'growth',
    },
    [
      frame('pr-cost', 'Cost-Plus', 0, 0, 240, 220, BG.slate),
      sticky('pr-cost-h', 'Koszt + marża. Proste, ale ignoruje wartość.', 12, 44),
      frame('pr-value', 'Value-Based', 250, 0, 240, 220, BG.green),
      sticky('pr-value-h', 'Cena od postrzeganej wartości / ROI klienta.', 262, 44),
      frame('pr-comp', 'Competitive', 500, 0, 240, 220, BG.amber),
      sticky('pr-comp-h', 'Względem rynku; ryzyko wojny cenowej.', 512, 44),
      frame('pr-tiers', 'Tier / Package Design', 0, 240, 740, 200, BG.blue),
      sticky(
        'pr-tiers-h',
        'Good-Better-Best; kotwiczenie; fencing; metryka rozliczeniowa.',
        12,
        284
      ),
    ]
  ),
  // 6.5 VoC / NPS (table)
  table(
    {
      id: 'cx-voc-nps',
      nameEn: 'Voice of Customer / NPS',
      namePl: 'Głos klienta / NPS',
      descEn:
        'Segment NPS with verbatim themes and drivers — turn feedback into prioritized actions.',
      descPl:
        'NPS per segment z tematami wypowiedzi i driverami — zamień feedback w priorytetowe działania.',
      icon: Handshake,
      group: 'growth',
    },
    [
      col('label', 'Segment', 'text', { width: 180 }),
      col('nps', 'NPS', 'number', { width: 100 }),
      col('sentiment', 'Sentyment', 'status', {
        width: 130,
        options: ['promoter', 'passive', 'detractor'],
      }),
      col('theme', 'Główny temat', 'text', { width: 240 }),
      col('action', 'Działanie', 'text', { width: 220 }),
    ],
    [
      row(
        'voc1',
        {
          label: 'Enterprise',
          nps: 45,
          sentiment: 'promoter',
          theme: 'Niezawodność, wsparcie',
          action: 'Program referencyjny',
        },
        'label'
      ),
      row(
        'voc2',
        {
          label: 'Mid-market',
          nps: 20,
          sentiment: 'passive',
          theme: 'Onboarding zbyt wolny',
          action: 'Skróć time-to-value',
        },
        'label'
      ),
      row(
        'voc3',
        {
          label: 'SMB',
          nps: -5,
          sentiment: 'detractor',
          theme: 'Cena vs wartość',
          action: 'Rewizja pakietu wejścia',
        },
        'label'
      ),
    ]
  ),
];

// ═══════════════════════════════════════════════════════════════════════════
// 7. PMO (3)
// ═══════════════════════════════════════════════════════════════════════════
const PMO: TemplateDefinition[] = [
  // 7.1 Project Charter (whiteboard)
  wb(
    {
      id: 'cx-charter',
      nameEn: 'Project Charter',
      namePl: 'Karta projektu (Charter)',
      descEn:
        'One-page mandate: purpose, scope (in/out), objectives, milestones, stakeholders, budget and top risks.',
      descPl:
        'Jednostronicowy mandat: cel, zakres (in/out), cele, kamienie milowe, interesariusze, budżet i kluczowe ryzyka.',
      icon: ClipboardList,
      group: 'pmo',
    },
    [
      frame('ch-purpose', 'Cel & uzasadnienie', 0, 0, 360, 170, BG.slate),
      sticky('ch-purpose-h', 'Po co projekt? Jaki problem/okazję adresuje?', 14, 44),
      frame('ch-scope', 'Zakres (In / Out)', 380, 0, 360, 170, BG.blue),
      sticky('ch-scope-h', 'Co wchodzi, a co wyraźnie NIE wchodzi w zakres.', 394, 44),
      frame('ch-obj', 'Cele & mierniki', 0, 190, 360, 170, BG.green),
      sticky('ch-obj-h', 'SMART cele + kryteria sukcesu (mierzalne).', 14, 234),
      frame('ch-mile', 'Kamienie milowe', 380, 190, 360, 170, BG.amber),
      sticky('ch-mile-h', 'Główne punkty kontrolne i terminy.', 394, 234),
      frame('ch-stake', 'Interesariusze & role', 0, 380, 360, 160, BG.violet),
      sticky('ch-stake-h', 'Sponsor, PM, kluczowe role (odnieś do RACI).', 14, 424),
      frame('ch-risk', 'Budżet & top ryzyka', 380, 380, 360, 160, BG.pink),
      sticky('ch-risk-h', 'Ramy budżetu + 3–5 kluczowych ryzyk i mitygacje.', 394, 424),
    ]
  ),
  // 7.2 Risk Register (table)
  table(
    {
      id: 'cx-risk-register',
      nameEn: 'Risk Register',
      namePl: 'Rejestr ryzyk',
      descEn:
        'Risks scored by probability × impact with mitigation, owner and status — the backbone of project risk control.',
      descPl:
        'Ryzyka oceniane prawdopodobieństwo × wpływ z mitygacją, właścicielem i statusem — kręgosłup kontroli ryzyka projektu.',
      icon: ShieldAlert,
      group: 'pmo',
    },
    [
      col('label', 'Ryzyko', 'text', { width: 260 }),
      col('probability', 'Prawdop.', 'select', { width: 120, options: ['Low', 'Medium', 'High'] }),
      col('impact', 'Wpływ', 'select', { width: 120, options: ['Low', 'Medium', 'High'] }),
      col('score', 'Ocena', 'number', { width: 100 }),
      col('mitigation', 'Mitygacja / plan', 'text', { width: 260 }),
      col('owner', 'Właściciel', 'person', { width: 140 }),
      col('status', 'Status', 'status', { width: 130, options: ['open', 'mitigating', 'closed'] }),
    ],
    [
      row(
        'rr1',
        {
          label: 'Opóźnienie dostawcy',
          probability: 'Medium',
          impact: 'High',
          score: 6,
          mitigation: 'Bufor + alternatywny dostawca',
          owner: '',
          status: 'open',
        },
        'label'
      ),
      row(
        'rr2',
        {
          label: 'Przekroczenie budżetu',
          probability: 'Medium',
          impact: 'High',
          score: 6,
          mitigation: 'Kontrola zmian + rezerwa',
          owner: '',
          status: 'mitigating',
        },
        'label'
      ),
      row(
        'rr3',
        {
          label: 'Niska adopcja użytkowników',
          probability: 'High',
          impact: 'Medium',
          score: 6,
          mitigation: 'Plan zmiany (ADKAR) + szkolenia',
          owner: '',
          status: 'open',
        },
        'label'
      ),
      row(
        'rr4',
        {
          label: 'Braki kompetencyjne',
          probability: 'Low',
          impact: 'Medium',
          score: 2,
          mitigation: 'Rekrutacja / partner',
          owner: '',
          status: 'open',
        },
        'label'
      ),
    ]
  ),
  // 7.3 OKR Planning (table)
  table(
    {
      id: 'cx-okr-planning',
      nameEn: 'OKR Planning',
      namePl: 'Planowanie OKR',
      descEn:
        'Objectives with measurable Key Results (baseline → target), owner and confidence — align teams on outcomes.',
      descPl:
        'Cele z mierzalnymi Kluczowymi Rezultatami (baza → cel), właścicielem i pewnością — zgraj zespoły na rezultatach.',
      icon: Target,
      group: 'pmo',
    },
    [
      col('label', 'Objective / Key Result', 'text', { width: 300 }),
      col('type', 'Typ', 'select', { width: 120, options: ['Objective', 'Key Result'] }),
      col('baseline', 'Baza', 'text', { width: 110 }),
      col('target', 'Cel', 'text', { width: 110 }),
      col('owner', 'Właściciel', 'person', { width: 140 }),
      col('confidence', 'Pewność', 'select', { width: 120, options: ['Low', 'Medium', 'High'] }),
    ],
    [
      row(
        'okr1',
        {
          label: 'O1: Zostań liderem NPS w segmencie',
          type: 'Objective',
          baseline: '',
          target: '',
          owner: '',
          confidence: 'Medium',
        },
        'label'
      ),
      row(
        'okr2',
        {
          label: 'KR1.1: NPS z 20 → 40',
          type: 'Key Result',
          baseline: '20',
          target: '40',
          owner: '',
          confidence: 'Medium',
        },
        'label'
      ),
      row(
        'okr3',
        {
          label: 'KR1.2: Churn z 3% → 1.5%',
          type: 'Key Result',
          baseline: '3%',
          target: '1.5%',
          owner: '',
          confidence: 'Low',
        },
        'label'
      ),
      row(
        'okr4',
        {
          label: 'O2: Skaluj przychód powtarzalny',
          type: 'Objective',
          baseline: '',
          target: '',
          owner: '',
          confidence: 'Medium',
        },
        'label'
      ),
      row(
        'okr5',
        {
          label: 'KR2.1: ARR z 5M → 8M',
          type: 'Key Result',
          baseline: '5M',
          target: '8M',
          owner: '',
          confidence: 'Medium',
        },
        'label'
      ),
      row(
        'okr6',
        {
          label: 'KR2.2: Nowi klienci ent. 10 → 25',
          type: 'Key Result',
          baseline: '10',
          target: '25',
          owner: '',
          confidence: 'High',
        },
        'label'
      ),
    ]
  ),
];

// ── Eksport zbiorczy ─────────────────────────────────────────────────────────
export const CONSULTING_TEMPLATES: TemplateDefinition[] = [
  ...STRATEGY,
  ...OPERATIONS,
  ...FINANCE,
  ...DIGITAL,
  ...PEOPLE,
  ...GROWTH,
  ...PMO,
];

export const CONSULTING_TEMPLATES_BY_GROUP: Record<ConsultingCategory, TemplateDefinition[]> = {
  strategy: STRATEGY,
  operations: OPERATIONS,
  finance: FINANCE,
  digital: DIGITAL,
  people: PEOPLE,
  growth: GROWTH,
  pmo: PMO,
};
