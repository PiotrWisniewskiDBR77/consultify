/**
 * cardBlockSchema — F3 (D11): deklaratywny silnik bloków dla KART inicjatyw.
 *
 * Karta inicjatywy (problem / teza / business-case …) jest renderowana z listy
 * deklaratywnych BLOKÓW — dokładnie jak slajd M17 jest komponowany z prymitywów
 * (`COMPOSITION_BLOCK_TYPES` w `presentationLayoutDirectorService.ts`). Dzięki
 * temu AI może EMITOWAĆ układ karty (grammar), a generyczny renderer
 * (`CardBlockRenderer.tsx`) mapuje bloki → UI. To zastępuje 6 bespoke kart
 * rdzenia jednym kontraktem.
 *
 * Parytet nazewnictwa z M17 (świadomie podzbiór 16 prymitywów deck-a — karta to
 * nie slajd, więc pomijamy cover/divider/quote/icon_row/numbered_list/image/
 * smart_*):
 *   M17                         →  CardBlock.type
 *   heading                     →  heading
 *   paragraph                   →  paragraph
 *   bullet_list                 →  bullet_list
 *   table                       →  table
 *   chart                       →  chart
 *   callout                     →  callout
 *   kpi_widget / metric_strip   →  kpi_strip
 *
 * Ten plik = CZYSTE TYPY + deterministyczny walidator `validateCardSpec`
 * (wzorowany na `deckDesignCritic` — bez LLM, fail-open, zwraca issues[]).
 */

// ── Block-type vocabulary (parytet z M17 COMPOSITION_BLOCK_TYPES) ────────────

export const CARD_BLOCK_TYPES = [
  'heading',
  'paragraph',
  'kpi_strip',
  'bullet_list',
  'table',
  'chart',
  'callout',
] as const;

export type CardBlockType = (typeof CARD_BLOCK_TYPES)[number];

// ── Per-block typed props ────────────────────────────────────────────────────

/** Nagłówek wewnątrz karty (poziom h3..h4 — tytuł karty żyje na `CardSpec.title`). */
export interface HeadingBlock {
  type: 'heading';
  /** Tekst nagłówka. */
  text: string;
  /** 3 = sekcja karty, 4 = pod-sekcja. Domyślnie 3. */
  level?: 3 | 4;
}

/** Akapit prozy (np. opis problemu / uzasadnienie). */
export interface ParagraphBlock {
  type: 'paragraph';
  text: string;
  /** Wyróżnienie wizualne (np. teza / lead). */
  emphasis?: 'normal' | 'lead' | 'muted';
}

/** Pojedynczy kafelek KPI. */
export interface KpiTile {
  /** Etykieta metryki. */
  label: string;
  /** Wartość (sformatowana po stronie producenta: "1,2 mln zł", "37%"…). */
  value: string;
  /** Opcjonalny podpis / delta ("+12% r/r"). */
  delta?: string;
  /** Kierunek delty dla koloryzacji. */
  trend?: 'up' | 'down' | 'flat';
}

/** Pasek kafelków KPI (M17 kpi_widget / metric_strip). */
export interface KpiStripBlock {
  type: 'kpi_strip';
  tiles: KpiTile[];
}

/** Lista punktowana (jedna myśl = jedna linia). */
export interface BulletListBlock {
  type: 'bullet_list';
  items: string[];
  /** Numerowana zamiast wypunktowanej. */
  ordered?: boolean;
}

/** Tabela (proste komórki tekstowe). */
export interface TableBlock {
  type: 'table';
  /** Nagłówki kolumn. */
  columns: string[];
  /** Wiersze; każdy wiersz to tablica komórek równa długości `columns`. */
  rows: string[][];
}

export type ChartKind = 'bar' | 'line' | 'pie' | 'area';

