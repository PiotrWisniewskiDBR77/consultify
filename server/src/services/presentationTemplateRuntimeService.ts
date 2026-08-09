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
  variables?: Array<{
    key: string;
    label: string;
    type: 'text' | 'number' | 'date' | 'boolean' | 'enum';
    required: boolean;
    defaultValue?: string | number | boolean;
    description?: string;
    options?: string[];
  }>;
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
  layouts: Record<
    string,
    {
      masterName: string;
      backgroundColor?: string;
      accentColor?: string;
    }
  >;
  layoutMapping: Record<CustomTemplateLayoutRole, string>;
}

const CUSTOM_LAYOUT_ROLES: CustomTemplateLayoutRole[] = [
  'cover',
  'content',
  'kpi',
  'table',
  'decision',
];
const HEX_COLOR = /^#?[0-9A-Fa-f]{6}$/;

export function validatePresentationCustomTemplate(
  value: unknown
): { ok: true; value: PresentationCustomTemplateDefinition } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const input = value as any;
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: ['customTemplate must be an object'] };
  }
  if (!Number.isInteger(input.version) || input.version < 1)
    errors.push('version must be a positive integer');
  if (input.variables !== undefined) {
    if (!Array.isArray(input.variables)) errors.push('variables must be an array');
    else {
      const keys = new Set<string>();
      input.variables.forEach((variable: any, index: number) => {
        const prefix = `variables.${index}`;
        const key = typeof variable?.key === 'string' ? variable.key.trim() : '';
        if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key)) errors.push(`${prefix}.key is invalid`);
        if (keys.has(key)) errors.push(`${prefix}.key must be unique`);
        keys.add(key);
        if (typeof variable?.label !== 'string' || !variable.label.trim())
          errors.push(`${prefix}.label is required`);
        if (!['text', 'number', 'date', 'boolean', 'enum'].includes(variable?.type))
          errors.push(`${prefix}.type is invalid`);
        if (
          variable?.type === 'enum' &&
          (!Array.isArray(variable.options) || variable.options.length === 0)
        )
          errors.push(`${prefix}.options are required for enum`);
      });
    }
  }
  if (!input.theme || typeof input.theme !== 'object') errors.push('theme is required');
  const theme = input.theme || {};
  for (const key of ['titleFont', 'bodyFont'] as const) {
    if (typeof theme[key] !== 'string' || !theme[key].trim())
      errors.push(`theme.${key} is required`);
  }
  for (const key of [
    'primaryColor',
    'backgroundColor',
    'surfaceColor',
    'textColor',
    'accentColor',
  ] as const) {
    if (typeof theme[key] !== 'string' || !HEX_COLOR.test(theme[key]))
      errors.push(`theme.${key} must be a 6-digit hex color`);
  }
  if (
    theme.logoDataUri !== undefined &&
    !/^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/=]+$/i.test(theme.logoDataUri)
  ) {
    errors.push('theme.logoDataUri must be a PNG or JPEG data URI');
  }
  if (
    !input.layouts ||
    typeof input.layouts !== 'object' ||
    Array.isArray(input.layouts) ||
    Object.keys(input.layouts).length === 0
  ) {
    errors.push('layouts must contain at least one layout');
  } else {
    for (const [id, layout] of Object.entries(input.layouts) as Array<[string, any]>) {
      if (!id.trim()) errors.push('layout id must not be empty');
      if (
        !layout ||
        typeof layout !== 'object' ||
        typeof layout.masterName !== 'string' ||
        !layout.masterName.trim()
      )
        errors.push(`layouts.${id}.masterName is required`);
      for (const key of ['backgroundColor', 'accentColor'] as const) {
        if (layout?.[key] !== undefined && !HEX_COLOR.test(layout[key]))
          errors.push(`layouts.${id}.${key} must be a 6-digit hex color`);
      }
    }
  }
  if (!input.layoutMapping || typeof input.layoutMapping !== 'object') {
    errors.push('layoutMapping is required');
  } else {
    for (const role of CUSTOM_LAYOUT_ROLES) {
      const layoutId = input.layoutMapping[role];
      if (typeof layoutId !== 'string' || !layoutId.trim())
        errors.push(`layoutMapping.${role} is required`);
      else if (!input.layouts || !Object.prototype.hasOwnProperty.call(input.layouts, layoutId))
        errors.push(`layoutMapping.${role} references unknown layout '${layoutId}'`);
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, value: input };
}

