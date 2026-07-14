/**
 * cardSpecSchema (server) — F3/R2: deklaratywny silnik bloków kart inicjatyw,
 * w wersji SERWEROWEJ (czyste typy + walidator, BEZ Reacta).
 *
 * To wierne lustro frontowego `src/components/Initiatives/cards/cardBlockSchema.ts`
 * (SoT). Serwer NIE może importować kodu FE (`@/...` poza jego tsconfigiem), więc
 * gdy generator ma EMITOWAĆ CardSpec i bramkować go (R2), potrzebuje własnej,
 * deterministycznej kopii `validateCardSpec`. PARYTET kodów/severity z FE jest
 * wymagany — przy zmianie jednej strony zaktualizuj drugą.
 *
 * Walidator jest deterministyczny i NIGDY nie rzuca (fail-open) — zwraca issues[].
 */

// ── Block-type vocabulary (parytet z FE / M17 COMPOSITION_BLOCK_TYPES) ────────

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

export interface HeadingBlock {
  type: 'heading';
  text: string;
  level?: 3 | 4;
}

export interface ParagraphBlock {
  type: 'paragraph';
  text: string;
  emphasis?: 'normal' | 'lead' | 'muted';
}

export interface KpiTile {
  label: string;
  value: string;
  delta?: string;
  trend?: 'up' | 'down' | 'flat';
}

export interface KpiStripBlock {
  type: 'kpi_strip';
  tiles: KpiTile[];
}

export interface BulletListBlock {
  type: 'bullet_list';
  items: string[];
  ordered?: boolean;
}

export interface TableBlock {
  type: 'table';
  columns: string[];
  rows: string[][];
}

export type ChartKind = 'bar' | 'line' | 'pie' | 'area';

export interface ChartBlock {
  type: 'chart';
  chartKind: ChartKind;
  title?: string;
  series: Array<{ label: string; value: number }>;
}

export type CalloutTone = 'info' | 'success' | 'warning' | 'danger';

export interface CalloutBlock {
  type: 'callout';
  tone: CalloutTone;
  text: string;
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

export interface CardSpec {
  sectionKey: string;
  title: string;
  blocks: CardBlock[];
}

// ── Walidator (deterministyczny, fail-open — parytet z FE deckDesignCritic) ──

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
 */
export function validateCardSpec(spec: CardSpec | null | undefined): CardIssue[] {
  const issues: CardIssue[] = [];

  if (!spec || typeof spec !== 'object') {
    return [issue('CB-03-EMPTY-BLOCKS', 'CRITICAL', null, 'CardSpec jest pusty/niezdefiniowany.')];
  }

  if (!isNonEmptyString(spec.sectionKey)) {
    issues.push(issue('CB-01-NO-SECTION-KEY', 'CRITICAL', null, 'Brak `sectionKey`.'));
  }

  if (!isNonEmptyString(spec.title)) {
    issues.push(issue('CB-02-NO-TITLE', 'MAJOR', null, 'Brak `title` karty.'));
  }

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

/**
 * Defensywna koercja surowego JSON-a z LLM → `CardSpec`. Nigdy nie rzuca;
 * narzuca `sectionKey`, dba o tablicę `blocks`. Walidację robi `validateCardSpec`.
 */
export function coerceToCardSpec(raw: unknown, sectionKey: string, fallbackTitle = ''): CardSpec {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const blocks = Array.isArray(obj.blocks) ? (obj.blocks as CardBlock[]) : [];
  const title = isNonEmptyString(obj.title) ? (obj.title as string).trim() : fallbackTitle;
  return { sectionKey, title, blocks };
}

/** Zwięzły opis issues[] do feedbacku w pętli auto-heal (regen). */
export function summarizeIssues(issues: CardIssue[]): string {
  if (!issues.length) return 'brak';
  return issues
    .map(
      (it) =>
        `[${it.severity} ${it.code}${it.blockIndex != null ? ` @blok ${it.blockIndex}` : ''}] ${it.message}`
    )
    .join('\n');
}
