/**
 * Evidence Contract — jednolity kontrakt Warstwy Dowodowej (HP-14, Harvey-Parity Blok D).
 *
 * SSOT: Harvard/wdrozenie-100/_PLAN_HARVEY_PARITY_2026-07-11.md §1.4 + §Blok D (HP-14).
 * Kontrakt: `{ sources, assumptions, risks, confidence, toVerify }` — DOKŁADNIE ten kształt,
 * którego żąda plan, zwracany przez serwisy GENERUJĄCE (Insight, raport finansowy, …) obok
 * ich normalnego outputu. To warstwa "dowodu jakości" (przewaga Harvey: "zna prawo / pokazuje
 * źródła").
 *
 * RELACJA DO `evidenceEnvelopeService.ts` (istniejący, persystencja):
 *   - `EvidenceEnvelope` = REKORD persystowany (id/org/artifactId/timestamps) w tabeli
 *     `artifact_evidence`. Ma `sources`/`assumptions`/`confidence`(numeric)/`toVerify`, ale
 *     NIE MA `risks` (kolumny brak — patrz decyzja D-2 w raporcie handoffu).
 *   - `EvidenceContract` (ten plik) = lekki, GENERATOR-FACING DTO. Prosty kształt z planu
 *     (assumptions/risks/toVerify jako string[]), `confidence` jako etykieta 'low'|'medium'|'high'.
 *   Jeden serwis może ZWRÓCIĆ kontrakt (HP-14) i NIEZALEŻNIE persystować kopertę (istniejący tor).
 *
 * TWARDA ZASADA (bramka dowodowa "Deklaracja—niepotwierdzone", jak w Oxford):
 *   `confidence` i `toVerify` MUSZĄ wynikać z REALNYCH sygnałów danych (ile źródeł, czy
 *   cytowania się zweryfikowały, ile luk), NIE z LLM-zgadywania. Do tego służy
 *   `deriveConfidence(...)` — DETERMINISTYCZNA funkcja, zero I/O, zero LLM.
 *
 * Lokalizacja: `server/src/services/evidence/` — dzisiejszy dom Warstwy Dowodowej po stronie
 * backendu (server NIE konsumuje `packages/shared`, patrz audyt). Mirror typu do
 * `packages/shared` pod render FE = zakres HP-16 (ArtifactRightPanel), świadomie odłożony.
 */

// ==========================================
// TYPY — kontrakt HP-14
// ==========================================

/** Etykieta pewności — DOKŁADNIE trójstopniowa jak w planie. */
export type EvidenceConfidence = 'low' | 'medium' | 'high';

/**
 * Źródło dowodowe. `type`/`ref` celowo luźne (string) — kontrakt jest generator-facing i
 * obsługuje heterogeniczne generatory (interview/document/kb/reconcile/ratio/valuation/…).
 * Mapowanie na wąski union `EvidenceSourceType` koperty następuje dopiero przy persystencji.
 */
export interface EvidenceContractSource {
  /** Klasa źródła, np. 'interview' | 'document' | 'kb' | 'reconcile' | 'ratio' | 'valuation'. */
  type: string;
  /** Id ref do rekordu źródła (opcjonalny — nie każde źródło ma cytowalny id). */
  ref?: string;
  /** Czytelny tytuł/etykieta źródła. */
  title?: string;
  /** Link (Vault/interview/URL zewnętrzny). */
  url?: string;
  /** Krótki cytat/wycinek. */
  snippet?: string;
}

/** Kontrakt evidence HP-14 — jednolity kształt zwracany przez serwisy generujące. */
export interface EvidenceContract {
  sources: EvidenceContractSource[];
  /** Jawne założenia przyjęte przy generacji (F7 "transparentne założenia"). */
  assumptions: string[];
  /** Ryzyka/ograniczenia dotknięte przy generacji (czego output NIE gwarantuje). */
  risks: string[];
  /** Pewność wyprowadzona DETERMINISTYCZNIE z realnych sygnałów (patrz deriveConfidence). */
  confidence: EvidenceConfidence;
  /** Twierdzenia/luki wymagające weryfikacji człowieka ("Deklaracja—niepotwierdzone"). */
  toVerify: string[];
}

// ==========================================
// WALIDATOR (kształt)
// ==========================================

const CONFIDENCE_VALUES: readonly EvidenceConfidence[] = ['low', 'medium', 'high'];

export function isEvidenceConfidence(value: unknown): value is EvidenceConfidence {
  return typeof value === 'string' && (CONFIDENCE_VALUES as readonly string[]).includes(value);
}

