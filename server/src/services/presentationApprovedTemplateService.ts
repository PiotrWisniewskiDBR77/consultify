import type { OutlineItem, SourceArtifact } from './presentationGeneratorService.js';
import {
  applyTemplateRuntime,
  buildTemplateRuntimeFromRow,
  type PresentationTemplateRuntime,
  type TemplateSlideRecipe,
} from './presentationTemplateRuntimeService.js';

export interface ApprovedTemplateResolution {
  runtime: PresentationTemplateRuntime;
  warnings: string[];
}

export interface TemplateSlotMapping {
  slideIndex: number;
  intent: string;
  title: string;
  layoutRule: string;
  requiredBlocks: string[];
  sourceTypes: string[];
  mappedSourceIds: string[];
  missingSourceTypes: string[];
}

export interface TemplateSlotMappingResult {
  templateId?: string;
  templateFamily: string;
  slots: TemplateSlotMapping[];
  missingRequiredInputs: string[];
  warnings: string[];
}

function lifecycleState(row: any): string {
  return String(
    row?.lifecycle_state || row?.status || (row?.is_system ? 'approved' : 'draft')
  ).trim();
}

function sourceId(source: SourceArtifact): string {
  return String(source.artifactId || source.id || source.type);
}

function sourceMatches(
  recipe: TemplateSlideRecipe | undefined,
  sources: SourceArtifact[]
): SourceArtifact[] {
  const sourceTypes = recipe?.sourceTypes || [];
  if (sourceTypes.length === 0) return [];
  return sources.filter((source) => sourceTypes.includes(source.type));
}

export function resolveApprovedPresentationTemplate(row: any | null): ApprovedTemplateResolution {
  if (!row) throw new Error('approved_template_not_found');
  const state = lifecycleState(row);
  if (state !== 'approved') {
    throw new Error(`template_not_approved:${state || 'unknown'}`);
  }
  const runtime = buildTemplateRuntimeFromRow(row);
  if (!runtime) throw new Error('approved_template_invalid');
  return {
    runtime,
    warnings: [],
  };
}

export function applyApprovedTemplateToOutline(params: {
  runtime: PresentationTemplateRuntime;
  outline: OutlineItem[];
  sources: SourceArtifact[];
}): { outline: OutlineItem[]; slotMapping: TemplateSlotMappingResult; warnings: string[] } {
  const templated = applyTemplateRuntime({
    outline: params.outline,
    runtime: params.runtime,
    sources: params.sources,
  });
  const recipeByIntent = new Map(
    params.runtime.slideRecipes.map((recipe) => [recipe.intent, recipe])
  );
  const slots = templated.outline.map((item, index) => {
    const recipe = recipeByIntent.get(item.intent);
    const matchedSources = sourceMatches(recipe, params.sources);
    const sourceTypes = recipe?.sourceTypes || [];
    const matchedTypes = new Set(matchedSources.map((source) => source.type));
    return {
      slideIndex: index,
      intent: item.intent,
      title: item.title,
      layoutRule: String(item.layoutHint || recipe?.layoutFamily || 'content-card'),
      requiredBlocks: recipe?.requiredBlocks || item.suggestedBlocks || [],
      sourceTypes,
      mappedSourceIds: matchedSources.map(sourceId),
      missingSourceTypes: sourceTypes.filter(
        (sourceType) => !matchedTypes.has(sourceType as SourceArtifact['type'])
      ),
    } satisfies TemplateSlotMapping;
  });
  const missingRequiredInputs = params.runtime.sourceRequirements
    .filter((requirement) => requirement.required)
    .filter(
      (requirement) =>
        !params.sources.some(
          (source) => source.type === (requirement.type as SourceArtifact['type'])
        )
    )
    .map((requirement) => requirement.type);
  const warnings = [
    ...templated.warnings,
    ...Array.from(new Set(missingRequiredInputs)).map(
      (sourceType) => `Approved template requires source type ${sourceType}.`
    ),
  ];
  return {
    outline: templated.outline,
    slotMapping: {
      templateId: params.runtime.templateId,
      templateFamily: params.runtime.templateFamily,
      slots,
      missingRequiredInputs: Array.from(new Set(missingRequiredInputs)),
      warnings,
    },
    warnings,
  };
}
