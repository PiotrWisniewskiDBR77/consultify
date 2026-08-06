import type { OutlineItem, SourceArtifact } from './presentationGeneratorService.js';
import type { SlideIntent } from './report/pptx/types.js';

export type TemplateFamily =
  | 'Digital Transformation Read Deck'
  | 'Board Decision Deck'
  | 'DRD Diagnostic Deck'
  | 'Initiative Kickoff Deck'
  | 'Steering Committee Deck'
  | string;

export interface TemplateSlideRecipe {
  intent: SlideIntent;
  layoutFamily: string;
  requiredBlocks: string[];
  optionalBlocks?: string[];
  fallbackPolicy?: 'degradation_notice' | 'skip_slide' | 'keep_with_warning';
  density: 'visual' | 'balanced' | 'document';
  visualPolicy: 'hero_visual' | 'data_first' | 'diagram_first' | 'supporting_visual' | 'text_only';
  notesPolicy: 'none' | 'light' | 'standard' | 'speaker_heavy';
  sourceTypes?: string[];
}

export type CustomTemplateLayoutRole = 'cover' | 'content' | 'kpi' | 'table' | 'decision';

export interface PresentationCustomTemplateDefinition {
  version: number;
  theme: {
    titleFont: string;
    bodyFont: string;
    primaryColor: string;
    backgroundColor: string;
    surfaceColor: string;
    textColor: string;
    accentColor: string;
    logoDataUri?: string;
  };
  layouts: Record<string, {
    masterName: string;
    backgroundColor?: string;
    accentColor?: string;
  }>;
  layoutMapping: Record<CustomTemplateLayoutRole, string>;
}

export interface PresentationTemplateRuntime {
  templateId?: string;
  templateFamily: TemplateFamily;
  minSlides: number;
  maxSlides: number;
  mustHaveIntents: SlideIntent[];
  recommendedVisuals: string[];
  outline: OutlineItem[];
  slideRecipes: TemplateSlideRecipe[];
  sourceRequirements: Array<{
    type: string;
    required: boolean;
    readiness: 'ready' | 'partial_ready' | 'insufficient_evidence';
  }>;
  headerFooter: {
    enabled: boolean;
    hideOnCover: boolean;
    showPageNumbers: boolean;
    showConfidentiality: boolean;
  };
  customTemplate?: PresentationCustomTemplateDefinition;
}

const FAMILY_BY_DECK_TYPE: Record<string, TemplateFamily> = {
  digital_transformation_read_deck: 'Digital Transformation Read Deck',
  transformation_read_deck: 'Digital Transformation Read Deck',
  board_decision_deck: 'Board Decision Deck',
  assessment_summary: 'DRD Diagnostic Deck',
  tool_workshop: 'Initiative Kickoff Deck',
  steering_committee: 'Steering Committee Deck',
  program_update: 'Steering Committee Deck',
};

