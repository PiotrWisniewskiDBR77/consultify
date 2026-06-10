import type { StepDefinition, ToolType } from '@/store/useToolStore';

export type ToolPhaseAiActionId =
  | 'frame-mission'
  | 'draft-session'
  | 'find-signals'
  | 'build-analysis'
  | 'synthesize-insights'
  | 'finalize-outputs'
  | 'review-ai-cards';

export type ToolPhaseAiActionIcon = 'sparkles' | 'wand' | 'search';

export interface ToolPhaseAiActionDefinition {
  id: ToolPhaseAiActionId;
  icon: ToolPhaseAiActionIcon;
  label: string;
  labelPl: string;
  title?: string;
  titlePl?: string;
}

const createAction = (
  id: ToolPhaseAiActionId,
  icon: ToolPhaseAiActionIcon,
  label: string,
  labelPl: string,
  title?: string,
  titlePl?: string
): ToolPhaseAiActionDefinition => ({
  id,
  icon,
  label,
  labelPl,
  title,
  titlePl,
});

const SUMMARY_STEP_IDS = new Set([
  'outputs',
  'summary',
  'results',
  'reasoning',
  'prepare',
  'initiatives',
]);

/**
 * Tools that actually have an apply-handler wired in `useToolAI.ts`.
 * For everything else we return an empty action list to avoid surfacing
 * buttons whose streamed AI output is silently dropped (Teresa-as-illusion).
 *
 * To add a tool here, also extend the early-return guard in
 * `src/hooks/discovery/useToolAI.ts` and ship the corresponding
 * `applyXxxPendingAction` function.
 */
const TOOLS_WITH_APPLY_HANDLER: ReadonlySet<ToolType> = new Set<ToolType>([
  'dynamic-swot',
  'market-forces',
  'growth-paths',
  'portfolio-priority',
  'risk-uncertainty',
]);

export function getToolPhaseAiActions(
  toolType: ToolType,
  stepDefinition?: StepDefinition
): ToolPhaseAiActionDefinition[] {
  if (!stepDefinition) return [];
  // Suppress AI action chips for tools without a working apply-handler.
  // Better to show nothing than to surface a button that silently no-ops.
  if (!TOOLS_WITH_APPLY_HANDLER.has(toolType)) return [];

  const buildCopy: Partial<
    Record<ToolType, { label: string; labelPl: string; title: string; titlePl: string }>
  > = {
    'dynamic-swot': {
      label: 'Build SWOT',
      labelPl: 'Buduj SWOT',
      title: 'Turn accepted signals into SWOT proposal cards',
      titlePl: 'Zamień zaakceptowane sygnały w proponowane karty SWOT',
    },
    'market-forces': {
      label: 'Build Forces',
      labelPl: 'Buduj siły',
      title: 'Turn accepted signals into scored Porter forces',
      titlePl: 'Zamień zaakceptowane sygnały w ocenione siły Portera',
    },
    'growth-paths': {
      label: 'Build Options',
      labelPl: 'Buduj opcje',
      title: 'Turn accepted signals into Ansoff growth options',
      titlePl: 'Zamień zaakceptowane sygnały w opcje wzrostu Ansoffa',
    },
    'portfolio-priority': {
      label: 'Build Portfolio',
      labelPl: 'Buduj portfolio',
      title: 'Turn accepted signals into portfolio priority cards',
      titlePl: 'Zamień zaakceptowane sygnały w karty priorytetyzacji portfolio',
    },
    'risk-uncertainty': {
      label: 'Build Risk Map',
      labelPl: 'Buduj mapę ryzyka',
      title: 'Turn accepted signals into assumptions, risks, and scenarios',
      titlePl: 'Zamień zaakceptowane sygnały w założenia, ryzyka i scenariusze',
    },
  };

  const analysisStepIds: Partial<Record<ToolType, string>> = {
    'dynamic-swot': 'swot',
    'market-forces': 'forces',
    'growth-paths': 'options',
    'portfolio-priority': 'items',
    'risk-uncertainty': 'assumptions',
  };

  if (stepDefinition.id === 'mission') {
    return [
      createAction(
        'frame-mission',
        'sparkles',
        'AI Frame',
        'AI Frame',
        'Sharpen the strategic question before analysis',
        'Wyostrz pytanie strategiczne przed analizą'
      ),
      createAction(
        'draft-session',
        'wand',
        'AI Draft',
        'AI Draft',
        'Generate a controlled first draft of the full tool session',
        'Wygeneruj kontrolowany pierwszy szkic całej sesji narzędzia'
      ),
    ];
  }

  if (stepDefinition.id === 'input') {
    return [
      createAction(
        'find-signals',
        'search',
        'Find Signals',
        'Find Signals',
        'Extract evidence from interview and organization context',
        'Wyciągnij evidence z wywiadu i kontekstu organizacji'
      ),
    ];
  }

  if (analysisStepIds[toolType] === stepDefinition.id) {
    const copy = buildCopy[toolType];
    return [
      createAction(
        'build-analysis',
        'sparkles',
        copy?.label || 'Build Analysis',
        copy?.labelPl || 'Buduj analizę',
        copy?.title || 'Turn accepted signals into proposal cards',
        copy?.titlePl || 'Zamień zaakceptowane sygnały w proponowane karty'
      ),
    ];
  }

  if (stepDefinition.id === 'insights') {
    return [
      createAction(
        'synthesize-insights',
        'wand',
        'Synthesize',
        'Synthesize',
        'Create trade-offs, tensions, priorities, and recommended moves',
        'Stwórz trade-offy, napięcia, priorytety i rekomendowane ruchy'
      ),
    ];
  }

  if (stepDefinition.id === 'outputs') {
    return [
      createAction(
        'finalize-outputs',
        'wand',
        'Finalize',
        'Finalize',
        'Prepare final summary, output candidates, and initiative drafts',
        'Przygotuj final summary, output candidates i szkice inicjatyw'
      ),
    ];
  }

  if (!stepDefinition.aiAssisted) return [];

  if (SUMMARY_STEP_IDS.has(stepDefinition.id)) {
    return [
      createAction(
        'finalize-outputs',
        'wand',
        'Finalize',
        'Finalize',
        'Generate a consulting-grade summary for this phase',
        'Wygeneruj konsultingowe podsumowanie tej fazy'
      ),
    ];
  }

  return [
    createAction(
      'build-analysis',
      'sparkles',
      'Build Analysis',
      'Buduj analizę',
      'Generate structured AI suggestions for this step',
      'Wygeneruj ustrukturyzowane sugestie AI dla tego kroku'
    ),
  ];
}
