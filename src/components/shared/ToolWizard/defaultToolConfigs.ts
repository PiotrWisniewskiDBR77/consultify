/**
 * Default tool configurations for the V3 Tool Wizard Standard.
 * Each tool overrides steps and input fields as needed.
 *
 * Reference tool: Dynamic SWOT (demonstrates full wizard flow)
 */

import type { WizardInputField, WizardStepConfig, WizardStepId, WizardToolConfig } from './types';

/** Canonical 6-step wizard flow */
export const DEFAULT_WIZARD_STEPS: WizardStepConfig[] = [
  {
    id: 'define',
    label: { en: 'Define', pl: 'Określ' },
    description: { en: 'Intent, scope, and audience', pl: 'Cel, zakres i odbiorcy' },
  },
  {
    id: 'inputs',
    label: { en: 'Inputs & Assumptions', pl: 'Dane i założenia' },
    description: {
      en: 'Client data and consultant assumptions',
      pl: 'Dane klienta i założenia konsultanta',
    },
  },
  {
    id: 'work',
    label: { en: 'Work', pl: 'Praca' },
    description: { en: 'Analysis work surface', pl: 'Powierzchnia robocza analizy' },
  },
  {
    id: 'review',
    label: { en: 'Review', pl: 'Przegląd' },
    description: {
      en: 'Summaries, missing items, improvements',
      pl: 'Podsumowania, braki, ulepszenia',
    },
  },
  {
    id: 'finalize',
    label: { en: 'Finalize', pl: 'Finalizacja' },
    description: {
      en: 'Lock session for output creation',
      pl: 'Zablokuj sesję do tworzenia outputów',
    },
  },
  {
    id: 'outputs',
    label: { en: 'Outputs', pl: 'Wyniki' },
    description: {
      en: 'Create initiatives, reports, presentations',
      pl: 'Twórz inicjatywy, raporty, prezentacje',
    },
  },
];

/** Reference tool: Dynamic SWOT */
export const DYNAMIC_SWOT_CONFIG: WizardToolConfig = {
  toolType: 'dynamic-swot',
  toolName: { en: 'Dynamic SWOT', pl: 'Dynamiczny SWOT' },
  toolDescription: {
    en: 'AI-driven SWOT analysis with correlation matrix and initiative generation',
    pl: 'Analiza SWOT wspomagana AI z macierzą korelacji i generowaniem inicjatyw',
  },
  category: 'strategic',
  surfaceType: 'workspace',
  steps: DEFAULT_WIZARD_STEPS,
  inputFields: [
    {
      id: 'companyName',
      label: { en: 'Company / Business Unit', pl: 'Firma / Jednostka biznesowa' },
      type: 'text',
      required: true,
      placeholder: { en: 'e.g. Acme Corp, EMEA Division', pl: 'np. Acme Corp, Dywizja EMEA' },
    },
    {
      id: 'industry',
      label: { en: 'Industry', pl: 'Branża' },
      type: 'text',
      required: true,
      placeholder: { en: 'e.g. Manufacturing, Healthcare', pl: 'np. Produkcja, Ochrona zdrowia' },
    },
    {
      id: 'strategicContext',
      label: { en: 'Strategic Context', pl: 'Kontekst strategiczny' },
      type: 'textarea',
      required: false,
      placeholder: {
        en: 'Current strategy, key challenges, market position...',
        pl: 'Obecna strategia, kluczowe wyzwania, pozycja rynkowa...',
      },
      helpText: {
        en: 'Provide context to help AI generate better suggestions',
        pl: 'Podaj kontekst aby AI generowało lepsze sugestie',
      },
    },
    {
      id: 'timeHorizon',
      label: { en: 'Time Horizon', pl: 'Horyzont czasowy' },
      type: 'select',
      required: true,
      options: [
        { value: '6m', label: { en: '6 months', pl: '6 miesięcy' } },
        { value: '1y', label: { en: '1 year', pl: '1 rok' } },
        { value: '3y', label: { en: '3 years', pl: '3 lata' } },
        { value: '5y', label: { en: '5+ years', pl: '5+ lat' } },
      ],
    },
  ],
  outputCapabilities: ['initiative', 'report', 'presentation'],
};

