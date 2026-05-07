/**
 * Documentation Change Control Validator (Epic L3 — closure).
 *
 * Pure-logic validator for the changelogs that live next to
 * `docs/governance/DOCUMENTATION_CHANGE_CONTROL.md`.
 *
 * Two entry points:
 *
 *   - `validateChangelogContent(content, filePath)` — parses the changelog text and
 *     validates each entry against the required-metadata rules from
 *     `DOCUMENTATION_CHANGE_CONTROL.md` § 3 + § 5.
 *   - `parseOwnerRegistry(content)` — parses the markdown table in
 *     `DOC_OWNER_REGISTRY.md` into structured rows.
 *
 * INVARIANTS (do NOT break in future edits):
 *
 *   - The validator is **read-only**. It NEVER writes any file.
 *   - Functions NEVER throw. Malformed input degrades to an empty / FAIL result, with
 *     enough information in `issues` for the caller to act.
 *   - The report is JSON-serializable (no functions, no `Date`, no symbols on the wire).
 *   - The "latest entry" is `entries[0]` (newest-on-top convention). Older entries are
 *     validated with the same rules but their errors are downgraded to warnings — we
 *     never fail a PR because of a historical entry the current author did not write.
 *   - Boilerplate rejection is opinionated on purpose: rationale matching
 *     `/^updated docs?\.?$/i` is ALWAYS rejected, even if it is ≥ 20 chars.
 */

// ============================================================================
// PUBLIC TYPES
// ============================================================================

export interface ParsedChangelogEntry {
  date: string;
  author: string;
  doc: string | null;
  riskTier: 'P0' | 'P1' | 'P2' | null;
  rationale: string;
  impactNote: string;
  reviewer: string;
  linkedPr: string;
  diffSummary: string[];
  hasMetadata: boolean;
}

export interface ValidationIssue {
  entryIndex: number;
  field:
    | 'date'
    | 'author'
    | 'rationale'
    | 'impact_note'
    | 'reviewer'
    | 'linked_pr'
    | 'risk_tier'
    | 'diff_summary';
  severity: 'error' | 'warning';
  reason: string;
}

export interface ChangelogValidationReport {
  filePath: string;
  parsedAt: string;
  entries: ParsedChangelogEntry[];
  issues: ValidationIssue[];
  verdict: 'PASS' | 'PASS_WITH_WARNINGS' | 'FAIL';
}

export interface OwnerRegistryEntry {
  docPath: string;
  ownerRole: string;
  ownerName: string;
  delegate: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MIN_RATIONALE_CHARS = 20;
const BOILERPLATE_RATIONALE = /^updated\s+docs?\.?$/i;
const ENTRY_HEADER = /^##\s+(\d{4}-\d{2}-\d{2})\s+[—–-]\s+(.+?)\s*$/;
const ANY_ENTRY_HEADER_PREFIX = /^##\s+\d{4}-\d{2}-\d{2}\b/;

// ============================================================================
// PARSING
// ============================================================================

function safeSplitLines(content: string): string[] {
  if (typeof content !== 'string' || content.length === 0) return [];
  return content.split(/\r?\n/);
}

function findEntryStarts(lines: string[]): number[] {
  const starts: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (ANY_ENTRY_HEADER_PREFIX.test(line)) {
      starts.push(i);
    }
  }
  return starts;
}

