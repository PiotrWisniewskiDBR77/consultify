/**
 * docScoring — scoring engine dla M18 (raporty/dokumenty).
 *
 * Bierze DocumentSchema (sekcje × bloki) i sprawdza:
 * - section count
 * - block types presence (kpi, callout, chart, table, etc.)
 * - block counts (≥N typed blocks; bramki B3 quality-gate)
 * - graficzne (KPI 3-5 itemów, chart palette ≤7, table headers wyróżnione)
 */

import {
  blockTypeClass,
  type AnyDocBlockType,
  type CanonicalDocBlockType,
  type LegacyDocBlockType,
} from './blockTypeNormalization.js';
import { emptyReport, finalize, ReportBuilder, type ScoreReport } from './scoringTypes.js';

// ──────────────────────────────────────────────────────────────
// Minimal Document shape (mirror documentStudioTypes)
//
// KANON typów bloków = rodzina żywego pipeline'u (documentStudioTypes:
// paragraph / bullet_list / kpi_strip / …). Historyczna rodzina scoringu
// (text / bulletList / kpi / …) pozostaje AKCEPTOWANA jako alias — scoring
// normalizuje obie formy na wejściu (blockTypeNormalization.ts) i liczy na
// kanonicznej. Dzięki temu surowe wyjście B3 scoruje się bez ręcznego
// mapowania, a katalog scenariuszy (legacy nazwy) działa bez zmian.
// ──────────────────────────────────────────────────────────────

/**
 * Historyczna rodzina docScoring — utrzymana dla katalogu scenariuszy.
 * NOWY kod powinien używać nazw kanonicznych ({@link CanonicalDocBlockType}).
 */
export type DocBlockType =
  | 'text'
  | 'heading'
  | 'bulletList'
  | 'numberedList'
  | 'quote'
  | 'callout'
  | 'chart'
  | 'table'
  | 'kpi'
  | 'image'
  | 'divider';

export type { AnyDocBlockType, CanonicalDocBlockType, LegacyDocBlockType };

export interface DocBlock {
  blockId: string;
  /** Obie rodziny dozwolone — normalizacja na wejściu scoringu. */
  type: AnyDocBlockType;
  content: any;
}

export interface DocSection {
  sectionId: string;
  heading?: string;
  blocks: DocBlock[];
}

export interface DocumentArtifact {
  sections: DocSection[];
  citations?: Array<{ id: string; ref: string }>;
}

// ──────────────────────────────────────────────────────────────
// Doc-specific criteria DSL
// ──────────────────────────────────────────────────────────────

export interface DocCriteria {
  scenarioId: string;
  // Substantive
  minSections: number;
  maxSections: number;
  minBlocks?: number;
  maxBlocks?: number;
  /** Wymagane typy bloków + min liczba wystąpień (obie rodziny nazw OK). */
  requireBlockType?: Array<{ type: AnyDocBlockType; min: number; chartKind?: string }>;
  /** Typy bloków które NIE MOGĄ wystąpić (constraint test; obie rodziny OK). */
  forbidBlockType?: AnyDocBlockType[];
  /** Sekcja z heading zawierającym jeden z keywords musi istnieć. */
  requireSectionHeading?: string[];
  /** Cytowanie ≥N. */
  minCitations?: number;
  /** Jakikolwiek text/heading zawiera jeden z keywords. */
  anyTextContains?: string[];
  // Graphic
  /** KPI block ma 3-5 itemów. */
  kpiItemsRange?: [number, number];
  /** Chart palette clamp ≤N. */
  chartPaletteMax?: number;
  /** Chart series count ≤N. */
  chartSeriesMax?: number;
  /** Distinct block types ≥N. */
  minDistinctBlockTypes?: number;
  /** Cell styling: ≥N komórek tabeli ma bgColor (CF/styling presence). */
  minStyledCells?: number;
}

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function allBlocks(doc: DocumentArtifact): DocBlock[] {
  return doc.sections.flatMap((s) => s.blocks);
}

