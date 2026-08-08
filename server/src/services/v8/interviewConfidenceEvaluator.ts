/**
 * P10 §2.3.2 — JEDEN współdzielony evaluator poziomu pewności.
 *
 * Powód powstania (M03R-012, re-baseline 2026-08-04): ten sam próg był zapisany
 * w TRZECH miejscach i w każdym inaczej —
 *   · `p10-interview-insight-canon.test.ts` żądał "3+",
 *   · `P10_CONFIDENCE_SEMANTICS.high.minimumEvidence` mówił "2+",
 *   · `insightSignalBridgeService` liczył `evidence_pointers.length >= 3`.
 * Dodatkowo `high` i `medium` deklarowały OBA "2+ pointers", więc poziomy były
 * nierozróżnialne. Decyzja Master Codex ustaliła kanon (patrz niżej); ten plik
 * jest jego jedyną implementacją. Kanon, bridge i testy MUSZĄ pytać tutaj —
 * żaden konsument nie liczy już surowej długości tablicy.
 *
 * KANON (decyzja Master Codex 2026-08-04):
 *   high    — 2+ pointery z RÓŻNYCH źródeł lub materialnie różnych segmentów,
 *             albo clear triangulation; bez nierozwiązanej istotnej sprzeczności.
 *   medium  — 2+ pointery w JEDNYM źródle/segmencie, albo 1 pointer + strong
 *             artifact; bez cross-source triangulation.
 *   low     — pojedynczy wąski sygnał lub hipoteza.
 * (`insufficient` i `contradicted` pozostają jak w §2.3.2.)
 */

import type { P10ConfidenceLevel, P10EvidencePointer, P10EvidencePointerType } from './interviewInsightCanon.js';

/**
 * „Strong artifact" = pointer niosący materiał źródłowy, który sam w sobie daje
 * się zweryfikować (cytat, załącznik, eksport, powiązanie ankiety) — w odróżnieniu
 * od wskazania na obiekt (`interview_session`) czy notatki operatora, które bez
 * drugiego pointera są tylko sygnałem.
 */
export const P10_STRONG_ARTIFACT_POINTER_TYPES: readonly P10EvidencePointerType[] = [
  'transcript_excerpt',
  'attachment',
  'export_artifact',
  'survey_linkage',
] as const;

export interface ConfidenceEvaluationInput {
  pointers: readonly P10EvidencePointer[];
  /**
   * Triangulacja stwierdzona jawnie przez generator/recenzenta: ten sam wniosek
   * potwierdzony metodami, których nie da się sprowadzić do jednego źródła.
   * Sama liczba pointerów NIE ustawia tej flagi.
   */
  clearTriangulation?: boolean;
  /**
   * Istotna sprzeczność, która nie została rozstrzygnięta. Blokuje `high`
   * i — przy 2+ wiarygodnych pointerach — wymusza `contradicted`.
   */
  unresolvedMaterialContradiction?: boolean;
}

export interface ConfidenceEvaluation {
  level: P10ConfidenceLevel;
  activePointerCount: number;
  distinctSourceCount: number;
  /** Reguła `high` spełniona — jedyna podstawa dla `sourceCoverage = 'complete'`. */
  meetsHighRule: boolean;
  hasStrongArtifact: boolean;
  /** Ludzkie uzasadnienie decyzji — do audytu i do UI. */
  rationale: string;
}

/**
 * Klucz źródła/segmentu. Dwa cytaty z tej samej rozmowy to JEDEN segment, więc
 * kotwica po `#` jest odcinana; `type` wchodzi w klucz, bo ten sam identyfikator
 * w innej roli (sesja vs eksport z niej) to inny rodzaj dowodu, ale nie inne
 * źródło — dlatego bazą klucza jest `sourceRef`, a nie `pointerId`.
 */
function segmentKey(pointer: P10EvidencePointer): string {
  const ref = (pointer.sourceRef || '').trim().toLowerCase();
  const withoutAnchor = ref.split('#')[0];
  return withoutAnchor || `pointer:${pointer.pointerId}`;
}

export function evaluateConfidence(input: ConfidenceEvaluationInput): ConfidenceEvaluation {
  const active = (input.pointers || []).filter((p) => p && !p.isTombstone);
  const activePointerCount = active.length;
  const distinctSourceCount = new Set(active.map(segmentKey)).size;
  const hasStrongArtifact = active.some((p) =>
    P10_STRONG_ARTIFACT_POINTER_TYPES.includes(p.type)
  );
  const contradicted = input.unresolvedMaterialContradiction === true;

  // Reguła `high` — liczy się rozrzut po źródłach, nie liczba pointerów.
  const meetsHighRule =
    !contradicted &&
    activePointerCount >= 2 &&
    (distinctSourceCount >= 2 || input.clearTriangulation === true);

  const base = {
    activePointerCount,
    distinctSourceCount,
    meetsHighRule,
    hasStrongArtifact,
  };

  // §2.3.2: sprzeczność wymaga co najmniej dwóch wiarygodnych, materialnie
  // rozbieżnych pointerów. Przy jednym pointerze nie ma z czym się sprzeczać —
  // taki finding jest hipotezą, nie kontrą.
  if (contradicted && activePointerCount >= 2) {
    return {
      ...base,
      level: 'contradicted',
      rationale: 'Nierozwiązana istotna sprzeczność przy 2+ wiarygodnych pointerach.',
    };
  }

  if (activePointerCount === 0) {
    return {
      ...base,
      level: 'insufficient',
      rationale: 'Brak aktywnych evidence pointers — finding nie jest gotowy.',
    };
  }

  if (meetsHighRule) {
    return {
      ...base,
      level: 'high',
      rationale:
        input.clearTriangulation === true && distinctSourceCount < 2
          ? 'Clear triangulation bez nierozwiązanej sprzeczności.'
          : `${activePointerCount} pointerów z ${distinctSourceCount} różnych źródeł/segmentów, bez nierozwiązanej sprzeczności.`,
    };
  }

  // medium: 2+ pointery w jednym źródle/segmencie ALBO 1 pointer + strong artifact.
  if (activePointerCount >= 2 || hasStrongArtifact) {
    return {
      ...base,
      level: 'medium',
      rationale:
        activePointerCount >= 2
          ? 'Wiele pointerów, ale w jednym źródle/segmencie — brak cross-source triangulation.'
          : 'Pojedynczy pointer wsparty strong artifact — brak cross-source triangulation.',
    };
  }

  return {
    ...base,
    level: 'low',
    rationale: 'Pojedynczy wąski sygnał — hipoteza.',
  };
}

/**
 * Pokrycie źródłowe dla mostka sygnałów. `complete` WYŁĄCZNIE gdy spełniona jest
 * reguła `high` — nigdy na podstawie samej długości tablicy pointerów.
 */
export function evaluateSourceCoverage(
  input: ConfidenceEvaluationInput
): 'complete' | 'partial' {
  return evaluateConfidence(input).meetsHighRule ? 'complete' : 'partial';
}
