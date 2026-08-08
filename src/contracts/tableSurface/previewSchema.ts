/**
 * `PreviewSchema<T>` — preview GENEROWANE ze schematu, nie składane per ekran.
 *
 * Źródło normatywne: `MY_WORK_TABLE_SURFACE_CONTRACT_V1.md` §6, w tym
 * „Deskryptor generacyjny preview" i zdanie zamykające: „Brak deskryptora
 * blokuje automatyczny PASS preview."
 * Zasada architektoniczna 4 z REPAIR_MASTER_PLAN: „Preview jest generowane ze
 * schematu, a nie składane ręcznie per ekran."
 *
 * Co ten schemat naprawia: PREVIEW jest jedyną powierzchnią, która oblała
 * WSZYSTKIE 45 tabel w `MATRIX_T01_T45.csv` — 45/45 FAIL, także tam gdzie TABLE
 * dostało PASS (T07, T08, T12–T14, T21, T25, T34, T39). Ręczne składanie per
 * ekran dało 45 różnych paneli: różna kolejność bloków, po kilka przycisków
 * Open, duplikaty akcji (T43: trzy), brak bloku Relations.
 *
 * Parametr `T` to typ rekordu. Selektory są funkcjami `(record: T) => …`, więc
 * schemat jest sprawdzalny typem względem encji, a nie stringologią.
 *
 * @module contracts/tableSurface/previewSchema
 */

import { CANON_ACTION_VARIANTS, CANON_PREVIEW_BLOCK_ORDER } from './canon';
import type { CanonicalIcon } from './types';

/** Sześć bloków w stałej kolejności (§6). */
export type PreviewBlockId = (typeof CANON_PREVIEW_BLOCK_ORDER)[number];

/** Pięć wariantów przycisku akcji; wariant wynika ze SKUTKU, nie z modułu (§6). */
export type PreviewActionVariant = (typeof CANON_ACTION_VARIANTS)[number];

/** Tryb bloku Details (§6 Details — trzy warianty, każdy z własnymi limitami). */
export type PreviewDetailsMode = 'prose' | 'properties' | 'file-list';

// ─── Bloki ──────────────────────────────────────────────────────────────────

/** Blok 1 — header: tytuł → pin → Open → ×. Open występuje DOKŁADNIE RAZ (§6). */
export interface PreviewHeaderSchema<T> {
  /** Źródło tytułu. Tytuł może być skrócony wizualnie, pełny tekst dostępny. */
  title: (record: T) => string;
  /** Pin jest OBOWIĄZKOWY dla preview tabelowego (§10). */
  pin: true;
  /** Jedyny Open w całym panelu. Otwiera pełny obiekt. */
  open: true;
  close: true;
}

/** Blok 2 — Meta: status/priorytet + termin po prawej + rekomendacja (§6 Meta). */
export interface PreviewMetaSchema<T> {
  /** Chipy pierwszego rzędu: status, priorytet, opcjonalnie ważność/typ. */
  pills: (record: T) => PreviewMetaPill[];
  /** Termin albo najważniejsza wartość czasowa — prawa strona pierwszego rzędu. */
  trailing?: (record: T) => string | null;
  /** Drugi rząd: rekomendacja lub najważniejszy kontekst. 8–18 słów, twardo ≤24. */
  recommendation?: (record: T) => string | null;
}

export interface PreviewMetaPill {
  id: string;
  label: string;
  /** Semantyczna kropka 6 px; kolor treści, nie stanu kontrolki. */
  tone?: 'neutral' | 'positive' | 'warning' | 'danger' | 'info';
}

/** Blok 3 — Details wraz z lokalnym kebabem Copy → Export → Download (§6). */
export interface PreviewDetailsSchema<T> {
  mode: PreviewDetailsMode;
  /** Proza — wymagana i dozwolona WYŁĄCZNIE przy `mode: 'prose'`. */
  prose?: (record: T) => string;
  /** Właściwości klucz–wartość — wyłącznie przy `mode: 'properties'`. */
  properties?: (record: T) => Array<{ label: string; value: string }>;
  /** Lista plików — wyłącznie przy `mode: 'file-list'`. */
  files?: (record: T) => Array<{ name: string; format: string; size?: string }>;
  /**
   * Lokalny kebab Details. §6: „Eksporty występują WYŁĄCZNIE w kebabie Details."
   * Kolejność Copy → Export → Download jest wymuszana walidatorem.
   */
  contentActions: PreviewDetailsAction[];
  /**
   * Word count dotyczy WYŁĄCZNIE prozy i znika dla properties/list/empty (§6).
   * Wyliczane, nie deklarowane — pole istnieje tylko po to, by test mógł
   * sprawdzić, że tryb inny niż `prose` go nie ustawia.
   */
  showWordCount: boolean;
}

