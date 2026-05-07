/**
 * Unit tests for `docChangeControlValidatorService` — Epic L3 closure.
 *
 * The validator is pure logic (no I/O, never throws). These tests cover:
 *
 *   1. The "zero entries" edge case.
 *   2. The happy-path PASS verdict.
 *   3. Each individual missing-field error.
 *   4. The boilerplate-rationale rule.
 *   5. The risk-tier and diff-summary warnings (not errors).
 *   6. The "older entries warn-only" downgrade rule.
 *   7. Owner-registry parsing (happy path + malformed table).
 *   8. JSON-serializability and never-throws behavior.
 */

import { describe, expect, it } from 'vitest';

import {
  type ChangelogValidationReport,
  parseOwnerRegistry,
  validateChangelogContent,
  type ValidationIssue,
} from '../docChangeControlValidatorService.js';

const FILE_PATH = 'docs/governance/CHANGELOG_TEST.md';

const FULL_RATIONALE =
  'Closing Epic L3 by introducing change control for all controlled docs to prevent silent drift.';

function buildEntry(
  overrides: Partial<{
    date: string;
    author: string;
    doc: string;
    riskTier: string;
    rationale: string;
    impactNote: string;
    reviewer: string;
    linkedPr: string;
    diffSummary: string[];
  }> = {}
): string {
  const date = overrides.date ?? '2026-05-07';
  const author = overrides.author ?? 'Sprint 14 (L3)';
  const doc = overrides.doc ?? 'docs/product/PRESENTATION_RBAC_MATRIX.md';
  const riskTier = overrides.riskTier ?? 'P1';
  const rationale = overrides.rationale ?? FULL_RATIONALE;
  const impactNote =
    overrides.impactNote ??
    `- Code: none\n- Docs: parent policy doc\n- Tests: validator unit tests`;
  const reviewer = overrides.reviewer ?? '<Security Lead> (Security owner)';
  const linkedPr = overrides.linkedPr ?? 'Sprint 14 — Epic L3';
  const diffBullets =
    overrides.diffSummary !== undefined
      ? overrides.diffSummary
      : ['Initial changelog created.', 'No product-doc edits.'];

  const lines: string[] = [];
  lines.push(`## ${date} — ${author}`);
  lines.push('');
  if (doc.length > 0) lines.push(`**Doc:** ${doc}`);
  if (riskTier.length > 0) lines.push(`**Risk tier:** ${riskTier}`);
  if (rationale.length > 0) {
    lines.push(`**Rationale:**`);
    lines.push(rationale);
    lines.push('');
  }
  if (impactNote.length > 0) {
    lines.push(`**Impact note:**`);
    lines.push(impactNote);
    lines.push('');
  }
  if (reviewer.length > 0) lines.push(`**Reviewer:** ${reviewer}`);
  if (linkedPr.length > 0) lines.push(`**Linked PR / ticket:** ${linkedPr}`);
  lines.push('');
  if (diffBullets.length > 0) {
    lines.push(`**Diff summary:**`);
    for (const b of diffBullets) lines.push(`- ${b}`);
  } else {
    lines.push(`**Diff summary:**`);
  }
  return lines.join('\n');
}

function buildChangelog(entryBlocks: string[]): string {
  const header = `# Changelog — TEST.md\n\nThis file tracks all changes to \`docs/test.md\`.\n\n---\n\n`;
  return header + entryBlocks.join('\n\n---\n\n') + '\n';
}

function findIssues(
  report: ChangelogValidationReport,
  field: ValidationIssue['field']
): ValidationIssue[] {
  return report.issues.filter((i) => i.field === field);
}

