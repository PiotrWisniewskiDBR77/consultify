import { describe, expect, it } from 'vitest';

import {
  applyBrandLayoutSystem,
  buildBrandLayoutSystem,
} from '../presentationBrandLayoutService.js';
import {
  deckDocumentFromUnifiedJson,
  deckDocumentToUnifiedJson,
} from '../presentationDeckDocumentService.js';
import type { DeckSetup, OutlineItem } from '../presentationGeneratorService.js';
import {
  applyTemplateRuntime,
  buildSystemTemplateRuntime,
} from '../presentationTemplateRuntimeService.js';
import { planSlides } from '../slidePlanningEngineService.js';
import {
  applyTransformationPackToArtifactData,
  buildTransformationReadDeckPack,
} from '../transformationReadDeckPackService.js';
import type { ContextPack } from '../contextPackBuilder.js';
import type { UnifiedReportJSON } from '../report/pptx/types.js';

const vtsSources = [
  {
    type: 'tool_session',
    id: 'vts-interview-study-2026',
    artifactId: 'art-vts-interview-study-2026',
    label: 'VTS interview study 2026',
    confidence: 0.86,
    readiness: 'ready',
    lineage: { runtime: 'interview', recordId: 'vts-interview-study-2026', family: 'evidence' },
  },
  {
    type: 'assessment',
    id: 'vts-drd-assessment',
    artifactId: 'art-vts-drd-assessment',
    label: 'VTS DRD assessment',
    confidence: 0.82,
    readiness: 'ready',
    lineage: { runtime: 'assessment', recordId: 'vts-drd-assessment', family: 'diagnostic' },
  },
  {
    type: 'initiative_portfolio',
    id: 'vts-initiative-portfolio',
    artifactId: 'art-vts-initiative-portfolio',
    label: 'VTS transformation initiatives',
    confidence: 0.78,
    readiness: 'ready',
    lineage: { runtime: 'initiative', recordId: 'vts-initiative-portfolio', family: 'plan' },
  },
] as DeckSetup['sourceArtifacts'];

function makeVtsOutline(): OutlineItem[] {
  const intents: OutlineItem['intent'][] = [
    'cover',
    'executive_summary',
    'performance_overview',
    'assessment',
    'key_messages',
    'initiative_portfolio',
    'roadmap',
    'risk_management',
    'next_steps',
    'appendix',
  ];
  return Array.from({ length: 52 }, (_, index) => {
    const intent = intents[index % intents.length];
    return {
      intent,
      title:
        index === 0
          ? 'Program Transformacji Cyfrowej VTS Group'
          : `VTS transformation section ${index + 1}`,
      keyMessage: `Evidence-backed message ${index + 1}`,
      enabled: true,
      sourceRef:
        intent === 'cover' || intent === 'next_steps'
          ? undefined
          : vtsSources[index % vtsSources.length].artifactId,
    };
  });
}

function makeUnifiedFromOutline(outline: OutlineItem[]): UnifiedReportJSON {
  return {
    meta: {
      client: 'VTS Group',
      project: 'Program Transformacji Cyfrowej VTS Group',
      date: '2026-05-05',
      author: 'Consultify',
      confidentiality: 'confidential',
      language: 'pl',
      template: 'corporate',
    },
    slides: outline.map((item, index) => ({
      intent: item.intent,
      key_message: item.keyMessage || item.title,
      content:
        item.intent === 'cover'
          ? {
              type: 'cover',
              title: item.title,
              subtitle: 'Read deck zarządczy',
              organization: 'VTS Group',
              date: 'Maj 2026',
              confidentiality: 'confidential',
            }
          : item.intent === 'initiative_portfolio'
            ? {
                type: 'initiative_portfolio',
                initiatives: [
                  {
                    name: `Initiative ${index}`,
                    priority: 'high',
                    timeline: '30 days',
                    owner: 'Program Office',
                  },
                ],
              }
            : {
                type: 'key_messages',
                messages: [
                  {
                    title: item.title,
                    description: item.keyMessage || 'Grounded recommendation',
                  },
                ],
              },
      source_refs: item.sourceRef
        ? [
            {
              artifact_id: item.sourceRef,
              artifact_type: 'evidence',
              artifact_name: 'VTS evidence pack',
            },
          ]
        : [],
    })) as UnifiedReportJSON['slides'],
  };
}