const BASE_RECIPES: Partial<Record<SlideIntent, Omit<TemplateSlideRecipe, 'intent'>>> = {
  cover: {
    layoutFamily: 'cover-client-gradient',
    requiredBlocks: ['title', 'subtitle', 'client-meta'],
    optionalBlocks: ['confidentiality', 'logo'],
    fallbackPolicy: 'keep_with_warning',
    density: 'visual',
    visualPolicy: 'hero_visual',
    notesPolicy: 'none',
  },
  executive_summary: {
    layoutFamily: 'executive-summary-three-column',
    requiredBlocks: ['headline', 'key_findings', 'recommendation'],
    optionalBlocks: ['kpi_strip'],
    fallbackPolicy: 'degradation_notice',
    density: 'balanced',
    visualPolicy: 'supporting_visual',
    notesPolicy: 'standard',
    sourceTypes: ['assessment', 'tool_session', 'report'],
  },
  section_intro: {
    fallbackPolicy: 'keep_with_warning',
    layoutFamily: 'section-divider',
    requiredBlocks: ['section_title', 'description'],
    density: 'visual',
    visualPolicy: 'hero_visual',
    notesPolicy: 'light',
  },
  key_messages: {
    fallbackPolicy: 'degradation_notice',
    layoutFamily: 'insight-card-grid',
    requiredBlocks: ['messages', 'evidence_note'],
    density: 'balanced',
    visualPolicy: 'supporting_visual',
    notesPolicy: 'standard',
    sourceTypes: ['tool_session', 'assessment', 'report'],
  },
  performance_overview: {
    fallbackPolicy: 'degradation_notice',
    layoutFamily: 'dashboard-kpi-strip',
    requiredBlocks: ['kpis', 'context'],
    density: 'balanced',
    visualPolicy: 'data_first',
    notesPolicy: 'light',
    sourceTypes: ['kpi_roi', 'assessment'],
  },
  single_insight: {
    fallbackPolicy: 'degradation_notice',
    layoutFamily: 'single-insight-proof',
    requiredBlocks: ['chart', 'insight_text', 'source'],
    density: 'balanced',
    visualPolicy: 'data_first',
    notesPolicy: 'standard',
    sourceTypes: ['tool_session', 'assessment', 'report'],
  },
  comparison: {
    fallbackPolicy: 'degradation_notice',
    layoutFamily: 'before-after-comparison',
    requiredBlocks: ['left_items', 'right_items', 'verdict'],
    density: 'balanced',
    visualPolicy: 'diagram_first',
    notesPolicy: 'standard',
    sourceTypes: ['assessment', 'financial_analysis'],
  },
  assessment: {
    fallbackPolicy: 'degradation_notice',
    layoutFamily: 'maturity-scorecard',
    requiredBlocks: ['maturity_matrix', 'overall_score'],
    density: 'balanced',
    visualPolicy: 'data_first',
    notesPolicy: 'standard',
    sourceTypes: ['assessment'],
  },
  recommendation_portfolio: {
    fallbackPolicy: 'degradation_notice',
    layoutFamily: 'recommendation-stack',
    requiredBlocks: ['recommendations', 'priority', 'impact'],
    density: 'document',
    visualPolicy: 'supporting_visual',
    notesPolicy: 'standard',
    sourceTypes: ['initiative_portfolio', 'assessment', 'tool_session'],
  },
  initiative_portfolio: {
    fallbackPolicy: 'degradation_notice',
    layoutFamily: 'portfolio-table-client',
    requiredBlocks: ['initiative_table', 'priority', 'timeline'],
    density: 'document',
    visualPolicy: 'data_first',
    notesPolicy: 'light',
    sourceTypes: ['initiative_portfolio'],
  },
  prioritization_matrix: {
    fallbackPolicy: 'degradation_notice',
    layoutFamily: 'impact-effort-matrix',
    requiredBlocks: ['quadrants', 'axis_labels'],
    density: 'balanced',
    visualPolicy: 'data_first',
    notesPolicy: 'standard',
    sourceTypes: ['initiative_portfolio', 'assessment'],
  },
  roadmap: {
    fallbackPolicy: 'degradation_notice',
    layoutFamily: 'governance-roadmap',
    requiredBlocks: ['phases', 'milestones', 'owners'],
    density: 'balanced',
    visualPolicy: 'diagram_first',
    notesPolicy: 'standard',
    sourceTypes: ['execution_status', 'initiative_portfolio'],
  },
  risk_management: {
    fallbackPolicy: 'degradation_notice',
    layoutFamily: 'raid-table',
    requiredBlocks: ['risk_table', 'mitigations'],
    density: 'document',
    visualPolicy: 'data_first',
    notesPolicy: 'standard',
    sourceTypes: ['raid'],
  },
  next_steps: {
    fallbackPolicy: 'keep_with_warning',
    layoutFamily: 'decision-and-next-steps',
    requiredBlocks: ['actions', 'owners', 'deadlines'],
    density: 'balanced',
    visualPolicy: 'text_only',
    notesPolicy: 'speaker_heavy',
  },
  appendix: {
    layoutFamily: 'appendix-dense-table',
    requiredBlocks: ['source_notes', 'tables'],
    optionalBlocks: ['methodology', 'assumptions'],
    fallbackPolicy: 'keep_with_warning',
    density: 'document',
    visualPolicy: 'text_only',
    notesPolicy: 'none',
  },
};

function safeJsonParse<T>(raw: unknown, fallback: T): T {
  if (!raw) return fallback;
  if (typeof raw === 'object') return raw as T;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return fallback;
  }
}

function recipeForIntent(
  intent: SlideIntent,
  overrides?: Partial<TemplateSlideRecipe>
): TemplateSlideRecipe {
  const base = BASE_RECIPES[intent] || BASE_RECIPES.key_messages!;
  return {
    intent,
    ...base,
    ...overrides,
  };
}

