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
export const TOOLS_WITH_APPLY_HANDLER: ReadonlySet<ToolType> = new Set<ToolType>([
  'dynamic-swot',
  'market-forces',
  'value-chain',
  'capability-mapper',
  'ambition-decomposer',
  'focus-tradeoff',
  'narrative-engine',
  'growth-paths',
  'portfolio-priority',
  'risk-uncertainty',
  // operational/digital tools deepened with the generic operational AI handler
  'sop-builder',
  'a3-problem-solving',
  'smed-planner',
  'dms-builder',
  'inventory-autopilot',
  'ai-discovery',
  'pain-explorer',
  'rpa-scanner',
  'process-automation',
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
    'value-chain': {
      label: 'Build Chain',
      labelPl: 'Buduj łańcuch',
      title: 'Turn accepted signals into scored value-chain activities',
      titlePl: 'Zamień zaakceptowane sygnały w ocenione aktywności łańcucha wartości',
    },
    'capability-mapper': {
      label: 'Build Map',
      labelPl: 'Buduj mapę',
      title: 'Turn accepted signals into scored capabilities',
      titlePl: 'Zamień zaakceptowane sygnały w ocenione kompetencje',
    },
    'ambition-decomposer': {
      label: 'Build Themes',
      labelPl: 'Buduj tematy',
      title: 'Decompose the ambition into strategic themes with targets',
      titlePl: 'Rozłóż ambicję na tematy strategiczne z celami',
    },
    'focus-tradeoff': {
      label: 'Score Priorities',
      labelPl: 'Oceń priorytety',
      title: 'Score competing priorities on value, effort, and fit',
      titlePl: 'Oceń konkurujące priorytety wg wartości, wysiłku i dopasowania',
    },
    'narrative-engine': {
      label: 'Build Pillars',
      labelPl: 'Buduj filary',
      title: 'Turn accepted signals into narrative pillars with proof',
      titlePl: 'Zamień zaakceptowane sygnały w filary narracji z dowodami',
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
    'value-chain': 'activities',
    'capability-mapper': 'capabilities',
    'ambition-decomposer': 'themes',
    'focus-tradeoff': 'priorities',
    'narrative-engine': 'pillars',
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
        // Odbiór 2026-08-30 (przegląd całości): `labelPl` był tu skopiowany
        // 1:1 z `label` angielskim (kopiuj-wklej przy autorstwie) — jedyne
        // dwa przyciski w tym słowniku bez realnego tłumaczenia, reszta
        // (np. 'Buduj analizę', 'Buduj portfolio') już ma wzorzec.
        'Uzupełnij tę sekcję',
        'Sharpen the strategic question before analysis',
        'Wyostrz pytanie strategiczne przed analizą'
      ),
      createAction(
        'draft-session',
        'wand',
        'AI Draft',
        'Uzupełnij tę sekcję',
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
        // Odbiór 2026-08-30 (przegląd modułów 04/11/16): `labelPl` był tu
        // kopią 1:1 angielskiego `label` (ten sam defekt co niegdyś
        // 'AI Frame' wyżej w tym pliku) — jedyny przycisk kroku „Wejście i
        // eksploracja", który mówił po angielsku w polskim interfejsie.
        'Znajdź sygnały',
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
        // Odbiór 2026-08-30 (przegląd modułów 04/11/16): `labelPl` = kopia
        // 1:1 angielskiego — ten sam defekt co 'find-signals' i 'finalize-outputs'
        // niżej w tym pliku.
        'Syntetyzuj',
        'Create trade-offs, tensions, priorities, and recommended moves',
        'Stwórz kompromisy, napięcia, priorytety i rekomendowane ruchy'
      ),
    ];
  }

  if (stepDefinition.id === 'outputs') {
    return [
      createAction(
        'finalize-outputs',
        'wand',
        'Finalize',
        'Finalizuj',
        'Prepare final summary, output candidates, and initiative drafts',
        'Przygotuj podsumowanie końcowe, kandydatów na rezultaty i szkice inicjatyw'
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
        'Finalizuj',
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