export interface PreviewDetailsAction {
  actionId: 'copy' | 'export' | 'download';
  label: string;
  icon: CanonicalIcon;
}

/**
 * Blok 4 — AI. WARUNKOWY: renderowany tylko gdy deskryptor deklaruje realne
 * akcje AI (§6). Brak AI nie zostawia pustego slotu — przestrzeń przejmuje
 * Details. Pusta atrapa jest zakazana (§10, wiersz „Preview AI").
 */
export interface PreviewAISchema<T> {
  actions: (record: T) => PreviewActionSchema[];
}

/**
 * Blok 5 — Relations. OBOWIĄZKOWY jako blok, także gdy relacji nie ma —
 * wtedy renderuje kanoniczne `No relations` (§6, REPAIR_MASTER_PLAN R03:
 * „Relations zawsze jako blok, także empty state").
 */
export interface PreviewRelationsSchema<T> {
  items: (record: T) => Array<{ id: string; label: string; type: string }>;
  /** Kanoniczny tekst pustego stanu. Nie wolno pominąć bloku. */
  emptyLabel: string;
}

/** Blok 6 — Actions: siatka 2 kolumny, maks. 3 rzędy, maks. 6 akcji (§6). */
export interface PreviewActionsSchema<T> {
  /** Rzędy siatki. Pojedyncza akcja zajmuje pierwszą kolumnę — bez atrapy w drugiej. */
  rows: (record: T) => PreviewActionSchema[][];
}

export interface PreviewActionSchema {
  /** Wspólny z kebabem, gdy to ta sama akcja (§6 Relacja z kebabem). */
  actionId: string;
  label: string;
  icon: CanonicalIcon;
  variant: PreviewActionVariant;
  disabled?: boolean;
  /** Destructive zawsze wymaga potwierdzenia (§9). */
  confirmation?: boolean;
  shortcut?: string;
}

// ─── Schemat pełny ──────────────────────────────────────────────────────────

/**
 * Deskryptor generacyjny preview dla encji `T`.
 *
 * `ai` jest opcjonalne — to jedyny blok warunkowy. Pozostałe pięć jest wymagane
 * przez typ, więc „ekran zapomniał o Relations" nie jest reprezentowalne.
 */
export interface PreviewSchema<T> {
  /** Powierzchnia, dla której schemat obowiązuje. */
  surfaceId: string;
  /** Nazwa encji — do komunikatów walidatora. */
  entity: string;
  header: PreviewHeaderSchema<T>;
  meta: PreviewMetaSchema<T>;
  details: PreviewDetailsSchema<T>;
  /** Pominąć całkowicie, jeśli encja nie ma realnych akcji AI. */
  ai?: PreviewAISchema<T>;
  relations: PreviewRelationsSchema<T>;
  actions: PreviewActionsSchema<T>;
}

/**
 * Bloki, które schemat faktycznie wyrenderuje — w kanonicznej kolejności,
 * z pominięciem nieobecnego AI.
 */
export function previewBlockOrder<T>(schema: PreviewSchema<T>): PreviewBlockId[] {
  return CANON_PREVIEW_BLOCK_ORDER.filter((block) => block !== 'ai' || !!schema.ai);
}

/** Liczy słowa prozy tak samo jak licznik `~N words` w nagłówku Details (§6). */
export function countProseWords(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

/**
 * Spłaszcza siatkę akcji do listy — do sprawdzania unikalności `actionId`
 * i limitu sześciu akcji bezpośrednich.
 */
export function flattenPreviewActions<T>(
  schema: PreviewSchema<T>,
  record: T
): PreviewActionSchema[] {
  return schema.actions.rows(record).flat();
}

/** Kanoniczna kolejność pozycji lokalnego kebaba Details (§6). */
export const CANON_DETAILS_ACTION_ORDER = ['copy', 'export', 'download'] as const;
