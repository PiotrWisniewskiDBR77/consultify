/**
 * builders — kompaktowe konstruktory mock-artifactów dla katalogu 90 scenariuszy.
 *
 * Każdy scenariusz w katalogu dostarcza `mockPass` — artefakt KNOWN-GOOD który
 * MUSI przejść scoring dla swoich criteria. fullCatalog.test.ts iteruje 90
 * scenariuszy, scoruje każdy mockPass i asertuje passed===true.
 *
 * To jest regression-guard SCORINGU: gdy ktoś zepsuje scorer (np zmieni próg),
 * któryś z 90 mock-passów spadnie → test złapie. Plus waliduje że criteria są
 * SATISFIABLE (istnieje artefakt który je spełnia).
 */

import type {
  DeckLayoutDirectorResult,
  SlideLayoutPlan,
} from '../../../../server/src/services/presentationLayoutDirectorService.js';
import type { DocumentArtifact, DocBlock, DocSection } from '../scoring/docScoring.js';
import type { GeneratedTable, TableField } from '../scoring/tableScoring.js';

// ──────────────────────────────────────────────────────────────
// Deck builders
// ──────────────────────────────────────────────────────────────

export function deckPlan(
  intents: string[],
  palette: string,
  opts: { briefsForIndices?: number[]; allLlm?: boolean } = {}
): DeckLayoutDirectorResult {
  const allLlm = opts.allLlm ?? true;
  const briefSet = new Set(opts.briefsForIndices ?? intents.map((_, i) => i));
  const plans: SlideLayoutPlan[] = intents.map((intent, i) => ({
    slideIndex: i,
    layoutIntent: intent as any,
    paletteId: palette,
    imageBrief: briefSet.has(i)
      ? `Brief for slide ${i + 1}: ${intent} visual — professional composition`
      : null,
    reasoning: `Reasoning for ${intent} at slide ${i + 1} — covers required substance and keywords`,
    source: allLlm ? 'llm' : 'deterministic',
    // Real slide INPUT title/key_message (carried through by the generator).
    title: `Slide ${i + 1}: ${intent}`,
    keyMessage: `Key message for ${intent} at slide ${i + 1} — covers required substance and keywords`,
  }));
  return { plans, tierUsed: 'PREMIUM', fallbackUsed: false };
}

/**
 * Wstrzykuje keyword do reasoning danego slajdu (np cover title proxy).
 * deckScoring używa reasoning+imageBrief jako proxy dla cover title.
 */
export function withCoverKeywords(
  result: DeckLayoutDirectorResult,
  keywords: string[]
): DeckLayoutDirectorResult {
  const plans = result.plans.map((p, i) =>
    i === 0
      ? {
          ...p,
          // Inject into the REAL title (scorer now reads title/keyMessage), and
          // keep reasoning/imageBrief too for legacy-proxy back-compat.
          title: `${p.title ?? ''} ${keywords.join(' ')}`.trim(),
          reasoning: `${p.reasoning} ${keywords.join(' ')}`,
          imageBrief: `${p.imageBrief ?? ''} ${keywords.join(' ')}`,
        }
      : p
  );
  return { ...result, plans };
}

/** Wstrzykuje keyword do key_message któregokolwiek slajdu (anyKeyMessageContains). */
export function withAnyKeyword(
  result: DeckLayoutDirectorResult,
  keywords: string[]
): DeckLayoutDirectorResult {
  const plans = result.plans.map((p, i) =>
    i === 1
      ? {
          ...p,
          keyMessage: `${p.keyMessage ?? ''} ${keywords.join(' ')}`.trim(),
          reasoning: `${p.reasoning} ${keywords.join(' ')}`,
        }
      : p
  );
  return { ...result, plans };
}

// ──────────────────────────────────────────────────────────────
// Doc builders
// ──────────────────────────────────────────────────────────────

let blockCounter = 0;
function bid(): string {
  return `b-${++blockCounter}`;
}

export function block(type: DocBlock['type'], content: any = {}): DocBlock {
  return { blockId: bid(), type, content };
}

export function heading(text: string): DocBlock {
  return block('heading', { text });
}

export function text(body: string): DocBlock {
  return block('text', { text: body });
}

export function callout(body: string, tone = 'info'): DocBlock {
  return block('callout', { text: body, tone });
}

export function kpi(items: Array<{ label: string; value: string; delta: string }>): DocBlock {
  return block('kpi', { items });
}

export function kpiN(n: number): DocBlock {
  return kpi(
    Array.from({ length: n }, (_, i) => ({
      label: `KPI ${i + 1}`,
      value: `${(i + 1) * 10}`,
      delta: i % 2 === 0 ? '+5%' : '-3%',
    }))
  );
}

