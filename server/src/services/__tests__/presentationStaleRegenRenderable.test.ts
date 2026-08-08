/**
 * Stale-regen download path — render-integrity acceptance test.
 *
 * Bug (dowód: Harvard/wdrozenie-100/_DOWOD_DECK_PPTX_2026-07-14.md): the PPTX
 * re-render before download projected deck_json through
 * deckDocumentToUnifiedJson, which kept each card's intent but flattened the
 * content to cover/appendix/key_messages — intent-bound layouts
 * (kpi/chart/roadmap/risk/maturity/...) crashed into red "Render Error"
 * slides (8/12 in the proof deck) for every deck downloaded after ANY edit.
 *
 * Fix under test:
 *  1. deckDocumentToRenderableUnifiedJson — merges the rich `unified_json`
 *     render model (base) with the edited `deck_json` cards (overlay), so the
 *     re-render is fresh AND renderable.
 *  2. deckDocumentToUnifiedJson — coerces the projected intent to the emitted
 *     content shape (contract: layouts are intent-bound), so even the
 *     no-unified fallback can never produce a shape-mismatch Render Error.
 *
 * Hard acceptance threshold: ZERO render-failed slides after a simulated edit.
 */
import { describe, expect, it } from 'vitest';

import {
  type DeckDocument,
  deckDocumentFromUnifiedJson,
  deckDocumentToRenderableUnifiedJson,
  deckDocumentToUnifiedJson,
} from '../presentationDeckDocumentService.js';
import { PptxPipelineService } from '../report/pptx/PptxPipelineService.js';
import type { UnifiedReportJSON } from '../report/pptx/types.js';

