/**
 * provenance (F10.2) — „skąd to wiesz": źródło/artefakt przy twierdzeniach.
 *
 * Każda kluczowa liczba/twierdzenie powinno mieć PROVENANCE — referencję do
 * artefaktu źródłowego (insight z wywiadu / inicjatywa / decyzja / KPI / raport
 * finansowy / założenie / notatka). To buduje zaufanie i audytowalność materiału.
 *
 * Ten moduł: model referencji, audyt pokrycia (które twierdzenia bez źródła),
 * render przypisów (numerowane footnoty) + inline-markery. Komplementarny do
 * [factBook] (tamten = spójność liczb; ten = ich pochodzenie).
 *
 * Czyste funkcje, deterministyczne, nigdy nie rzucają.
 */

export type ProvenanceKind =
  | 'insight'
  | 'initiative'
  | 'decision'
  | 'kpi'
  | 'financial_report'
  | 'assumption'
  | 'note'
  | 'external';

export interface ProvenanceRef {
  kind: ProvenanceKind;
  /** Etykieta źródła (np. „Wywiad z CFO, 2026-05") — wymagana. */
  label: string;
  /** Id artefaktu w systemie (opcjonalne — link). */
  id?: string;
  /** URL / cytowanie zewnętrzne (np. Gartner 2024). */
  url?: string;
}

export interface Claim {
  /** Klucz twierdzenia (np. hero-number key lub id sekcji). */
  key: string;
  /** Treść twierdzenia (do przypisu). */
  text: string;
  source?: ProvenanceRef;
}

export interface ProvenanceAudit {
  total: number;
  withSource: number;
  missingSource: string[]; // klucze twierdzeń bez źródła
  /** Pokrycie 0..1. */
  coverage: number;
}

/** Audyt pokrycia provenance — które kluczowe twierdzenia nie mają źródła. */
export function auditProvenance(claims: Claim[]): ProvenanceAudit {
  const total = claims.length;
  const missingSource = claims
    .filter((c) => !c.source || !c.source.label || !c.source.label.trim())
    .map((c) => c.key);
  const withSource = total - missingSource.length;
  return {
    total,
    withSource,
    missingSource,
    coverage: total === 0 ? 1 : withSource / total,
  };
}

/** Czytelna etykieta rodzaju źródła (PL). */
const KIND_LABEL: Record<ProvenanceKind, string> = {
  insight: 'Wniosek z wywiadu',
  initiative: 'Inicjatywa',
  decision: 'Decyzja',
  kpi: 'Wskaźnik KPI',
  financial_report: 'Raport finansowy',
  assumption: 'Założenie',
  note: 'Notatka',
  external: 'Źródło zewnętrzne',
};

/** Sformatuj pojedynczą referencję do tekstu przypisu. */
export function formatProvenanceRef(ref: ProvenanceRef): string {
  const kind = KIND_LABEL[ref.kind] ?? ref.kind;
  const tail = ref.url ? ` — ${ref.url}` : '';
  return `${kind}: ${ref.label}${tail}`;
}

export interface Footnote {
  index: number; // 1-based
  key: string;
  text: string;
}

/**
 * Zbuduj numerowane przypisy dla twierdzeń, które mają źródło.
 * Dedupe po identycznej referencji (ten sam kind+label+id → jeden numer).
 */
export function renderProvenanceFootnotes(claims: Claim[]): {
  footnotes: Footnote[];
  /** Mapa key twierdzenia → numer przypisu (do wstawienia inline). */
  markerByClaimKey: Record<string, number>;
} {
  const footnotes: Footnote[] = [];
  const markerByClaimKey: Record<string, number> = {};
  const seen = new Map<string, number>(); // sygnatura źródła → index

  for (const c of claims) {
    if (!c.source || !c.source.label?.trim()) continue;
    const sig = `${c.source.kind}|${c.source.label}|${c.source.id ?? ''}|${c.source.url ?? ''}`;
    let idx = seen.get(sig);
    if (idx === undefined) {
      idx = footnotes.length + 1;
      seen.set(sig, idx);
      footnotes.push({ index: idx, key: c.key, text: formatProvenanceRef(c.source) });
    }
    markerByClaimKey[c.key] = idx;
  }

  return { footnotes, markerByClaimKey };
}

/** Inline-marker przypisu (np. „[3]"). */
export function provenanceMarker(index: number): string {
  return `[${index}]`;
}
