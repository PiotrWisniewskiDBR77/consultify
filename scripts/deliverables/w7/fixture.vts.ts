/**
 * STEP 1b visual-proof fixture — VTS Group digital-transformation deck.
 *
 * WHAT IS REAL HERE:
 *  - `composition` on every card is the AUTHENTIC output of B1
 *    (presentationLayoutDirectorService.planDeckLayout) captured on 2026-07-04
 *    via `node --import tsx scripts/deliverables/_diag-deck-composition.mts`
 *    against claude-sonnet-4-6 (tier PREMIUM, fallback=false, 7/7 slides).
 *    layoutVariantId sequence: centered, two_column, kpi_grid_2x2, big_number,
 *    split_lr, stacked, timeline_strip (7 DISTINCT variants).
 *  - The blocks are representative consulting content for that topic. They carry
 *    real block types/areas so the renderer's region assignment is exercised.
 *
 * Each card is emitted twice by the harness:
 *   BEFORE = composition stripped → renderer uses its pure intent+block-count
 *            heuristic (today's shipped behaviour).
 *   AFTER  = composition present → selectLayout honours layoutVariantId and
 *            assignBlocksToRegions honours composition.regions (Step 1b).
 *
 * The point of the proof is that BEFORE and AFTER differ visibly on the SAME
 * content — that composition steers the layout, not just the intent.
 */
import type { CardBlock, DeckCard } from '@/components/Presentations/wizard/types';

let uid = 0;
const bid = () => `blk-${++uid}`;

function block(
  type: CardBlock['type'],
  area: CardBlock['position']['area'],
  order: number,
  content: Record<string, unknown>
): CardBlock {
  return {
    block_id: bid(),
    card_id: '',
    type,
    content,
    is_refreshable: false,
    position: { area, order },
    ai_editable: true,
  };
}

function card(
  partial: Pick<DeckCard, 'card_id' | 'order_index' | 'intent' | 'title' | 'composition'> & {
    blocks: CardBlock[];
  }
): DeckCard {
  return {
    deck_id: 'deck-vts-step1b',
    layout_id: 'auto',
    source_refs: [],
    has_refreshable_data: false,
    background: { type: 'theme' },
    animations: { entrance: 'none', block_stagger: false },
    is_locked: false,
    ...partial,
    blocks: partial.blocks.map((b) => ({ ...b, card_id: partial.card_id })),
  };
}