/** Wykres — w F3 renderowany jako prosty placeholder/legend (nie pełny chart). */
export interface ChartBlock {
  type: 'chart';
  chartKind: ChartKind;
  /** Tytuł wykresu. */
  title?: string;
  /** Pary etykieta→wartość (renderer rysuje słupki/legendę proporcjonalnie). */
  series: Array<{ label: string; value: number }>;
}

export type CalloutTone = 'info' | 'success' | 'warning' | 'danger';

/** Wyróżniony blok (ostrzeżenie / wniosek / ryzyko). */
export interface CalloutBlock {
  type: 'callout';
  tone: CalloutTone;
  text: string;
  /** Opcjonalny tytuł callouta. */
  title?: string;
}

export type CardBlock =
  | HeadingBlock
  | ParagraphBlock
  | KpiStripBlock
  | BulletListBlock
  | TableBlock
  | ChartBlock
  | CalloutBlock;

// ── CardSpec ─────────────────────────────────────────────────────────────────

/**
 * Pełna deklaracja jednej karty inicjatywy. `sectionKey` mapuje na
 * `componentKey` z `sections/registry.ts` (np. 'problemDefinition', 'overview').
 */
export interface CardSpec {
  /** Klucz sekcji (parytet z SECTION_REGISTRY). */
  sectionKey: string;
  /** Tytuł karty (action-title, nie etykieta). */
  title: string;
  /** Uporządkowana lista bloków do wyrenderowania. */
  blocks: CardBlock[];
}

// ── Walidator (deterministyczny, fail-open — wzór deckDesignCritic) ──────────

export type CardIssueSeverity = 'CRITICAL' | 'MAJOR' | 'MINOR';

export type CardIssueCode =
  | 'CB-01-NO-SECTION-KEY'
  | 'CB-02-NO-TITLE'
  | 'CB-03-EMPTY-BLOCKS'
  | 'CB-04-UNKNOWN-BLOCK-TYPE'
  | 'CB-05-EMPTY-BLOCK-CONTENT'
  | 'CB-06-TABLE-SHAPE'
  | 'CB-07-CHART-EMPTY'
  | 'CB-08-KPI-EMPTY';

export interface CardIssue {
  code: CardIssueCode;
  severity: CardIssueSeverity;
  /** Indeks bloku, którego dotyczy (null = poziom CardSpec). */
  blockIndex: number | null;
  message: string;
}

const BLOCK_TYPE_SET = new Set<string>(CARD_BLOCK_TYPES);

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function issue(
  code: CardIssueCode,
  severity: CardIssueSeverity,
  blockIndex: number | null,
  message: string
): CardIssue {
  return { code, severity, blockIndex, message };
}

/**
 * Waliduje `CardSpec`: braki/puste bloki/nieznane typy/zła tabela.
 * Deterministyczny, nigdy nie rzuca — zwraca listę issues[] (pusta = OK).
 * Wzorowane na `deckDesignCritic.critiqueSlide`.
 */