function buildRichReport(): UnifiedReportJSON {
  return {
    meta: {
      client: 'DBR77 Robotics Marketplace',
      project: 'Operational Scale-Up Assessment',
      date: '2026-07-14',
      author: 'Consultify',
      confidentiality: 'confidential',
      language: 'en',
      template: 'corporate',
    },
    slides: [
      {
        intent: 'cover',
        key_message: 'Operational Scale-Up Assessment',
        content: {
          type: 'cover',
          title: 'Operational Scale-Up Assessment',
          subtitle: 'Diagnostic findings and 12-month roadmap',
          organization: 'DBR77 Robotics Marketplace',
          date: '2026-07-14',
          confidentiality: 'confidential',
        },
      },
      {
        intent: 'executive_summary',
        key_message: 'Revenue can double if operations industrialise first',
        content: {
          type: 'executive_summary',
          headline: 'Revenue can double — if operations industrialise first',
          kpis: [
            { name: 'Revenue growth', value: '38', unit: '%', trend: 'up', status: 'good' },
            { name: 'Quote-to-order', value: '21', unit: 'days', trend: 'flat', status: 'warning' },
          ],
          key_findings: [
            'Qualified pipeline grew 61% YoY while conversion fell to 19%',
            'Quote-to-order cycle is 21 days vs 6-day benchmark',
          ],
          recommendation: 'Launch a 3-wave operational scale-up programme.',
        },
      },
      {
        intent: 'section_intro',
        key_message: 'Where the operation stands today',
        content: {
          type: 'section_intro',
          section_title: 'Diagnostic: where the operation stands today',
          section_number: 1,
          description: 'Findings from 14 stakeholder interviews and process walkthroughs.',
        },
      },
      {
        intent: 'key_messages',
        key_message: 'Three structural bottlenecks cap growth',
        content: {
          type: 'key_messages',
          messages: [
            {
              title: 'Quoting bottleneck',
              description: 'Every quote passes through senior engineers.',
            },
            {
              title: 'Fulfilment handoffs',
              description: 'Five manual handoffs between order and installation.',
            },
          ],
        },
      },
      {
        intent: 'performance_overview',
        key_message: 'Growth is masking a margin problem',
        content: {
          type: 'performance_overview',
          period: 'FY2025 vs FY2024',
          kpis: [
            {
              name: 'Marketplace GMV',
              value: 'PLN 41M',
              trend: 'up',
              delta: '+38%',
              status: 'good',
            },
            {
              name: 'Gross margin',
              value: '24%',
              trend: 'down',
              delta: '-6 p.p.',
              status: 'critical',
            },
          ],
          context: 'Unit economics deteriorate with every incremental order.',
        },
      },
      {
        intent: 'single_insight',
        key_message: 'Conversion collapses where quoting effort peaks',
        content: {
          type: 'single_insight',
          chart_type: 'bar',
          chart_data: {
            labels: ['Lead', 'Qualified', 'Won'],
            series: [
              { name: 'FY2024', values: [100, 64, 31] },
              { name: 'FY2025', values: [100, 71, 19] },
            ],
          },
          insight_text: 'Funnel conversion fell 12 p.p. YoY in the manual quoting stages.',
          source: 'CRM export 2024-2026',
        },
      },
      {
        intent: 'comparison',
        key_message: 'Current quoting model vs industrialised target',
        content: {
          type: 'comparison',
          left_label: 'Today: artisanal quoting',
          right_label: 'Target: industrialised quoting',
          left_items: ['Senior engineer builds every quote', '21-day median cycle'],
          right_items: ['Configurator covers 70% of quotes', '6-day cycle for standard'],
          verdict: 'The target model frees ~9,500 engineering hours/year.',
        },
      },
      {
        intent: 'assessment',
        key_message: 'Strong commercial engine, weak industrial backbone',
        content: {
          type: 'assessment',
          matrix_type: 'maturity',
          scale_max: 5,
          overall_score: 2.8,
          axes: [
            { axisId: 'sales', axisName: 'Sales', score: 4.1, maxScore: 5, target: 4.5 },
            { axisId: 'quoting', axisName: 'Quoting', score: 1.9, maxScore: 5, target: 4.0 },
          ],
        },
      },
      {
        intent: 'roadmap',
        key_message: '12-month programme in three waves',
        content: {
          type: 'roadmap',
          phases: [
            {
              label: 'Wave 1 — Industrialise quoting',
              timeframe: 'Q3 2026',
              status: 'in_progress',
              items: ['Deploy configurator', 'Price floor policy v1'],
            },
            {
              label: 'Wave 2 — Automate fulfilment',
              timeframe: 'Q4 2026',
              status: 'planned',
              items: ['Digital handoffs', 'Partner SLA scorecards'],
            },
          ],
        },
      },
      {
        intent: 'risk_management',
        key_message: 'Programme risks all have owners and mitigations',
        content: {
          type: 'risk_management',
          risks: [
            {
              risk: 'Key-person dependency',
              likelihood: 'high',
              impact: 'high',
              mitigation: 'Knowledge-capture sprints',
              owner: 'CTO',
            },
            {
              risk: 'Configurator scope creep',
              likelihood: 'medium',
              impact: 'high',
              mitigation: 'Freeze scope at top-20 cell types',
              owner: 'Programme lead',
            },
          ],
        },
      },
      {
        intent: 'initiative_portfolio',
        key_message: 'Initiatives sequenced by dependency and payback',
        content: {
          type: 'initiative_portfolio',
          initiatives: [
            {
              name: 'Robot-cell configurator',
              summary: 'Self-service configuration',
              strategicIntent: 'Fix',
              priority: 'critical',
              timeline: 'Q3 2026',
              impact: 5,
              effort: 4,
              budget: 'PLN 850k',
              roi: '4.2x / 18m',
              owner: 'CTO',
            },
            {
              name: 'Deal-desk & price floors',
              summary: 'Approval matrix',
              strategicIntent: 'Fix',
              priority: 'critical',
              timeline: 'Q3-Q4 2026',
              impact: 4,
              effort: 2,
              budget: 'PLN 120k',
              roi: '11x / 12m',
              owner: 'CRO',
            },
          ],
        },
      },
      {
        intent: 'next_steps',
        key_message: 'Decisions needed this month to hit Q3 start',
        content: {
          type: 'next_steps',
          actions: [
            {
              action: 'Approve Wave 1 budget and charter',
              owner: 'Board',
              deadline: '2026-07-25',
              status: 'pending',
            },
            {
              action: 'Nominate programme lead',
              owner: 'CEO',
              deadline: '2026-07-31',
              status: 'pending',
            },
          ],
          closing_message: 'Every month of delay costs recoverable GMV.',
        },
      },
    ],
  };
}

/** deck_json as the DB holds it after generation (real blocks). */
function buildDeckDocument(report: UnifiedReportJSON): DeckDocument {
  return deckDocumentFromUnifiedJson({
    deckId: 'deck-stale-regen-test',
    organizationId: 'org-test',
    title: report.meta.project,
    unifiedJson: report,
    setup: { language: 'en', confidentiality: 'confidential', theme: 'corporate' },
    status: 'ready',
  });
}