export const VTS_CARDS: DeckCard[] = [
  card({
    card_id: 'c0',
    order_index: 0,
    intent: 'cover',
    title: 'Diagnoza transformacji cyfrowej VTS Group',
    // B1: variant=centered, emphasis=narrative
    composition: {
      layoutVariantId: 'centered',
      emphasis: 'narrative',
      regions: [
        { area: 'overlay', blockTypes: ['image'] },
        { area: 'full', blockTypes: ['heading', 'paragraph', 'divider'] },
      ],
    },
    blocks: [
      block('heading', 'full', 0, { text: 'Diagnoza transformacji cyfrowej VTS Group', level: 1 }),
      block('paragraph', 'full', 1, {
        text: 'Kompleksowa diagnoza dojrzałości cyfrowej — ustalenia i rekomendacja dla zarządu.',
      }),
      block('divider', 'full', 2, {}),
    ],
  }),
  card({
    card_id: 'c1',
    order_index: 1,
    intent: 'executive_summary',
    title: 'Streszczenie wykonawcze',
    // B1: variant=two_column, emphasis=narrative
    composition: {
      layoutVariantId: 'two_column',
      emphasis: 'narrative',
      regions: [
        { area: 'left', blockTypes: ['heading', 'bullet_list'] },
        { area: 'right', blockTypes: ['callout', 'paragraph'] },
      ],
    },
    blocks: [
      block('heading', 'full', 0, { text: 'Streszczenie wykonawcze', level: 2 }),
      block('bullet_list', 'full', 1, {
        items: [
          'Zaledwie 18% procesów jest zautomatyzowanych — 3× poniżej benchmarku branży.',
          'Dane rozproszone w 7 niepołączonych systemach; brak jednego źródła prawdy.',
          'Adopcja narzędzi cyfrowych spadła o 12 p.p. rok do roku.',
        ],
      }),
      block('callout', 'full', 2, {
        text: 'Rekomendacja: wdrożyć platformę automatyzacji i ustandaryzować procesy w 90 dni.',
        variant: 'recommendation',
      }),
      block('paragraph', 'full', 3, {
        text: 'Priorytet wynika z największego wskaźnika ROI wśród rozważanych kierunków.',
      }),
    ],
  }),
  card({
    card_id: 'c2',
    order_index: 2,
    intent: 'performance_overview',
    title: 'Stan obecny — wskaźniki dojrzałości',
    // B1: variant=kpi_grid_2x2, emphasis=data
    composition: {
      layoutVariantId: 'kpi_grid_2x2',
      emphasis: 'data',
      regions: [
        { area: 'top', blockTypes: ['heading', 'metric_strip'] },
        { area: 'bottom', blockTypes: ['chart'] },
      ],
    },
    blocks: [
      block('heading', 'full', 0, { text: 'Stan obecny — wskaźniki dojrzałości', level: 2 }),
      block('metric_strip', 'full', 1, {
        metrics: [
          { label: 'Automatyzacja', value: '18%', trend: 'down' },
          { label: 'NPS klienta', value: '31', trend: 'flat' },
          { label: 'Adopcja narzędzi', value: '54%', trend: 'down' },
          { label: 'Koszt operacyjny', value: '+9%', trend: 'up' },
        ],
      }),
      block('chart', 'full', 2, {
        chartType: 'line',
        title: 'Trend adopcji narzędzi (12 mies.)',
        series: [{ name: 'Adopcja', data: [66, 63, 61, 59, 58, 56, 55, 54, 54, 53, 54, 54] }],
      }),
    ],
  }),
  card({
    card_id: 'c3',
    order_index: 3,
    intent: 'single_insight',
    title: 'Problem 1 — niska automatyzacja procesów',
    // B1: variant=big_number, emphasis=data
    composition: {
      layoutVariantId: 'big_number',
      emphasis: 'data',
      regions: [
        { area: 'left', blockTypes: ['kpi_widget', 'callout'] },
        { area: 'right', blockTypes: ['paragraph', 'bullet_list'] },
      ],
    },
    blocks: [
      block('kpi_widget', 'full', 0, {
        value: '18%',
        label: 'procesów zautomatyzowanych',
        benchmark: 'benchmark branży: 55%',
      }),
      block('callout', 'full', 1, {
        text: '3× poniżej mediany rynku.',
        variant: 'warning',
      }),
      block('paragraph', 'full', 2, {
        text: 'Ręczne przetwarzanie dominuje w obsłudze zamówień, fakturowaniu i raportowaniu.',
      }),
      block('bullet_list', 'full', 3, {
        items: [
          'Obsługa zamówień: 82% kroków ręcznych.',
          'Fakturowanie: brak integracji z ERP.',
          'Raportowanie: arkusze montowane ręcznie co miesiąc.',
        ],
      }),
    ],
  }),
  card({
    card_id: 'c4',
    order_index: 4,
    intent: 'comparison',
    title: 'Porównanie z konkurencją',
    // B1: variant=split_lr, emphasis=comparison
    composition: {
      layoutVariantId: 'split_lr',
      emphasis: 'comparison',
      regions: [
        { area: 'left', blockTypes: ['chart'] },
        { area: 'right', blockTypes: ['heading', 'bullet_list'] },
      ],
    },
    blocks: [
      block('heading', 'full', 0, { text: 'Porównanie z konkurencją', level: 2 }),
      block('chart', 'full', 1, {
        chartType: 'bar',
        title: 'Dojrzałość cyfrowa (5 wymiarów)',
        series: [
          { name: 'VTS Group', data: [3, 2, 4, 2, 3] },
          { name: 'Konkurent A', data: [4, 4, 4, 3, 4] },
          { name: 'Konkurent B', data: [5, 4, 3, 4, 4] },
        ],
      }),
      block('bullet_list', 'full', 2, {
        items: [
          'VTS wyprzedza rynek tylko w wymiarze "kultura danych".',
          'Największa luka: automatyzacja procesów (-2 pkt).',
          'Konkurent B lideruje w integracji systemów.',
        ],
      }),
    ],
  }),
  card({
    card_id: 'c5',
    order_index: 5,
    intent: 'recommendation_single',
    title: 'Rekomendacja — platforma automatyzacji',
    // B1: variant=stacked, emphasis=narrative
    composition: {
      layoutVariantId: 'stacked',
      emphasis: 'narrative',
      regions: [
        { area: 'top', blockTypes: ['heading', 'callout'] },
        { area: 'bottom', blockTypes: ['paragraph', 'icon_row'] },
      ],
    },
    blocks: [
      block('heading', 'full', 0, { text: 'Rekomendacja — platforma automatyzacji', level: 2 }),
      block('callout', 'full', 1, {
        text: 'Wdrożyć platformę automatyzacji procesów i ustandaryzować 3 kluczowe przepływy.',
        variant: 'recommendation',
      }),
      block('paragraph', 'full', 2, {
        text: 'Oczekiwany efekt: automatyzacja z 18% → 50% w 12 miesięcy, redukcja kosztu operacyjnego o 7%.',
      }),
      block('icon_row', 'full', 3, {
        items: ['Obsługa zamówień', 'Fakturowanie', 'Raportowanie'],
      }),
    ],
  }),
  card({
    card_id: 'c6',
    order_index: 6,
    intent: 'next_steps',
    title: 'Następne kroki — plan 90 dni',
    // B1: variant=timeline_strip, emphasis=visual
    composition: {
      layoutVariantId: 'timeline_strip',
      emphasis: 'visual',
      regions: [
        { area: 'top', blockTypes: ['heading', 'paragraph'] },
        { area: 'bottom', blockTypes: ['timeline_block', 'smart_layout'] },
      ],
    },
    blocks: [
      block('heading', 'full', 0, { text: 'Następne kroki — plan 90 dni', level: 2 }),
      block('paragraph', 'full', 1, {
        text: 'Trzy fazy z jasnymi właścicielami i miernikami postępu.',
      }),
      block('timeline_block', 'full', 2, {
        events: [
          { label: '0–30 dni', text: 'Audyt procesów + wybór platformy' },
          { label: '31–60 dni', text: 'Pilotaż na obsłudze zamówień' },
          { label: '61–90 dni', text: 'Skalowanie na fakturowanie i raporty' },
        ],
      }),
      block('smart_layout', 'full', 3, {
        items: ['Właściciel: COO', 'Miernik: % automatyzacji', 'Przegląd: co 2 tygodnie'],
      }),
    ],
  }),
];