export function materializeTemplateVariableBrief(
  variables: NonNullable<PresentationCustomTemplateDefinition['variables']>,
  values: Record<string, unknown>
): { lines: string[]; missingRequired: string[] } {
  const missingRequired: string[] = [];
  const lines = variables.map((variable) => {
    const value = values[variable.key] ?? variable.defaultValue;
    if (value === undefined || value === '') {
      if (variable.required) missingRequired.push(variable.key);
      return `Data required: ${variable.label}`;
    }
    return `${variable.label}: ${String(value)}`;
  });
  return { lines, missingRequired };
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
    customTemplate: (() => {
      if (layoutPolicy?.customTemplate == null) return undefined;
      const validation = validatePresentationCustomTemplate(layoutPolicy.customTemplate);
      if (validation.ok === false)
        throw new Error(`custom_template_invalid:${validation.errors.join('; ')}`);
      return validation.value;
    })(),
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
    blocks: Array<{ type: string; content: any }>;
  };
}

function cleanStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item || '').trim()).filter(Boolean) : [];
}

function decodeTemplateText(value: unknown): string {
  return String(value || '')
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function groundedValueForLabel(label: string, sourceLines: string[]): string {
  const labelTerms = label
    .toLowerCase()
    .split(/\W+/)
    .filter((term) => term.length > 2);
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const explicitlyLabelled = sourceLines.find((line) =>
    new RegExp(`${escapedLabel}\\s*[:—–=-]\\s*\\S+`, 'i').test(line)
  );
  if (explicitlyLabelled) {
    const explicitValue = explicitlyLabelled
      .match(new RegExp(`${escapedLabel}\\s*[:—–=-]\\s*([^;]+)`, 'i'))?.[1]
      ?.trim();
    if (explicitValue)
      return explicitValue.length > 48 ? `${explicitValue.slice(0, 45).trim()}…` : explicitValue;
  }
  const grounded = sourceLines.find((line) => {
    const lower = line.toLowerCase();
    return labelTerms.some((term) => lower.includes(term)) && /(?:\d|€|\$|£|%)/.test(line);
  });
  if (!grounded) return 'Data required';
  const labelledValue = grounded.match(
    new RegExp(`${escapedLabel}\\s*[:—–-]\\s*([^;]+)`, 'i')
  )?.[1];
  const concise = labelledValue?.trim() || grounded.trim();
  return concise.length > 48 ? `${concise.slice(0, 45).trim()}…` : concise;
}

function labelledList(sourceLines: string[], label: RegExp): string[] {
  const line = sourceLines.find((candidate) => label.test(candidate));
  const value = line?.replace(/^[^:—–=-]+[:—–=-]\s*/i, '').trim();
  return value
    ? value
        .split(/,|\band\b/gi)
        .map((item) => item.trim().replace(/[.]$/, ''))
        .filter(Boolean)
    : [];
}

function compactSlideText(value: unknown, maxLength = 110): string {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  const clipped = text.slice(0, maxLength - 1);
  const boundary = clipped.lastIndexOf(' ');
  return `${clipped.slice(0, boundary > maxLength * 0.65 ? boundary : clipped.length).trim()}…`;
}

/**
 * Materialise an approved template into useful, audience-facing slide content.
 * The template stores instructions rather than source facts, so these blocks
 * deliberately express a decision framework and evidence slots without
 * inventing numerical results.  Each intent gets a native block topology that
 * the Deck Builder and PPTX exporter already understand.
 */
function blocksForTemplateIntent(
  item: Record<string, unknown>,
  title: string,
  intent: string,
  briefLines: string[] = []
) {
  const keyMessage = String(item.keyMessage ?? item.key_message ?? '').trim();
  const hints = cleanStringList(item.contentHints ?? item.content_hints);
  const dataNeeded = cleanStringList(item.dataNeeded ?? item.data_needed);
  // A creation brief contains the user's facts for this particular deck.
  // Template copy used to prefer the generic architect guidance, leaving a
  // newly-created deck full of placeholders even when a detailed brief was
  // supplied.  Prefer grounded brief content; the template still controls
  // structure, layout and evidence labels.
  const headline = compactSlideText(briefLines[0] || keyMessage || hints[0] || title, 120);
  const evidenceLabels = dataNeeded.length > 0 ? dataNeeded.slice(0, 4) : hints.slice(0, 4);
  const sourceLines = [keyMessage, ...hints, ...briefLines].filter(Boolean);
  const heading = { type: 'heading', content: { text: title, level: 1 } };
  const visualLead = {
    type: 'callout',
    content: { variant: 'info', text: compactSlideText(headline, 48) },
  };

  switch (intent) {
    case 'cover':
      return [
        heading,
        ...(headline !== title
          ? [{ type: 'callout', content: { variant: 'recommendation', text: headline } }]
          : []),
        {
          type: 'smart_layout',
          content: {
            layoutType: '3col',
            items: ['Opportunity', 'Proof', 'Ask'].map((label, index) => ({
              title: label,
              description: compactSlideText(
                briefLines[index + 1] ||
                  hints[index] ||
                  ['Define the investable wedge', 'Show the evidence', 'State the decision'][index],
                58
              ),
            })),
          },
        },
      ];
    case 'executive_summary':
      return [
        heading,
        { type: 'callout', content: { variant: 'recommendation', text: headline } },
        {
          type: 'smart_layout',
          content: {
            layoutType: '3col',
            items: (evidenceLabels.length
              ? evidenceLabels
              : ['Recommendation', 'Value', 'Conditions']
            )
              .slice(0, 3)
              .map((label) => ({
                title: label,
                description: compactSlideText(groundedValueForLabel(label, sourceLines), 72),
              })),
          },
        },
      ];
    case 'performance_overview':
      return [
        heading,
        visualLead,
        {
          type: 'metric_strip',
          content: {
            metrics: (evidenceLabels.length
              ? evidenceLabels
              : ['Investment', 'Run-rate benefit', 'Payback']
            ).slice(0, 3).map((label) => ({
              label,
              value: compactSlideText(groundedValueForLabel(label, sourceLines), 38),
              trend: 'stable',
            })),
          },
        },
      ];
    case 'comparison':
      const comparisonFacts = briefLines.slice(0, 3).map((line) => compactSlideText(line, 58));
      return [
        heading,
        visualLead,
        {
          type: 'smart_layout',
          content: {
            layoutType: '3col',
            items: ['Evidence', 'Economics', 'Decision'].map((scenario, index) => ({
              title: scenario,
              description:
                comparisonFacts[index] ||
                'Define the evidence, accountable owner and decision threshold.',
            })),
          },
        },
      ];
    case 'roadmap':
      return [
        heading,
        visualLead,
        {
          type: 'timeline_block',
          content: {
            items: [
              {
                date: '0–3',
                title: 'Mobilise',
                description: compactSlideText(
                  briefLines[0] || 'Confirm baseline, owners and controls.',
                  72
                ),
              },
              {
                date: '4–9',
                title: 'Prove',
                description: compactSlideText(
                  briefLines[1] || 'Deliver priority use cases and validate value.',
                  72
                ),
              },
              {
                date: '10–18',
                title: 'Scale',
                description: compactSlideText(
                  briefLines[2] || 'Expand proven automation and lock in benefits.',
                  72
                ),
              },
            ],
          },
        },
      ];
    case 'risk_management':
      const risks = labelledList(briefLines, /^(?:(?:top|key)\s+)?risks?\s*[:—–=-]/i);
      const mitigations = labelledList(briefLines, /^mitigations?\s*[:—–=-]/i);
      return [
        heading,
        visualLead,
        {
          type: 'table',
          content: {
            headers: ['Risk', 'Exposure', 'Mitigation', 'Owner'],
            rows:
              risks.length > 0
                ? risks.slice(0, 3).map((risk, index) => [
                    compactSlideText(risk, 48),
                    'Open',
                    compactSlideText(
                      mitigations[index] || mitigations[0] || 'Mitigation required',
                      58
                    ),
                    'Owner required',
                  ])
                : [
                    [
                      'Adoption',
                      'Assess',
                      'Role-based enablement and adoption measures',
                      'Business owner',
                    ],
                    [
                      'Controls',
                      'Assess',
                      'Human review for exceptions and audit trail',
                      'Risk owner',
                    ],
                    [
                      'Value leakage',
                      'Assess',
                      'Monthly benefit validation against baseline',
                      'Finance owner',
                    ],
                  ],
          },
        },
      ];
    case 'recommendation_single':
    case 'recommendation_portfolio':
      return [
        heading,
        { type: 'callout', content: { variant: 'recommendation', text: headline } },
        {
          type: 'bullet_list',
          content: {
            items: (briefLines.length
              ? briefLines
              : hints.length
              ? hints
              : ['Decision rights', 'Value ownership', 'Control cadence']
            )
              .slice(0, 3)
              .map((line) => compactSlideText(line, 76)),
          },
        },
      ];
    case 'next_steps':
      const decisions = labelledList(briefLines, /^decisions?(?:\s+required)?\s*[:—–=-]/i);
      return [
        heading,
        { type: 'callout', content: { variant: 'decision', text: headline } },
        {
          type: 'numbered_list',
          content: {
            items: (decisions.length
              ? decisions
              : hints.length
              ? hints
              : [
                  'Confirm the decision and conditions',
                  'Nominate accountable owners',
                  'Launch the first control gate',
                ]
            )
              .slice(0, 3)
              .map((line) => compactSlideText(line, 76)),
          },
        },
      ];
    default:
      return [
        heading,
        visualLead,
        ...(briefLines.length > 1 || hints.length > 1
          ? [
              {
                type: 'bullet_list',
                content: {
                  items: (briefLines.length > 1 ? briefLines : hints)
                    .slice(1, 4)
                    .map((line) => compactSlideText(line, 58)),
                },
              },
            ]
          : [
              {
                type: 'smart_layout',
                content: {
                  layoutType: '3col',
                  items: ['Signal', 'Implication', 'Action'].map((label, index) => ({
                    title: label,
                    description: compactSlideText(
                      briefLines[index + 1] || hints[index] || headline,
                      42
                    ),
                  })),
                },
              },
            ]),
      ];
  }
}

function briefLinesForOutlineItem(
  title: string,
  intent: string,
  briefLines: string[],
  index: number,
  total: number
): string[] {
  if (briefLines.length === 0) return [];
  const topic = `${title} ${intent}`.toLowerCase();
  const topicGroups: Array<[RegExp, string[]]> = [
    [/thesis|cover|venture/, ['thesis', 'company', 'product', 'version', 'audience']],
    [/problem|customer/, ['problem', 'customer', 'beachhead', 'trigger', 'workaround']],
    [/product|why now|workflow/, ['workflow', 'product', 'evidence', 'status', 'privacy']],
    [
      /market|opportunit/,
      ['market', 'beachhead', 'customer', 'segment', 'adoption', 'expansion', 'price', 'pricing'],
    ],
    [/business model|gtm|go-to-market/, ['business model', 'pricing', 'subscription', 'revenue', 'gtm', 'channel']],
    [/evidence|economic|risk/, ['evidence', 'measure', 'risk', 'owner', 'mitigation', 'cogs']],
    [/competition|defensib/, ['defensibility', 'competition', 'proprietary', 'telemetry', 'distribution']],
    [
      /financial|outlook/,
      ['financial', 'scenario', 'revenue', 'cogs', 'margin', 'ebitda', 'cash', 'runway', 'headcount', 'opex'],
    ],
    [/team|governance/, ['team', 'owner', 'governance', 'privacy', 'security', 'finance']],
    [/funding|ask|milestone|next step/, ['ask', 'pilot', 'milestone', 'decision', 'funding', '90-day']],
  ];
  const keywords = topicGroups.find(([matcher]) => matcher.test(topic))?.[1] || [];
  const matched = briefLines.filter((line) => {
    const lower = line.toLowerCase();
    return keywords.some((keyword) => lower.includes(keyword));
  });
  if (matched.length > 0) {
    return matched
      .map((line, position) => {
        const lower = line.toLowerCase();
        const keywordScore = keywords.reduce(
          (score, keyword, keywordIndex) =>
            score + (lower.includes(keyword) ? keywords.length - keywordIndex : 0),
          0
        );
        const evidencePenalty = /do not invent|evidence needed|tbd|pending evidence/i.test(line)
          ? 20
          : 0;
        return { line, score: keywordScore - evidencePenalty, position };
      })
      .sort((a, b) => b.score - a.score || a.position - b.position)
      .slice(0, 7)
      .map(({ line }) => line);
  }

  // Custom intents and titles are allowed.  When no semantic keyword is
  // available, distribute the brief deterministically so every slide still
  // receives grounded user content instead of repeating the first sentence.
  const start = Math.floor((index * briefLines.length) / Math.max(total, 1));
  return briefLines.slice(start, Math.min(start + 4, briefLines.length));
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
  outlineBlueprint: unknown[],
  brief?: string
): DeckSlideFromOutline[] {
  const items = Array.isArray(outlineBlueprint) ? outlineBlueprint : [];
  const briefLines = String(brief || '')
    .split(/[\n;]+|(?<=[.!?])\s+(?=[A-Z])/)
    .map((line) => line.trim())
    .filter(Boolean);
  return items.map((raw, index) => {
    const item = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const intent = String(item.intent || 'content');
    // Template Architect inputs may arrive HTML-escaped from a rich-text
    // control. Persisting those entities literally creates visible "&amp;"
    // titles and correctly trips the export encoding gate. Decode only the
    // small safe entity set at the template-to-artifact boundary.
    const title = decodeTemplateText(item.title || item.workingTitle || `Slide ${index + 1}`);
    const slideBriefLines = briefLinesForOutlineItem(title, intent, briefLines, index, items.length);
    const blocks = blocksForTemplateIntent(item, title, intent, slideBriefLines);
    return { type: intent, content: { title, intent, blocks } };
  });
}
