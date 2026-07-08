/**
 * Decision Engine — wizard step definitions.
 *
 * Seven steps mirror the Decision-Quality chain input side (Harvard/wdrozenie-100/
 * _TOOLS_DOKTRYNA/decision-engine.md §4.1): frame the question, lay out a MECE
 * alternative set, weigh the criteria that truly matter, range the key
 * uncertainties, and surface the assumptions each alternative silently stands
 * on — before the engine synthesizes the matrix, the weakest link and the move
 * sequence. There is deliberately no `moves` step: the move sequence is 100%
 * engine OUTPUT (`buildMoveSequence` in decisionEngine.ts), never a captured
 * input section.
 *
 * Step ids MUST match what `toDecisionSession` (src/config/decisionengine/
 * decisionEngine.ts) reads off `OperationalToolData.sections`: `frame` (or
 * `decision`), `alternatives` (or `options`), `criteria`, `uncertainties` (or
 * `risks`), `assumptions`.
 */

import type { StepDefinition } from '@/store/useToolStore';

export const DECISION_STEPS: StepDefinition[] = [
  {
    id: 'context',
    name: 'Decision Context',
    namePl: 'Kontekst Decyzji',
    description: 'Define the mission goal, scope and timeframe the decision must serve',
    descriptionPl: 'Zdefiniuj cel misji, zakres i horyzont, któremu decyzja ma służyć',
    required: true,
    aiAssisted: false,
  },
  {
    id: 'frame',
    name: 'Frame',
    namePl: 'Ramowanie',
    description:
      'State the decision question, decision-maker, horizon and reversibility — and check it is not a naked binary',
    descriptionPl:
      'Zapisz pytanie decyzyjne, decydenta, horyzont i odwracalność — i sprawdź, czy nie jest to naga binarność',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'alternatives',
    name: 'Alternatives',
    namePl: 'Alternatywy',
    description: 'Generate a MECE set of at least three real, doable alternatives — flag any straw man',
    descriptionPl:
      'Wygeneruj wzajemnie rozłączny (MECE) zestaw co najmniej trzech realnych, wykonalnych alternatyw — oznacz opcję słomianą',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'criteria',
    name: 'Criteria & Weights',
    namePl: 'Kryteria i Wagi',
    description: 'Name the criteria the decision-maker truly values and weigh the trade-off explicitly',
    descriptionPl: 'Nazwij kryteria, na których decydentowi naprawdę zależy, i jawnie zważ trade-off',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'uncertainties',
    name: 'Uncertainties',
    namePl: 'Niepewności',
    description: 'Capture key uncertainties as low/base/high ranges, not point estimates, for the tornado',
    descriptionPl: 'Ujmij kluczowe niepewności jako zakresy low/base/high, nie szacunki punktowe, do analizy tornado',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'assumptions',
    name: 'Assumptions',
    namePl: 'Założenia',
    description:
      'Surface the hidden premises each alternative silently stands on — ideally from a pre-mortem walk-back',
    descriptionPl:
      'Ujawnij ukryte przesłanki, na których po cichu stoi każda alternatywa — najlepiej z pre-mortemu',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'summary',
    name: 'Summary & Initiatives',
    namePl: 'Podsumowanie i Inicjatywy',
    description:
      'Summarize the matrix, the weakest link, the tornado driver and the disciplined move sequence into initiatives',
    descriptionPl:
      'Podsumuj macierz, najsłabsze ogniwo, driver tornado i zdyscyplinowaną sekwencję ruchów w inicjatywy',
    required: true,
    aiAssisted: true,
  },
];
