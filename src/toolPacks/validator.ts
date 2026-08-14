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
import { evaluateRuntimeReadiness } from './runtimeReadiness';

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

/**
 * @param candidateSha SHA, wobec którego weryfikujemy świeżość dowodów runtime.
 *   Wymagane, by uznać narzędzie za RUNTIME_ACTIVE.
 */
export function validateToolPack(pack: ToolPack, candidateSha = ''): ValidationResult {
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

  /**
   * Packi jeszcze niespisane i te bez dowodów wolno trzymać na placeholderach.
   * Różnią się WYŁĄCZNIE raportowaniem — walidacja jest dla nich tak samo łagodna,
   * a bramka publikacji tak samo twarda.
   */
  const declaredMissing =
    pack.contentStatus === 'EVIDENCE_MISSING' || pack.contentStatus === 'PACK_NOT_AUTHORED';

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

  // Zbiór id faz — deklarowany PRZED użyciem w walidacji silnika i pytań.
  const phaseIds = new Set((pack.phases ?? []).map((p) => p.id));

  // --- cel, zastosowania, przeciwwskazania (P1) ---
  if (looksLikePlaceholder(pack.purpose)) {
    if (!declaredMissing) err('purpose', 'purpose zawiera EVIDENCE_MISSING w kompletnym packu.');
  } else if (isBlankBilingual(pack.purpose)) {
    if (!declaredMissing) err('purpose', 'purpose wymaga treści PL i EN.');
  }
  if (!declaredMissing) {
    if (!Array.isArray(pack.useCases) || pack.useCases.length === 0) {
      err('useCases', 'Pack musi wymieniać co najmniej jedno zastosowanie.');
    }
    if (!Array.isArray(pack.contraindications) || pack.contraindications.length === 0) {
      err('contraindications', 'Pack musi wymieniać przeciwwskazania — kiedy NIE używać.');
    }
  }

  // --- pola każdej fazy (P1) ---
  (pack.phases ?? []).forEach((phase, i) => {
    if (!phase.id) err(`phases[${i}].id`, 'Faza bez id.');
    if (isBlankBilingual(phase.title, 1)) err(`phases[${i}].title`, 'Faza wymaga tytułu PL i EN.');
    if (isBlankBilingual(phase.goal)) err(`phases[${i}].goal`, 'Faza wymaga celu PL i EN.');
    (['whatGoodLooksLike', 'evidenceToAskFor', 'completionCriterion'] as const).forEach((f) => {
      if (isEvidenceMissing(phase[f]) && !declaredMissing) {
        err(`phases[${i}].${f}`, 'Brak treści fazy w kompletnym packu.');
      }
    });
  });

  // --- pytania: prompt PL/EN + challengeRule (P1) ---
  (pack.questions ?? []).forEach((q, i) => {
    if (isBlankBilingual(q.prompt)) {
      err(`questions[${i}].prompt`, 'Pytanie wymaga treści PL i EN.');
    }
    if (isEvidenceMissing(q.challengeRule) && !declaredMissing) {
      err(`questions[${i}].challengeRule`, 'Pytanie bez reguły challenge nie pogłębia rozmowy.');
    }
  });

  // --- wiązanie z silnikiem, bankiem pytań i rendererem (P1) ---
  if (!declaredMissing) {
    const engine = pack.engine;
    if (!engine) {
      err('engine', 'PACK_COMPLETE wymaga wiązania z silnikiem i bankiem pytań.');
    } else {
      if (!engine.engineDir) err('engine.engineDir', 'Brak katalogu silnika.');
      if (!engine.questionBankModule) {
        err('engine.questionBankModule', 'Brak modułu banku pytań.');
      }
      if (!(engine.expectedQuestionNodeCount > 0)) {
        err(
          'engine.expectedQuestionNodeCount',
          'Pack musi deklarować rozmiar banku pytań — inaczej „kompletny" znaczy „ma pięć pytań".'
        );
      }
      // Fazy obsługiwane przez bank muszą istnieć wśród faz packa.
      const unknown = (engine.bankBackedPhaseIds ?? []).filter((id) => !phaseIds.has(id));
      if (unknown.length) {
        err('engine.bankBackedPhaseIds', `Nieznane fazy: ${unknown.join(', ')}.`);
      }
      if (isEvidenceMissing(engine.rendererComponent)) {
        warn('engine.rendererComponent', 'Brak dedykowanego renderera — geometria generyczna.');
      }
    }

    // --- rejestr praw (P1) ---
    if (!pack.rights) {
      err('rights', 'PACK_COMPLETE wymaga wpisu Rights/Attribution.');
    } else {
      if (!pack.rights.methodologyName) err('rights.methodologyName', 'Brak nazwy metodyki.');
      if (/^free$/i.test(String(pack.rights.commercialUseStatus ?? ''))) {
        err(
          'rights.commercialUseStatus',
          'Zakaz wpisywania „Free" jako wniosku prawnego — flaga produktowa nie jest dowodem.'
        );
      }
    }
  }

  // --- mechanika ---
  if (!Array.isArray(pack.phases) || pack.phases.length === 0) {
    if (!declaredMissing) err('phases', 'Pack musi definiować co najmniej jedną fazę.');
  }
  if (!Array.isArray(pack.questions) || pack.questions.length === 0) {
    if (!declaredMissing) err('questions', 'Pack musi definiować co najmniej jedno pytanie.');
  }

  // Każde pytanie musi wskazywać istniejącą fazę — inaczej sesja się rozjedzie.
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

  // --- kontrakt konkluzji W2 (CONCLUSION_LAYER_STANDARD) ---
  (
    ['k1FactSource', 'k2GroundingScope', 'k3PrioritySource', 'k4EffectRule', 'tradeoffRule'] as const
  ).forEach((key) => {
    if (isEvidenceMissing(pack.conclusion?.[key]) && !declaredMissing) {
      err(`conclusion.${key}`, 'Brak kontraktu konkluzji W2 wymaganego przez FROZEN standard.');
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

  /*
   * BRAMKA PUBLIKACJI (wzmocniona po review Codexa, P0).
   *
   * Kompletna treść to WARUNEK KONIECZNY, nie wystarczający. RUNTIME_ACTIVE
   * wymaga dodatkowo manifestu gotowości z bramkami PASS, odniesionego do
   * bieżącego candidate SHA. Poprzednia wersja przepuszczała narzędzie
   * z zerowym runtime, o ile treść była kompletna.
   */
  let publishableAsActive = false;
  if (pack.runtimeStatus === 'RUNTIME_ACTIVE') {
    if (!contentComplete) {
      err('runtimeStatus', 'RUNTIME_ACTIVE bez kompletnego Packa jest zabronione.');
    }
    const verdict = evaluateRuntimeReadiness(pack.runtimeReadiness, candidateSha);
    if (!verdict.publishable) {
      verdict.failures.forEach((f) => err('runtimeReadiness', f));
    }
    publishableAsActive = contentComplete && verdict.publishable;
  } else if (pack.runtimeReadiness) {
    // Manifest bez roszczenia do RUNTIME_ACTIVE jest dozwolony (postęp prac),
    // ale nie wolno mu twierdzić, że wszystko przeszło.
    const verdict = evaluateRuntimeReadiness(pack.runtimeReadiness, candidateSha);
    if (verdict.publishable) {
      warn(
        'runtimeReadiness',
        'Wszystkie bramki PASS, ale runtimeStatus nie jest RUNTIME_ACTIVE — do podniesienia po odbiorze.'
      );
    }
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

/**
 * Waliduje wiele packów i zwraca zbiorcze podsumowanie.
 * `candidateSha` przekazujemy jawnie — `packs.map(validateToolPack)` wstawiłoby
 * indeks tablicy jako SHA i po cichu unieważniło bramkę świeżości dowodów.
 */
export function validateAll(packs: ToolPack[], candidateSha = ''): {
  results: ValidationResult[];
  summary: {
    total: number;
    packComplete: number;
    packNotAuthored: number;
    evidenceMissing: number;
    runtimeActive: number;
    invalid: number;
  };
} {
  const results = packs.map((pack) => validateToolPack(pack, candidateSha));
  return {
    results,
    summary: {
      total: packs.length,
      packComplete: packs.filter((p) => p.contentStatus === 'PACK_COMPLETE').length,
      packNotAuthored: packs.filter((p) => p.contentStatus === 'PACK_NOT_AUTHORED').length,
      evidenceMissing: packs.filter((p) => p.contentStatus === 'EVIDENCE_MISSING').length,
      runtimeActive: packs.filter((p) => p.runtimeStatus === 'RUNTIME_ACTIVE').length,
      invalid: results.filter((r) => !r.valid).length,
    },
  };
}
