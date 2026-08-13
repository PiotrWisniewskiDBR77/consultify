/**
 * Walidator Tool Packów.
 *
 * Egzekwuje dwie reguły właścicielskie (2026-08-13):
 *
 * 1. Rozdział pojęć: TREŚĆ (contentStatus) ≠ DOSTĘPNOŚĆ (runtimeStatus).
 * 2. Bramka publikacji: narzędzia nie wolno oznaczyć RUNTIME_ACTIVE bez
 *    kompletnego Packa. Kompletna treść sama w sobie NIE otwiera runtime.
 *
 * Walidator jest deterministyczny i nie sięga do sieci ani bazy.
 */

import {
  EVIDENCE_MISSING,
  isEvidenceMissing,
  type Bilingual,
  type ToolPack,
} from './contract';

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
  severity: ValidationSeverity;
  /** Ścieżka pola, np. `library.whenToUse`. */
  field: string;
  message: string;
}

export interface ValidationResult {
  toolType: string;
  valid: boolean;
  /** Czy pack wolno uznać za kompletny treściowo. */
  contentComplete: boolean;
  /** Czy pack wolno wypuścić jako RUNTIME_ACTIVE. */
  publishableAsActive: boolean;
  issues: ValidationIssue[];
}

const MIN_TEXT_LENGTH = 12;

/**
 * Próg długości dotyczy PROZY (opisy Library), nie nazw własnych.
 * Nazwy narzędzi bywają legalnie krótkie („VSM Builder", „A3"), więc
 * wymuszanie na nich minimalnej długości odrzucałoby poprawne packi.
 */
function isBlankBilingual(value: Bilingual | undefined, minLength = MIN_TEXT_LENGTH): boolean {
  if (!value) return true;
  const pl = String(value.pl ?? '').trim();
  const en = String(value.en ?? '').trim();
  return pl.length < minLength || en.length < minLength;
}

function looksLikePlaceholder(value: Bilingual | undefined): boolean {
  if (!value) return false;
  return [value.pl, value.en].some((t) => String(t ?? '').includes(EVIDENCE_MISSING));
}

/** Pola Library wymagane przez FROZEN standard + wymagania właściciela. */
const LIBRARY_FIELDS: Array<keyof ToolPack['library']> = [
  'whatItIs',
  'whatItIsNot',
  'whenToUse',
  'whenNotToUse',
  'whyItMatters',
  'inputsRequired',
  'roles',
  'outcome',
];

/** Pola metodyczne, które muszą mieć potwierdzoną treść. */
const METHOD_FIELDS: Array<keyof ToolPack> = [
  'classificationRules',
  'evidenceExpectations',
  'relationships',
  'interpretationRules',
  'completionCriteria',
  'signatureRationale',
];