/** Simulate what autosave persists after the user edits the deck in the FE. */
function simulateEdits(deck: DeckDocument): DeckDocument {
  const edited: DeckDocument = JSON.parse(JSON.stringify(deck));

  const exec = edited.cards.find((card) => card.intent === 'executive_summary')!;
  exec.title = 'EDITED HEADLINE: margins first, growth second';
  const execHeading = exec.blocks.find((block) => block.type === 'heading');
  if (execHeading) (execHeading.content as any).text = exec.title;
  const execBullets = exec.blocks.find((block) => block.type === 'bullet_list');
  (execBullets!.content as any).items[0] = 'EDITED FINDING: pipeline grew 61% YoY';

  const risk = edited.cards.find((card) => card.intent === 'risk_management')!;
  const riskTable = risk.blocks.find((block) => block.type === 'table');
  (riskTable!.content as any).rows[0][3] = 'EDITED MITIGATION: hire shadow engineers';

  // Reorder roadmap <-> risk, delete comparison, add a brand-new card.
  const roadmap = edited.cards.find((card) => card.intent === 'roadmap')!;
  const tmp = roadmap.order_index;
  roadmap.order_index = risk.order_index;
  risk.order_index = tmp;
  edited.cards = edited.cards.filter((card) => card.intent !== 'comparison');
  edited.cards.push({
    card_id: 'card-added-by-user',
    deck_id: edited.deck_id,
    order_index: 99,
    intent: 'key_messages',
    layout_id: 'content_full',
    title: 'ADDED SLIDE: open questions',
    key_message: 'ADDED SLIDE: open questions',
    blocks: [
      {
        block_id: 'b-added-1',
        card_id: 'card-added-by-user',
        type: 'bullet_list',
        content: { items: ['Budget ceiling: PLN 1.2M or 1.5M?'] },
        is_refreshable: false,
        position: { area: 'full', order: 0 },
        ai_editable: true,
      },
    ],
    source_refs: [],
    has_refreshable_data: false,
    background: { type: 'theme' },
    animations: { entrance: 'none', block_stagger: false },
    is_locked: false,
  } as any);
  return edited;
}

function renderFailures(warnings: string[]): string[] {
  return warnings.filter((warning) => warning.includes('render failed'));
}