function parseEntryBlock(blockLines: string[]): ParsedChangelogEntry {
  const headerLine = blockLines[0] ?? '';
  const headerMatch = headerLine.match(ENTRY_HEADER);
  const date = headerMatch ? (headerMatch[1] ?? '') : '';
  const author = headerMatch ? (headerMatch[2] ?? '').trim() : '';

  let doc: string | null = null;
  let riskTier: 'P0' | 'P1' | 'P2' | null = null;
  let reviewer = '';
  let linkedPr = '';
  let rationale = '';
  let impactNote = '';
  const diffSummary: string[] = [];

  type Section = 'rationale' | 'impact_note' | 'diff_summary' | null;
  let current: Section = null;
  let buffer: string[] = [];

  function flush(): void {
    if (current === null) {
      buffer = [];
      return;
    }
    if (current === 'rationale') {
      rationale = buffer.join('\n').trim();
    } else if (current === 'impact_note') {
      impactNote = buffer.join('\n').trim();
    } else if (current === 'diff_summary') {
      for (const raw of buffer) {
        const trimmed = raw.trim();
        if (trimmed.startsWith('- ')) {
          const item = trimmed.slice(2).trim();
          if (item.length > 0) diffSummary.push(item);
        } else if (trimmed.startsWith('* ')) {
          const item = trimmed.slice(2).trim();
          if (item.length > 0) diffSummary.push(item);
        }
      }
    }
    buffer = [];
    current = null;
  }

  for (let i = 1; i < blockLines.length; i++) {
    const line = blockLines[i] ?? '';

    const docMatch = line.match(/^\*\*Doc:\*\*\s*(.*)$/i);
    const riskMatch = line.match(/^\*\*Risk\s+tier:\*\*\s*(.*)$/i);
    const reviewerMatch = line.match(/^\*\*Reviewer:\*\*\s*(.*)$/i);
    const prMatch = line.match(/^\*\*Linked\s+PR\s*\/\s*ticket:\*\*\s*(.*)$/i);
    const rationaleStart = /^\*\*Rationale:\*\*\s*$/i.test(line);
    const impactStart = /^\*\*Impact\s+note:\*\*\s*$/i.test(line);
    const diffStart = /^\*\*Diff\s+summary:\*\*\s*$/i.test(line);

    if (docMatch) {
      flush();
      const value = (docMatch[1] ?? '').trim();
      doc = value.length > 0 ? value : null;
      continue;
    }
    if (riskMatch) {
      flush();
      const raw = (riskMatch[1] ?? '').trim();
      if (raw === 'P0' || raw === 'P1' || raw === 'P2') {
        riskTier = raw;
      } else {
        riskTier = null;
      }
      continue;
    }
    if (reviewerMatch) {
      flush();
      reviewer = (reviewerMatch[1] ?? '').trim();
      continue;
    }
    if (prMatch) {
      flush();
      linkedPr = (prMatch[1] ?? '').trim();
      continue;
    }
    if (rationaleStart) {
      flush();
      current = 'rationale';
      continue;
    }
    if (impactStart) {
      flush();
      current = 'impact_note';
      continue;
    }
    if (diffStart) {
      flush();
      current = 'diff_summary';
      continue;
    }

    if (current !== null) {
      buffer.push(line);
    }
  }
  flush();

  const hasMetadata =
    date.length > 0 &&
    author.length > 0 &&
    rationale.length > 0 &&
    impactNote.length > 0 &&
    reviewer.length > 0 &&
    linkedPr.length > 0;

  return {
    date,
    author,
    doc,
    riskTier,
    rationale,
    impactNote,
    reviewer,
    linkedPr,
    diffSummary,
    hasMetadata,
  };
}

function parseEntries(content: string): ParsedChangelogEntry[] {
  try {
    const lines = safeSplitLines(content);
    const starts = findEntryStarts(lines);
    if (starts.length === 0) return [];

    const entries: ParsedChangelogEntry[] = [];
    for (let i = 0; i < starts.length; i++) {
      const start = starts[i] ?? 0;
      const end = i + 1 < starts.length ? (starts[i + 1] ?? lines.length) : lines.length;
      const block = lines.slice(start, end);
      entries.push(parseEntryBlock(block));
    }
    return entries;
  } catch {
    return [];
  }
}

// ============================================================================
// VALIDATION
// ============================================================================

function pushIssue(
  issues: ValidationIssue[],
  entryIndex: number,
  field: ValidationIssue['field'],
  severity: ValidationIssue['severity'],
  reason: string,
): void {
  issues.push({ entryIndex, field, severity, reason });
}

