import type { DeckSetup, OutlineItem } from './presentationGeneratorService.js';
import type { PresentationNarrativePlan } from './presentationNarrativePlannerService.js';
import type { PresentationSourcePack } from './presentationSourcePackService.js';
import {
  buildSystemTemplateRuntime,
  type PresentationTemplateRuntime,
  type TemplateSlideRecipe,
} from './presentationTemplateRuntimeService.js';
import type { SlideIntent } from './report/pptx/types.js';

export type TemplateArchitectPlanStatus = 'draft' | 'ready_for_review' | 'needs_sources';

export interface TemplateArchitectSlideBlueprint {
  slideNumber: number;
  intent: SlideIntent;
  title: string;
  purpose: string;
  requiredData: string[];
  layoutRule: string;
  contentDensity: 'visual' | 'balanced' | 'document';
  approvalRequired: boolean;
}

export interface TemplateArchitectSection {
  name: string;
  purpose: string;
  slides: TemplateArchitectSlideBlueprint[];
}

export interface TemplateArchitectPlan {
  planId: string;
  status: TemplateArchitectPlanStatus;
  templateName: string;
  templateFamily: string;
  purpose: string;
  recommendedFrequency: string | null;
  audience: string[];
  requiredInputs: string[];
  optionalInputs: string[];
  sections: TemplateArchitectSection[];
  runtimePreview: PresentationTemplateRuntime;
  governance: {
    initialStatus: 'draft';
    approvalRequired: true;
    ownerRole: string;
    auditEvent: 'template_architect_plan_created';
  };
  warnings: string[];
  createdAt: string;
}

function familyFromSetup(setup: DeckSetup): string {
  const requested = String((setup as any).templateFamily || (setup as any).deckType || '').trim();
  if (requested) return requested;
  if (setup.title.toLowerCase().includes('steering') || setup.title.toLowerCase().includes('ks')) {
    return 'Steering Committee Deck';
  }
  if (
    setup.title.toLowerCase().includes('diagnostic') ||
    setup.title.toLowerCase().includes('readiness')
  ) {
    return 'DRD Diagnostic Deck';
  }
  if (setup.goal === 'decide') return 'Board Decision Deck';
  return 'Digital Transformation Read Deck';
}

function sectionNameFor(intent: SlideIntent): string {
  if (intent === 'cover') return 'Opening';
  if (intent === 'executive_summary' || intent === 'key_messages') return 'Executive Thesis';
  if (intent === 'performance_overview' || intent === 'assessment' || intent === 'single_insight') {
    return 'Evidence And Diagnosis';
  }
  if (
    intent === 'initiative_portfolio' ||
    intent === 'recommendation_portfolio' ||
    intent === 'roadmap'
  ) {
    return 'Plan And Execution';
  }
  if (intent === 'risk_management' || intent === 'next_steps') return 'Decisions And Governance';
  return 'Appendix';
}

function purposeForBlueprint(item: OutlineItem, narrativePlan?: PresentationNarrativePlan): string {
  const slidePlan = narrativePlan?.slidePlan.find(
    (slide) => slide.intent === item.intent && slide.title === item.title
  );
  return slidePlan?.audienceQuestion || item.keyMessage || `Explain ${item.title}.`;
}

function requiredDataForRecipe(recipe: TemplateSlideRecipe | undefined): string[] {
  const sourceTypes = recipe?.sourceTypes || [];
  if (sourceTypes.length > 0) return sourceTypes;
  return recipe?.requiredBlocks || [];
}

function groupBlueprints(
  blueprints: TemplateArchitectSlideBlueprint[]
): TemplateArchitectSection[] {
  const groups = new Map<string, TemplateArchitectSlideBlueprint[]>();
  for (const blueprint of blueprints) {
    const name = sectionNameFor(blueprint.intent);
    groups.set(name, [...(groups.get(name) || []), blueprint]);
  }
  return [...groups.entries()].map(([name, slides]) => ({
    name,
    purpose:
      name === 'Executive Thesis'
        ? 'State the recommendation and executive logic early.'
        : name === 'Evidence And Diagnosis'
          ? 'Ground the story in source-backed proof.'
          : name === 'Plan And Execution'
            ? 'Translate evidence into actions, owners, and roadmap.'
            : name === 'Decisions And Governance'
              ? 'Make decisions, risks, and next actions explicit.'
              : 'Support the story without slowing the main deck.',
    slides,
  }));
}

