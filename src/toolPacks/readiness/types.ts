/**
 * Typy rozszerzonego manifestu gotowości runtime — STREAM H3, 2026-08-13.
 *
 * `RuntimeReadinessManifest` (runtimeReadiness.ts) niesie WYŁĄCZNIE 10
 * obowiązkowych bramek + MPQ + evidenceLedgerRefs — to, co konsumuje
 * `evaluateRuntimeReadiness()`. Ten plik dokłada WARSTWĘ SZCZEGÓŁU: 16
 * kryteriów per narzędzie (pack, engine, mapowanie pytań/faz, persistence,
 * renderer, walidacja/dowody, Output, Report, Presentation, Initiative,
 * approval, browser E2E, restart/reopen, Light MPQ, Dark MPQ, evidence
 * ledger), każde z osobnym PASS/FAIL/NOT_VERIFIED i wskaźnikiem na dowód —
 * po to, żeby manifest był CZYTELNY dla człowieka, a nie tylko dla bramki.
 *
 * Rozdział: `runtimeReadiness.gates` to to, co faktycznie blokuje
 * RUNTIME_ACTIVE (przez `evaluateRuntimeReadiness`). `criteria.*` to
 * uzasadnienie/dowód dla każdej z tych bramek PLUS trzy dodatkowe osie
 * (Report, Presentation, browser E2E), które nie mają własnej bramki w
 * `MANDATORY_GATES`, ale są częścią uczciwego obrazu narzędzia.
 */

import type { RuntimeReadinessManifest } from '../runtimeReadiness';

export type CriterionStatus = 'PASS' | 'FAIL' | 'NOT_VERIFIED';

export interface CriterionRecord {
  status: CriterionStatus;
  /** Wskaźnik na dowód: ścieżka pliku, nazwa testu, komenda, albo jawny brak. */
  evidence: string;
}

export interface ToolReadinessCriteria {
  pack: CriterionRecord;
  engine: CriterionRecord;
  questionWorkflowMapping: CriterionRecord;
  persistence: CriterionRecord;
  renderer: CriterionRecord;
  validationEvidence: CriterionRecord;
  output: CriterionRecord;
  report: CriterionRecord;
  presentation: CriterionRecord;
  initiative: CriterionRecord;
  approval: CriterionRecord;
  browserE2E: CriterionRecord;
  restartReopen: CriterionRecord;
  lightMpq: CriterionRecord;
  darkMpq: CriterionRecord;
  evidenceLedger: CriterionRecord;
}

export interface RecordedVerdict {
  publishable: boolean;
  failureCount: number;
}

export interface ToolReadinessRecord {
  toolType: string;
  displayName: string;
  signatureArchetype: string;
  /** Ranga z ROSTER_MATRIX.md §3, re-zweryfikowana tym streamem, nie kopiowana. */
  tier: 1 | 2 | 3;
  candidateSha: string;
  verifiedAt: string;
  criteria: ToolReadinessCriteria;
  runtimeReadiness: RuntimeReadinessManifest;
  /**
   * Werdykt zapisany w danych — test kontraktowy porównuje go z LIVE wynikiem
   * `evaluateRuntimeReadiness(record.runtimeReadiness, CANDIDATE_SHA)`, żeby
   * złapać rozjazd między tym, co manifest TWIERDZI, a tym, co bramka
   * FAKTYCZNIE policzy.
   */
  recordedVerdict: RecordedVerdict;
}