describe('presentation generator VTS golden deck contract', () => {
  it('plans a VTS read deck with review metadata and concrete source refs', () => {
    const setup: DeckSetup = {
      title: 'Program Transformacji Cyfrowej VTS Group',
      audience: 'executive',
      goal: 'decide',
      language: 'pl',
      theme: 'corporate',
      confidentiality: 'confidential',
      sourceArtifacts: vtsSources,
    };
    const plan = planSlides({ setup, outline: makeVtsOutline() });

    expect(plan.outline).toHaveLength(52);
    expect(plan.createMode).toBe('artifact-first');
    expect(plan.slideRecipes[1].confidence).toBeGreaterThan(0.7);
    expect(plan.slideRecipes[1].sourceRefs.length).toBeGreaterThan(0);
    expect(plan.slideRecipes.some((recipe) => recipe.visualPolicy === 'data_first')).toBe(true);
  });

  it('normalizes, brands and projects the golden deck without losing cards', () => {
    const outline = makeVtsOutline();
    const deck = deckDocumentFromUnifiedJson({
      deckId: 'deck-vts-golden',
      organizationId: 'org-vts',
      title: 'Program Transformacji Cyfrowej VTS Group',
      unifiedJson: makeUnifiedFromOutline(outline),
      outline,
      setup: {
        language: 'pl',
        confidentiality: 'confidential',
        presentationMode: 'document',
        communicationRegister: 'executive',
      },
      sourceArtifacts: vtsSources,
      status: 'ready',
    });

    const branded = applyBrandLayoutSystem(
      deck,
      buildBrandLayoutSystem({
        brandColor: '#0B3D91',
        confidentiality: 'confidential',
        templateFamily: 'Digital Transformation Read Deck',
      })
    );
    const projected = deckDocumentToUnifiedJson(branded);

    expect(branded.cards).toHaveLength(52);
    expect(branded.cards[1] as any).toHaveProperty('header_footer');
    expect(branded.cards.every((card) => card.layout_id)).toBe(true);
    expect(projected.slides).toHaveLength(52);
    expect(projected.meta.confidentiality).toBe('confidential');
  });

  it('executes system template runtime as a full recipe', () => {
    const runtime = buildSystemTemplateRuntime('Digital Transformation Read Deck');
    const applied = applyTemplateRuntime({
      runtime,
      outline: makeVtsOutline(),
      sources: vtsSources,
    });

    expect(runtime.slideRecipes.some((recipe) => recipe.intent === 'recommendation_portfolio')).toBe(true);
    const recipeIntents = new Set(runtime.slideRecipes.map((recipe) => recipe.intent));
    expect(
      applied.outline
        .filter((item) => recipeIntents.has(item.intent))
        .every((item) => item.layoutHint && item.suggestedBlocks?.length)
    ).toBe(true);
    expect(applied.warnings).toEqual([]);
  });

  it('builds TransformationReadDeckPack and maps narrative context into deck-ready data', () => {
    const contextPack: ContextPack = {
      pack_id: 'cp-vts',
      created_at: '2026-05-05T00:00:00.000Z',
      organization_id: 'org-vts',
      language: 'pl',
      sources: [],
      headings: ['VTS transformation'],
      key_points: ['Brak jednego ownera procesu obniża tempo decyzji.'],
      data_points: [{ label: 'Maturity', value: 3.2, unit: '/5', source_artifact_id: 'art-vts' }],
      charts_available: [],
      images_available: [],
      metadata: { total_source_artifacts: 3, confidence_score: 0.84, extraction_warnings: [] },
    };
    const pack = buildTransformationReadDeckPack({
      contextPack,
      artifactData: {},
      sources: vtsSources,
      language: 'pl',
    });
    const mapped = applyTransformationPackToArtifactData({}, pack);

    expect(pack.insightPack.length).toBeGreaterThan(0);
    expect(mapped._keyFindings[0]).toContain('ownera');
    expect(mapped._kpis[0].label).toBe('Maturity');
    expect(mapped._actions.length).toBeGreaterThan(0);
  });

  it('maps narrative enrichment into canonical card blocks instead of orphan metadata', () => {
    const outline = makeVtsOutline().slice(0, 2);
    const unified = makeUnifiedFromOutline(outline);
    (unified.slides[1] as any)._narrative_enrichment = {
      content: 'Narrative engine sentence grounded in interview evidence.',
      facts_used: 2,
      observations_used: 1,
    };
    const deck = deckDocumentFromUnifiedJson({
      deckId: 'deck-vts-narrative',
      organizationId: 'org-vts',
      title: 'Narrative test',
      unifiedJson: unified,
    });

    const textBlocks = deck.cards[1].blocks.filter((block) => block.type === 'paragraph');
    expect(textBlocks.some((block) => String(block.content.text).includes('Narrative engine'))).toBe(true);
  });
});
