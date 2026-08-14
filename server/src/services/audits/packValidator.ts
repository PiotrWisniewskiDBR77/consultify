/**
 * packValidator — bramka publikacji Audit Packa.
 *
 * DLACZEGO TWARDO:
 * Etykieta „norma" jest w audycie oświadczeniem wobec klienta. Pakiet bez
 * wskazanego źródła, jego wersji i potwierdzonych praw nie może udawać
 * normatywnego — ani wobec klienta, ani wobec wydawcy normy. Dlatego publikacja
 * jako `VERIFIED_NORMATIVE` przechodzi przez listę warunków, których nie da się
 * ominąć z UI: walidator jest jedyną drogą do statusu `published`.
 *
 * Walidator NIE ocenia merytorycznej poprawności treści — tego nie da się
 * zautomatyzować. Sprawdza kompletność i spójność deklaracji oraz to, czy
 * ekspert faktycznie zatwierdził mapowanie.
 */

import { isNormativeSourceType } from './types.js';
import type {
  AuditNormSource,
  AuditPack,
  AuditPackCriterion,
  FindingTaxonomyEntry,
  PackClassification,
} from './types.js';
import { FINDING_SEVERITIES, PACK_CLASSIFICATIONS } from './types.js';

export interface ValidationIssue {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  path?: string;
}

export interface PackValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  /** Klasyfikacje, na które pakiet kwalifikuje się w obecnym stanie. */
  eligibleClassifications: PackClassification[];
}

export interface ValidatePackInput {
  pack: Partial<AuditPack> & { title?: string; packKey?: string };
  criteria: Array<Partial<AuditPackCriterion>>;
  source?: AuditNormSource | null;
  /** Docelowy status publikacji — decyduje o surowości bramki. */
  targetPublicationStatus?: 'draft' | 'in_review' | 'published';
}

function err(code: string, message: string, path?: string): ValidationIssue {
  return { severity: 'error', code, message, path };
}
function warn(code: string, message: string, path?: string): ValidationIssue {
  return { severity: 'warning', code, message, path };
}

