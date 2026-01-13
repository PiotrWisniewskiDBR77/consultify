/**
 * Rapid Lean Observation Templates
 */

export interface ObservationChecklistItem {
  id: string;
  text: string;
  textPl?: string;
  category?: string;
}

export interface ObservationTemplate {
  id: string;
  name: string;
  namePl?: string;
  description: string;
  descriptionPl?: string;
  category: string;
  icon?: string;
  checklist: ObservationChecklistItem[];
  fields: Array<{
    id: string;
    label: string;
    labelPl?: string;
    type: 'text' | 'number' | 'select' | 'checkbox' | 'rating';
    options?: string[];
    required?: boolean;
  }>;
}

export const RAPID_LEAN_OBSERVATION_TEMPLATES: ObservationTemplate[] = [
  {
    id: 'waste-walk',
    name: 'Waste Walk',
    namePl: 'Spacer po marnotrawstwie',
    description: 'Systematic observation to identify the 8 wastes in a process area',
    descriptionPl:
      'Systematyczna obserwacja w celu identyfikacji 8 typów marnotrawstwa w obszarze procesu',
    category: 'lean',
    icon: 'Footprints',
    checklist: [
      { id: 'ww1', text: 'Overproduction observed', textPl: 'Zaobserwowano nadprodukcję' },
      { id: 'ww2', text: 'Waiting time identified', textPl: 'Zidentyfikowano czas oczekiwania' },
      { id: 'ww3', text: 'Unnecessary transport', textPl: 'Niepotrzebny transport' },
      { id: 'ww4', text: 'Over-processing present', textPl: 'Obecne nadmierne przetwarzanie' },
      { id: 'ww5', text: 'Excess inventory', textPl: 'Nadmierny zapas' },
      { id: 'ww6', text: 'Unnecessary motion', textPl: 'Niepotrzebny ruch' },
      { id: 'ww7', text: 'Defects or rework', textPl: 'Wady lub przeróbki' },
      { id: 'ww8', text: 'Unused talent', textPl: 'Niewykorzystany talent' },
    ],
    fields: [
      { id: 'location', label: 'Location', labelPl: 'Lokalizacja', type: 'text', required: true },
      {
        id: 'waste_type',
        label: 'Primary Waste Type',
        labelPl: 'Główny typ marnotrawstwa',
        type: 'select',
        options: [
          'Overproduction',
          'Waiting',
          'Transport',
          'Processing',
          'Inventory',
          'Motion',
          'Defects',
          'Skills',
        ],
      },
      { id: 'severity', label: 'Severity', labelPl: 'Dotkliwość', type: 'rating' },
      { id: 'description', label: 'Description', labelPl: 'Opis', type: 'text' },
    ],
  },
  {
    id: '5s-audit',
    name: '5S Audit',
    namePl: 'Audyt 5S',
    description: 'Workplace organization assessment using 5S methodology',
    descriptionPl: 'Ocena organizacji miejsca pracy metodą 5S',
    category: 'lean',
    icon: 'CheckSquare',
    checklist: [
      {
        id: '5s1',
        text: 'Sort: Unnecessary items removed',
        textPl: 'Sortowanie: Usunięto niepotrzebne przedmioty',
      },
      {
        id: '5s2',
        text: 'Set in Order: Items properly organized',
        textPl: 'Systematyka: Przedmioty właściwie zorganizowane',
      },
      { id: '5s3', text: 'Shine: Area is clean', textPl: 'Sprzątanie: Obszar jest czysty' },
      {
        id: '5s4',
        text: 'Standardize: Standards are visible',
        textPl: 'Standaryzacja: Standardy są widoczne',
      },
      {
        id: '5s5',
        text: 'Sustain: Audits are regular',
        textPl: 'Samodyscyplina: Audyty są regularne',
      },
    ],
    fields: [
      { id: 'area', label: 'Area', labelPl: 'Obszar', type: 'text', required: true },
      { id: 'sort_score', label: 'Sort Score', labelPl: 'Ocena sortowania', type: 'rating' },
      {
        id: 'set_score',
        label: 'Set in Order Score',
        labelPl: 'Ocena systematyki',
        type: 'rating',
      },
      { id: 'shine_score', label: 'Shine Score', labelPl: 'Ocena sprzątania', type: 'rating' },
      {
        id: 'standardize_score',
        label: 'Standardize Score',
        labelPl: 'Ocena standaryzacji',
        type: 'rating',
      },
      {
        id: 'sustain_score',
        label: 'Sustain Score',
        labelPl: 'Ocena samodyscypliny',
        type: 'rating',
      },
    ],
  },
  {
    id: 'gemba-walk',
    name: 'Gemba Walk',
    namePl: 'Spacer Gemba',
    description: 'Go to the actual place where work is done to observe and learn',
    descriptionPl: 'Udaj się do miejsca, gdzie wykonywana jest praca, aby obserwować i uczyć się',
    category: 'lean',
    icon: 'Eye',
    checklist: [
      {
        id: 'gw1',
        text: 'Observed actual work processes',
        textPl: 'Zaobserwowano rzeczywiste procesy pracy',
      },
      { id: 'gw2', text: 'Spoke with workers', textPl: 'Rozmawiano z pracownikami' },
      {
        id: 'gw3',
        text: 'Identified improvement opportunities',
        textPl: 'Zidentyfikowano możliwości usprawnień',
      },
      {
        id: 'gw4',
        text: 'Noted safety concerns',
        textPl: 'Odnotowano obawy dotyczące bezpieczeństwa',
      },
    ],
    fields: [
      {
        id: 'area',
        label: 'Area Visited',
        labelPl: 'Odwiedzony obszar',
        type: 'text',
        required: true,
      },
      {
        id: 'duration',
        label: 'Duration (minutes)',
        labelPl: 'Czas trwania (minuty)',
        type: 'number',
      },
      {
        id: 'observations',
        label: 'Key Observations',
        labelPl: 'Kluczowe obserwacje',
        type: 'text',
      },
    ],
  },
];

export const getObservationTemplates = () => RAPID_LEAN_OBSERVATION_TEMPLATES;
export const getTemplateById = (id: string) =>
  RAPID_LEAN_OBSERVATION_TEMPLATES.find((t) => t.id === id);
