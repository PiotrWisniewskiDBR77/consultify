/**
 * Rapid Lean Questionnaire Data
 */

export type LeanDimension =
  | 'valueStreamEfficiency'
  | 'wasteElimination'
  | 'flowPullSystems'
  | 'qualityAtSource'
  | 'continuousImprovement'
  | 'visualManagement';

export const LEAN_SCALE = [
  { value: 1, label: 'Not implemented', description: 'No evidence of lean practices' },
  { value: 2, label: 'Initial', description: 'Some awareness, ad-hoc implementation' },
  { value: 3, label: 'Developing', description: 'Systematic approach beginning' },
  { value: 4, label: 'Mature', description: 'Well-established, consistent results' },
  { value: 5, label: 'Optimized', description: 'Continuous improvement embedded' },
];

export interface RapidLeanQuestion {
  id: string;
  dimension: LeanDimension;
  text: string;
  textPl?: string;
  helpText?: string;
  helpTextPl?: string;
  weight: number;
  quickMode?: boolean;
}

export interface LeanDimensionConfig {
  id: LeanDimension;
  name: string;
  namePl?: string;
  description: string;
  descriptionPl?: string;
  questions: RapidLeanQuestion[];
}

export const RAPID_LEAN_QUESTIONNAIRE: LeanDimensionConfig[] = [
  {
    id: 'valueStreamEfficiency',
    name: 'Value Stream Efficiency',
    namePl: 'Efektywność strumienia wartości',
    description: 'How well value flows through your processes',
    descriptionPl: 'Jak dobrze wartość przepływa przez procesy',
    questions: [
      {
        id: 'vse1',
        dimension: 'valueStreamEfficiency',
        text: 'Value stream maps are regularly updated and used for improvement',
        textPl: 'Mapy strumienia wartości są regularnie aktualizowane i używane do usprawnień',
        weight: 1,
        quickMode: true,
      },
      {
        id: 'vse2',
        dimension: 'valueStreamEfficiency',
        text: 'Non-value-adding steps are identified and minimized',
        textPl: 'Kroki nie dodające wartości są zidentyfikowane i zminimalizowane',
        weight: 1,
      },
    ],
  },
  {
    id: 'wasteElimination',
    name: 'Waste Elimination',
    namePl: 'Eliminacja marnotrawstwa',
    description: 'Identification and removal of the 8 wastes',
    descriptionPl: 'Identyfikacja i eliminacja 8 typów marnotrawstwa',
    questions: [
      {
        id: 'we1',
        dimension: 'wasteElimination',
        text: 'All 8 wastes are well understood by the team',
        textPl: 'Wszystkie 8 typów marnotrawstwa jest dobrze zrozumianych przez zespół',
        weight: 1,
        quickMode: true,
      },
    ],
  },
  {
    id: 'flowPullSystems',
    name: 'Flow & Pull Systems',
    namePl: 'Przepływ i systemy pull',
    description: 'Implementation of flow and pull-based production',
    descriptionPl: 'Wdrożenie produkcji opartej na przepływie i pull',
    questions: [
      {
        id: 'fps1',
        dimension: 'flowPullSystems',
        text: 'Work is pulled based on customer demand',
        textPl: 'Praca jest ciągnięta w oparciu o zapotrzebowanie klienta',
        weight: 1,
        quickMode: true,
      },
    ],
  },
  {
    id: 'qualityAtSource',
    name: 'Quality at Source',
    namePl: 'Jakość u źródła',
    description: 'Building quality into the process',
    descriptionPl: 'Wbudowywanie jakości w proces',
    questions: [
      {
        id: 'qas1',
        dimension: 'qualityAtSource',
        text: 'Quality checks are integrated at each process step',
        textPl: 'Kontrole jakości są zintegrowane na każdym etapie procesu',
        weight: 1,
        quickMode: true,
      },
    ],
  },
  {
    id: 'continuousImprovement',
    name: 'Continuous Improvement',
    namePl: 'Ciągłe doskonalenie',
    description: 'Kaizen and improvement culture',
    descriptionPl: 'Kaizen i kultura doskonalenia',
    questions: [
      {
        id: 'ci1',
        dimension: 'continuousImprovement',
        text: 'Regular improvement events (kaizen) are held',
        textPl: 'Regularne wydarzenia usprawniające (kaizen) są organizowane',
        weight: 1,
        quickMode: true,
      },
    ],
  },
  {
    id: 'visualManagement',
    name: 'Visual Management',
    namePl: 'Zarządzanie wizualne',
    description: 'Visual controls and communication',
    descriptionPl: 'Wizualne kontrole i komunikacja',
    questions: [
      {
        id: 'vm1',
        dimension: 'visualManagement',
        text: 'Visual boards display key metrics and status',
        textPl: 'Tablice wizualne wyświetlają kluczowe metryki i status',
        weight: 1,
        quickMode: true,
      },
    ],
  },
];

export const getRapidLeanQuestions = () => {
  return RAPID_LEAN_QUESTIONNAIRE.flatMap((d) => d.questions);
};