export interface EvidenceContractValidation {
  valid: boolean;
  errors: string[];
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

/**
 * Waliduje KSZTAŁT kontraktu (nie treść). Zwraca listę błędów — pusty = valid.
 * Używany w testach i (opcjonalnie) jako guard przed serializacją do API.
 */
export function validateEvidenceContract(input: unknown): EvidenceContractValidation {
  const errors: string[] = [];
  if (input === null || typeof input !== 'object') {
    return { valid: false, errors: ['contract must be an object'] };
  }
  const c = input as Record<string, unknown>;

  if (!Array.isArray(c.sources)) {
    errors.push('sources must be an array');
  } else {
    c.sources.forEach((s, i) => {
      if (s === null || typeof s !== 'object') {
        errors.push(`sources[${i}] must be an object`);
        return;
      }
      const src = s as Record<string, unknown>;
      if (typeof src.type !== 'string' || src.type.trim() === '') {
        errors.push(`sources[${i}].type must be a non-empty string`);
      }
      (['ref', 'title', 'url', 'snippet'] as const).forEach((k) => {
        if (src[k] !== undefined && typeof src[k] !== 'string') {
          errors.push(`sources[${i}].${k} must be a string when present`);
        }
      });
    });
  }

  if (!isStringArray(c.assumptions)) errors.push('assumptions must be a string[]');
  if (!isStringArray(c.risks)) errors.push('risks must be a string[]');
  if (!isStringArray(c.toVerify)) errors.push('toVerify must be a string[]');
  if (!isEvidenceConfidence(c.confidence)) {
    errors.push("confidence must be one of 'low' | 'medium' | 'high'");
  }

  return { valid: errors.length === 0, errors };
}

// ==========================================
// PEWNOŚĆ — DETERMINISTYCZNA (zero LLM, zero zgadywania)
// ==========================================

/**
 * Realne sygnały danych, z których wyprowadzamy `confidence`. Wszystkie POLICZALNE
 * przy generacji — NIE deklarowane przez model.
 */
export interface ConfidenceSignals {
  /** Ile źródeł faktycznie podpięto (0 = brak → zawsze 'low'). */
  sourceCount: number;
  /** Ile cytowań zweryfikował runtime citationVerifier (jeśli w ogóle weryfikowano). */
  verifiedCitations?: number;
  /** Ile cytowań łącznie poddano weryfikacji (mianownik do ratio). */
  totalCitations?: number;
  /** Liczba nierozwiązanych luk/braków danych (missing_data, missingStatementTypes…). */
  unresolvedGaps?: number;
  /** Zewnętrzny deterministyczny wynik jakości 0-100 (np. material_quality.score walidatora karty). */
  qualityScore?: number;
}

/**
 * Wyprowadza etykietę pewności z realnych sygnałów. Reguły (bramka dowodowa):
 *   - 0 źródeł → 'low' (twarde; "Deklaracja—niepotwierdzone").
 *   - qualityScore < 40 → sufit 'low' (materiał zbyt cienki, niezależnie od liczby źródeł).
 *   - 'high'  gdy ≥3 źródła ∧ (brak cytowań do weryfikacji LUB ≥80% zweryfikowanych)
 *             ∧ brak nierozwiązanych luk ∧ (qualityScore brak LUB ≥70).
 *   - 'medium' gdy ≥1 źródło ∧ (brak cytowań LUB ≥50% zweryfikowanych).
 *   - w przeciwnym razie 'low'.
 */
export function deriveConfidence(signals: ConfidenceSignals): EvidenceConfidence {
  const sourceCount = Number.isFinite(signals.sourceCount) ? signals.sourceCount : 0;
  if (sourceCount <= 0) return 'low';

  const total = signals.totalCitations ?? 0;
  const verified = signals.verifiedCitations ?? 0;
  // Brak cytowań do weryfikacji ⇒ ratio neutralne (1). Nie karzemy za brak cytowań,
  // gdy pewność jedzie na innych źródłach — karzemy za CYTOWANIA, które się NIE zweryfikowały.
  const citationRatio = total > 0 ? verified / total : 1;

  const gaps = signals.unresolvedGaps ?? 0;
  const quality = signals.qualityScore;

  if (typeof quality === 'number' && quality < 40) return 'low';

  const highOk =
    sourceCount >= 3 &&
    citationRatio >= 0.8 &&
    gaps === 0 &&
    (quality === undefined || quality >= 70);
  if (highOk) return 'high';

  const mediumOk = sourceCount >= 1 && citationRatio >= 0.5;
  if (mediumOk) return 'medium';

  return 'low';
}

/** Numeryczny odpowiednik etykiety (środek przedziału) — pod persystencję koperty. */
export function confidenceToNumeric(label: EvidenceConfidence): number {
  switch (label) {
    case 'high':
      return 0.85;
    case 'medium':
      return 0.55;
    case 'low':
    default:
      return 0.25;
  }
}

// ==========================================
// HELPERY
// ==========================================

/** Pusty kontrakt — pewność 'low' (brak dowodów = niepotwierdzone). */
export function emptyEvidenceContract(): EvidenceContract {
  return { sources: [], assumptions: [], risks: [], confidence: 'low', toVerify: [] };
}

/** Zwięzła linia do logu produkcyjnego (bez PII — same liczniki). */
export function summarizeEvidenceForLog(contract: EvidenceContract): string {
  return (
    `sources=${contract.sources.length} assumptions=${contract.assumptions.length} ` +
    `risks=${contract.risks.length} toVerify=${contract.toVerify.length} ` +
    `confidence=${contract.confidence}`
  );
}
