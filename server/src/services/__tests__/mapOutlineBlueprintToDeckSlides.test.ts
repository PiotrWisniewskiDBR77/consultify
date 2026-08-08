/**
 * R11 deck slice (2026-07-26) — `mapOutlineBlueprintToDeckSlides`.
 *
 * This is the fix for the R0 audit finding: "Użyj wzorca" for a presentation
 * used to discard the template's structure and hand the AI chat pipeline a
 * text description instead. The replacement is a pure, deterministic
 * outline_json -> slide mapping — no AI, no DB — so this test proves the
 * copy against a REAL `outline_json` fixture shape (migration 568 seed
 * shape), not against "whatever the model produced".
 *
 * `POST /presentations/decks/from-template` (server/src/routes/presentations.routes.ts)
 * is the production caller — it must never re-derive this mapping inline.
 */
import { describe, expect, it } from 'vitest';

import { mapOutlineBlueprintToDeckSlides } from '../presentationTemplateRuntimeService.js';

/** Same shape as the `pt-steering` system template seeded by migration 568. */
const STEERING_OUTLINE_FIXTURE = [
  { intent: 'cover', title: 'Steering Committee Update' },
  { intent: 'executive_summary', title: 'Executive Summary' },
  { intent: 'key_messages', title: 'Key Messages' },
  { intent: 'performance_overview', title: 'Portfolio Health' },
  { intent: 'initiative_portfolio', title: 'Initiative Portfolio' },
  { intent: 'roadmap', title: 'Execution Roadmap' },
  { intent: 'risk_management', title: 'Risks & Mitigations' },
  { intent: 'next_steps', title: 'Next Steps & Decisions' },
];