function validateEntry(
  entry: ParsedChangelogEntry,
  index: number,
  issues: ValidationIssue[],
  downgradeErrorsToWarning: boolean,
): void {
  const errSev: ValidationIssue['severity'] = downgradeErrorsToWarning ? 'warning' : 'error';

  if (entry.date.length === 0) {
    pushIssue(issues, index, 'date', errSev, 'Missing or non-ISO date in entry header.');
  }
  if (entry.author.length === 0) {
    pushIssue(issues, index, 'author', errSev, 'Missing author in entry header.');
  }

  const rationaleTrim = entry.rationale.trim();
  if (rationaleTrim.length === 0) {
    pushIssue(issues, index, 'rationale', errSev, 'Rationale is missing.');
  } else if (BOILERPLATE_RATIONALE.test(rationaleTrim)) {
    pushIssue(
      issues,
      index,
      'rationale',
      errSev,
      'Rationale is boilerplate ("updated docs"); provide a substantive rationale.',
    );
  } else if (rationaleTrim.length < MIN_RATIONALE_CHARS) {
    pushIssue(
      issues,
      index,
      'rationale',
      errSev,
      `Rationale is too short (< ${MIN_RATIONALE_CHARS} chars).`,
    );
  }

  if (entry.impactNote.trim().length === 0) {
    pushIssue(issues, index, 'impact_note', errSev, 'Impact note is missing.');
  }

  if (entry.reviewer.trim().length === 0) {
    pushIssue(issues, index, 'reviewer', errSev, 'Reviewer is missing.');
  }

  if (entry.linkedPr.trim().length === 0) {
    pushIssue(issues, index, 'linked_pr', errSev, 'Linked PR / ticket is missing.');
  }

  if (entry.riskTier === null) {
    pushIssue(
      issues,
      index,
      'risk_tier',
      'warning',
      'Risk tier missing or invalid (expected P0, P1, or P2).',
    );
  }

  if (entry.diffSummary.length < 1) {
    pushIssue(
      issues,
      index,
      'diff_summary',
      'warning',
      'Diff summary has zero bullets; add at least one bullet.',
    );
  }
}

function computeVerdict(issues: ValidationIssue[]): 'PASS' | 'PASS_WITH_WARNINGS' | 'FAIL' {
  let hasError = false;
  let hasAny = false;
  for (const issue of issues) {
    hasAny = true;
    if (issue.severity === 'error') {
      hasError = true;
      break;
    }
  }
  if (hasError) return 'FAIL';
  if (hasAny) return 'PASS_WITH_WARNINGS';
  return 'PASS';
}

export function validateChangelogContent(
  content: string,
  filePath: string,
): ChangelogValidationReport {
  const safeFilePath = typeof filePath === 'string' ? filePath : '';
  const parsedAt = new Date().toISOString();

  let entries: ParsedChangelogEntry[] = [];
  try {
    entries = parseEntries(content);
  } catch {
    entries = [];
  }

  const issues: ValidationIssue[] = [];

  if (entries.length === 0) {
    pushIssue(
      issues,
      -1,
      'date',
      'error',
      'Changelog has zero entries; at least one entry is required per Documentation Change Control.',
    );
  } else {
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!entry) continue;
      const downgrade = i > 0;
      validateEntry(entry, i, issues, downgrade);
    }
  }

  return {
    filePath: safeFilePath,
    parsedAt,
    entries,
    issues,
    verdict: computeVerdict(issues),
  };
}

// ============================================================================
// OWNER REGISTRY PARSING
// ============================================================================

function stripBackticks(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('`') && trimmed.endsWith('`')) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export function parseOwnerRegistry(content: string): OwnerRegistryEntry[] {
  try {
    const lines = safeSplitLines(content);
    if (lines.length === 0) return [];

    let separatorIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = (lines[i] ?? '').trim();
      if (/^\|[\s\-:|]+\|$/.test(line)) {
        separatorIdx = i;
        break;
      }
    }
    if (separatorIdx < 0) return [];

    const result: OwnerRegistryEntry[] = [];
    for (let i = separatorIdx + 1; i < lines.length; i++) {
      const raw = (lines[i] ?? '').trim();
      if (raw.length === 0) continue;
      if (!raw.startsWith('|')) continue;

      const middle = raw.replace(/^\|/, '').replace(/\|$/, '');
      const cells = middle.split('|').map((c) => c.trim());
      if (cells.length < 4) continue;

      const docPath = stripBackticks(cells[0] ?? '');
      const ownerRole = (cells[1] ?? '').trim();
      const ownerName = (cells[2] ?? '').trim();
      const delegate = (cells[3] ?? '').trim();

      if (docPath.length === 0) continue;

      result.push({ docPath, ownerRole, ownerName, delegate });
    }
    return result;
  } catch {
    return [];
  }
}
