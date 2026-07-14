/**
 * slideArchetypes — W7.3: arsenał ≥20 archetypów slajdów z REALNĄ geometrią.
 *
 * Dziś `COMPOSITION_LAYOUT_VARIANTS` to tylko NAZWY-podpowiedzi dla LLM (np.
 * "kpi_grid_2x2") — bez geometrii. Ten rejestr nadaje każdemu archetypowi konkretne
 * REGIONY (x,y,w,h znormalizowane 0..1) + dozwolone prymitywy treści + dopasowane
 * intencje. Dzięki temu archetyp jest RENDEROWALNY (renderer/composition resolwuje
 * id → geometria), a nie tylko słowem w prompt'cie.
 *
 * Każdy archetyp ma regiony rozłączne, w granicach kanwy (walidowane testem przez
 * `deckDesignCritic` DR-06). Deterministyczne, bez LLM.
 *
 * SSOT: DECK_COMPOSITION_REDESIGN + DELIVERABLES_GENERATORS_SPEC §3.
 */

// Prymitywy treści (zbieżne z COMPOSITION_BLOCK_TYPES w presentationLayoutDirectorService).
export type ArchetypeBlock =
  | 'heading'
  | 'paragraph'
  | 'bullet_list'
  | 'numbered_list'
  | 'table'
  | 'chart'
  | 'image'
  | 'kpi_widget'
  | 'metric_strip'
  | 'smart_diagram'
  | 'callout'
  | 'quote_block'
  | 'timeline_block'
  | 'divider'
  | 'icon_row';

/** Region archetypu — znormalizowany 0..1, origin top-left. */
export interface ArchetypeRegion {
  /** Nazwa logiczna regionu (do mapowania treści). */
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Prymitywy, które tu pasują (pierwszy = preferowany). */
  blocks: ArchetypeBlock[];
}

export interface SlideArchetype {
  id: string;
  label: string;
  description: string;
  regions: ArchetypeRegion[];
  /** Intencje slajdu, dla których ten archetyp jest dobrym wyborem. */
  bestForIntents: string[];
}

// Standardowy margines treści (poza pasem tytułu). Tytuł zwykle zajmuje górę 0..0.18.
const TITLE_H = 0.16;
const TOP = 0.2; // start treści pod tytułem
const BODY_H = 0.78; // wysokość obszaru treści (0.20..0.98)
const GUTTER = 0.02;

/** Pas tytułu — wspólny dla większości archetypów (poza pełnoekranowymi). */
const TITLE_REGION: ArchetypeRegion = {
  name: 'title',
  x: 0.04,
  y: 0.04,
  w: 0.92,
  h: TITLE_H,
  blocks: ['heading'],
};