/**
 * Bloki danego typu — matchowanie na KANONICZNEJ klasie typu, więc artefakt
 * może przyjść w dowolnej rodzinie nazw (raw B3: paragraph/kpi_strip/… lub
 * legacy: text/kpi/…), a kryterium tak samo. risk_table liczy się jako table,
 * footnote/citation jako paragraph (semantyka historycznego mapowania).
 */
function blocksOfType(doc: DocumentArtifact, type: AnyDocBlockType): DocBlock[] {
  const wanted = blockTypeClass(type);
  return allBlocks(doc).filter((b) => blockTypeClass(b.type) === wanted);
}

function allText(doc: DocumentArtifact): string {
  const parts: string[] = [];
  for (const section of doc.sections) {
    if (section.heading) parts.push(section.heading);
    for (const block of section.blocks) {
      const content = block.content ?? {};
      if (typeof content.text === 'string') parts.push(content.text);
      if (typeof content.title === 'string') parts.push(content.title);
      if (typeof content.label === 'string') parts.push(content.label);
      if (Array.isArray(content.items)) {
        for (const item of content.items) {
          if (typeof item === 'string') parts.push(item);
          else if (item?.text) parts.push(String(item.text));
        }
      }
    }
  }
  return parts.join(' ');
}

// ──────────────────────────────────────────────────────────────
// Scoring
// ──────────────────────────────────────────────────────────────