function isNonEmpty(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

// ---------------------------------------------------------------------------
// Taksonomia ustaleń
// ---------------------------------------------------------------------------

export function validateFindingTaxonomy(
  taxonomy: FindingTaxonomyEntry[] | undefined
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const list = Array.isArray(taxonomy) ? taxonomy : [];

  if (list.length === 0) {
    issues.push(
      err('TAXONOMY_EMPTY', 'Pakiet musi zdefiniować taksonomię ustaleń', 'findingTaxonomy')
    );
    return issues;
  }

  const seen = new Set<string>();
  let hasNonConforming = false;

  list.forEach((entry, index) => {
    const path = `findingTaxonomy[${index}]`;
    if (!isNonEmpty(entry?.key)) {
      issues.push(err('TAXONOMY_KEY_MISSING', 'Pozycja taksonomii nie ma klucza', path));
      return;
    }
    if (seen.has(entry.key)) {
      issues.push(
        err('TAXONOMY_KEY_DUPLICATE', `Zduplikowany klucz taksonomii: ${entry.key}`, path)
      );
    }
    seen.add(entry.key);

    if (!isNonEmpty(entry.label)) {
      issues.push(err('TAXONOMY_LABEL_MISSING', `Pozycja ${entry.key} nie ma etykiety`, path));
    }
    if (typeof entry.nonConforming !== 'boolean') {
      issues.push(
        err(
          'TAXONOMY_NONCONFORMING_MISSING',
          `Pozycja ${entry.key} musi jawnie deklarować, czy oznacza niezgodność`,
          path
        )
      );
    }
    if (entry.nonConforming) hasNonConforming = true;

    if (entry.nonConforming && entry.requiresCorrectiveAction === false) {
      issues.push(
        warn(
          'TAXONOMY_NONCONFORMING_WITHOUT_ACTION',
          `Pozycja ${entry.key} oznacza niezgodność, ale nie wymaga działania korygującego — upewnij się, że to celowe`,
          path
        )
      );
    }
    if (entry.defaultSeverity && !FINDING_SEVERITIES.includes(entry.defaultSeverity)) {
      issues.push(
        err(
          'TAXONOMY_SEVERITY_INVALID',
          `Pozycja ${entry.key} ma nieznaną istotność: ${entry.defaultSeverity}`,
          path
        )
      );
    }
  });

  if (!hasNonConforming) {
    issues.push(
      err(
        'TAXONOMY_NO_NONCONFORMING',
        'Taksonomia musi zawierać co najmniej jedną pozycję oznaczającą niezgodność — inaczej audyt nie może stwierdzić braku spełnienia wymagania',
        'findingTaxonomy'
      )
    );
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Kryteria
// ---------------------------------------------------------------------------

function validateCriteria(
  criteria: Array<Partial<AuditPackCriterion>>,
  strict: boolean
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (criteria.length === 0) {
    issues.push(err('CRITERIA_EMPTY', 'Pakiet nie zawiera żadnego kryterium', 'criteria'));
    return issues;
  }

  const ids = new Set(criteria.map((c) => c.id).filter(Boolean) as string[]);
  const refCodes = new Map<string, number>();
  let testableCount = 0;

  criteria.forEach((criterion, index) => {
    const path = `criteria[${index}]`;
    const label = criterion.refCode || criterion.title || `#${index}`;

    if (!isNonEmpty(criterion.title)) {
      issues.push(err('CRITERION_TITLE_MISSING', `Kryterium ${label} nie ma tytułu`, path));
    }

    if (criterion.parentId && !ids.has(criterion.parentId)) {
      issues.push(
        err('CRITERION_PARENT_MISSING', `Kryterium ${label} wskazuje nieistniejącego rodzica`, path)
      );
    }

    if (criterion.refCode) {
      refCodes.set(criterion.refCode, (refCodes.get(criterion.refCode) ?? 0) + 1);
    }

    const isLeaf = criterion.nodeKind === 'criterion' || criterion.nodeKind === 'control';
    if (isLeaf) {
      testableCount += 1;

      if (!isNonEmpty(criterion.requirementText)) {
        issues.push(
          err(
            'CRITERION_REQUIREMENT_MISSING',
            `Kryterium ${label} nie ma sformułowanego wymagania — bez niego nie da się orzec zgodności`,
            path
          )
        );
      }
      if (!isNonEmpty(criterion.auditQuestion)) {
        issues.push(
          err('CRITERION_QUESTION_MISSING', `Kryterium ${label} nie ma pytania audytowego`, path)
        );
      }
      if (!isNonEmpty(criterion.auditProcedure)) {
        const issue = strict
          ? err(
              'CRITERION_PROCEDURE_MISSING',
              `Kryterium ${label} nie ma procedury testowej — audyt normatywny wymaga opisu, jak sprawdzić wymaganie`,
              path
            )
          : warn(
              'CRITERION_PROCEDURE_MISSING',
              `Kryterium ${label} nie ma procedury testowej`,
              path
            );
        issues.push(issue);
      }
      const expected = Array.isArray(criterion.expectedEvidence) ? criterion.expectedEvidence : [];
      if (expected.length === 0) {
        const issue = strict
          ? err(
              'CRITERION_EVIDENCE_MISSING',
              `Kryterium ${label} nie określa oczekiwanego dowodu`,
              path
            )
          : warn(
              'CRITERION_EVIDENCE_MISSING',
              `Kryterium ${label} nie określa oczekiwanego dowodu`,
              path
            );
        issues.push(issue);
      }
      if (strict && !isNonEmpty(criterion.sourceReference)) {
        issues.push(
          err(
            'CRITERION_SOURCE_REF_MISSING',
            `Kryterium ${label} nie wskazuje miejsca w źródle — bez tego traceability do normy jest nieweryfikowalna`,
            path
          )
        );
      }
    }
  });

  for (const [code, count] of refCodes) {
    if (count > 1) {
      issues.push(
        warn('CRITERION_REFCODE_DUPLICATE', `Kod ${code} występuje ${count} razy`, 'criteria')
      );
    }
  }

  if (testableCount === 0) {
    issues.push(
      err(
        'CRITERIA_NO_TESTABLE',
        'Pakiet nie zawiera ani jednego kryterium/kontroli do sprawdzenia — sama hierarchia domen nie jest audytem',
        'criteria'
      )
    );
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Źródło i prawa
// ---------------------------------------------------------------------------

function validateSourceForNormative(
  pack: Partial<AuditPack>,
  source: AuditNormSource | null | undefined
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!source) {
    issues.push(
      err('SOURCE_MISSING', 'Pakiet normatywny musi wskazywać zarejestrowane źródło', 'sourceId')
    );
    return issues;
  }

  if (!isNonEmpty(source.sourceVersion) && !isNonEmpty(pack.sourceVersion ?? null)) {
    issues.push(
      err(
        'SOURCE_VERSION_MISSING',
        'Pakiet normatywny musi wskazywać wersję/edycję źródła (np. rok wydania normy)',
        'sourceVersion'
      )
    );
  }

  if (source.rightsStatus === 'not_verified' || !source.rightsStatus) {
    issues.push(
      err(
        'SOURCE_RIGHTS_UNVERIFIED',
        'Prawa do źródła nie zostały potwierdzone — nie wolno publikować pakietu jako normatywnego',
        'source.rightsStatus'
      )
    );
  }
  if (source.rightsStatus === 'not_permitted') {
    issues.push(
      err(
        'SOURCE_RIGHTS_DENIED',
        'Źródło jest oznaczone jako niedozwolone do wykorzystania',
        'source.rightsStatus'
      )
    );
  }

  // OŚ 1 — CZYM jest źródło. Żaden stan weryfikacji tego nie zmienia:
  // dokładnie sprawdzona procedura klienta pozostaje procedurą klienta.
  if (!isNormativeSourceType(source.sourceType)) {
    issues.push(
      err(
        'SOURCE_TYPE_NOT_NORMATIVE',
        `Źródło typu „${source.sourceType}" nie jest normą ani regulacją, więc pakiet nie może być przedstawiony jako audyt zgodności z normą. To nie jest kwestia jakości weryfikacji — to kwestia natury dokumentu.`,
        'source.sourceType'
      )
    );
  }

  // OŚ 2 — CZY sprawdzone. Norma z mapowaniem czekającym na przegląd
  // pozostaje normą, ale nie wolno na niej oprzeć audytu zgodności.
  if (source.verificationStatus !== 'VERIFIED') {
    issues.push(
      err(
        'SOURCE_NOT_VERIFIED',
        `Weryfikacja źródła ma stan „${source.verificationStatus}", a audyt zgodności wymaga „VERIFIED"`,
        'source.verificationStatus'
      )
    );
  }

  if (!source.verifiedBy || !source.verifiedAt) {
    issues.push(
      err(
        'SOURCE_VERIFIER_MISSING',
        'Brak zapisu, kto i kiedy zweryfikował źródło',
        'source.verifiedBy'
      )
    );
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Walidator główny
// ---------------------------------------------------------------------------

export function validatePack(input: ValidatePackInput): PackValidationResult {
  const { pack, criteria, source } = input;
  const target = input.targetPublicationStatus ?? 'draft';
  // Pakiet „normatywny" to taki, który chce być przedstawiony jako audyt
  // zgodności z normą — czyli ma normatywny TYP źródła. Sam status weryfikacji
  // nigdy nie czyni pakietu normatywnym.
  const wantsNormative =
    isNormativeSourceType(pack.sourceType) || pack.classification === 'VERIFIED_NORMATIVE';
  const strict = target === 'published' && wantsNormative;

  const issues: ValidationIssue[] = [];

  // Tożsamość
  if (!isNonEmpty(pack.packKey)) {
    issues.push(err('PACK_KEY_MISSING', 'Pakiet musi mieć stabilny klucz', 'packKey'));
  }
  if (!isNonEmpty(pack.title)) {
    issues.push(err('PACK_TITLE_MISSING', 'Pakiet musi mieć tytuł', 'title'));
  }
  if (typeof pack.version !== 'number' || pack.version < 1) {
    issues.push(err('PACK_VERSION_INVALID', 'Pakiet musi mieć wersję ≥ 1', 'version'));
  }
  if (pack.classification && !PACK_CLASSIFICATIONS.includes(pack.classification)) {
    issues.push(
      err(
        'PACK_CLASSIFICATION_INVALID',
        `Nieznana klasyfikacja: ${pack.classification}`,
        'classification'
      )
    );
  }

  // Zakres i cel — wymagane przy publikacji
  if (target === 'published') {
    if (!isNonEmpty(pack.scope)) {
      issues.push(err('PACK_SCOPE_MISSING', 'Publikowany pakiet musi określać zakres', 'scope'));
    }
    if (!isNonEmpty(pack.objectives)) {
      issues.push(
        err('PACK_OBJECTIVES_MISSING', 'Publikowany pakiet musi określać cele audytu', 'objectives')
      );
    }
    if (!Array.isArray(pack.requiredRoles) || pack.requiredRoles.length === 0) {
      issues.push(
        err('PACK_ROLES_MISSING', 'Publikowany pakiet musi określać wymagane role', 'requiredRoles')
      );
    }
  }

  issues.push(...validateFindingTaxonomy(pack.findingTaxonomy));
  issues.push(...validateCriteria(criteria, strict));

  // Zatwierdzenie eksperckie
  if (target === 'published') {
    if (!pack.expertApprovedBy || !pack.expertApprovedAt) {
      issues.push(
        err(
          'PACK_EXPERT_APPROVAL_MISSING',
          'Publikacja wymaga zatwierdzenia przez eksperta — pakiet nie może wejść do użycia bez przeglądu człowieka',
          'expertApprovedBy'
        )
      );
    }
  }

  // Spójność obu osi pakietu ze źródłem. Pakiet nie może deklarować innej
  // natury niż jego źródło — inaczej etykieta w Library kłamie.
  if (source && pack.sourceType && pack.sourceType !== source.sourceType) {
    issues.push(
      err(
        'PACK_SOURCE_TYPE_MISMATCH',
        `Pakiet deklaruje typ źródła „${pack.sourceType}", a wskazane źródło jest typu „${source.sourceType}"`,
        'sourceType'
      )
    );
  }

  // Normatywność
  if (wantsNormative) {
    issues.push(...validateSourceForNormative(pack, source));
  } else if (source?.verificationStatus === 'VERIFIED' && pack.sourceType === 'DEMONSTRATION') {
    issues.push(
      warn(
        'PACK_UNDERCLAIMS',
        'Pakiet oparty o zweryfikowane źródło jest oznaczony jako demonstracyjny',
        'classification'
      )
    );
  }

  // Pakiet demonstracyjny nie może udawać zgodności z normą w tytule
  if (
    !isNormativeSourceType(pack.sourceType) &&
    /\b(ISO|IATF|VDA|SOC\s?2|HIPAA)\b/i.test(String(pack.title || '')) &&
    !/(demo|demonstrac|wzorc|szkolen)/i.test(String(pack.title || ''))
  ) {
    issues.push(
      err(
        'PACK_TITLE_IMPLIES_NORMATIVE',
        'Tytuł sugeruje zgodność z normą, a pakiet nie jest zweryfikowany jako normatywny — zmień tytuł albo potwierdź źródło',
        'title'
      )
    );
  }

  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    eligibleClassifications: computeEligibleClassifications(pack, source, errors),
  };
}

function computeEligibleClassifications(
  pack: Partial<AuditPack>,
  source: AuditNormSource | null | undefined,
  errors: ValidationIssue[]
): PackClassification[] {
  const eligible: PackClassification[] = ['EVIDENCE_MISSING', 'DEMONSTRATION'];

  const structuralOk = !errors.some(
    (e) => e.code.startsWith('CRITERI') || e.code.startsWith('TAXONOMY')
  );
  if (structuralOk) eligible.push('INTERNAL_FRAMEWORK');

  const normativeOk =
    structuralOk &&
    !!source &&
    isNormativeSourceType(source.sourceType) &&
    source.verificationStatus === 'VERIFIED' &&
    (source.rightsStatus === 'licensed' ||
      source.rightsStatus === 'owned_internal' ||
      source.rightsStatus === 'public_reference') &&
    !!source.sourceVersion &&
    !!pack.expertApprovedBy;
  if (normativeOk) eligible.push('VERIFIED_NORMATIVE');

  return eligible;
}

/**
 * Bramka publikacji. Rzuca listą powodów, jeżeli pakiet nie może zostać
 * opublikowany w żądanej klasyfikacji.
 */
export function assertPublishable(input: ValidatePackInput): PackValidationResult {
  const result = validatePack({ ...input, targetPublicationStatus: 'published' });
  if (!result.valid) {
    const reasons = result.errors.map((e) => `${e.code}: ${e.message}`).join('; ');
    throw new Error(`Pakiet nie może zostać opublikowany — ${reasons}`);
  }
  return result;
}