function familyForTemplate(row: any): TemplateFamily {
  const explicit = String(row?.template_family || row?.templateFamily || '').trim();
  if (explicit) return explicit;
  return FAMILY_BY_DECK_TYPE[String(row?.deck_type || '').trim()] || row?.name || 'Custom Deck';
}

export function buildTemplateRuntimeFromRow(row: any | null): PresentationTemplateRuntime | null {
  if (!row) return null;
  const outline = safeJsonParse<any[]>(row.outline_json, []).map((item, index) => ({
    intent: String(item.intent || 'key_messages') as SlideIntent,
    title: String(item.title || item.workingTitle || `Slide ${index + 1}`),
    keyMessage: item.keyMessage || item.key_message || null,
    enabled: item.enabled !== false,
    sourceRef: item.sourceRef,
    // FALA D (2026-07-26) — the Template Architect (presentationTemplateDraftService.ts)
    // drafts per-slide `dataNeeded`/`suggestedVisual` briefing fields, but this mapper
    // used to hand-pick only 5 fields and silently drop them — the generator never saw
    // them even though `applyTemplateRuntime`/`applyApprovedTemplateToOutline` downstream
    // just spread the OutlineItem through unchanged. Restoring `dataNeeded` here is what
    // makes it reach `generateDeck`'s narrative loop (see
    // `buildTemplateBriefingInstruction` in presentationGeneratorService.ts). `suggestedVisual`
    // is restored (no longer dropped) but deliberately NOT wired into `layoutHint` below —
    // `layoutHint`/the recipe's `layoutFamily` is a closed vocabulary of known layout names
    // (e.g. 'dashboard-kpi-strip', 'raid-table') that rendering switches on; `suggestedVisual`
    // is a free-text LLM label (e.g. "RAG status table") that would silently override a real
    // layout family with a string the renderer doesn't recognise. Left available on the
    // OutlineItem for a dedicated layout-selection change to consume deliberately.
    dataNeeded: Array.isArray(item.dataNeeded)
      ? item.dataNeeded.filter(
          (d: unknown): d is string => typeof d === 'string' && d.trim().length > 0
        )
      : Array.isArray(item.data_needed)
        ? item.data_needed.filter(
            (d: unknown): d is string => typeof d === 'string' && d.trim().length > 0
          )
        : undefined,
    suggestedVisual:
      typeof item.suggestedVisual === 'string' && item.suggestedVisual.trim()
        ? item.suggestedVisual.trim()
        : typeof item.suggested_visual === 'string' && item.suggested_visual.trim()
          ? item.suggested_visual.trim()
          : undefined,
  }));
  const recipeJson = safeJsonParse<any>(row.template_recipe_json, null);
  const layoutPolicy = safeJsonParse<any>(row.layout_policy_json, null);
  const slideRecipes = outline.map((item) => {
    const override =
      Array.isArray(recipeJson?.slideRecipes) &&
      recipeJson.slideRecipes.find((recipe: any) => recipe.intent === item.intent);
    return recipeForIntent(item.intent, override);
  });
  const mustHaveIntents = safeJsonParse<SlideIntent[]>(row.must_have_intents, []);
  const recommendedVisuals = safeJsonParse<string[]>(row.recommended_visuals, []);
  const sourceRequirements =
    safeJsonParse<any[] | null>(row.source_requirements_json, null) ||
    Array.from(new Set(slideRecipes.flatMap((recipe) => recipe.sourceTypes || []))).map((type) => ({
      type,
      required: ['assessment', 'initiative_portfolio'].includes(type),
      readiness: 'partial_ready',
    }));

  return {
    templateId: row.id,
    templateFamily: familyForTemplate(row),
    minSlides: Number(row.min_slides || 5),
    maxSlides: Number(row.max_slides || 25),
    mustHaveIntents,
    recommendedVisuals,
    outline,
    slideRecipes,
    sourceRequirements,
    headerFooter: {
      enabled: true,
      hideOnCover: true,
      showPageNumbers: true,
      showConfidentiality: true,
      ...(recipeJson?.headerFooter || {}),
    },
    customTemplate:
      layoutPolicy?.customTemplate && typeof layoutPolicy.customTemplate === 'object'
        ? layoutPolicy.customTemplate
        : undefined,
  };
}

