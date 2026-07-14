/**
 * starterTemplates — W10.2 (seeding): katalog startowych szablonów materiałów dla
 * pierwszego uruchomienia nowej organizacji.
 *
 * Nowa org otwierając „Materiały" widzi pusty stan. Ten katalog daje gotowe punkty
 * startu — szkielet briefu + rekomendowany motyw + format + audytorium — żeby
 * użytkownik wygenerował pierwszy materiał jednym kliknięciem zamiast patrzeć w pustkę.
 *
 * Czysty katalog danych + resolver. Deterministyczny. Komponuje z themeRegistry
 * (motywy) i kontraktem briefu (generateBundle przyjmuje brief string).
 *
 * SSOT: M17 plan W10.2 (first-run seeding: template'y + quick brand-setup).
 */

import type { ThemeId } from './themeRegistry.js';

export type StarterFormat = 'bundle' | 'deck' | 'doc' | 'sheet';
export type StarterAudience = 'investor' | 'board' | 'internal' | 'client';

export interface StarterTemplate {
  id: string;
  /** Tytuł w UI (PL). */
  title: string;
  /** Krótki opis do kafelka. */
  description: string;
  /** Gotowy szkielet briefu (placeholder'y {{...}} do uzupełnienia przez usera). */
  briefSkeleton: string;
  recommendedTheme: ThemeId;
  format: StarterFormat;
  audience: StarterAudience;
  /** Tagi do filtrowania/wyszukiwania. */
  tags: string[];
}

// ── Katalog startowy (6 szablonów pokrywających typowe potrzeby) ─────────────
const STARTERS: StarterTemplate[] = [
  {
    id: 'investor_business_plan',
    title: 'Biznesplan inwestorski',
    description: 'Pełna wiązka dla inwestora: deck + raport + model finansowy z jednego briefu.',
    briefSkeleton:
      'Biznesplan dla {{nazwa firmy}} — {{produkt/usługa}}. Teza: {{jedno zdanie dlaczego wygramy}}. ' +
      'Runda: {{kwota}} na {{cel}}. Rynek: {{TAM}}. Model: {{jak zarabiamy}}.',
    recommendedTheme: 'executive',
    format: 'bundle',
    audience: 'investor',
    tags: ['inwestor', 'fundraising', 'finanse', 'biznesplan'],
  },
  {
    id: 'ai_readiness_diagnosis',
    title: 'Diagnoza gotowości na AI',
    description: 'Raport + deck z oceną dojrzałości AI organizacji i rekomendacjami.',
    briefSkeleton:
      'Diagnoza gotowości na AI dla {{nazwa firmy}} ({{branża}}, {{liczba pracowników}} osób). ' +
      'Zakres: {{działy}}. Cel: {{co chcemy osiągnąć z AI}}. Horyzont: {{miesiące}}.',
    recommendedTheme: 'modern',
    format: 'bundle',
    audience: 'board',
    tags: ['AI', 'transformacja', 'diagnoza', 'strategia'],
  },
  {
    id: 'board_quarterly_report',
    title: 'Raport zarządczy kwartalny',
    description: 'Book-quality raport dla zarządu: wyniki, ryzyka, rekomendacje.',
    briefSkeleton:
      'Raport zarządczy {{kwartał}} dla {{nazwa firmy}}. Kluczowe wyniki: {{metryki}}. ' +
      'Główne ryzyka: {{ryzyka}}. Rekomendacje: {{decyzje do podjęcia}}.',
    recommendedTheme: 'corporate',
    format: 'doc',
    audience: 'board',
    tags: ['zarząd', 'raport', 'kwartalny', 'wyniki'],
  },
  {
    id: 'strategy_offsite_deck',
    title: 'Deck strategiczny',
    description: 'Prezentacja na sesję strategiczną: gdzie jesteśmy, dokąd idziemy, jak.',
    briefSkeleton:
      'Deck strategiczny dla {{nazwa firmy}}. Sytuacja: {{gdzie jesteśmy}}. ' +
      'Ambicja: {{dokąd zmierzamy}}. Inicjatywy: {{kluczowe ruchy}}. Horyzont: {{rok}}.',
    recommendedTheme: 'executive',
    format: 'deck',
    audience: 'internal',
    tags: ['strategia', 'prezentacja', 'offsite', 'roadmapa'],
  },
  {
    id: 'client_proposal',
    title: 'Oferta dla klienta',
    description: 'Propozycja wartości + zakres + cennik dla klienta.',
    briefSkeleton:
      'Oferta dla {{klient}} od {{nazwa firmy}}. Problem klienta: {{ból}}. ' +
      'Nasze rozwiązanie: {{co dostarczamy}}. Zakres: {{moduły}}. Inwestycja: {{cena}}.',
    recommendedTheme: 'clean',
    format: 'bundle',
    audience: 'client',
    tags: ['sprzedaż', 'oferta', 'propozycja', 'klient'],
  },
  {
    id: 'market_analysis_table',
    title: 'Analiza rynku (tabela)',
    description: 'Tabela porównawcza graczy/segmentów z danymi.',
    briefSkeleton:
      'Analiza rynku {{branża}} dla {{nazwa firmy}}. Wymiary porównania: {{kryteria}}. ' +
      'Gracze/segmenty: {{lista}}. Źródło danych: {{skąd}}.',
    recommendedTheme: 'clean',
    format: 'sheet',
    audience: 'internal',
    tags: ['rynek', 'analiza', 'konkurencja', 'tabela'],
  },
];

const BY_ID = new Map<string, StarterTemplate>(STARTERS.map((s) => [s.id, s]));

/** Wszystkie startery (read-only). */
export const STARTER_TEMPLATES: ReadonlyArray<StarterTemplate> = STARTERS;

/** Liczba szablonów startowych. */
export const STARTER_TEMPLATE_COUNT = STARTERS.length;

/** Szablon po id (lub null). */
export function getStarterTemplate(id: string): StarterTemplate | null {
  return BY_ID.get(id) ?? null;
}

/** Startery dla formatu (np. tylko 'bundle'). */
export function startersForFormat(format: StarterFormat): StarterTemplate[] {
  return STARTERS.filter((s) => s.format === format);
}

/** Startery pasujące do tagu (case-insensitive). */
export function startersByTag(tag: string): StarterTemplate[] {
  const t = tag.trim().toLowerCase();
  if (!t) return [];
  return STARTERS.filter((s) => s.tags.some((x) => x.toLowerCase() === t));
}

/**
 * Plan seedingu dla NOWEJ organizacji — startery rekomendowane na pierwszy ekran.
 * `industryHint` (opcjonalny) podbija dopasowane tagiem startery na górę listy.
 */
export function firstRunSeedPlan(industryHint?: string): {
  featured: StarterTemplate[];
  all: StarterTemplate[];
} {
  const hint = (industryHint ?? '').trim().toLowerCase();
  if (!hint) {
    // domyślnie wyróżnij wiązki (najpełniejszy pierwszy materiał)
    return { featured: startersForFormat('bundle'), all: [...STARTERS] };
  }
  const matched = STARTERS.filter((s) =>
    s.tags.some((t) => hint.includes(t.toLowerCase()) || t.toLowerCase().includes(hint))
  );
  const featured = matched.length > 0 ? matched : startersForFormat('bundle');
  return { featured, all: [...STARTERS] };
}