/** Process Automation — hybrid workspace+table (V3-E05 reference) */
export const PROCESS_AUTOMATION_CONFIG: WizardToolConfig = {
  toolType: 'process-automation',
  toolName: { en: 'Process Automation', pl: 'Automatyzacja Procesów' },
  toolDescription: {
    en: 'Map, analyze, and optimize business processes for automation',
    pl: 'Mapuj, analizuj i optymalizuj procesy biznesowe pod kątem automatyzacji',
  },
  category: 'automation',
  surfaceType: 'hybrid',
  steps: [
    {
      id: 'define',
      label: { en: 'Define', pl: 'Określ' },
      description: { en: 'Intent, scope, and audience', pl: 'Cel, zakres i odbiorcy' },
    },
    {
      id: 'inputs',
      label: { en: 'Inputs & Assumptions', pl: 'Dane i założenia' },
      description: {
        en: 'Process context, pain points, automation goals',
        pl: 'Kontekst procesu, problemy, cele automatyzacji',
      },
    },
    {
      id: 'work',
      label: { en: 'Process Map', pl: 'Mapa procesu' },
      description: {
        en: 'Editable process steps table + flow visualization',
        pl: 'Edytowalna tabela kroków + wizualizacja przepływu',
      },
    },
    {
      id: 'review',
      label: { en: 'Review', pl: 'Przegląd' },
      description: {
        en: 'Summaries, missing items, improvements',
        pl: 'Podsumowania, braki, ulepszenia',
      },
    },
    {
      id: 'finalize',
      label: { en: 'Finalize', pl: 'Finalizacja' },
      description: {
        en: 'Lock session for output creation',
        pl: 'Zablokuj sesję do tworzenia outputów',
      },
    },
    {
      id: 'outputs',
      label: { en: 'Outputs', pl: 'Wyniki' },
      description: {
        en: 'Process map report, feasibility matrix, ROI, recommended tools',
        pl: 'Raport mapy procesu, macierz wykonalności, ROI, rekomendowane narzędzia',
      },
    },
  ],
  inputFields: [
    {
      id: 'processName',
      label: { en: 'Process Name', pl: 'Nazwa procesu' },
      type: 'text',
      required: true,
      placeholder: { en: 'e.g. Order Fulfillment', pl: 'np. Realizacja zamówień' },
    },
    {
      id: 'processOwner',
      label: { en: 'Process Owner', pl: 'Właściciel procesu' },
      type: 'text',
      required: false,
      placeholder: { en: 'e.g. Operations Manager', pl: 'np. Kierownik operacji' },
    },
    {
      id: 'department',
      label: { en: 'Department', pl: 'Dział' },
      type: 'text',
      required: false,
      placeholder: { en: 'e.g. Supply Chain, Finance', pl: 'np. Łańcuch dostaw, Finanse' },
    },
    {
      id: 'scope',
      label: { en: 'Scope (which areas)', pl: 'Zakres (które obszary)' },
      type: 'textarea',
      required: false,
      placeholder: {
        en: 'Which parts of the process are in scope?',
        pl: 'Które części procesu są w zakresie?',
      },
    },
    {
      id: 'currentPainPoints',
      label: { en: 'Current Pain Points', pl: 'Obecne problemy' },
      type: 'textarea',
      required: false,
      placeholder: {
        en: 'Bottlenecks, manual steps, errors, delays...',
        pl: 'Wąskie gardła, manualne kroki, błędy, opóźnienia...',
      },
    },
    {
      id: 'automationGoals',
      label: { en: 'Automation Goals', pl: 'Cele automatyzacji' },
      type: 'textarea',
      required: false,
      placeholder: {
        en: 'What do you want to achieve with automation?',
        pl: 'Co chcesz osiągnąć dzięki automatyzacji?',
      },
    },
  ],
  outputCapabilities: ['initiative', 'report', 'presentation'],
};

/** Registry of all tool configs — tools not listed here get a generic config */
export const TOOL_WIZARD_CONFIGS: Record<string, WizardToolConfig> = {
  'dynamic-swot': DYNAMIC_SWOT_CONFIG,
  'process-automation': PROCESS_AUTOMATION_CONFIG,
};

/** Create a generic config for tools not in the registry */
export function getToolWizardConfig(toolType: string, toolName?: string): WizardToolConfig {
  if (TOOL_WIZARD_CONFIGS[toolType]) {
    return TOOL_WIZARD_CONFIGS[toolType];
  }

  return {
    toolType,
    toolName: { en: toolName || toolType, pl: toolName || toolType },
    category: 'strategic',
    surfaceType: 'workspace',
    steps: DEFAULT_WIZARD_STEPS,
    inputFields: [],
    outputCapabilities: ['initiative', 'report'],
  };
}