describe('validateChangelogContent', () => {
  // 1
  it('empty content fails with exactly one error', () => {
    const report = validateChangelogContent('', FILE_PATH);
    expect(report.entries).toEqual([]);
    expect(report.verdict).toBe('FAIL');
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0]?.severity).toBe('error');
    expect(report.issues[0]?.entryIndex).toBe(-1);
    expect(report.filePath).toBe(FILE_PATH);
    expect(typeof report.parsedAt).toBe('string');
  });

  // 2
  it('a single fully-populated entry passes with no issues', () => {
    const content = buildChangelog([buildEntry()]);
    const report = validateChangelogContent(content, FILE_PATH);
    expect(report.verdict).toBe('PASS');
    expect(report.issues).toEqual([]);
    expect(report.entries).toHaveLength(1);
    const entry = report.entries[0];
    expect(entry?.date).toBe('2026-05-07');
    expect(entry?.author).toBe('Sprint 14 (L3)');
    expect(entry?.riskTier).toBe('P1');
    expect(entry?.diffSummary).toHaveLength(2);
    expect(entry?.hasMetadata).toBe(true);
  });

  // 3
  it('missing rationale produces an error on the rationale field', () => {
    const content = buildChangelog([buildEntry({ rationale: '' })]);
    const report = validateChangelogContent(content, FILE_PATH);
    expect(report.verdict).toBe('FAIL');
    const rationaleIssues = findIssues(report, 'rationale');
    expect(rationaleIssues).toHaveLength(1);
    expect(rationaleIssues[0]?.severity).toBe('error');
  });

  // 4
  it('boilerplate "updated docs" rationale is rejected even if not empty', () => {
    const content = buildChangelog([buildEntry({ rationale: 'updated docs' })]);
    const report = validateChangelogContent(content, FILE_PATH);
    expect(report.verdict).toBe('FAIL');
    const rationaleIssues = findIssues(report, 'rationale');
    expect(rationaleIssues).toHaveLength(1);
    expect(rationaleIssues[0]?.severity).toBe('error');
    expect(rationaleIssues[0]?.reason.toLowerCase()).toContain('boilerplate');
  });

  // 4b — case-insensitive boilerplate match (parity with policy regex).
  it('boilerplate rationale is matched case-insensitively', () => {
    const content = buildChangelog([buildEntry({ rationale: 'Updated Doc.' })]);
    const report = validateChangelogContent(content, FILE_PATH);
    expect(report.verdict).toBe('FAIL');
    expect(findIssues(report, 'rationale')).toHaveLength(1);
  });

  // 5
  it('missing impact note produces an error on the impact_note field', () => {
    const content = buildChangelog([buildEntry({ impactNote: '' })]);
    const report = validateChangelogContent(content, FILE_PATH);
    expect(report.verdict).toBe('FAIL');
    const issues = findIssues(report, 'impact_note');
    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe('error');
  });

  // 6
  it('missing reviewer produces an error on the reviewer field', () => {
    const content = buildChangelog([buildEntry({ reviewer: '' })]);
    const report = validateChangelogContent(content, FILE_PATH);
    expect(report.verdict).toBe('FAIL');
    const issues = findIssues(report, 'reviewer');
    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe('error');
  });

  // 7
  it('missing linked PR / ticket produces an error on the linked_pr field', () => {
    const content = buildChangelog([buildEntry({ linkedPr: '' })]);
    const report = validateChangelogContent(content, FILE_PATH);
    expect(report.verdict).toBe('FAIL');
    const issues = findIssues(report, 'linked_pr');
    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe('error');
  });

  // 8
  it('missing risk tier downgrades to PASS_WITH_WARNINGS, not FAIL', () => {
    const content = buildChangelog([buildEntry({ riskTier: '' })]);
    const report = validateChangelogContent(content, FILE_PATH);
    expect(report.verdict).toBe('PASS_WITH_WARNINGS');
    const issues = findIssues(report, 'risk_tier');
    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe('warning');
  });

  // 9
  it('empty diff summary is a warning, not an error', () => {
    const content = buildChangelog([buildEntry({ diffSummary: [] })]);
    const report = validateChangelogContent(content, FILE_PATH);
    expect(report.verdict).toBe('PASS_WITH_WARNINGS');
    const issues = findIssues(report, 'diff_summary');
    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe('warning');
  });

  // 10
  it('only the latest entry is checked strictly; older entries are warn-only', () => {
    const latest = buildEntry({
      date: '2026-05-07',
      author: 'Sprint 14 (L3)',
    });
    const oldBroken = buildEntry({
      date: '2024-01-01',
      author: 'Legacy author',
      rationale: '',
      impactNote: '',
      reviewer: '',
      linkedPr: '',
    });
    const content = buildChangelog([latest, oldBroken]);
    const report = validateChangelogContent(content, FILE_PATH);

    expect(report.entries).toHaveLength(2);
    const latestIssues = report.issues.filter((i) => i.entryIndex === 0);
    const olderIssues = report.issues.filter((i) => i.entryIndex === 1);

    expect(latestIssues).toEqual([]);
    expect(olderIssues.length).toBeGreaterThan(0);
    for (const issue of olderIssues) {
      expect(issue.severity).toBe('warning');
    }
    expect(report.verdict).toBe('PASS_WITH_WARNINGS');
  });

  // 11 — happy path for owner registry parsing.
  it('parses a well-formed owner registry table', () => {
    const content = `# Doc Owner Registry\n\n| Doc | Owner role | Named owner | Delegate |\n| --- | --- | --- | --- |\n| \`docs/product/A.md\` | Product | <Product Lead> | <PD Delegate> |\n| \`docs/product/B.md\` | Ops | <Ops Lead> | <Ops Delegate> |\n`;
    const rows = parseOwnerRegistry(content);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      docPath: 'docs/product/A.md',
      ownerRole: 'Product',
      ownerName: '<Product Lead>',
      delegate: '<PD Delegate>',
    });
    expect(rows[1]?.docPath).toBe('docs/product/B.md');
    expect(rows[1]?.ownerRole).toBe('Ops');
  });

  // 12 — malformed table: returns empty array, no throw.
  it('returns an empty array for a malformed owner registry, never throwing', () => {
    const malformed = `# Header without a table\n\nJust prose, no pipes here at all.\n`;
    expect(() => parseOwnerRegistry(malformed)).not.toThrow();
    expect(parseOwnerRegistry(malformed)).toEqual([]);

    const truncated = `| Doc | Owner |\n`;
    expect(parseOwnerRegistry(truncated)).toEqual([]);

    expect(parseOwnerRegistry('')).toEqual([]);
  });

  // 13 — JSON-serializable.
  it('the validation report is JSON-serializable', () => {
    const content = buildChangelog([buildEntry()]);
    const report = validateChangelogContent(content, FILE_PATH);
    const roundTrip: unknown = JSON.parse(JSON.stringify(report));
    expect(roundTrip).toEqual(report);
  });

  // 14 — never throws on malformed Markdown.
  it('never throws on garbage / malformed Markdown', () => {
    const inputs = [
      '## not a date — author\nrandom text',
      '## 9999-99-99 — bad date\n**Rationale:**\nshort',
      '\u0000\u0001\u0002 binary garbage',
      '## 2026-05-07 — Author\n**Rationale:**',
      '##',
      '###### nested headings only',
      '# title\n\n## 2026-05-07 — A\n**Risk tier:** WAT\n**Reviewer:** \n',
    ];
    for (const input of inputs) {
      expect(() => validateChangelogContent(input, FILE_PATH)).not.toThrow();
      const report = validateChangelogContent(input, FILE_PATH);
      expect(['PASS', 'PASS_WITH_WARNINGS', 'FAIL']).toContain(report.verdict);
    }
  });

  // 15 — extra: starter changelog seed shape (sanity for real-world fixture).
  it('the starter-changelog seed produced by L3 closure passes', () => {
    const seed = `# Changelog — PRESENTATION_RBAC_MATRIX.md

This file tracks all changes to \`docs/product/PRESENTATION_RBAC_MATRIX.md\`.

---

## 2026-05-07 — Sprint 14 (L3)

**Doc:** docs/product/PRESENTATION_RBAC_MATRIX.md
**Risk tier:** P1
**Rationale:**
Created by closing Epic L3 (documentation change control). All controlled docs now have changelogs to enforce auditable change history per the standard.

**Impact note:**
- Code: none (governance scaffold only)
- Docs: parent policy at DOCUMENTATION_CHANGE_CONTROL.md
- Tests: docChangeControlValidatorService unit tests

**Reviewer:** <Security Lead> (Security owner)
**Linked PR / ticket:** Sprint 14 — Epic L3

**Diff summary:**
- Initial changelog created.
- No product-doc edits.
`;
    const report = validateChangelogContent(seed, FILE_PATH);
    expect(report.verdict).toBe('PASS');
    expect(report.entries).toHaveLength(1);
    expect(report.entries[0]?.riskTier).toBe('P1');
    expect(report.entries[0]?.diffSummary.length).toBeGreaterThanOrEqual(1);
  });
});
