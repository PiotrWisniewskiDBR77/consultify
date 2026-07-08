/**
 * Digital Value Pool — wizard step definitions.
 *
 * SSOT for the 4-step operational flow that feeds `toValuePoolSession`
 * (src/config/digitalvaluepool/index.ts): the adapter reads sections keyed
 * `functions`/`pools` (value-chain functions with a cost/revenue base and an
 * industry benchmark share) and `useCases`/`use_cases`/`moves` (candidate
 * use-cases scored on impact × feasibility plus the scale-readiness gate).
 * Step ids below are the canonical section keys the store persists
 * `OperationalItem[]` under for this tool.
 *
 * Doctrine SSOT: Harvard/wdrozenie-100/_TOOLS_DOKTRYNA/digital-value-pool.md
 */

import type { StepDefinition } from '@/store/useToolStore';

export const VALUE_POOL_STEPS: StepDefinition[] = [
  {
    id: 'context',
    name: 'Value Pool Context',
    namePl: 'Kontekst Puli Wartości',
    description: 'Define the transformation budget, scope and horizon for the value-pool decomposition',
    descriptionPl: 'Zdefiniuj budżet transformacji, zakres i horyzont dekompozycji puli wartości',
    required: true,
    aiAssisted: false,
  },
  {
    id: 'functions',
    name: 'Value-Chain Functions',
    namePl: 'Funkcje Łańcucha Wartości',
    description: 'Decompose the org into 10-20 functions, each with a cost/revenue base and an industry benchmark share',
    descriptionPl: 'Rozbij organizację na 10-20 funkcji, każda z bazą kosztową/przychodową i benchmarkiem branżowym',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'useCases',
    name: 'Use-Case Priority Matrix',
    namePl: 'Macierz Priorytetów Use-Case’ów',
    description: 'Score candidate use-cases on impact × feasibility and the scale-readiness gate (data/owner/scale-path/business metric)',
    descriptionPl: 'Oceń kandydackie use-case’y na impact × feasibility i bramce gotowości do skali (dane/właściciel/ścieżka skali/metryka biznesowa)',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'summary',
    name: 'Summary & Initiatives',
    namePl: 'Podsumowanie i Inicjatywy',
    description: 'Summarize the value pool (concentration, dead fields, pilots-without-scale) and generate the W2 roadmap initiatives',
    descriptionPl: 'Podsumuj pulę wartości (koncentracja, martwe pola, piloty bez skali) i wygeneruj inicjatywy roadmapy W2',
    required: true,
    aiAssisted: true,
  },
];