export function applyTemplateRuntime(params: {
  outline: OutlineItem[];
  runtime?: PresentationTemplateRuntime | null;
  sources: SourceArtifact[];
}): { outline: OutlineItem[]; warnings: string[] } {
  const runtime = params.runtime;
  if (!runtime) return { outline: params.outline, warnings: [] };
  const warnings: string[] = [];
  const selectedTypes = new Set(params.sources.map((source) => source.type));
  for (const required of runtime.sourceRequirements) {
    if (required.required && !selectedTypes.has(required.type as SourceArtifact['type'])) {
      warnings.push(`Template expects source type ${required.type}, but it was not selected.`);
    }
  }
  if (params.outline.length < runtime.minSlides) {
    warnings.push(`Template recommends at least ${runtime.minSlides} slides.`);
  }
  if (params.outline.length > runtime.maxSlides) {
    warnings.push(`Template recommends at most ${runtime.maxSlides} slides.`);
  }

  const recipeByIntent = new Map(runtime.slideRecipes.map((recipe) => [recipe.intent, recipe]));
  const outline = params.outline.map((item) => {
    const recipe = recipeByIntent.get(item.intent);
    if (!recipe) return item;
    const matchedSource = params.sources.find((source) =>
      (recipe.sourceTypes || []).includes(source.type)
    );
    const missingSource = !matchedSource && (recipe.sourceTypes || []).length > 0;
    const fallbackPolicy = recipe.fallbackPolicy || 'degradation_notice';
    const fallbackWarnings =
      missingSource && fallbackPolicy !== 'skip_slide'
        ? ['Template source requirement is not fully grounded.']
        : [];
    const degradationBlocks =
      missingSource && fallbackPolicy === 'degradation_notice'
        ? ['data_gap_notice', 'required_source_types', 'data_owner']
        : recipe.requiredBlocks;
    return {
      ...item,
      enabled: fallbackPolicy === 'skip_slide' && missingSource ? false : item.enabled,
      sourceRef: item.sourceRef || matchedSource?.artifactId || matchedSource?.id,
      sourceRefs:
        item.sourceRefs ||
        (matchedSource ? [matchedSource.artifactId || matchedSource.id || matchedSource.type] : []),
      layoutHint:
        item.layoutHint ||
        (missingSource && fallbackPolicy === 'degradation_notice'
          ? 'degradation-data-gap'
          : recipe.layoutFamily),
      suggestedBlocks: item.suggestedBlocks || degradationBlocks,
      density: item.density || recipe.density,
      visualPolicy: item.visualPolicy || recipe.visualPolicy,
      notesPolicy: recipe.notesPolicy,
      warnings: [...(item.warnings || []), ...fallbackWarnings],
    } as OutlineItem;
  });

  return { outline, warnings };
}

