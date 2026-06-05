/**
 * canvasTableSeed — Canvas markdown table → Table Studio seed projection.
 *
 * Why this exists (Canvas L-2):
 * Canvas drafts with `kind='table'` can produce a real Table Studio
 * (`tp_tables` / `tp_fields` / `tp_records`) entry rather than a sibling
 * markdown blob. Naïve mapping would land all-text columns with junk field
 * names — the audit explicitly called that out as worse than today's
 * stay-in-canvas behavior. This module infers a sensible field type per
 * column (date / number / single-line-text / long-text) from the cell
 * contents and produces the same `StarterTableSeed` shape
 * `ensureStarterTableData` already consumes.
 *
 * Pure module — no DB I/O, no service deps — so callers can unit-test the
 * inference independently of the Table Studio service stack.
 */

import { marked, type Tokens } from 'marked';

export interface StarterTableField {
  name: string;
  fieldType: string;
  options?: Record<string, unknown>;
}

export interface StarterTableSeed {
  fields: StarterTableField[];
  records: Array<Record<string, unknown>>;
}

/**
 * Parse a canvas markdown body, locate the first GFM table, and project it
 * to a {fields, records} seed. Returns `null` if no table is found — caller
 * should treat that as a precondition failure.
 */
export function buildCanvasTableSeed(markdown: string): StarterTableSeed | null {
  const tokens = marked.lexer(markdown || '');
  const table = tokens.find((t) => t.type === 'table') as Tokens.Table | undefined;
  if (!table) return null;

  // Header projection — preserve column order; collapse inline emphasis to
  // plain text so the field name isn't "**Header**".
  const headers = table.header.map((cell, i) => ({
    rawText: cell.text.trim(),
    plainName: stripInlineMarkdown(cell.text).trim() || `Column ${i + 1}`,
  }));

  // Body projection — same per-cell flattening.
  const rows: string[][] = table.rows.map((row) =>
    row.map((cell) => stripInlineMarkdown(cell.text).trim())
  );

  // Type inference per column. For each column we sample non-empty cells
  // and apply lightweight heuristics:
  //   - all values match an ISO/EU date → date
  //   - all values parse as finite numbers → number
  //   - any value > 80 chars → long_text (multi-line text)
  //   - otherwise → single_line_text
  const fields: StarterTableField[] = headers.map((header, colIndex) => {
    const values = rows.map((row) => row[colIndex] ?? '').filter((v) => v.length > 0);

    if (values.length > 0 && values.every(looksLikeDate)) {
      return { name: header.plainName, fieldType: 'date', options: {} };
    }
    if (values.length > 0 && values.every(looksLikeNumber)) {
      return { name: header.plainName, fieldType: 'number', options: { precision: 2 } };
    }
    if (values.some((v) => v.length > 80)) {
      return { name: header.plainName, fieldType: 'long_text', options: {} };
    }
    return { name: header.plainName, fieldType: 'single_line_text', options: {} };
  });

  // Records — key each cell by the inferred field name; coerce typed cells
  // so RecordsService stores native values (ISO date string for date fields,
  // numeric for number fields).
  const records = rows.map((row) => {
    const record: Record<string, unknown> = {};
    fields.forEach((field, colIndex) => {
      const raw = row[colIndex] ?? '';
      if (field.fieldType === 'date') {
        record[field.name] = normalizeDate(raw);
      } else if (field.fieldType === 'number') {
        record[field.name] = coerceNumber(raw);
      } else {
        record[field.name] = raw;
      }
    });
    return record;
  });

  return { fields, records };
}

/** Strip TipTap-style inline markdown so a header / cell becomes a plain string. */
function stripInlineMarkdown(text: string): string {
  return (text || '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\((.+?)\)/g, '$1')
    .replace(/~~(.+?)~~/g, '$1');
}

const DATE_PATTERNS = [
  // ISO 8601: 2026-06-05 or with time
  /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?(?:Z|[+\-]\d{2}:?\d{2})?)?$/,
  // EU: 05/06/2026 or 05.06.2026 or 05-06-2026
  /^\d{1,2}[./-]\d{1,2}[./-]\d{4}$/,
  // US: 06/05/2026
  /^\d{1,2}\/\d{1,2}\/\d{4}$/,
];

function looksLikeDate(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 6 || trimmed.length > 30) return false;
  return DATE_PATTERNS.some((re) => re.test(trimmed));
}

function normalizeDate(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const eu = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (eu) {
    const [, d, m, y] = eu;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return trimmed;
}

function looksLikeNumber(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  // Strip currency symbol and thousand separators so "1,234.56" / "$1234" parse.
  const cleaned = trimmed.replace(/[\s$€£zł]/gi, '').replace(/,/g, '.');
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) {
    // Allow comma as decimal separator (Polish locale): 1234,56
    const withCommaDecimal = trimmed.replace(/[\s$€£zł]/gi, '').replace(/\.(?=\d{3})/g, '');
    return /^-?\d+([,.]\d+)?$/.test(withCommaDecimal);
  }
  return Number.isFinite(Number(cleaned));
}

function coerceNumber(value: string): number | string {
  const cleaned = value.trim().replace(/[\s$€£zł]/gi, '').replace(/,/g, '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : value;
}