// ── Rejestr 24 archetypów ────────────────────────────────────────────────────
const ARCHETYPES: SlideArchetype[] = [
  // 1. centered — tytuł + podtytuł wyśrodkowane (cover/divider)
  {
    id: 'centered',
    label: 'Centered',
    description: 'Tytuł i podtytuł wyśrodkowane — okładka/dzielnik sekcji.',
    bestForIntents: ['cover', 'section_intro'],
    regions: [
      { name: 'title', x: 0.1, y: 0.36, w: 0.8, h: 0.18, blocks: ['heading'] },
      { name: 'subtitle', x: 0.1, y: 0.56, w: 0.8, h: 0.12, blocks: ['paragraph'] },
    ],
  },
  // 2. left_image — obraz po lewej, treść po prawej
  {
    id: 'left_image',
    label: 'Left image',
    description: 'Obraz pełnej wysokości po lewej, treść po prawej.',
    bestForIntents: ['cover', 'section_intro', 'single_insight'],
    regions: [
      { name: 'image', x: 0, y: 0, w: 0.42, h: 1, blocks: ['image'] },
      { name: 'title', x: 0.46, y: 0.2, w: 0.5, h: 0.18, blocks: ['heading'] },
      { name: 'body', x: 0.46, y: 0.4, w: 0.5, h: 0.5, blocks: ['paragraph', 'bullet_list'] },
    ],
  },
  // 3. bottom_strip — treść pełna + pasek akcentu na dole
  {
    id: 'bottom_strip',
    label: 'Bottom strip',
    description: 'Treść u góry, pasek akcentu/CTA na dole.',
    bestForIntents: ['cover', 'next_steps'],
    regions: [
      TITLE_REGION,
      { name: 'body', x: 0.04, y: TOP, w: 0.92, h: 0.6, blocks: ['paragraph', 'bullet_list'] },
      { name: 'strip', x: 0, y: 0.85, w: 1, h: 0.15, blocks: ['callout', 'metric_strip'] },
    ],
  },
  // 4. stacked — pionowy stos (tytuł → treść)
  {
    id: 'stacked',
    label: 'Stacked',
    description: 'Prosty pionowy stos: tytuł nad treścią.',
    bestForIntents: ['executive_summary', 'key_messages', 'single_insight', 'appendix', 'roadmap'],
    regions: [
      TITLE_REGION,
      {
        name: 'body',
        x: 0.04,
        y: TOP,
        w: 0.92,
        h: BODY_H,
        blocks: ['paragraph', 'bullet_list', 'chart', 'table'],
      },
    ],
  },
  // 5. two_column — dwie równe kolumny
  {
    id: 'two_column',
    label: 'Two column',
    description: 'Dwie równe kolumny treści.',
    bestForIntents: ['executive_summary', 'key_messages', 'comparison', 'risk_management'],
    regions: [
      TITLE_REGION,
      {
        name: 'left',
        x: 0.04,
        y: TOP,
        w: 0.46 - GUTTER,
        h: BODY_H,
        blocks: ['bullet_list', 'paragraph'],
      },
      {
        name: 'right',
        x: 0.5 + GUTTER,
        y: TOP,
        w: 0.46 - GUTTER,
        h: BODY_H,
        blocks: ['bullet_list', 'paragraph'],
      },
    ],
  },
  // 6. kpi_grid_2x2 — siatka 2×2 KPI
  {
    id: 'kpi_grid_2x2',
    label: 'KPI grid 2×2',
    description: 'Cztery kafelki KPI w siatce 2×2.',
    bestForIntents: [
      'executive_summary',
      'performance_overview',
      'recommendation_portfolio',
      'initiative_portfolio',
    ],
    regions: [
      TITLE_REGION,
      { name: 'kpi_tl', x: 0.04, y: TOP, w: 0.46 - GUTTER, h: 0.37, blocks: ['kpi_widget'] },
      {
        name: 'kpi_tr',
        x: 0.5 + GUTTER,
        y: TOP,
        w: 0.46 - GUTTER,
        h: 0.37,
        blocks: ['kpi_widget'],
      },
      { name: 'kpi_bl', x: 0.04, y: 0.61, w: 0.46 - GUTTER, h: 0.37, blocks: ['kpi_widget'] },
      {
        name: 'kpi_br',
        x: 0.5 + GUTTER,
        y: 0.61,
        w: 0.46 - GUTTER,
        h: 0.37,
        blocks: ['kpi_widget'],
      },
    ],
  },
  // 7. icon_row_grid — pasek ikon nad siatką treści
  {
    id: 'icon_row_grid',
    label: 'Icon row + grid',
    description: 'Rząd ikon nad trzema kolumnami treści.',
    bestForIntents: ['key_messages'],
    regions: [
      TITLE_REGION,
      { name: 'icons', x: 0.04, y: TOP, w: 0.92, h: 0.14, blocks: ['icon_row'] },
      { name: 'col1', x: 0.04, y: 0.36, w: 0.3 - GUTTER, h: 0.6, blocks: ['paragraph'] },
      { name: 'col2', x: 0.35, y: 0.36, w: 0.3 - GUTTER, h: 0.6, blocks: ['paragraph'] },
      { name: 'col3', x: 0.66, y: 0.36, w: 0.3, h: 0.6, blocks: ['paragraph'] },
    ],
  },
  // 8. big_number — jedna ogromna liczba + kontekst
  {
    id: 'big_number',
    label: 'Big number',
    description: 'Jedna dominująca liczba z krótkim kontekstem.',
    bestForIntents: ['single_insight', 'performance_overview', 'recommendation_single'],
    regions: [
      TITLE_REGION,
      { name: 'number', x: 0.04, y: 0.28, w: 0.92, h: 0.4, blocks: ['kpi_widget'] },
      { name: 'context', x: 0.1, y: 0.72, w: 0.8, h: 0.2, blocks: ['paragraph', 'callout'] },
    ],
  },
  // 9. chart_left_text_right — wykres po lewej, narracja po prawej
  {
    id: 'chart_left_text_right',
    label: 'Chart + narrative',
    description: 'Wykres po lewej, interpretacja po prawej.',
    bestForIntents: ['single_insight', 'performance_overview', 'recommendation_single'],
    regions: [
      TITLE_REGION,
      { name: 'chart', x: 0.04, y: TOP, w: 0.56 - GUTTER, h: BODY_H, blocks: ['chart'] },
      {
        name: 'narrative',
        x: 0.6 + GUTTER,
        y: TOP,
        w: 0.36 - GUTTER,
        h: BODY_H,
        blocks: ['bullet_list', 'paragraph', 'callout'],
      },
    ],
  },
  // 10. split_lr — wyraźny podział lewa/prawa (np. teza vs dowód)
  {
    id: 'split_lr',
    label: 'Split L/R',
    description: 'Podział lewa/prawa z akcentem rozdzielającym.',
    bestForIntents: ['comparison', 'assessment', 'prioritization_matrix'],
    regions: [
      TITLE_REGION,
      {
        name: 'left',
        x: 0.04,
        y: TOP,
        w: 0.46 - GUTTER,
        h: BODY_H,
        blocks: ['paragraph', 'bullet_list', 'chart'],
      },
      {
        name: 'right',
        x: 0.5 + GUTTER,
        y: TOP,
        w: 0.46 - GUTTER,
        h: BODY_H,
        blocks: ['paragraph', 'bullet_list', 'chart'],
      },
    ],
  },
  // 11. table — pełna tabela
  {
    id: 'table',
    label: 'Full table',
    description: 'Pełnoszerokościowa tabela danych.',
    bestForIntents: [
      'comparison',
      'assessment',
      'risk_management',
      'recommendation_portfolio',
      'initiative_portfolio',
      'appendix',
    ],
    regions: [
      TITLE_REGION,
      { name: 'table', x: 0.04, y: TOP, w: 0.92, h: BODY_H, blocks: ['table'] },
    ],
  },
  // 12. smart_diagram — pełnoekranowy diagram
  {
    id: 'smart_diagram',
    label: 'Smart diagram',
    description: 'Diagram pełnoekranowy (proces/przyczyna-skutek).',
    bestForIntents: ['root_cause', 'prioritization_matrix'],
    regions: [
      TITLE_REGION,
      { name: 'diagram', x: 0.04, y: TOP, w: 0.92, h: BODY_H, blocks: ['smart_diagram'] },
    ],
  },
  // 13. timeline_strip — poziomy pasek osi czasu
  {
    id: 'timeline_strip',
    label: 'Timeline strip',
    description: 'Pozioma oś czasu z kamieniami milowymi.',
    bestForIntents: ['roadmap', 'next_steps'],
    regions: [
      TITLE_REGION,
      { name: 'timeline', x: 0.04, y: 0.42, w: 0.92, h: 0.3, blocks: ['timeline_block'] },
      { name: 'caption', x: 0.04, y: 0.76, w: 0.92, h: 0.18, blocks: ['paragraph'] },
    ],
  },
  // 14. numbered_stack — ponumerowane kroki
  {
    id: 'numbered_stack',
    label: 'Numbered stack',
    description: 'Ponumerowana lista kroków/działań.',
    bestForIntents: ['next_steps', 'roadmap'],
    regions: [
      TITLE_REGION,
      { name: 'steps', x: 0.04, y: TOP, w: 0.92, h: BODY_H, blocks: ['numbered_list'] },
    ],
  },
  // 15. exec_scqa — Minto SCQA w 4 ćwiartkach (Situation/Complication/Question/Answer)
  {
    id: 'exec_scqa',
    label: 'Exec SCQA',
    description: 'Minto SCQA: Sytuacja/Komplikacja/Pytanie/Odpowiedź w 4 ćwiartkach.',
    bestForIntents: ['executive_summary', 'root_cause'],
    regions: [
      TITLE_REGION,
      { name: 'situation', x: 0.04, y: TOP, w: 0.46 - GUTTER, h: 0.37, blocks: ['paragraph'] },
      {
        name: 'complication',
        x: 0.5 + GUTTER,
        y: TOP,
        w: 0.46 - GUTTER,
        h: 0.37,
        blocks: ['paragraph'],
      },
      { name: 'question', x: 0.04, y: 0.61, w: 0.46 - GUTTER, h: 0.37, blocks: ['paragraph'] },
      {
        name: 'answer',
        x: 0.5 + GUTTER,
        y: 0.61,
        w: 0.46 - GUTTER,
        h: 0.37,
        blocks: ['callout', 'paragraph'],
      },
    ],
  },
  // 16. before_after — stan przed (lewa) vs po (prawa)
  {
    id: 'before_after',
    label: 'Before / after',
    description: 'Stan obecny po lewej, docelowy po prawej.',
    bestForIntents: ['comparison', 'recommendation_single', 'root_cause'],
    regions: [
      TITLE_REGION,
      {
        name: 'before',
        x: 0.04,
        y: TOP,
        w: 0.46 - GUTTER,
        h: BODY_H,
        blocks: ['bullet_list', 'paragraph'],
      },
      {
        name: 'after',
        x: 0.5 + GUTTER,
        y: TOP,
        w: 0.46 - GUTTER,
        h: BODY_H,
        blocks: ['bullet_list', 'paragraph'],
      },
    ],
  },
  // 17. funnel — pionowy lejek etapów
  {
    id: 'funnel',
    label: 'Funnel',
    description: 'Pionowy lejek etapów (np. TAM→SAM→SOM, sprzedaż).',
    bestForIntents: ['market', 'single_insight'],
    regions: [
      TITLE_REGION,
      { name: 'funnel', x: 0.2, y: TOP, w: 0.6, h: 0.6, blocks: ['smart_diagram', 'chart'] },
      { name: 'labels', x: 0.04, y: 0.82, w: 0.92, h: 0.14, blocks: ['metric_strip'] },
    ],
  },
  // 18. heatmap — macierz/siatka oceny
  {
    id: 'heatmap',
    label: 'Heatmap',
    description: 'Macierz oceny kolorami (gęstość/ryzyko/dojrzałość).',
    bestForIntents: ['assessment', 'risk_management', 'prioritization_matrix'],
    regions: [
      TITLE_REGION,
      {
        name: 'matrix',
        x: 0.04,
        y: TOP,
        w: 0.72 - GUTTER,
        h: BODY_H,
        blocks: ['table', 'smart_diagram'],
      },
      { name: 'legend', x: 0.78, y: TOP, w: 0.18, h: BODY_H, blocks: ['metric_strip', 'callout'] },
    ],
  },
  // 19. matrix_2x2 — macierz strategiczna 2×2 z osiami
  {
    id: 'matrix_2x2',
    label: '2×2 matrix',
    description: 'Macierz strategiczna 2×2 z opisanymi osiami.',
    bestForIntents: ['prioritization_matrix', 'assessment', 'recommendation_portfolio'],
    regions: [
      TITLE_REGION,
      { name: 'quadrants', x: 0.12, y: TOP, w: 0.84, h: 0.72, blocks: ['smart_diagram'] },
      { name: 'axis_caption', x: 0.04, y: 0.93, w: 0.92, h: 0.05, blocks: ['paragraph'] },
    ],
  },
  // 20. minto_pyramid — myśl nadrzędna + 3 wspierające
  {
    id: 'minto_pyramid',
    label: 'Minto pyramid',
    description: 'Myśl nadrzędna u góry, 3 argumenty wspierające pod.',
    bestForIntents: ['executive_summary', 'recommendation_single', 'key_messages'],
    regions: [
      TITLE_REGION,
      { name: 'governing', x: 0.16, y: TOP, w: 0.68, h: 0.22, blocks: ['callout'] },
      {
        name: 'support1',
        x: 0.04,
        y: 0.48,
        w: 0.3 - GUTTER,
        h: 0.48,
        blocks: ['paragraph', 'bullet_list'],
      },
      {
        name: 'support2',
        x: 0.35,
        y: 0.48,
        w: 0.3 - GUTTER,
        h: 0.48,
        blocks: ['paragraph', 'bullet_list'],
      },
      { name: 'support3', x: 0.66, y: 0.48, w: 0.3, h: 0.48, blocks: ['paragraph', 'bullet_list'] },
    ],
  },
  // 21. logo_wall — siatka dowodów/logotypów
  {
    id: 'logo_wall',
    label: 'Logo wall',
    description: 'Siatka logotypów/dowodów społecznych.',
    bestForIntents: ['key_messages', 'appendix'],
    regions: [
      TITLE_REGION,
      { name: 'grid', x: 0.04, y: TOP, w: 0.92, h: BODY_H, blocks: ['icon_row', 'image'] },
    ],
  },
  // 22. quote_hero — duży cytat wyróżniony
  {
    id: 'quote_hero',
    label: 'Quote hero',
    description: 'Wyróżniony cytat/teza na pełnym slajdzie.',
    bestForIntents: ['section_intro', 'single_insight'],
    regions: [
      { name: 'quote', x: 0.1, y: 0.3, w: 0.8, h: 0.4, blocks: ['quote_block'] },
      { name: 'attribution', x: 0.1, y: 0.72, w: 0.8, h: 0.1, blocks: ['paragraph'] },
    ],
  },
  // 23. comparison_columns — nagłówek + N kolumn porównawczych
  {
    id: 'comparison_columns',
    label: 'Comparison columns',
    description: 'Trzy kolumny porównawcze pod wspólnym nagłówkiem.',
    bestForIntents: ['comparison', 'recommendation_portfolio'],
    regions: [
      TITLE_REGION,
      {
        name: 'col1',
        x: 0.04,
        y: TOP,
        w: 0.3 - GUTTER,
        h: BODY_H,
        blocks: ['bullet_list', 'kpi_widget'],
      },
      {
        name: 'col2',
        x: 0.35,
        y: TOP,
        w: 0.3 - GUTTER,
        h: BODY_H,
        blocks: ['bullet_list', 'kpi_widget'],
      },
      { name: 'col3', x: 0.66, y: TOP, w: 0.3, h: BODY_H, blocks: ['bullet_list', 'kpi_widget'] },
    ],
  },
  // 24. roadmap_swimlane — poziome tory czasowe
  {
    id: 'roadmap_swimlane',
    label: 'Roadmap swimlane',
    description: 'Poziome tory (workstream) na osi czasu.',
    bestForIntents: ['roadmap', 'initiative_portfolio'],
    regions: [
      TITLE_REGION,
      { name: 'lane1', x: 0.04, y: TOP, w: 0.92, h: 0.24, blocks: ['timeline_block'] },
      { name: 'lane2', x: 0.04, y: 0.46, w: 0.92, h: 0.24, blocks: ['timeline_block'] },
      { name: 'lane3', x: 0.04, y: 0.72, w: 0.92, h: 0.24, blocks: ['timeline_block'] },
    ],
  },
];

