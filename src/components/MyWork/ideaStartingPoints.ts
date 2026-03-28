import type { CanvasToolType } from './ideaSelectionTypes';

export interface IdeaStartingPoint {
  id: string;
  labelEn: string;
  labelPl: string;
  promptEn: string;
  promptPl: string;
  preferredSystem: CanvasToolType;
}

export const IDEA_STARTING_POINTS: IdeaStartingPoint[] = [
  {
    id: 'break_down_problem',
    labelEn: 'Break down a problem',
    labelPl: 'Rozbij problem',
    promptEn: 'Break down this problem into the main dimensions, hypotheses, and next actions.',
    promptPl: 'Rozbij ten problem na główne wymiary, hipotezy i kolejne działania.',
    preferredSystem: 'mindmap',
  },
  {
    id: 'root_causes',
    labelEn: 'Find root causes',
    labelPl: 'Znajdź przyczyny źródłowe',
    promptEn: 'Help me find the root causes behind this issue and structure them clearly.',
    promptPl: 'Pomóż mi znaleźć przyczyny źródłowe tego problemu i uporządkować je jasno.',
    preferredSystem: 'mindmap',
  },
  {
    id: 'compare_options',
    labelEn: 'Compare options',
    labelPl: 'Porównaj opcje',
    promptEn: 'Create a comparison of the main options, tradeoffs, and recommended criteria.',
    promptPl: 'Przygotuj porównanie głównych opcji, trade-offów i rekomendowanych kryteriów.',
    preferredSystem: 'table',
  },
  {
    id: 'map_process',
    labelEn: 'Map a process',
    labelPl: 'Zmapuj proces',
    promptEn: 'Map the current process, key handoffs, bottlenecks, and improvement opportunities.',
    promptPl: 'Zmapuj obecny proces, główne handoffy, wąskie gardła i szanse usprawnień.',
    preferredSystem: 'process_flow',
  },
  {
    id: 'turn_notes_into_structure',
    labelEn: 'Turn notes into structure',
    labelPl: 'Zamień notatki w strukturę',
    promptEn:
      'Turn these notes into a clear structure with themes, clusters, and recommended next steps.',
    promptPl:
      'Zamień te notatki w klarowną strukturę z tematami, klastrami i rekomendowanymi następnymi krokami.',
    preferredSystem: 'whiteboard',
  },
  {
    id: 'simplify_financial_statement',
    labelEn: 'Simplify a financial statement',
    labelPl: 'Uprość sprawozdanie finansowe',
    promptEn:
      'Simplify this financial statement into a working analysis table with the most useful fields.',
    promptPl:
      'Uprość to sprawozdanie finansowe do roboczej tabeli analitycznej z najważniejszymi polami.',
    preferredSystem: 'table',
  },
];