export function chart(kind: string, seriesCount = 2): DocBlock {
  const palette = ['#2563EB', '#0D9488', '#7C3AED', '#DC2626', '#EA580C', '#0891B2', '#65A30D'];
  return block('chart', {
    kind,
    title: `Chart (${kind})`,
    xAxisLabel: 'okres',
    yAxisLabel: 'wartość',
    categories: ['A', 'B', 'C'],
    series: Array.from({ length: seriesCount }, (_, i) => ({
      label: `Series ${i + 1}`,
      values: [10, 20, 30],
      color: palette[i % palette.length],
    })),
  });
}

export function bulletList(items: string[]): DocBlock {
  return block('bulletList', { items });
}

export function numberedList(items: string[]): DocBlock {
  return block('numberedList', { items });
}

export function quote(body: string, author: string): DocBlock {
  return block('quote', { text: body, author });
}

export function tableBlock(
  rows: Array<Record<string, { value?: unknown; style?: { bgColor?: string } }>>
): DocBlock {
  return block('table', { rows: rows.map((cells) => ({ cells })) });
}

export function section(heading: string, blocks: DocBlock[]): DocSection {
  return { sectionId: `sec-${heading.slice(0, 8).replace(/\s/g, '')}-${++blockCounter}`, heading, blocks };
}

export function doc(sections: DocSection[], citations?: Array<{ id: string; ref: string }>): DocumentArtifact {
  return { sections, citations };
}

export function citations(n: number): Array<{ id: string; ref: string }> {
  return Array.from({ length: n }, (_, i) => ({ id: `c${i + 1}`, ref: `Source ${i + 1} (2026)` }));
}

// ──────────────────────────────────────────────────────────────
// Table builders
// ──────────────────────────────────────────────────────────────

export function field(key: string, header: string, type: string): TableField {
  return { key, header, type };
}

export function selectField(
  key: string,
  header: string,
  options: Array<{ label: string; color: string }>,
  multi = false
): TableField {
  return { key, header, type: multi ? 'multiSelect' : 'singleSelect', options };
}

/** Status traffic-light (3 lub 4 opcji z semantic colors). */
export function trafficLightSelect(
  key: string,
  header: string,
  labels: string[]
): TableField {
  // Map labels do semantic colors: pierwszy=green (good/low), ostatni=red (bad/high).
  const colorFor = (idx: number, total: number): string => {
    if (total <= 1) return '#16A34A';
    if (idx === 0) return '#16A34A'; // green
    if (idx === total - 1) return '#DC2626'; // red
    if (total >= 3 && idx === Math.floor(total / 2)) return '#D97706'; // amber middle
    return '#D97706'; // amber for in-between
  };
  return {
    key,
    header,
    type: 'singleSelect',
    options: labels.map((label, i) => ({ label, color: colorFor(i, labels.length) })),
  };
}

export interface TableBuildOpts {
  fields: TableField[];
  rowCount: number;
  cf?: GeneratedTable['conditionalFormatting'];
  hasFormulas?: boolean;
  sheets?: GeneratedTable[];
}

export function table(opts: TableBuildOpts): GeneratedTable {
  const seedRows = Array.from({ length: opts.rowCount }, (_, i) => {
    const row: Record<string, unknown> = {};
    for (const f of opts.fields) {
      if (f.type === 'singleSelect' || f.type === 'multiSelect') {
        row[f.key] = f.options?.[i % (f.options.length || 1)]?.label ?? 'opt';
      } else if (f.type === 'number' || f.type === 'rating') {
        row[f.key] = (i % 5) + 1;
      } else if (f.type === 'currency') {
        row[f.key] = (i + 1) * 1000;
      } else if (f.type === 'percent') {
        row[f.key] = 0.25 + (i % 4) * 0.1;
      } else if (f.type === 'date') {
        row[f.key] = `2026-0${(i % 9) + 1}-15`;
      } else if (f.type === 'checkbox') {
        row[f.key] = i % 2 === 0;
      } else if (f.type === 'email') {
        row[f.key] = `user${i}@example.com`;
      } else if (f.type === 'url') {
        row[f.key] = `https://example.com/${i}`;
      } else if (f.type === 'phone') {
        row[f.key] = `+48 600 000 ${String(i).padStart(3, '0')}`;
      } else {
        row[f.key] = `${f.header} ${i + 1}`;
      }
    }
    return row;
  });
  return {
    fields: opts.fields,
    seedRows,
    conditionalFormatting: opts.cf,
    hasFormulas: opts.hasFormulas,
    sheets: opts.sheets,
  };
}