// ── Indeks + API ─────────────────────────────────────────────────────────────

const BY_ID = new Map<string, SlideArchetype>(ARCHETYPES.map((a) => [a.id, a]));

/** Wszystkie archetypy (read-only). */
export const SLIDE_ARCHETYPES: ReadonlyArray<SlideArchetype> = ARCHETYPES;

/** Liczba archetypów w arsenale (DoD W7.3: ≥20). */
export const ARCHETYPE_COUNT = ARCHETYPES.length;

/** Czy id jest znanym archetypem? */
export function isArchetypeId(id: unknown): id is string {
  return typeof id === 'string' && BY_ID.has(id);
}

/** Archetyp po id (lub null). */
export function getArchetype(id: string): SlideArchetype | null {
  return BY_ID.get(id) ?? null;
}

/** Archetypy dopasowane do intencji (puste → fallback 'stacked'). */
export function archetypesForIntent(intent: string): SlideArchetype[] {
  const matches = ARCHETYPES.filter((a) => a.bestForIntents.includes(intent));
  return matches.length > 0 ? matches : [BY_ID.get('stacked')!];
}

/**
 * Resolwuje preferowany archetyp: jeśli `preferredId` znany I pasuje do intencji,
 * zwraca go; inaczej pierwszy dopasowany do intencji; inaczej 'stacked'.
 */
export function resolveArchetype(intent: string, preferredId?: string | null): SlideArchetype {
  if (preferredId && BY_ID.has(preferredId)) {
    const a = BY_ID.get(preferredId)!;
    if (a.bestForIntents.includes(intent)) return a;
  }
  return archetypesForIntent(intent)[0];
}