export function scoreDoc(doc: DocumentArtifact, criteria: DocCriteria): ScoreReport {
  const report = emptyReport(criteria.scenarioId);
  const b = new ReportBuilder(report);
  const sections = doc.sections ?? [];
  const blocks = allBlocks(doc);

  // ── Substantive ──────────────────────────────────────────────
  b.expectCount(
    sections,
    criteria.minSections,
    criteria.maxSections,
    'section count',
    'substantive',
    'B3 sectionStructure — sprawdź czy LLM dzieli content na sekcje'
  );

  if (criteria.minBlocks || criteria.maxBlocks) {
    b.expectCount(
      blocks,
      criteria.minBlocks ?? 0,
      criteria.maxBlocks ?? 9999,
      'total blocks count',
      'substantive'
    );
  }

  if (criteria.requireBlockType) {
    for (const req of criteria.requireBlockType) {
      let count = blocksOfType(doc, req.type).length;
      if (req.chartKind && req.type === 'chart') {
        count = blocksOfType(doc, 'chart').filter(
          (bl) => bl.content?.kind === req.chartKind
        ).length;
      }
      b.expect(
        count >= req.min,
        `requireBlockType ${req.type}${req.chartKind ? `/${req.chartKind}` : ''}`,
        `≥${req.min}`,
        String(count),
        'substantive',
        `B3 quality-gate — LLM nie wybiera typed block ${req.type}. Wzmocnij example w prompcie B3`
      );
    }
  }

  if (criteria.forbidBlockType) {
    for (const forbidden of criteria.forbidBlockType) {
      const count = blocksOfType(doc, forbidden).length;
      b.expect(
        count === 0,
        `forbidBlockType ${forbidden}`,
        '0',
        String(count),
        'substantive',
        `Constraint: LLM nadal generuje ${forbidden} — EXPLICIT exclusion w prompt`
      );
    }
  }

  if (criteria.requireSectionHeading) {
    const hasHeading = sections.some((s) =>
      criteria.requireSectionHeading!.some((kw) =>
        (s.heading ?? '').toLowerCase().includes(kw.toLowerCase())
      )
    );
    b.expect(
      hasHeading,
      'section heading keyword',
      `one section heading contains [${criteria.requireSectionHeading.join('|')}]`,
      sections.map((s) => s.heading).join(' / '),
      'substantive',
      `LLM pomija wymaganą sekcję — wzmocnij outline w prompt`
    );
  }

  if (criteria.minCitations) {
    const count = doc.citations?.length ?? 0;
    b.expect(
      count >= criteria.minCitations,
      'citations count',
      `≥${criteria.minCitations}`,
      String(count),
      'substantive',
      `LLM nie zwraca citations[] — B3 schema musi zawierać citations`
    );
  }

  if (criteria.anyTextContains) {
    const text = allText(doc);
    b.expectContainsCi(
      text,
      criteria.anyTextContains,
      'any',
      'any text contains keyword',
      'substantive'
    );
  }

  // ── Graphic ──────────────────────────────────────────────────

  if (criteria.kpiItemsRange) {
    const kpiBlocks = blocksOfType(doc, 'kpi');
    if (kpiBlocks.length === 0) {
      // Zaliczamy n/a jeśli nie wymagano w substantive — w przeciwnym razie złapie inny check.
    } else {
      for (const kpi of kpiBlocks) {
        const items = Array.isArray(kpi.content?.items) ? kpi.content.items.length : 0;
        b.expect(
          items >= criteria.kpiItemsRange[0] && items <= criteria.kpiItemsRange[1],
          `KPI block items (${kpi.blockId})`,
          `${criteria.kpiItemsRange[0]}-${criteria.kpiItemsRange[1]}`,
          String(items),
          'graphic',
          'B3 KPI block — items powinno być 3-5 zgodnie z kanonem'
        );
      }
    }
  }

  if (criteria.chartPaletteMax) {
    for (const chart of blocksOfType(doc, 'chart')) {
      const series = Array.isArray(chart.content?.series) ? chart.content.series : [];
      const colors = new Set(series.map((s: any) => s?.color).filter(Boolean));
      b.expect(
        colors.size <= criteria.chartPaletteMax,
        `chart palette clamp (${chart.blockId})`,
        `≤${criteria.chartPaletteMax}`,
        String(colors.size),
        'graphic',
        'Chart series colors > kanon — clamp paleta w renderer'
      );
    }
  }

  if (criteria.chartSeriesMax) {
    for (const chart of blocksOfType(doc, 'chart')) {
      const seriesCount = Array.isArray(chart.content?.series) ? chart.content.series.length : 0;
      b.expect(
        seriesCount <= criteria.chartSeriesMax,
        `chart series count (${chart.blockId})`,
        `≤${criteria.chartSeriesMax}`,
        String(seriesCount),
        'graphic',
        'Zbyt wiele serii — kanon ≤6'
      );
    }
  }

  if (criteria.minDistinctBlockTypes) {
    // Liczone na klasach kanonicznych — 'text' i 'paragraph' to JEDEN typ.
    const distinct = new Set(blocks.map((b) => blockTypeClass(b.type))).size;
    b.expect(
      distinct >= criteria.minDistinctBlockTypes,
      'distinct block types',
      `≥${criteria.minDistinctBlockTypes}`,
      String(distinct),
      'graphic',
      'Sama proza — wzmocnij B3 prompt "vary block types"'
    );
  }

  if (criteria.minStyledCells) {
    let styledCount = 0;
    for (const table of blocksOfType(doc, 'table')) {
      const rows = Array.isArray(table.content?.rows) ? table.content.rows : [];
      for (const row of rows) {
        const cells = row?.cells ?? {};
        for (const cell of Object.values(cells)) {
          if ((cell as any)?.style?.bgColor) styledCount++;
        }
      }
    }
    b.expect(
      styledCount >= criteria.minStyledCells,
      'styled cells presence',
      `≥${criteria.minStyledCells} cells z bgColor`,
      String(styledCount),
      'graphic',
      'Tabela bez stylowania per cell — X2 wpięcie CF/styling'
    );
  }

  const totalCriteria =
    1 + // section count
    (criteria.minBlocks || criteria.maxBlocks ? 1 : 0) +
    (criteria.requireBlockType?.length ?? 0) +
    (criteria.forbidBlockType?.length ?? 0) +
    (criteria.requireSectionHeading ? 1 : 0) +
    (criteria.minCitations ? 1 : 0) +
    (criteria.anyTextContains ? 1 : 0) +
    (criteria.kpiItemsRange ? Math.max(1, blocksOfType(doc, 'kpi').length) : 0) +
    (criteria.chartPaletteMax ? Math.max(1, blocksOfType(doc, 'chart').length) : 0) +
    (criteria.chartSeriesMax ? Math.max(1, blocksOfType(doc, 'chart').length) : 0) +
    (criteria.minDistinctBlockTypes ? 1 : 0) +
    (criteria.minStyledCells ? 1 : 0);

  return finalize(report, totalCriteria);
}
