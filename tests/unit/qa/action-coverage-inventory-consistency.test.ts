import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// Consistency guard for the Ideas E02 action-coverage inventory.
//
// WHY THIS EXISTS: an orchestrator once reported class counts of 26/4/131/62
// (summing to 223) for docs/qa/ideas-complete-transformation-2026-08-09/
// 04_ACTION_COVERAGE_INVENTORY.csv, produced by splitting the CSV on raw
// commas. The file has quoted cells that legitimately CONTAIN commas (the
// `reason` column is long free text), so naive comma-splitting shreds rows
// and produces garbage counts. The real numbers, read with an RFC4180-aware
// parser, are 264 total records: 76 (a) / 152 (b) / 5 (c) / 31 (d).
// Separately, 03_CODEX_QUALITY_BACKLOG.md briefly marked QG-02 "RESOLVED"
// while its own text admitted the 31 class-(d) rows were never fixed — a
// status/evidence contradiction. This file asserts INVARIANTS, not today's
// hardcoded numbers, so it keeps binding as sibling work resolves class c/d
// rows over time:
//   1. the inventory CSV's record count equals the sum of its own class
//      counts (guards against a parser silently dropping/duplicating rows,
//      or a stray/typo'd classification value nobody is counting);
//   2. the CSV's own documented "construct baseline" total (recorded in
//      03_CODEX_QUALITY_BACKLOG.md's QG-02 evidence line, which is the
//      number the accounting in the CSV was actually performed against)
//      matches the CSV's live record count;
//   3. the "unresolved class c + class d" count computed live from the CSV
//      matches the number 03_CODEX_QUALITY_BACKLOG.md states for QG-02 (so
//      the doc and the CSV cannot silently drift apart);
//   4. QG-02 is never marked RESOLVED while any class c or class d row is
//      still unresolved (this is the assertion that must fail if someone
//      marks QG-02 resolved prematurely — see the manual proof recorded in
//      this file's sibling investigation notes / the task report).
//
// NOTE ON A DELIBERATELY-OMITTED ASSERTION: scripts/check-action-coverage
// .baseline.txt currently records a *different*, smaller total (194 across
// 91 files) than the CSV's 264/127. That is not a bug: 03_CODEX_QUALITY_
// BACKLOG.md documents that the live ratchet baseline was later regenerated
// after an awk heuristic improvement (Pass A3) that *reclassifies* some of
// the CSV's class-(a) heuristic-false-negatives as traceable, shrinking the
// live guard's total without touching the underlying inventory accounting.
// So `264 (CSV) === 194 (live ratchet baseline)` is FALSE by design, not by
// mistake — asserting that equality here would be a permanently-red, no
// -information test. Instead this file checks the baseline.txt artifact's
// OWN internal arithmetic (its header total against the sum of its body),
// which is the meaningful, currently-true invariant "whatever the guard
// treats as the total" cashes out to.

const REPO_ROOT = join(__dirname, '..', '..', '..');
const CSV_PATH = join(
  REPO_ROOT,
  'docs/qa/ideas-complete-transformation-2026-08-09/04_ACTION_COVERAGE_INVENTORY.csv'
);
const BACKLOG_PATH = join(
  REPO_ROOT,
  'docs/qa/ideas-complete-transformation-2026-08-09/03_CODEX_QUALITY_BACKLOG.md'
);
const BASELINE_PATH = join(REPO_ROOT, 'scripts/check-action-coverage.baseline.txt');

/**
 * Minimal RFC4180 CSV parser: handles quoted fields, commas inside quotes,
 * doubled-quote escaping ("") and CRLF/LF line endings. Deliberately NOT a
 * `.split(',')` — that is the exact bug this test file exists to prevent.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c === '\r') {
      // skip, \n handles the line break
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function loadInventoryRows(): { header: string[]; rows: string[][] } {
  const raw = readFileSync(CSV_PATH, 'utf8');
  const parsed = parseCsv(raw);
  const header = parsed[0];
  const rows = parsed.slice(1).filter((r) => r.length > 1 && r.some((cell) => cell.trim() !== ''));
  return { header, rows };
}

function classCounts(rows: string[][], classIdx: number): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of rows) {
    const cls = (r[classIdx] ?? '').trim();
    counts[cls] = (counts[cls] ?? 0) + 1;
  }
  return counts;
}

/** Extracts the text of one `## QG-XX — ...` section up to the next `## ` heading. */
function extractSection(markdown: string, headingPrefix: string): string {
  const lines = markdown.split('\n');
  const startIdx = lines.findIndex((l) => l.startsWith(headingPrefix));
  if (startIdx === -1) {
    throw new Error(`Section starting with "${headingPrefix}" not found in ${BACKLOG_PATH}`);
  }
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) {
      endIdx = i;
      break;
    }
  }
  return lines.slice(startIdx, endIdx).join('\n');
}

