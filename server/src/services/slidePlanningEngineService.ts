import type { DeckSetup, OutlineItem, SourceArtifact } from './presentationGeneratorService.js';
import type { SlideIntent } from './report/pptx/types.js';

export type DeckCreateMode = 'template-first' | 'artifact-first' | 'blank-brief' | 'library-first';
export type SlideDensity = 'visual' | 'balanced' | 'document';
export type VisualPolicy =
  | 'hero_visual'
  | 'data_first'
  | 'diagram_first'
  | 'supporting_visual'
  | 'text_only';

export interface SlideRecipe {
  outlineId: string;
  intent: SlideIntent;
  title: string;
  keyMessage: string;
  sourceRefs: string[];
  confidence: number;
  layoutFamily: string;
  blockMix: string[];
  density: SlideDensity;
  visualPolicy: VisualPolicy;
  notesPolicy: 'none' | 'light' | 'standard' | 'speaker_heavy';
  fallbackPolicy?: 'degradation_notice' | 'skip_slide' | 'keep_with_warning';
  warnings: string[];
}

export interface SlidePlanningResult {
  deckIntentSummary: string;
  createMode: DeckCreateMode;
  outline: OutlineItem[];
  slideRecipes: SlideRecipe[];
  sourcePriorityMap: Record<string, number>;
  evidenceGaps: string[];
  warnings: string[];
}

function sourceId(source: SourceArtifact): string {
  return String(source.artifactId || source.id || source.type);
}

function confidenceForSource(source?: SourceArtifact): number {
  if (!source) return 0.35;
  if (typeof source.confidence === 'number') return Math.max(0, Math.min(1, source.confidence));
  if (source.readiness && source.readiness !== 'ready') return 0.45;
  if (!source.id || source.id.startsWith('manual-')) return 0.4;
  return 0.75;
}

function densityForMode(mode: string | undefined): SlideDensity {
  if (mode === 'document') return 'document';
  if (mode === 'show' || mode === 'workshop') return 'visual';
  return 'balanced';
}

function visualPolicyForIntent(intent: SlideIntent, density: SlideDensity): VisualPolicy {
  if (intent === 'cover' || intent === 'section_intro') return 'hero_visual';
  if (
    intent === 'performance_overview' ||
    intent === 'assessment' ||
    intent === 'prioritization_matrix'
  ) {
    return 'data_first';
  }
  if (intent === 'roadmap' || intent === 'root_cause') return 'diagram_first';
  if (density === 'document' || intent === 'appendix') return 'text_only';
  return 'supporting_visual';
}

function layoutForIntent(intent: SlideIntent): string {
  const map: Partial<Record<SlideIntent, string>> = {
    cover: 'cover',
    executive_summary: 'executive-summary',
    section_intro: 'section-divider',
    performance_overview: 'dashboard',
    assessment: 'maturity-dashboard',
    initiative_portfolio: 'portfolio-table',
    recommendation_portfolio: 'initiative-cards',
    roadmap: 'roadmap',
    risk_management: 'risk-table',
    appendix: 'appendix-table',
  };
  return map[intent] || 'content-card';
}

function blockMixForIntent(intent: SlideIntent): string[] {
  const map: Partial<Record<SlideIntent, string[]>> = {
    cover: ['title', 'subtitle', 'client-meta', 'confidentiality'],
    executive_summary: ['headline', 'key-findings', 'decision-callout'],
    performance_overview: ['kpi-strip', 'evidence-summary', 'commentary'],
    assessment: ['score-matrix', 'gap-callouts', 'evidence-note'],
    initiative_portfolio: ['initiative-table', 'priority-chip', 'owner-timeline'],
    roadmap: ['phase-timeline', 'milestones', 'owners'],
    risk_management: ['risk-table', 'mitigations'],
    appendix: ['dense-table', 'source-notes'],
  };
  return map[intent] || ['heading', 'message', 'supporting-evidence'];
}

function createModeFor(setup: DeckSetup, hasTemplateOutline: boolean): DeckCreateMode {
  if (setup.templateId || hasTemplateOutline) return 'template-first';
  if ((setup.sourceArtifacts || []).some((source) => source.artifactId || source.id))
    return 'artifact-first';
  return 'blank-brief';
}

