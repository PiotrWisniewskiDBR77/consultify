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

  if (toolType === 'market-forces') {
    switch (stepDefinition.id) {
      case 'mission':
        return [
          createAction(
            'suggest-step',
            'sparkles',
            'AI Market Framing',
            'AI framing rynku',
            'Critique and sharpen the market brief',
            'Skrytykuj i wyostrz brief rynkowy'
          ),
          createAction(
            'generate-full-session',
            'wand',
            'Full Session Draft',
            'Szkic całej sesji',
            'Generate a controlled first draft of the full Porter session',
            'Wygeneruj kontrolowany pierwszy szkic całej sesji Portera'
          ),
        ];
      case 'input':
        return [
          createAction(
            'suggest-step',
            'search',
            'AI Market Signals',
            'AI sygnały rynkowe',
            'Suggest evidence and competitive signals for exploration',
            'Zaproponuj dowody i sygnały konkurencyjne do eksploracji'
          ),
        ];
      case 'forces':
        return [
          createAction(
            'suggest-step',
            'sparkles',
            'AI Force Scorecard',
            'AI scorecard sił',
            'Turn signals into scored Porter forces',
            'Zamień sygnały w ocenione siły Portera'
          ),
        ];
      case 'insights':
        return [
          createAction(
            'generate-correlations',
            'wand',
            'AI Implications',
            'AI implikacje',
            'Synthesize market structure into implications and moves',
            'Syntezuj strukturę rynku w implikacje i ruchy'
          ),
        ];
      case 'outputs':
        return [
          createAction(
            'generate-summary',
            'wand',
            'AI Final Summary',
            'AI final summary',
            'Generate final summary, output candidates, and initiatives',
            'Wygeneruj final summary, output candidates i inicjatywy'
          ),
        ];
      default:
        return [];
    }
  }

  if (toolType === 'growth-paths') {
    switch (stepDefinition.id) {
      case 'mission':
        return [
          createAction(
            'suggest-step',
            'sparkles',
            'AI Growth Framing',
            'AI framing wzrostu',
            'Critique and sharpen the growth mission',
            'Skrytykuj i wyostrz brief wzrostu'
          ),
          createAction(
            'generate-full-session',
            'wand',
            'Full Session Draft',
            'Szkic całej sesji',
            'Generate a controlled first draft of the full Ansoff session',
            'Wygeneruj kontrolowany pierwszy szkic całej sesji Ansoffa'
          ),
        ];
      case 'input':
        return [
          createAction(
            'suggest-step',
            'search',
            'AI Growth Signals',
            'AI sygnały wzrostu',
            'Suggest evidence and growth signals for exploration',
            'Zaproponuj dowody i sygnały wzrostu do eksploracji'
          ),
        ];
      case 'options':
        return [
          createAction(
            'suggest-step',
            'sparkles',
            'AI Ansoff Options',
            'AI opcje Ansoffa',
            'Turn signals into proposed Ansoff growth options',
            'Zamień sygnały w proponowane opcje wzrostu Ansoffa'
          ),
        ];
      case 'insights':
        return [
          createAction(
            'generate-correlations',
            'wand',
            'AI Growth Synthesis',
            'AI synteza wzrostu',
            'Compare options and synthesize recommended growth moves',
            'Porównaj opcje i syntezuj rekomendowane ruchy wzrostu'
          ),
        ];
      case 'outputs':
        return [
          createAction(
            'generate-summary',
            'wand',
            'AI Final Summary',
            'AI final summary',
            'Generate final summary, output candidates, and initiatives',
            'Wygeneruj final summary, output candidates i inicjatywy'
          ),
        ];
      default:
        return [];
    }
  }

  if (toolType === 'portfolio-priority') {
    switch (stepDefinition.id) {
      case 'mission':
        return [
          createAction(
            'suggest-step',
            'sparkles',
            'AI Portfolio Framing',
            'AI framing portfolio',
            'Critique and sharpen the portfolio decision brief',
            'Skrytykuj i wyostrz brief decyzji portfolio'
          ),
          createAction(
            'generate-full-session',
            'wand',
            'Full Session Draft',
            'Szkic całej sesji',
            'Generate a controlled first draft of the full portfolio session',
            'Wygeneruj kontrolowany pierwszy szkic całej sesji portfolio'
          ),
        ];
      case 'input':
        return [
          createAction(
            'suggest-step',
            'search',
            'AI Portfolio Signals',
            'AI sygnały portfolio',
            'Suggest evidence and constraints for portfolio prioritization',
            'Zaproponuj dowody i ograniczenia do priorytetyzacji portfolio'
          ),
        ];
      case 'items':
        return [
          createAction(
            'suggest-step',
            'sparkles',
            'AI Portfolio Matrix',
            'AI macierz portfolio',
            'Turn signals into scored BCG portfolio cards',
            'Zamień sygnały w ocenione karty portfolio BCG'
          ),
        ];
      case 'insights':
        return [
          createAction(
            'generate-correlations',
            'wand',
            'AI Trade-offs',
            'AI trade-offy',
            'Synthesize portfolio trade-offs and recommended moves',
            'Syntezuj trade-offy portfolio i rekomendowane ruchy'
          ),
        ];
      case 'outputs':
        return [
          createAction(
            'generate-summary',
            'wand',
            'AI Final Summary',
            'AI final summary',
            'Generate final summary, output candidates, and initiatives',
            'Wygeneruj final summary, output candidates i inicjatywy'
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
