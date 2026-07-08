/**
 * Automation Pipeline — step definitions.
 *
 * Cloned from the RPA Scanner / inventory-autopilot STEPS pattern (see
 * `RPA_SCANNER_STEPS` in `src/store/useToolStore.ts`). Four steps, matching the
 * doctrine's disciplined order (discover → profile/technology/prioritize/sequence
 * → synthesize): context sets the mission, `process-candidates` is the register
 * fed by process/task mining + top-down requests, `moves` are the automation
 * moves per lever (discover/profile/technology/prioritize/sequence) that the
 * engine turns into a W2-validated wave sequence, and `summary` closes the loop
 * with the AI-assisted conclusion + initiatives.
 *
 * Step ids are load-bearing: `toAutomationPipelineSession` (index.ts) reads
 * `sections['process-candidates']` and `sections['moves']` by these exact ids.
 */

import type { StepDefinition } from '@/store/useToolStore';

export const AUTOMATION_PIPELINE_STEPS: StepDefinition[] = [
  {
    id: 'context',
    name: 'Automation Pipeline Context',
    namePl: 'Kontekst Pipeline\'u Automatyzacji',
    description: 'Define the goal, scope and horizon of the automation pipeline assessment',
    descriptionPl: 'Zdefiniuj cel, zakres i horyzont oceny pipeline\'u automatyzacji',
    required: true,
    aiAssisted: false,
  },
  {
    id: 'process-candidates',
    name: 'Process Candidates',
    namePl: 'Procesy-kandydaci',
    description:
      'Register candidate processes with their rule-ness, data structure, stability, volume and exceptions',
    descriptionPl:
      'Zarejestruj procesy-kandydatów wraz z regułowością, strukturą danych, stabilnością, wolumenem i wyjątkami',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'moves',
    name: 'Automation Moves',
    namePl: 'Ruchy Automatyzacji',
    description:
      'Score automation moves per lever (discover / profile / technology / prioritize / sequence) with evidence',
    descriptionPl:
      'Oceń ruchy automatyzacji per dźwignia (odkrywanie / profilowanie / technologia / priorytetyzacja / sekwencja) z dowodami',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'summary',
    name: 'Summary & Initiatives',
    namePl: 'Podsumowanie i Inicjatywy',
    description: 'Summarize the pipeline assessment and generate initiatives',
    descriptionPl: 'Podsumuj ocenę pipeline\'u i wygeneruj inicjatywy',
    required: true,
    aiAssisted: true,
  },
];