export function buildPresentationTemplateArchitectPlan(params: {
  setup: DeckSetup;
  sourcePack: PresentationSourcePack;
  narrativePlan?: PresentationNarrativePlan;
  now?: Date;
}): TemplateArchitectPlan {
  const now = params.now || new Date();
  const templateFamily = familyFromSetup(params.setup);
  const runtimePreview = buildSystemTemplateRuntime(templateFamily);
  const recipeByIntent = new Map(
    runtimePreview.slideRecipes.map((recipe) => [recipe.intent, recipe])
  );
  const recipeInputTypes = runtimePreview.slideRecipes.flatMap(
    (recipe) => recipe.sourceTypes || []
  );
  const requiredInputs = Array.from(
    new Set(
      [
        ...runtimePreview.sourceRequirements
          .filter((requirement) => requirement.required)
          .map((requirement) => requirement.type),
        ...recipeInputTypes,
      ].filter(Boolean)
    )
  );
  const optionalInputs = Array.from(
    new Set(
      runtimePreview.sourceRequirements
        .filter((requirement) => !requirement.required)
        .map((requirement) => requirement.type)
        .filter((type) => !requiredInputs.includes(type))
    )
  );

  const blueprints = runtimePreview.outline.map((item, index) => {
    const recipe = recipeByIntent.get(item.intent);
    return {
      slideNumber: index + 1,
      intent: item.intent,
      title: item.title,
      purpose: purposeForBlueprint(item, params.narrativePlan),
      requiredData: requiredDataForRecipe(recipe),
      layoutRule: recipe?.layoutFamily || item.layoutHint || 'content-card',
      contentDensity: recipe?.density || 'balanced',
      approvalRequired:
        params.setup.goal === 'decide' ||
        item.intent === 'executive_summary' ||
        item.intent === 'risk_management' ||
        item.intent === 'next_steps',
    } satisfies TemplateArchitectSlideBlueprint;
  });

  const selectedSourceTypes = new Set(params.sourcePack.sources.map((source) => source.sourceType));
  const missingRequired = Array.from(
    new Set(
      blueprints
        .filter((blueprint) => {
          const alternatives = blueprint.requiredData.filter((data) =>
            requiredInputs.includes(data)
          );
          if (alternatives.length === 0) return false;
          return !alternatives.some((sourceType) => selectedSourceTypes.has(sourceType));
        })
        .flatMap((blueprint) =>
          blueprint.requiredData.filter((data) => requiredInputs.includes(data))
        )
    )
  );
  const warnings: string[] = [];
  if (params.sourcePack.status === 'empty') {
    warnings.push(
      'Template plan was created without source examples; validate required inputs before approval.'
    );
  }
  if (missingRequired.length > 0) {
    warnings.push(`Template requires missing source examples: ${missingRequired.join(', ')}.`);
  }
  if (params.narrativePlan?.status !== 'ready') {
    warnings.push(
      'Narrative plan is not ready; template approval should wait for narrative review.'
    );
  }

  return {
    planId: `ptap_${now.getTime()}`,
    status:
      params.sourcePack.status === 'empty'
        ? 'needs_sources'
        : warnings.length > 0
          ? 'draft'
          : 'ready_for_review',
    templateName: `${params.setup.title} Template`,
    templateFamily,
    purpose:
      params.narrativePlan?.thesis ||
      `Reusable ${templateFamily} for ${params.setup.audience} to ${params.setup.goal}.`,
    recommendedFrequency:
      templateFamily === 'Steering Committee Deck' ? 'weekly or bi-weekly' : null,
    audience: [params.setup.audience],
    requiredInputs,
    optionalInputs,
    sections: groupBlueprints(blueprints),
    runtimePreview,
    governance: {
      initialStatus: 'draft',
      approvalRequired: true,
      ownerRole: 'template_owner',
      auditEvent: 'template_architect_plan_created',
    },
    warnings,
    createdAt: now.toISOString(),
  };
}
