/**
 * Logistics Automation — step definitions.
 *
 * Cloned from the Inventory Autopilot step pattern (INVENTORY_STEPS in
 * useToolStore.ts): context -> two data-capture steps -> summary. Mirrors the
 * doctrine's own structure (Harvard/wdrozenie-100/_TOOLS_DOKTRYNA/logistics-automation.md
 * §4): map the 5-zone flow (`zones`), then identify and sequence automation
 * candidates (`moves`), then close on the roadmap + business case (`summary`).
 */

import type { StepDefinition } from '@/store/useToolStore';

export const LOGISTICS_STEPS: StepDefinition[] = [
  {
    id: 'context',
    name: 'Logistics Context',
    namePl: 'Kontekst Logistyki',
    description: 'Define the warehouse scope, decision horizon and success signal',
    descriptionPl: 'Zdefiniuj zakres magazynu, horyzont decyzji i sygnał sukcesu',
    required: true,
    aiAssisted: false,
  },
  {
    id: 'zones',
    name: 'Warehouse Zones',
    namePl: 'Strefy Magazynu',
    description: 'Map the 5-zone flow: FTE, non-productive time, volumes, accuracy',
    descriptionPl: 'Zmapuj przepływ 5 stref: FTE, czas nieprodukcyjny, wolumeny, dokładność',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'moves',
    name: 'Automation Candidates',
    namePl: 'Kandydaci na Automatyzację',
    description: 'Identify process and technology moves per zone, process before technology',
    descriptionPl: 'Zidentyfikuj ruchy procesowe i technologiczne per strefa, proces przed technologią',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'summary',
    name: 'Summary & Roadmap',
    namePl: 'Podsumowanie i Roadmapa',
    description: 'Summarize the ranked candidates, sequence and business case',
    descriptionPl: 'Podsumuj ranking kandydatów, sekwencję i business case',
    required: true,
    aiAssisted: true,
  },
];
