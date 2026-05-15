import type { StepDefinition, ToolType } from '@/store/useToolStore';

export type ToolPhaseAiActionId =
  | 'suggest-step'
  | 'generate-correlations'
  | 'generate-summary'
  | 'generate-full-session';

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

export function getToolPhaseAiActions(
  toolType: ToolType,
  stepDefinition?: StepDefinition
): ToolPhaseAiActionDefinition[] {
  if (!stepDefinition) return [];

  if (toolType === 'dynamic-swot') {
    switch (stepDefinition.id) {
      case 'mission':
        return [
          createAction(
            'suggest-step',
            'sparkles',
            'AI Mission Framing',
            'AI framing briefu',
            'Critique and sharpen the mission brief',
            'Skrytykuj i wyostrz brief misji'
          ),
          createAction(
            'generate-full-session',
            'wand',
            'Full Session Draft',
            'Szkic całej sesji',
            'Generate a controlled first draft of the full SWOT session',
            'Wygeneruj kontrolowany pierwszy szkic całej sesji SWOT'
          ),
        ];
      case 'input':
        return [
          createAction(
            'suggest-step',
            'search',
            'AI Signals',
            'AI sygnały',
            'Suggest high-value evidence and signals for exploration',
            'Zaproponuj wartościowe sygnały i dowody do eksploracji'
          ),
        ];
      case 'swot':
        return [
          createAction(
            'suggest-step',
            'sparkles',
            'AI SWOT Matrix',
            'AI macierz SWOT',
            'Turn captured signals into proposed SWOT factors',
            'Zamień zebrane sygnały w proponowane czynniki SWOT'
          ),
        ];
      case 'insights':
        return [
          createAction(
            'generate-correlations',
            'wand',
            'AI Tensions',
            'AI napięcia',
            'Synthesize correlations, tensions, and strategic logic',
            'Syntezuj korelacje, napięcia i logikę strategiczną'
          ),
        ];
      case 'outputs':
        return [
          createAction(
            'generate-summary',
            'wand',
            'AI Final Summary',
            'AI final summary',
            'Generate the final source summary, moves, and output candidates',
            'Wygeneruj final source summary, ruchy i kandydatów outputów'
          ),
        ];
      default:
        return [];
    }
  }

  if (!stepDefinition.aiAssisted) return [];

  if (SUMMARY_STEP_IDS.has(stepDefinition.id)) {
    return [
      createAction(
        'generate-summary',
        'wand',
        'AI Summary',
        'AI podsumowanie',
        'Generate a consulting-grade summary for this phase',
        'Wygeneruj konsultingowe podsumowanie tej fazy'
      ),
    ];
  }

  return [
    createAction(
      'suggest-step',
      'sparkles',
      'AI Suggestions',
      'AI sugestie',
      'Generate structured AI suggestions for this step',
      'Wygeneruj ustrukturyzowane sugestie AI dla tego kroku'
    ),
  ];
}