export function validateCardSpec(spec: CardSpec | null | undefined): CardIssue[] {
  const issues: CardIssue[] = [];

  if (!spec || typeof spec !== 'object') {
    return [issue('CB-03-EMPTY-BLOCKS', 'CRITICAL', null, 'CardSpec jest pusty/niezdefiniowany.')];
  }

  // CB-01 — sectionKey
  if (!isNonEmptyString(spec.sectionKey)) {
    issues.push(issue('CB-01-NO-SECTION-KEY', 'CRITICAL', null, 'Brak `sectionKey`.'));
  }

  // CB-02 — title
  if (!isNonEmptyString(spec.title)) {
    issues.push(issue('CB-02-NO-TITLE', 'MAJOR', null, 'Brak `title` karty.'));
  }

  // CB-03 — blocks niepuste
  const blocks = Array.isArray(spec.blocks) ? spec.blocks : [];
  if (blocks.length === 0) {
    issues.push(issue('CB-03-EMPTY-BLOCKS', 'CRITICAL', null, 'Karta nie ma żadnych bloków.'));
    return issues;
  }

  blocks.forEach((block, i) => {
    if (!block || typeof block !== 'object' || !BLOCK_TYPE_SET.has((block as CardBlock).type)) {
      issues.push(
        issue(
          'CB-04-UNKNOWN-BLOCK-TYPE',
          'CRITICAL',
          i,
          `Nieznany typ bloku: ${(block as { type?: unknown })?.type ?? 'undefined'}.`
        )
      );
      return;
    }

    switch (block.type) {
      case 'heading':
      case 'paragraph': {
        if (!isNonEmptyString(block.text)) {
          issues.push(
            issue(
              'CB-05-EMPTY-BLOCK-CONTENT',
              'MAJOR',
              i,
              `Blok ${block.type} bez treści (\`text\`).`
            )
          );
        }
        break;
      }
      case 'callout': {
        if (!isNonEmptyString(block.text)) {
          issues.push(issue('CB-05-EMPTY-BLOCK-CONTENT', 'MAJOR', i, 'Callout bez treści.'));
        }
        break;
      }
      case 'bullet_list': {
        const items = Array.isArray(block.items) ? block.items.filter(isNonEmptyString) : [];
        if (items.length === 0) {
          issues.push(
            issue('CB-05-EMPTY-BLOCK-CONTENT', 'MAJOR', i, 'Lista punktowana bez pozycji.')
          );
        }
        break;
      }
      case 'kpi_strip': {
        const tiles = Array.isArray(block.tiles) ? block.tiles : [];
        const valid = tiles.filter(
          (t) => t && isNonEmptyString(t.label) && isNonEmptyString(t.value)
        );
        if (valid.length === 0) {
          issues.push(
            issue('CB-08-KPI-EMPTY', 'MAJOR', i, 'kpi_strip bez poprawnych kafelków (label+value).')
          );
        }
        break;
      }
      case 'table': {
        const columns = Array.isArray(block.columns) ? block.columns : [];
        const rows = Array.isArray(block.rows) ? block.rows : [];
        if (columns.length === 0) {
          issues.push(issue('CB-06-TABLE-SHAPE', 'MAJOR', i, 'Tabela bez kolumn.'));
        } else if (rows.length === 0) {
          issues.push(issue('CB-06-TABLE-SHAPE', 'MINOR', i, 'Tabela bez wierszy.'));
        } else {
          const mismatched = rows.some((r) => !Array.isArray(r) || r.length !== columns.length);
          if (mismatched) {
            issues.push(
              issue(
                'CB-06-TABLE-SHAPE',
                'MAJOR',
                i,
                `Wiersze tabeli nie pasują do ${columns.length} kolumn.`
              )
            );
          }
        }
        break;
      }
      case 'chart': {
        const series = Array.isArray(block.series) ? block.series : [];
        const valid = series.filter(
          (s) =>
            s &&
            isNonEmptyString(s.label) &&
            typeof s.value === 'number' &&
            Number.isFinite(s.value)
        );
        if (valid.length === 0) {
          issues.push(
            issue(
              'CB-07-CHART-EMPTY',
              'MAJOR',
              i,
              'Wykres bez poprawnej serii danych (label+liczba).'
            )
          );
        }
        break;
      }
      default: {
        // wyczerpane wyżej przez BLOCK_TYPE_SET — defensywnie:
        issues.push(issue('CB-04-UNKNOWN-BLOCK-TYPE', 'CRITICAL', i, 'Nieobsłużony typ bloku.'));
      }
    }
  });

  return issues;
}

/** Czy spec ma jakiekolwiek issue CRITICAL (blokujące render/akceptację). */
export function hasCriticalIssues(issues: CardIssue[]): boolean {
  return issues.some((it) => it.severity === 'CRITICAL');
}

/** Wygodny predykat: spec jest renderowalny (brak CRITICAL). */
export function isRenderableCardSpec(spec: CardSpec | null | undefined): boolean {
  return !hasCriticalIssues(validateCardSpec(spec));
}