export function validateToolPack(pack: ToolPack): ValidationResult {
  const issues: ValidationIssue[] = [];
  const err = (field: string, message: string) =>
    issues.push({ severity: 'error', field, message });
  const warn = (field: string, message: string) =>
    issues.push({ severity: 'warning', field, message });

  // --- identity ---
  if (!pack.toolType) err('toolType', 'Brak toolType.');
  if (isBlankBilingual(pack.displayName, 1)) {
    err('displayName', 'Nazwa prezentacyjna musi być w PL i EN.');
  }
  if (!/^\d+\.\d+\.\d+$/.test(String(pack.packVersion ?? ''))) {
    err('packVersion', 'packVersion musi mieć postać semver (np. 1.0.0).');
  }

  const declaredMissing = pack.contentStatus === 'EVIDENCE_MISSING';

  // --- Library ---
  for (const field of LIBRARY_FIELDS) {
    const value = pack.library?.[field] as Bilingual | undefined;
    if (looksLikePlaceholder(value)) {
      if (!declaredMissing) {
        err(
          `library.${field}`,
          'Pole zawiera EVIDENCE_MISSING, ale pack nie jest oznaczony jako EVIDENCE_MISSING.'
        );
      }
      continue;
    }
    if (isBlankBilingual(value)) {
      err(`library.${field}`, `Wymagana treść PL i EN (min. ${MIN_TEXT_LENGTH} znaków).`);
    }
  }

  if (isEvidenceMissing(pack.library?.license)) {
    // Świadomy brak — nie zgadujemy licencji cudzej metody.
    warn('library.license', 'Licencja nieustalona (EVIDENCE_MISSING).');
  }
  if (isEvidenceMissing(pack.library?.estimatedEffort)) {
    warn('library.estimatedEffort', 'Czas trwania nieustalony (EVIDENCE_MISSING).');
  }

  // --- mechanika ---
  if (!Array.isArray(pack.phases) || pack.phases.length === 0) {
    if (!declaredMissing) err('phases', 'Pack musi definiować co najmniej jedną fazę.');
  }
  if (!Array.isArray(pack.questions) || pack.questions.length === 0) {
    if (!declaredMissing) err('questions', 'Pack musi definiować co najmniej jedno pytanie.');
  }

  // Każde pytanie musi wskazywać istniejącą fazę — inaczej sesja się rozjedzie.
  const phaseIds = new Set((pack.phases ?? []).map((p) => p.id));
  (pack.questions ?? []).forEach((q, i) => {
    if (!phaseIds.has(q.phaseId)) {
      err(`questions[${i}].phaseId`, `Pytanie wskazuje nieistniejącą fazę "${q.phaseId}".`);
    }
  });

  // Duplikaty id faz i pytań psują zapis stanu sesji.
  const dupPhase = findDuplicates((pack.phases ?? []).map((p) => p.id));
  if (dupPhase.length) err('phases', `Zduplikowane id faz: ${dupPhase.join(', ')}.`);
  const dupQuestion = findDuplicates((pack.questions ?? []).map((q) => q.id));
  if (dupQuestion.length) err('questions', `Zduplikowane id pytań: ${dupQuestion.join(', ')}.`);

  for (const field of METHOD_FIELDS) {
    if (isEvidenceMissing(pack[field])) {
      if (!declaredMissing) {
        err(String(field), 'Brak treści metodycznej, a pack nie jest EVIDENCE_MISSING.');
      }
    }
  }

  // --- mapowanie 5 funkcji ---
  (['output', 'report', 'initiative'] as const).forEach((key) => {
    if (isEvidenceMissing(pack.mapping?.[key]) && !declaredMissing) {
      err(`mapping.${key}`, 'Brak mapowania — traceability Session→Output→Report/Initiative.');
    }
  });

  // --- provenance ---
  if (!declaredMissing && (!pack.provenance || pack.provenance.length === 0)) {
    err('provenance', 'Pack bez źródeł nie może być kompletny.');
  }
  const unverifiable = (pack.provenance ?? []).filter((p) => !p.verifiableInRepo);
  if (unverifiable.length > 0) {
    warn(
      'provenance',
      `${unverifiable.length} źródeł niewryfikowalnych w repo (np. gitignorowane .zip).`
    );
  }

  const errors = issues.filter((i) => i.severity === 'error');
  const contentComplete = errors.length === 0 && pack.contentStatus === 'PACK_COMPLETE';

  // BRAMKA: RUNTIME_ACTIVE wymaga kompletnej treści.
  let publishableAsActive = pack.runtimeStatus === 'RUNTIME_ACTIVE' && contentComplete;
  if (pack.runtimeStatus === 'RUNTIME_ACTIVE' && !contentComplete) {
    err(
      'runtimeStatus',
      'RUNTIME_ACTIVE bez kompletnego Packa jest zabronione (bramka publikacji).'
    );
    publishableAsActive = false;
  }

  return {
    toolType: String(pack.toolType ?? ''),
    valid: issues.filter((i) => i.severity === 'error').length === 0,
    contentComplete,
    publishableAsActive,
    issues,
  };
}

function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const v of values) {
    if (seen.has(v)) dup.add(v);
    seen.add(v);
  }
  return [...dup];
}

/** Waliduje wiele packów i zwraca zbiorcze podsumowanie. */
export function validateAll(packs: ToolPack[]): {
  results: ValidationResult[];
  summary: {
    total: number;
    packComplete: number;
    evidenceMissing: number;
    runtimeActive: number;
    invalid: number;
  };
} {
  const results = packs.map(validateToolPack);
  return {
    results,
    summary: {
      total: packs.length,
      packComplete: packs.filter((p) => p.contentStatus === 'PACK_COMPLETE').length,
      evidenceMissing: packs.filter((p) => p.contentStatus === 'EVIDENCE_MISSING').length,
      runtimeActive: packs.filter((p) => p.runtimeStatus === 'RUNTIME_ACTIVE').length,
      invalid: results.filter((r) => !r.valid).length,
    },
  };
}