export function planSlides(params: {
  setup: DeckSetup;
  outline: OutlineItem[];
  templateOutlineUsed?: boolean;
}): SlidePlanningResult {
  const setup = params.setup;
  const sources = Array.isArray(setup.sourceArtifacts) ? setup.sourceArtifacts : [];
  const density = densityForMode((setup as any).presentationMode);
  const sourcePriorityMap = sources.reduce<Record<string, number>>((acc, source, index) => {
    acc[sourceId(source)] = Math.max(0.1, 1 - index * 0.08);
    return acc;
  }, {});

  const warnings: string[] = [];
  const evidenceGaps: string[] = [];
  const outline = params.outline.map((item, index) => {
    const matchedSource =
      sources.find((source) => sourceId(source) === item.sourceRef) ||
      sources.find((source) => item.title.toLowerCase().includes(source.type.replace(/_/g, ' '))) ||
      sources[index % Math.max(1, sources.length)];
    const confidence = confidenceForSource(matchedSource);
    const sourceRefs = matchedSource ? [sourceId(matchedSource)] : [];
    const slideWarnings: string[] = [];
    let fallbackPolicy: SlideRecipe['fallbackPolicy'] = 'keep_with_warning';
    // Only flag a "missing source" gap when the deck DOES reference sources but
    // none matched this slide. A blank-brief deck (zero sources) is a narrative
    // deck by design — degrading every analytical slide to a data-gap notice is
    // noise, not signal.
    if (
      sources.length > 0 &&
      !matchedSource &&
      item.intent !== 'cover' &&
      item.intent !== 'next_steps'
    ) {
      slideWarnings.push('No concrete source artifact matched to this slide.');
      evidenceGaps.push(`${item.title}: missing concrete source artifact`);
      fallbackPolicy = 'degradation_notice';
    }
    if (matchedSource?.readiness && matchedSource.readiness !== 'ready') {
      slideWarnings.push(`Source readiness is ${matchedSource.readiness}.`);
      evidenceGaps.push(`${item.title}: ${matchedSource.readiness}`);
    }
    if (confidence < 0.6) slideWarnings.push('Low grounding confidence.');

    const itemDensity = (item as any).density || density;
    const visualPolicy = ((item as any).visualPolicy ||
      visualPolicyForIntent(item.intent, itemDensity)) as VisualPolicy;
    const plannedItem: OutlineItem = {
      ...item,
      keyMessage:
        item.keyMessage ||
        ((setup as any).communicationRegister === 'executive'
          ? `Decision message: ${item.title}`
          : `Key message for ${item.title}`),
      sourceRef: sourceRefs[0] || item.sourceRef,
      confidence,
      sourceRefs,
      density: itemDensity,
      visualPolicy,
      layoutHint:
        item.layoutHint ||
        (fallbackPolicy === 'degradation_notice'
          ? 'degradation-data-gap'
          : layoutForIntent(item.intent)),
      suggestedBlocks:
        item.suggestedBlocks ||
        (fallbackPolicy === 'degradation_notice'
          ? ['data_gap_notice', 'required_source_types', 'data_owner']
          : blockMixForIntent(item.intent)),
      notesPolicy:
        (item as any).notesPolicy || (itemDensity === 'visual' ? 'speaker_heavy' : 'standard'),
      warnings: [...(item.warnings || []), ...slideWarnings],
    } as OutlineItem;
    (plannedItem as any).fallbackPolicy = fallbackPolicy;
    return plannedItem;
  });

  if (evidenceGaps.length) warnings.push('Some planned slides have incomplete evidence grounding.');
  if (density === 'document' && outline.length < 10) {
    warnings.push('Document mode usually needs a denser read-deck outline.');
  }

  const slideRecipes = outline.map((item, index) => ({
    outlineId: `outline-${index + 1}`,
    intent: item.intent,
    title: item.title,
    keyMessage: item.keyMessage || item.title,
    sourceRefs: (item as any).sourceRefs || (item.sourceRef ? [item.sourceRef] : []),
    confidence: (item as any).confidence ?? 0.5,
    layoutFamily: (item as any).layoutHint || layoutForIntent(item.intent),
    blockMix: (item as any).suggestedBlocks || blockMixForIntent(item.intent),
    density: ((item as any).density || density) as SlideDensity,
    visualPolicy: (item as any).visualPolicy || visualPolicyForIntent(item.intent, density),
    notesPolicy:
      (item as any).notesPolicy ||
      (((item as any).density || density) === 'visual' ? 'speaker_heavy' : 'standard'),
    fallbackPolicy: (item as any).fallbackPolicy || 'keep_with_warning',
    warnings: (item as any).warnings || [],
  }));

  return {
    deckIntentSummary: `${setup.title} for ${setup.audience} to ${setup.goal}`,
    createMode: createModeFor(setup, Boolean(params.templateOutlineUsed)),
    outline,
    slideRecipes,
    sourcePriorityMap,
    evidenceGaps: [...new Set(evidenceGaps)],
    warnings,
  };
}
