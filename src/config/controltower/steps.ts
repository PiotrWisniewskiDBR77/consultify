/**
 * Supply Chain Control Tower — step definitions.
 *
 * Five-step flow matching the tool's `sections` keys read by the adapter
 * (src/config/controltower/index.ts → toControlTowerSession):
 *   - context     : ConsultingMissionContext (goal/scope/timeframe) — not a section array
 *   - nodes        -> sections['nodes']      (chain nodes: ERP/WMS/TMS/supplier/carrier/3PL)
 *   - exceptions   -> sections['exceptions'] (tracked disruption types + thresholds + owners)
 *   - moves        -> sections['moves']      (candidate moves scored per lever)
 *   - summary      : maturity diagnosis + W2 sequence + recommended initiatives
 *
 * Mirrors the DMS Builder / Inventory Autopilot step shape (context → capture →
 * capture → summary), specialized to the four control-tower levers (visibility /
 * exceptions / response / maturity) from deepeningLadder.ts.
 */

import type { StepDefinition } from '@/store/useToolStore';

export const CONTROL_TOWER_STEPS: StepDefinition[] = [
  {
    id: 'context',
    name: 'Control Tower Context',
    namePl: 'Kontekst Wieży Kontroli',
    description: 'Define scope, chain topology and the time horizon for the control-tower build',
    descriptionPl: 'Zdefiniuj zakres, topologię łańcucha i horyzont czasowy budowy wieży kontroli',
    required: true,
    aiAssisted: false,
  },
  {
    id: 'nodes',
    name: 'Chain Nodes & Visibility',
    namePl: 'Węzły łańcucha i widoczność',
    description:
      'Map ERP/WMS/TMS/supplier/carrier/3PL nodes and mark which feed data automatically vs. which are blind spots',
    descriptionPl:
      'Zmapuj węzły ERP/WMS/TMS/dostawca/przewoźnik/3PL i oznacz, które dostarczają dane automatycznie, a które są martwymi polami',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'exceptions',
    name: 'Exceptions & Thresholds',
    namePl: 'Wyjątki i progi',
    description:
      'Define tracked exception types with thresholds, owners and detection lag — the core of the diagnosis',
    descriptionPl:
      'Zdefiniuj śledzone typy wyjątków z progami, właścicielami i detection lag — rdzeń diagnozy',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'moves',
    name: 'Moves & Response Model',
    namePl: 'Ruchy i model reakcji',
    description:
      'Score candidate moves across the visibility / exceptions / response / maturity levers with rationale, trade-off and rejected variant',
    descriptionPl:
      'Oceń kandydatów na ruchy w dźwigniach widoczność / wyjątki / model reakcji / dojrzałość — z uzasadnieniem, trade-off i wariantem odrzuconym',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'summary',
    name: 'Summary & Initiatives',
    namePl: 'Podsumowanie i Inicjatywy',
    description:
      'Summarize the maturity diagnosis, blind spots, detection lag and risk concentration, and generate initiatives',
    descriptionPl:
      'Podsumuj diagnozę dojrzałości, martwe pola, detection lag i koncentrację ryzyka oraz wygeneruj inicjatywy',
    required: true,
    aiAssisted: true,
  },
];