describe('04_ACTION_COVERAGE_INVENTORY.csv — real CSV parser sanity', () => {
  it('parses quoted, comma-containing cells without shredding rows', () => {
    const { header, rows } = loadInventoryRows();
    expect(header).toEqual([
      'file',
      'line',
      'snippet',
      'classification',
      'reason',
      'follow_up_action_id_or_blank',
    ]);
    // Sanity: every data row must have the full column count (a naive
    // comma-split on a quoted `reason` field containing commas would instead
    // produce rows with a variable, usually much larger, column count).
    for (const r of rows) {
      expect(r.length).toBe(header.length);
    }
  });

  it('record count equals the sum of its own class counts', () => {
    const { header, rows } = loadInventoryRows();
    const classIdx = header.indexOf('classification');
    expect(classIdx).toBeGreaterThanOrEqual(0);

    const counts = classCounts(rows, classIdx);
    // 'resolved' is the terminal classification a class-c/class-d row moves to
    // once its command is verified genuinely registered and wired (real
    // registry id + real call-site routing, not just relabeled) — it is a
    // legitimate, expected value alongside a/b/c/d, not a stray/typo. Omitting
    // it here would make this assertion fail precisely when the program is
    // doing its job (resolving debt), which is the opposite of the invariant
    // this test exists to protect.
    const known =
      (counts.a ?? 0) + (counts.b ?? 0) + (counts.c ?? 0) + (counts.d ?? 0) +
      (counts.resolved ?? 0);

    // Every row's classification must be one of a/b/c/d/resolved — if a
    // stray/typo'd classification value ever sneaks in, `known` silently
    // undercounts `rows.length` and this assertion catches it.
    expect(known).toBe(rows.length);
  });

  it("CSV record count matches the construct-baseline total 03_CODEX_QUALITY_BACKLOG.md's QG-02 accounting was performed against", () => {
    const { rows } = loadInventoryRows();
    const backlog = readFileSync(BACKLOG_PATH, 'utf8');
    const qg02 = extractSection(backlog, '## QG-02');

    // e.g. "Full accounting of the 264-construct baseline (127 files) recorded at HEAD"
    const match = qg02.match(/the (\d+)-construct baseline \((\d+) files\)/);
    expect(match, 'QG-02 section must state "the N-construct baseline (M files)"').not.toBeNull();
    const documentedTotal = Number(match![1]);

    expect(rows.length).toBe(documentedTotal);
  });

  it('unresolved class-c + class-d count matches what 03_CODEX_QUALITY_BACKLOG.md states for QG-02', () => {
    const { header, rows } = loadInventoryRows();
    const classIdx = header.indexOf('classification');
    const counts = classCounts(rows, classIdx);
    const liveUnresolved = (counts.c ?? 0) + (counts.d ?? 0);

    const backlog = readFileSync(BACKLOG_PATH, 'utf8');
    const qg02 = extractSection(backlog, '## QG-02');

    const match = qg02.match(/Unresolved debt \(class c \+ class d\):\s*(\d+)/);
    expect(
      match,
      'QG-02 section must state "Unresolved debt (class c + class d): N" — keep it in sync with the CSV when resolving rows'
    ).not.toBeNull();
    const documentedUnresolved = Number(match![1]);

    expect(liveUnresolved).toBe(documentedUnresolved);
  });

  it('QG-02 is NOT marked RESOLVED while any class c or class d row remains unresolved', () => {
    const { header, rows } = loadInventoryRows();
    const classIdx = header.indexOf('classification');
    const counts = classCounts(rows, classIdx);
    const unresolved = (counts.c ?? 0) + (counts.d ?? 0);

    const backlog = readFileSync(BACKLOG_PATH, 'utf8');
    const qg02 = extractSection(backlog, '## QG-02');

    const statusMatch = qg02.match(/\*\*Status:\s*([^*]+?)\*\*/);
    expect(statusMatch, 'QG-02 section must contain a "**Status: ...**" line').not.toBeNull();
    const status = statusMatch![1].trim();

    if (unresolved > 0) {
      expect(
        status.toUpperCase(),
        `QG-02 has ${unresolved} unresolved class-c/class-d row(s) but is marked "${status}" — ` +
          'inventorying is not remediation; QG-02 may only say RESOLVED once class c = 0 and class d = 0.'
      ).not.toContain('RESOLVED');
    } else {
      // Once the debt truly hits zero, RESOLVED is the expected, honest status.
      expect(status.toUpperCase()).toContain('RESOLVED');
    }
  });
});

describe('scripts/check-action-coverage.baseline.txt — internal arithmetic self-consistency', () => {
  it('the header-recorded RAZEM total matches the sum of the body\'s per-file counts, and the file count matches', () => {
    const raw = readFileSync(BASELINE_PATH, 'utf8');
    const lines = raw.split('\n');

    const headerLine = lines.find((l) => l.startsWith('# RAZEM:'));
    expect(headerLine, '# RAZEM: <n> naruszeń w <m> plikach header line must exist').toBeTruthy();
    const headerMatch = headerLine!.match(/# RAZEM:\s*(\d+)\s*naruszeń w\s*(\d+)\s*plikach/);
    expect(headerMatch, `unexpected RAZEM header format: "${headerLine}"`).not.toBeNull();
    const declaredTotal = Number(headerMatch![1]);
    const declaredFiles = Number(headerMatch![2]);

    const bodyLines = lines.filter((l) => l.length > 0 && !l.startsWith('#'));
    let sum = 0;
    for (const l of bodyLines) {
      const [countStr] = l.split('\t');
      const n = Number(countStr);
      expect(Number.isFinite(n), `non-numeric baseline count in line "${l}"`).toBe(true);
      sum += n;
    }

    expect(sum).toBe(declaredTotal);
    expect(bodyLines.length).toBe(declaredFiles);
  });
});
