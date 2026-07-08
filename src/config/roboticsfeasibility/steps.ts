/**
 * Robotics Feasibility — wizard step definitions.
 *
 * Four steps mirror the doctrine's two-gate method order (Harvard/wdrozenie-100/
 * _TOOLS_DOKTRYNA/robotics-feasibility.md §4): context first, then the candidate
 * operations carrying BOTH technical-gate and economic-gate inputs (§4.1/§4.2),
 * then the W2 move sequence, then the insight-first synthesis. Step ids MUST
 * match what `toRoboticsSession` (src/config/roboticsfeasibility/roboticsEngine.ts)
 * reads off `OperationalToolData.sections`: `operations` (or `candidates`).
 */

import type { StepDefinition } from '@/store/useToolStore';

export const ROBOTICS_STEPS: StepDefinition[] = [
  {
    id: 'context',
    name: 'Robotics Context',
    namePl: 'Kontekst Robotyzacji',
    description: 'Define the scope, decision horizon and success signal for the robotization case',
    descriptionPl: 'Zdefiniuj zakres, horyzont decyzji i sygnał sukcesu case\'u robotyzacji',
    required: true,
    aiAssisted: false,
  },
  {
    id: 'operations',
    name: 'Candidate Operations',
    namePl: 'Operacje Kandydujące',
    description:
      'For each candidate operation: technical gate (repeatability, structured environment, grip) then economic gate (CAPEX with explicit integration line, labour saving, payback)',
    descriptionPl:
      'Dla każdej operacji kandydującej: bramka techniczna (powtarzalność, ustrukturyzowanie, chwyt), potem bramka ekonomiczna (CAPEX z jawną linią integracji, oszczędność pracy, payback)',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'moves',
    name: 'W2 Move Sequence',
    namePl: 'Sekwencja Ruchów W2',
    description: 'Sequence the go/pilot/hybrid moves, each carrying rationale, trade-off and rejected variant',
    descriptionPl: 'Zsekwencjonuj ruchy go/pilot/hybryda, każdy z rationale, trade-off i odrzuconym wariantem',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'summary',
    name: 'Summary & Initiatives',
    namePl: 'Podsumowanie i Inicjatywy',
    description: 'Summarize the portfolio verdicts and generate initiatives',
    descriptionPl: 'Podsumuj werdykty portfela i wygeneruj inicjatywy',
    required: true,
    aiAssisted: true,
  },
];