describe('mapOutlineBlueprintToDeckSlides', () => {
  it('produces exactly one slide per outline item, in order, with matching intent + title', () => {
    const slides = mapOutlineBlueprintToDeckSlides(STEERING_OUTLINE_FIXTURE);

    expect(slides).toHaveLength(STEERING_OUTLINE_FIXTURE.length);
    slides.forEach((slide, index) => {
      const source = STEERING_OUTLINE_FIXTURE[index];
      expect(slide.type).toBe(source.intent);
      expect(slide.content.intent).toBe(source.intent);
      expect(slide.content.title).toBe(source.title);
      // The heading block carries the REAL title from the fixture.
      expect(slide.content.blocks[0]).toEqual({
        type: 'heading',
        content: { text: source.title, level: 1 },
      });
    });
  });

  it('carries keyMessage into a text block when the outline item has one', () => {
    const slides = mapOutlineBlueprintToDeckSlides([
      { intent: 'executive_summary', title: 'Executive Summary', keyMessage: 'Q3 on track' },
    ]);

    expect(slides[0].content.blocks).toEqual(
      expect.arrayContaining([
        { type: 'heading', content: { text: 'Executive Summary', level: 1 } },
        { type: 'callout', content: { variant: 'recommendation', text: 'Q3 on track' } },
      ])
    );
  });

  it('accepts the snake_case key_message spelling too', () => {
    const slides = mapOutlineBlueprintToDeckSlides([
      { intent: 'next_steps', title: 'Next Steps', key_message: 'Ship by Friday' },
    ]);

    expect(slides[0].content.blocks).toContainEqual({
      type: 'callout',
      content: { variant: 'decision', text: 'Ship by Friday' },
    });
  });

  it('omits the text block when there is no keyMessage (heading-only slide)', () => {
    const slides = mapOutlineBlueprintToDeckSlides([{ intent: 'cover', title: 'Cover' }]);
    expect(slides[0].content.blocks).toEqual([
      { type: 'heading', content: { text: 'Cover', level: 1 } },
    ]);
  });

  it('falls back to a positional title when an outline item has none', () => {
    const slides = mapOutlineBlueprintToDeckSlides([{ intent: 'appendix' }]);
    expect(slides[0].content.title).toBe('Slide 1');
    expect(slides[0].type).toBe('appendix');
  });

  it('falls back to intent "content" when an outline item has none', () => {
    const slides = mapOutlineBlueprintToDeckSlides([{ title: 'Untitled slide' }]);
    expect(slides[0].type).toBe('content');
    expect(slides[0].content.intent).toBe('content');
  });

  it('returns an empty array for an empty or non-array blueprint (never throws)', () => {
    expect(mapOutlineBlueprintToDeckSlides([])).toEqual([]);
    expect(mapOutlineBlueprintToDeckSlides(null as unknown as unknown[])).toEqual([]);
    expect(mapOutlineBlueprintToDeckSlides(undefined as unknown as unknown[])).toEqual([]);
  });

  it('tolerates a non-object item in the array without throwing', () => {
    const slides = mapOutlineBlueprintToDeckSlides(['not-an-object', 42, null]);
    expect(slides).toHaveLength(3);
    expect(slides[0].content.title).toBe('Slide 1');
    expect(slides[2].content.title).toBe('Slide 3');
  });

  it('is a pure, deterministic function — no AI, no randomness, same input = same output', () => {
    const a = mapOutlineBlueprintToDeckSlides(STEERING_OUTLINE_FIXTURE);
    const b = mapOutlineBlueprintToDeckSlides(STEERING_OUTLINE_FIXTURE);
    expect(a).toEqual(b);
  });

  it('materialises layout-specific native blocks for an executive decision deck', () => {
    const slides = mapOutlineBlueprintToDeckSlides([
      { intent: 'executive_summary', title: 'Recommendation', keyMessage: 'Approve gated scale' },
      {
        intent: 'performance_overview',
        title: 'Economics',
        dataNeeded: ['Investment', 'Annual benefit', 'Payback'],
      },
      { intent: 'comparison', title: 'Scenarios' },
      { intent: 'roadmap', title: 'Roadmap' },
      { intent: 'risk_management', title: 'Risks' },
      { intent: 'recommendation_portfolio', title: 'Governance' },
      { intent: 'next_steps', title: 'Decision' },
    ]);

    expect(slides.map((slide) => slide.content.blocks.map((block) => block.type))).toEqual([
      ['heading', 'callout', 'smart_layout'],
      ['heading', 'paragraph', 'metric_strip'],
      ['heading', 'paragraph', 'smart_layout'],
      ['heading', 'paragraph', 'timeline_block'],
      ['heading', 'paragraph', 'table'],
      ['heading', 'callout', 'bullet_list'],
      ['heading', 'callout', 'numbered_list'],
    ]);
    expect(
      new Set(slides.flatMap((slide) => slide.content.blocks.map((block) => block.type))).size
    ).toBeGreaterThanOrEqual(8);
  });

  it('grounds metric values from the supplied brief and marks only absent data explicitly', () => {
    const [slide] = mapOutlineBlueprintToDeckSlides([
      {
        intent: 'performance_overview',
        title: 'Economics',
        keyMessage: 'Investment: EUR 1.4m; NPV: EUR 3.2m',
        contentHints: ['Annual benefit: EUR 900k'],
        dataNeeded: ['Investment', 'Annual benefit', 'Payback'],
      },
    ]);
    const metrics = slide.content.blocks.find((block) => block.type === 'metric_strip')?.content
      .metrics;
    expect(metrics).toEqual([
      expect.objectContaining({ label: 'Investment', value: 'EUR 1.4m' }),
      expect.objectContaining({ label: 'Annual benefit', value: 'EUR 900k' }),
      expect.objectContaining({ label: 'Payback', value: 'Data required' }),
    ]);
    expect(JSON.stringify(slide)).not.toContain('Validate');
  });

  it('uses the intake brief across template slides so a complete Nova brief leaves no gaps', () => {
    const slides = mapOutlineBlueprintToDeckSlides(
      [
        {
          intent: 'executive_summary',
          title: 'Recommendation',
          dataNeeded: ['Recommended scenario', 'Investment envelope', 'Annual benefit'],
        },
        {
          intent: 'performance_overview',
          title: 'Economics',
          dataNeeded: ['Implementation cost', 'Run-rate benefit', 'NPV', 'Payback'],
        },
      ],
      'Recommended scenario: Gated Scale; Investment envelope: EUR 1.4m; Annual benefit: EUR 2.2m; Implementation cost: EUR 1.4m; Run-rate benefit: EUR 2.2m; NPV: EUR 3.2m; Payback: 11 months'
    );
    const serialized = JSON.stringify(slides);
    expect(serialized).not.toContain('Data required');
    expect(serialized).not.toContain('Validate');
    expect(serialized).toContain('EUR 3.2m');
    expect(serialized).toContain('11 months');
  });

  it('turns a prose steering brief into factual metrics, risks and decisions', () => {
    const slides = mapOutlineBlueprintToDeckSlides(
      [
        { intent: 'performance_overview', title: 'Performance', dataNeeded: ['Annual benefit'] },
        { intent: 'risk_management', title: 'Risks' },
        { intent: 'next_steps', title: 'Decisions' },
      ],
      'Program Atlas. Annual benefit: EUR 2.2m. Top risks: data migration delay, adoption in two business units. Mitigations: parallel reconciliation, named local champions. Decisions required: lock phase-two scope by 15 August, confirm Operations owner.'
    );

    const serialized = JSON.stringify(slides);
    expect(serialized).toContain('EUR 2.2m');
    expect(serialized).toContain('data migration delay');
    expect(serialized).toContain('parallel reconciliation');
    expect(serialized).toContain('lock phase-two scope by 15 August');
    expect(serialized).toContain('confirm Operations owner');
  });

  it('replaces generic custom VC guidance with slide-specific brief facts', () => {
    const slides = mapOutlineBlueprintToDeckSlides(
      [
        {
          intent: 'content',
          title: 'Problem & Customer',
          keyMessage: 'A specific customer segment has an urgent problem.',
        },
        {
          intent: 'content',
          title: 'Financial Outlook',
          keyMessage: 'The model creates an investable path.',
        },
      ],
      'Customer: solo founders with agent-generated mobile prototypes. Problem: they cannot safely ship production systems. Financial scenarios: active apps, USD 20 subscription, hosting COGS, EBITDA, cash and runway.'
    );

    const problem = JSON.stringify(slides[0]);
    const financial = JSON.stringify(slides[1]);
    expect(problem).toContain('solo founders');
    expect(problem).not.toContain('specific customer segment');
    expect(financial).toContain('USD 20 subscription');
    expect(financial).not.toContain('creates an investable path');
  });

  it('decodes safe HTML entities in Template Architect slide titles', () => {
    const [slide] = mapOutlineBlueprintToDeckSlides([
      { intent: 'content', title: 'Problem &amp; Customer' },
    ]);
    expect(slide.content.title).toBe('Problem & Customer');
    expect(JSON.stringify(slide)).not.toContain('&amp;');
  });
});
