import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbGet = vi.fn();
const dbAll = vi.fn();
const normalizeDeckDocument = vi.fn();

vi.mock('../../utils/DbPromise.js', () => ({
  get: (...args: any[]) => dbGet(...args),
  all: (...args: any[]) => dbAll(...args),
}));

vi.mock('../presentationDeckDocumentService.js', () => ({
  normalizeDeckDocument: (...args: any[]) => normalizeDeckDocument(...args),
}));

import { checkDeckQualityGates } from '../presentationQualityGatesService.js';

describe('presentationQualityGatesService', () => {
  beforeEach(() => {
    dbGet.mockReset();
    dbAll.mockReset();
    dbAll.mockResolvedValue([]);
    normalizeDeckDocument.mockReset();
  });

  it('blocks export when P0/P1 governance gates fail', async () => {
    dbGet.mockImplementation(async (query: string) => {
      if (query.includes('presentation_decks'))
        return { id: 'deck-1', presentation_mode: 'briefing' };
      if (query.includes('brand_kits')) return { id: 'brand-1' };
      return null;
    });
    normalizeDeckDocument.mockReturnValue({
      presentation_mode: 'briefing',
      cards: [
        { intent: 'cover', title: 'Cover', blocks: [{ content: { text: 'Program Update' } }] },
        {
          intent: 'recommendation_single',
          title: 'Exec',
          key_message: 'TBD',
          source_refs: [],
          blocks: [{ content: { text: 'to be populated from source data' } }],
        },
      ],
      meta: { confidentiality: 'internal' },
    });

    const report = await checkDeckQualityGates('org-1', 'deck-1');

    expect(report.canExport).toBe(false);
    expect(report.result).toBe('BLOCKED_P1');
    expect(report.scorecard.p0).toBeGreaterThan(0);
    expect(
      report.gates.some((gate) => gate.gateType === 'PLACEHOLDER_CONTENT' && gate.priority === 'P0')
    ).toBe(true);
    expect(
      report.gates.some(
        (gate) => gate.gateType === 'DECISION_MISSING_TRACEABILITY' && gate.priority === 'P1'
      )
    ).toBe(true);
  });

  it('blocks export while a manually added slide still contains starter prompts', async () => {
    dbGet.mockImplementation(async (query: string) => {
      if (query.includes('presentation_decks'))
        return { id: 'deck-manual', presentation_mode: 'show' };
      if (query.includes('brand_kits')) return { id: 'brand-1' };
      return null;
    });
    normalizeDeckDocument.mockReturnValue({
      presentation_mode: 'show',
      cards: [
        {
          intent: 'cover',
          title: 'Cover',
          blocks: [{ type: 'heading', content: { text: 'Board update' } }],
        },
        {
          intent: 'key_messages',
          title: 'New Slide',
          blocks: [
            { type: 'heading', content: { text: 'Add a clear slide title' } },
            { type: 'paragraph', content: { text: 'Add the key message or supporting evidence.' } },
          ],
        },
      ],
      meta: { confidentiality: 'internal' },
    });

    const report = await checkDeckQualityGates('org-1', 'deck-manual');
    expect(report.canExport).toBe(false);
    expect(report.gates.some((gate) => gate.gateType === 'PLACEHOLDER_CONTENT')).toBe(true);
  });

  it('returns PASS_WITH_P2 when only non-blocking warnings remain', async () => {
    dbGet.mockImplementation(async (query: string) => {
      if (query.includes('presentation_decks')) return { id: 'deck-2', presentation_mode: 'show' };
      if (query.includes('brand_kits')) return { id: 'brand-1' };
      return null;
    });
    normalizeDeckDocument.mockReturnValue({
      presentation_mode: 'show',
      cards: [
        { intent: 'cover', title: 'Cover', blocks: [{ content: { text: 'Board Briefing' } }] },
        {
          intent: 'executive_summary',
          title: 'Executive Summary',
          key_message: 'Decision: approve phase-one release',
          source_refs: [
            {
              artifact_id: 'a1',
              artifact_type: 'report',
              artifact_name: 'Report',
              confidence: 0.92,
            },
          ],
          blocks: [
            { type: 'callout', content: { text: 'High confidence summary for the decision.' } },
            { type: 'smart_layout', content: { items: [{ title: 'Value' }, { title: 'Risk' }] } },
          ],
          speaker_notes: 'Presenter narrative for executive context.',
        },
        {
          intent: 'next_steps',
          title: 'Next Steps',
          key_message: 'Decision owners and timeline for approval',
          source_refs: [
            {
              artifact_id: 'a2',
              artifact_type: 'report',
              artifact_name: 'Roadmap',
              confidence: 0.88,
            },
          ],
          blocks: [
            {
              type: 'numbered_list',
              content: {
                text: 'Action items and owners with explicit sequencing, decision framing, governance checkpoints, implementation details, dependency notes, communication paths, risk safeguards, and release prerequisites for each workstream owner.',
              },
            },
            { type: 'callout', content: { text: 'Approve owners and launch the first gate.' } },
          ],
        },
      ],
      meta: { confidentiality: 'internal' },
    });

    const report = await checkDeckQualityGates('org-1', 'deck-2');

    expect(report.result).toBe('PASS_WITH_P2');
    expect(report.scorecard.p0).toBe(0);
    expect(report.scorecard.p1).toBe(0);
    expect(report.scorecard.p2).toBeGreaterThan(0);
  });

  it('accepts a custom-template deck with inherited lineage, theme and exporter metadata', async () => {
    dbGet.mockImplementation(async (query: string) => {
      if (query.includes('presentation_decks'))
        return { id: 'deck-template', presentation_mode: 'briefing' };
      if (query.includes('brand_kits')) return null;
      return null;
    });
    const sourceRef = {
      artifact_id: 'template-artifact-1',
      artifact_type: 'presentation_template',
      artifact_name: 'Board Transformation Control',
      confidence: 1,
      freshness_days: 0,
    };
    const intents = [
      'cover',
      'executive_summary',
      'performance_overview',
      'initiative_portfolio',
      'roadmap',
      'risk_management',
      'next_steps',
      'appendix',
    ];
    normalizeDeckDocument.mockReturnValue({
      presentation_mode: 'briefing',
      cards: intents.map((intent, index) => ({
        intent,
        title: `Slide ${index + 1} grounded title`,
        key_message: `Grounded template guidance for slide ${index + 1}`,
        source_refs: [sourceRef],
        blocks:
          intent === 'cover'
            ? [{ type: 'heading', content: { text: 'Board Transformation Control' } }]
            : [
                {
                  type:
                    intent === 'performance_overview'
                      ? 'metric_strip'
                      : intent === 'roadmap'
                        ? 'timeline_block'
                        : intent === 'risk_management'
                          ? 'table'
                          : intent === 'next_steps'
                            ? 'numbered_list'
                            : intent === 'executive_summary'
                              ? 'callout'
                              : 'bullet_list',
                  content: {
                    text: 'Substantive template guidance for a reusable board presentation structure and its evidence.',
                  },
                },
                { type: 'paragraph', content: { text: 'Audience-ready supporting explanation.' } },
              ],
        ...(index === 0
          ? {}
          : {
              header_footer: { footerText: 'Board Transformation Control', pageNumber: index + 1 },
            }),
      })),
      meta: { confidentiality: 'internal' },
      delivery: {
        brandLayoutSystem: {
          source: 'custom_template',
          brand: { primaryColor: '#123456', titleFont: 'Aptos Display' },
        },
      },
    });

    const report = await checkDeckQualityGates('org-1', 'deck-template');

    expect(report.gates.map((gate) => gate.gateType)).not.toContain('LOW_TRACEABILITY');
    expect(report.gates.map((gate) => gate.gateType)).not.toContain(
      'DECISION_MISSING_TRACEABILITY'
    );
    expect(report.gates.map((gate) => gate.gateType)).not.toContain('MISSING_HEADER_FOOTER');
    expect(report.gates.map((gate) => gate.gateType)).not.toContain('NO_BRAND_KIT');
    expect(report.scorecard.p1).toBe(0);
  });

  // BUG C: a slide that pasted the template catalogue as content must HARD FAIL (P0),
  // never "clean". This is the exact regression the adversarial judge caught (score 6/100).
  it('FAILS (P0) when template inventory leaked into slide content', async () => {
    dbGet.mockImplementation(async (query: string) => {
      if (query.includes('presentation_decks'))
        return { id: 'deck-3', presentation_mode: 'briefing' };
      if (query.includes('brand_kits')) return { id: 'brand-1' };
      return null;
    });
    normalizeDeckDocument.mockReturnValue({
      presentation_mode: 'briefing',
      cards: [
        { intent: 'cover', title: 'Cover', blocks: [{ content: { text: 'Report' } }] },
        {
          intent: 'single_insight',
          title: 'Key findings',
          key_message: 'Findings',
          source_refs: [{ artifact_id: 'a1', confidence: 0.9 }],
          blocks: [
            {
              content: {
                text: 'Available templates (20): Okresowy raport postępu, Pitch inwestorski, Analiza rynku',
              },
            },
          ],
        },
      ],
      meta: { confidentiality: 'internal' },
    });

    const report = await checkDeckQualityGates('org-1', 'deck-3');

    expect(report.canExport).toBe(false);
    expect(
      report.gates.some(
        (gate) => gate.gateType === 'TEMPLATE_INVENTORY_LEAK' && gate.priority === 'P0'
      )
    ).toBe(true);
  });

  // BUG C: decision slides (recommendations/risks/roadmap) with empty content must FAIL (P1).
  it('FAILS (P1) when decision sections are present but empty', async () => {
    dbGet.mockImplementation(async (query: string) => {
      if (query.includes('presentation_decks'))
        return { id: 'deck-4', presentation_mode: 'briefing' };
      if (query.includes('brand_kits')) return { id: 'brand-1' };
      return null;
    });
    normalizeDeckDocument.mockReturnValue({
      presentation_mode: 'briefing',
      cards: [
        { intent: 'cover', title: 'Cover', blocks: [{ content: { text: 'Report' } }] },
        {
          intent: 'recommendation_portfolio',
          title: 'Recommendations',
          key_message: 'Recommendations',
          source_refs: [{ artifact_id: 'a1', confidence: 0.9 }],
          blocks: [{ content: { text: '' } }],
        },
      ],
      meta: { confidentiality: 'internal' },
    });

    const report = await checkDeckQualityGates('org-1', 'deck-4');

    expect(
      report.gates.some(
        (gate) => gate.gateType === 'EMPTY_DECISION_SECTIONS' && gate.priority === 'P1'
      )
    ).toBe(true);
  });

  it('blocks a visually sparse title-plus-thesis deck and reports missing layout evidence', async () => {
    dbGet.mockImplementation(async (query: string) => {
      if (query.includes('presentation_decks'))
        return { id: 'deck-sparse', presentation_mode: 'briefing' };
      if (query.includes('brand_kits')) return { id: 'brand-1' };
      return null;
    });
    const sourceRef = { artifact_id: 'template-1', confidence: 1 };
    normalizeDeckDocument.mockReturnValue({
      presentation_mode: 'briefing',
      cards: [
        {
          intent: 'cover',
          title: 'Cover',
          source_refs: [sourceRef],
          blocks: [{ type: 'heading', content: { text: 'Cover' } }],
        },
        {
          intent: 'performance_overview',
          title: 'Investment economics',
          key_message: 'Economics are attractive under the base case.',
          source_refs: [sourceRef],
          blocks: [
            {
              type: 'paragraph',
              content: { text: 'Economics are attractive under the base case.' },
            },
          ],
        },
      ],
      meta: { confidentiality: 'internal' },
    });

    const report = await checkDeckQualityGates('org-1', 'deck-sparse');

    expect(report.canExport).toBe(false);
    expect(report.result).toBe('BLOCKED_P1');
    expect(report.gates.map((gate) => gate.gateType)).toEqual(
      expect.arrayContaining(['LOW_INFORMATION_SLIDES', 'LAYOUT_EVIDENCE_MISSING'])
    );
  });

  it('reports explicit unresolved Data required labels as P2 rather than P0', async () => {
    dbGet.mockImplementation(async (query: string) => {
      if (query.includes('presentation_decks'))
        return { id: 'deck-data-gap', presentation_mode: 'show' };
      if (query.includes('brand_kits')) return { id: 'brand-1' };
      return null;
    });
    normalizeDeckDocument.mockReturnValue({
      presentation_mode: 'show',
      cards: [
        {
          intent: 'performance_overview',
          title: 'Economics',
          key_message: 'Economics require one final input before approval.',
          source_refs: [{ artifact_id: 'brief-1', confidence: 1 }],
          blocks: [
            {
              type: 'metric_strip',
              content: { metrics: [{ label: 'Payback', value: 'Data required' }] },
            },
          ],
        },
      ],
      meta: { confidentiality: 'internal' },
    });

    const report = await checkDeckQualityGates('org-1', 'deck-data-gap');
    expect(report.gates).toContainEqual(
      expect.objectContaining({ id: 'qg-unresolved-data', priority: 'P2' })
    );
    expect(report.gates).not.toContainEqual(
      expect.objectContaining({ id: 'qg-placeholder-content', priority: 'P0' })
    );
  });
});