describe('stale-regen download path — renderable projection', () => {
  const report = buildRichReport();

  it('merges unified_json base with deck_json edits: fresh AND renderable', async () => {
    const editedDeck = simulateEdits(buildDeckDocument(report));
    const merged = deckDocumentToRenderableUnifiedJson(editedDeck, report);
    const mergedStr = JSON.stringify(merged);

    // Edits survive.
    expect(mergedStr).toContain('EDITED HEADLINE');
    expect(mergedStr).toContain('EDITED FINDING');
    expect(mergedStr).toContain('EDITED MITIGATION');
    expect(mergedStr).toContain('ADDED SLIDE');
    // Structure edits survive.
    expect(merged.slides.some((slide) => (slide.content as any)?.type === 'comparison')).toBe(
      false
    );
    const riskIndex = merged.slides.findIndex(
      (s) => (s.content as any)?.type === 'risk_management'
    );
    const roadmapIndex = merged.slides.findIndex((s) => (s.content as any)?.type === 'roadmap');
    expect(riskIndex).toBeGreaterThan(-1);
    expect(riskIndex).toBeLessThan(roadmapIndex);
    // Rich per-intent content survives (this is what the old flatten destroyed).
    expect(merged.slides.some((slide) => (slide.content as any)?.chart_data)).toBe(true);
    expect(merged.slides.some((slide) => Array.isArray((slide.content as any)?.axes))).toBe(true);
    // Fields the lossy block projection cannot carry come back from the base.
    expect(mergedStr).toContain('PLN 850k');
    expect(mergedStr).toContain('CTO');

    // HARD THRESHOLD: zero "Render Error" fallback slides.
    const result = await new PptxPipelineService().generateFromUnifiedJson(merged, {
      template: 'corporate',
      language: 'en',
      confidentiality: 'confidential',
    });
    expect(renderFailures(result.warnings)).toEqual([]);
    expect(result.validation.valid).toBe(true);
    expect(result.slideCount).toBe(merged.slides.length + 1); // + closing slide
  }, 30000);

  it('no-unified fallback (legacy decks): coerced flatten renders with zero failures', async () => {
    const editedDeck = simulateEdits(buildDeckDocument(report));
    const flattenedOnly = deckDocumentToRenderableUnifiedJson(editedDeck, null);

    // Contract: projected intent always matches the emitted (flattened) content shape.
    for (const slide of flattenedOnly.slides) {
      expect(['cover', 'appendix', 'key_messages']).toContain(slide.intent);
      expect((slide.content as any).type).toBe(slide.intent);
    }

    const result = await new PptxPipelineService().generateFromUnifiedJson(flattenedOnly, {
      template: 'corporate',
      language: 'en',
      confidentiality: 'confidential',
    });
    expect(renderFailures(result.warnings)).toEqual([]);
  }, 30000);

  it('deckDocumentToUnifiedJson coerces intent and preserves source_intent', () => {
    const projected = deckDocumentToUnifiedJson(buildDeckDocument(report));
    expect(projected.slides).toHaveLength(report.slides.length);
    for (let i = 0; i < projected.slides.length; i++) {
      const slide = projected.slides[i] as any;
      expect(['cover', 'appendix', 'key_messages']).toContain(slide.intent);
      expect(slide.source_intent).toBe(report.slides[i].intent);
    }
  });

  it('exports manually edited headings and semantic message labels instead of starter metadata', () => {
    const deck = buildDeckDocument(report);
    const cover = deck.cards[0];
    cover.title = 'Nowa prezentacja';
    cover.blocks = [
      {
        block_id: 'manual-cover-starter-heading',
        card_id: cover.card_id,
        type: 'heading',
        content: { text: 'Nowa prezentacja' },
        is_refreshable: false,
        position: { area: 'full', order: 0 },
        ai_editable: true,
      },
      {
        block_id: 'manual-cover-heading',
        card_id: cover.card_id,
        type: 'heading',
        content: { text: 'Board Transformation Update' },
        is_refreshable: false,
        position: { area: 'full', order: 1 },
        ai_editable: true,
      },
      {
        block_id: 'manual-cover-body',
        card_id: cover.card_id,
        type: 'paragraph',
        content: { text: 'Three executive decisions unlock the next phase.' },
        is_refreshable: false,
        position: { area: 'full', order: 2 },
        ai_editable: true,
      },
    ];

    const content = deck.cards[1];
    content.title = 'New Slide';
    content.key_message = 'New Slide';
    content.intent = 'key_messages';
    content.blocks = [
      {
        block_id: 'manual-content-heading',
        card_id: content.card_id,
        type: 'heading',
        content: { text: 'Three decisions unlock EUR 2.2m annual benefit' },
        is_refreshable: false,
        position: { area: 'full', order: 0 },
        ai_editable: true,
      },
      {
        block_id: 'manual-content-body-1',
        card_id: content.card_id,
        type: 'paragraph',
        content: { text: 'Approve phase-two scope by 15 August; confirm Operations ownership.' },
        is_refreshable: false,
        position: { area: 'full', order: 1 },
        ai_editable: true,
      },
      {
        block_id: 'manual-content-body-2',
        card_id: content.card_id,
        type: 'paragraph',
        content: {
          text: 'Mitigate data-migration delay through parallel reconciliation and weekly owner-level checkpoints before scope lock.',
        },
        is_refreshable: false,
        position: { area: 'full', order: 2 },
        ai_editable: true,
      },
    ];

    const projected = deckDocumentToUnifiedJson(deck);
    const projectedCover = projected.slides[0] as any;
    const projectedContent = projected.slides[1] as any;

    expect(projectedCover.content.title).toBe('Board Transformation Update');
    expect(projectedContent.key_message).toBe('Three decisions unlock EUR 2.2m annual benefit');
    expect(projectedContent.content.messages.map((message: any) => message.title)).toEqual([
      'Approve phase-two scope by 15 August',
      'Mitigate data-migration delay through parallel reconciliation…',
    ]);
    expect(JSON.stringify(projected)).not.toContain('"title":"paragraph"');

    const renderable = deckDocumentToRenderableUnifiedJson(deck, report);
    expect((renderable.slides[0] as any).content.title).toBe('Board Transformation Update');
    expect((renderable.slides[0] as any).key_message).toBe('Board Transformation Update');

    // Legacy manual decks use the `title` intent with cover-shaped content.
    // The renderer resolves that to CoverLayout, so content shape—not intent
    // spelling—is the authoritative signal for writing the edited title back.
    const legacyBase = JSON.parse(JSON.stringify(report)) as UnifiedReportJSON;
    (legacyBase.slides[0] as any).intent = 'title';
    cover.intent = 'title';
    const legacyRenderable = deckDocumentToRenderableUnifiedJson(deck, legacyBase);
    expect((legacyRenderable.slides[0] as any).content.title).toBe(
      'Board Transformation Update'
    );
  });

  it('cards with a changed intent fall back to the renderable flattened shape', () => {
    const deck = buildDeckDocument(report);
    const kpiCard = deck.cards.find((card) => card.intent === 'performance_overview')!;
    kpiCard.intent = 'roadmap'; // intent no longer matches the base slide
    const merged = deckDocumentToRenderableUnifiedJson(deck, report);
    const slide = merged.slides[kpiCard.order_index] as any;
    expect(slide.intent).toBe('key_messages'); // coerced fallback, not a crash shape
    expect(slide.content.type).toBe('key_messages');
  });
});