export function buildSystemTemplateRuntime(family: TemplateFamily): PresentationTemplateRuntime {
  const familyKey = String(family);
  const outlines: Record<string, Array<{ intent: SlideIntent; title: string }>> = {
    'Digital Transformation Read Deck': [
      { intent: 'cover', title: 'Digital Transformation Program' },
      { intent: 'executive_summary', title: 'Executive Summary' },
      { intent: 'performance_overview', title: 'Evidence Dashboard' },
      { intent: 'assessment', title: 'DRD Diagnostic Results' },
      { intent: 'key_messages', title: 'Key Insights' },
      { intent: 'recommendation_portfolio', title: 'Recommended Initiatives' },
      { intent: 'initiative_portfolio', title: 'Initiative Portfolio' },
      { intent: 'roadmap', title: '30/60/90 Day Plan' },
      { intent: 'risk_management', title: 'Risks And Mitigations' },
      { intent: 'appendix', title: 'Appendices And Source Notes' },
    ],
    'Board Decision Deck': [
      { intent: 'cover', title: 'Board Decision Deck' },
      { intent: 'executive_summary', title: 'Decision Summary' },
      { intent: 'performance_overview', title: 'Business Case' },
      { intent: 'comparison', title: 'Options And Tradeoffs' },
      { intent: 'prioritization_matrix', title: 'Decision Matrix' },
      { intent: 'next_steps', title: 'Decision Required' },
    ],
    'DRD Diagnostic Deck': [
      { intent: 'cover', title: 'DRD Diagnostic Deck' },
      { intent: 'executive_summary', title: 'Diagnostic Summary' },
      { intent: 'assessment', title: 'Maturity Results' },
      { intent: 'single_insight', title: 'Critical Gap' },
      { intent: 'recommendation_portfolio', title: 'Recommendations' },
      { intent: 'roadmap', title: 'Transformation Roadmap' },
    ],
    'Initiative Kickoff Deck': [
      { intent: 'cover', title: 'Initiative Kickoff' },
      { intent: 'executive_summary', title: 'Kickoff Summary' },
      { intent: 'initiative_portfolio', title: 'Initiative Scope' },
      { intent: 'roadmap', title: 'Delivery Plan' },
      { intent: 'risk_management', title: 'Delivery Risks' },
      { intent: 'next_steps', title: 'Next Actions' },
    ],
    'Steering Committee Deck': [
      { intent: 'cover', title: 'Steering Committee Update' },
      { intent: 'executive_summary', title: 'Executive Summary' },
      { intent: 'performance_overview', title: 'Portfolio Health' },
      { intent: 'initiative_portfolio', title: 'Workstream Status' },
      { intent: 'risk_management', title: 'Risks And Decisions' },
      { intent: 'roadmap', title: 'Upcoming Milestones' },
      { intent: 'next_steps', title: 'Decisions And Next Steps' },
    ],
  };
  const outline = (outlines[familyKey] || outlines['Digital Transformation Read Deck']).map(
    (item) => ({
      ...item,
      enabled: true,
    })
  );
  return {
    templateFamily: family,
    minSlides: familyKey === 'Digital Transformation Read Deck' ? 40 : 6,
    maxSlides: familyKey === 'Digital Transformation Read Deck' ? 60 : 20,
    mustHaveIntents: ['cover', 'executive_summary', 'next_steps'],
    recommendedVisuals: ['header_footer', 'kpi_strip', 'roadmap', 'source_notes'],
    outline,
    slideRecipes: outline.map((item) => recipeForIntent(item.intent)),
    sourceRequirements: [
      {
        type: 'assessment',
        required: familyKey.includes('DRD') || familyKey.includes('Transformation'),
        readiness: 'partial_ready',
      },
      {
        type: 'initiative_portfolio',
        required: familyKey.includes('Transformation'),
        readiness: 'partial_ready',
      },
      { type: 'tool_session', required: false, readiness: 'partial_ready' },
    ],
    headerFooter: {
      enabled: true,
      hideOnCover: true,
      showPageNumbers: true,
      showConfidentiality: true,
    },
  };
}

/** One slide as `POST /presentations/decks` (structured-JSON deck creation) expects it. */
export interface DeckSlideFromOutline {
  type: string;
  content: {
    title: string;
    intent: string;
    blocks: Array<{ type: 'heading' | 'text'; content: string }>;
  };
}

/**
 * R11 deck slice (2026-07-26) — deterministic outline→slide mapping for
 * `POST /presentations/decks/from-template`.
 *
 * This is the fix for the R0 audit finding "`from_template` NIE kopiuje
 * `outline_json` do kart — tylko seeduje AI promptem": given a template's
 * `outline_json` (read fresh from `presentation_templates` by
 * `resolvePresentationTemplateForCreation`), produce one slide per outline
 * item with NO AI involved — pure, deterministic, and therefore unit-testable
 * against a fixture without a live database.
 *
 * Exported so the route (production caller) and the test can both use the
 * same function — the route must never re-derive this mapping inline.
 */
export function mapOutlineBlueprintToDeckSlides(
  outlineBlueprint: unknown[]
): DeckSlideFromOutline[] {
  const items = Array.isArray(outlineBlueprint) ? outlineBlueprint : [];
  return items.map((raw, index) => {
    const item = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const intent = String(item.intent || 'content');
    const title = String(item.title || item.workingTitle || `Slide ${index + 1}`);
    const keyMessageRaw = item.keyMessage ?? item.key_message ?? null;
    const blocks: Array<{ type: 'heading' | 'text'; content: string }> = [
      { type: 'heading', content: title },
    ];
    if (typeof keyMessageRaw === 'string' && keyMessageRaw.trim()) {
      blocks.push({ type: 'text', content: keyMessageRaw.trim() });
    }
    return { type: intent, content: { title, intent, blocks } };
  });
}
