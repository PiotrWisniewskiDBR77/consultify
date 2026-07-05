/**
 * blockTypeNormalization — JEDNO kanoniczne nazewnictwo typów bloków dokumentu
 * na granicy B3 (documentStructureGenerator) ↔ docScoring.
 *
 * KANON = rodzina ŻYWEGO pipeline'u (server/src/services/documentStudio/
 * documentStudioTypes.ts → DocumentBlockType oraz B3 ALLOWED_BLOCK_TYPES):
 *   heading / paragraph / bullet_list / numbered_list / table / risk_table /
 *   kpi_strip / chart / quote / callout / image / footnote / citation
 * (+ 'divider' — istnieje tylko w scoringu, bez odpowiednika w B3).
 *
 * Rodzina LEGACY (historyczny DSL docScoring + katalog scenariuszy):
 *   text → paragraph, bulletList → bullet_list, numberedList → numbered_list,
 *   kpi → kpi_strip.
 *
 * Scoring woła `normalizeBlockType()` na WEJŚCIU (artefakt + kryteria), więc
 * akceptuje OBIE formy i liczy na kanonicznej. Dzięki temu surowe wyjście B3
 * przechodzi przez scoring bez ręcznego mapowania w testach, a katalog
 * scenariuszy (legacy nazwy) działa bez zmian.
 */

/** Kanoniczne typy bloków — mirror żywego DocumentBlockType + 'divider'. */
export const CANONICAL_DOC_BLOCK_TYPES = [
  'heading',
  'paragraph',
  'bullet_list',
  'numbered_list',
  'table',
  'risk_table',
  'kpi_strip',
  'chart',
  'quote',
  'callout',
  'image',
  'footnote',
  'citation',
  'divider',
] as const;

export type CanonicalDocBlockType = (typeof CANONICAL_DOC_BLOCK_TYPES)[number];

/** Aliasy legacy (docScoring DSL / katalog scenariuszy) → kanon. */
export const LEGACY_TO_CANONICAL: Record<string, CanonicalDocBlockType> = {
  text: 'paragraph',
  bulletList: 'bullet_list',
  numberedList: 'numbered_list',
  kpi: 'kpi_strip',
};

/** Legacy aliasy — historyczna rodzina docScoring. */
export type LegacyDocBlockType = 'text' | 'bulletList' | 'numberedList' | 'kpi';

/** Dowolna akceptowana forma typu bloku (unia aliasów). */
export type AnyDocBlockType = CanonicalDocBlockType | LegacyDocBlockType;

/**
 * Znormalizuj typ bloku do formy kanonicznej.
 * Alias legacy → kanon; typ kanoniczny → bez zmian; nieznany → bez zmian
 * (nieznany typ po prostu nie zmatchuje żadnego kryterium — scoring nie
 * powinien "naprawiać" śmieciowych typów, od tego jest walidacja B3).
 */
export function normalizeBlockType(type: string): string {
  return LEGACY_TO_CANONICAL[type] ?? type;
}

/**
 * Klasa równoważności do MATCHOWANIA w scoringu — zachowuje semantykę
 * historycznego mapowania B3_TO_SCORING z docGeneratorE2E:
 *   - risk_table liczy się jako table (specjalizacja tabeli),
 *   - footnote / citation liczą się jako paragraph (tekst pomocniczy).
 * Wejście dowolnej rodziny; wyjście = reprezentant klasy (kanoniczny).
 */
export function blockTypeClass(type: string): string {
  const canonical = normalizeBlockType(type);
  switch (canonical) {
    case 'risk_table':
      return 'table';
    case 'footnote':
    case 'citation':
      return 'paragraph';
    default:
      return canonical;
  }
}

/** Czy typ bloku artefaktu spełnia typ z kryterium (obie formy dozwolone)? */
export function blockTypeMatches(blockType: string, criterionType: string): boolean {
  return blockTypeClass(blockType) === blockTypeClass(criterionType);
}
