/**
 * Unit tests for `docChangelogParityService` — Sprint 16 closure of the
 * Sprint 15 (L3) "doc-vs-changelog parity" future-work item.
 *
 * The service is pure logic (no I/O, never throws). These tests cover:
 *
 *   1. `summarizeDocDiff` first-commit / null-baseline behavior.
 *   2. Whitespace-only diffs are not meaningful.
 *   3. Real prose diffs are meaningful.
 *   4. `expectedChangelogPath` happy-path mapping.
 *   5. Doc changed without a corresponding changelog entry → ERROR.
 *   6. Doc changed AND changelog updated today → PASS.
 *   7. Doc unchanged but changelog added today → WARNING.
 *   8. Empty changelog → `changelog_missing` ERROR.
 *   9. Result is JSON-serializable (no functions / Date / Symbol).
 *  10. Service NEVER throws even on garbage input.
 *  11. `compareDocVsChangelog` returns PASS when no issues.
 *  12. Verdict is FAIL whenever any error issue is present.
 *  13. Verdict is PASS_WITH_WARNINGS when only warnings are present.
 *  14. Comment-only diffs (HTML comments) are not meaningful.
 *  15. Markdown link target-only changes are not meaningful.
 *  16. `extractLatestChangelogDate` reads the top-most entry header.
 */

import { describe, expect, it } from 'vitest';

import {
  compareDocVsChangelog,
  expectedChangelogPath,
  extractLatestChangelogDate,
  type ParityCheckInput,
  summarizeDocDiff,
} from '../docChangelogParityService.js';

const DOC_PATH = 'docs/product/PRESENTATION_RBAC_MATRIX.md';
const CHANGELOG_PATH = 'docs/governance/CHANGELOG_PRESENTATION_RBAC_MATRIX.md';

const TODAY = new Date().toISOString().slice(0, 10);
const YESTERDAY = (() => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
})();

const SAMPLE_CHANGELOG = (date: string): string =>
  `# Changelog — PRESENTATION_RBAC_MATRIX.md\n\n---\n\n## ${date} — Test Author\n\n**Doc:** ${DOC_PATH}\n**Risk tier:** P1\n**Rationale:**\nA real and substantive rationale for the test fixture.\n\n**Impact note:**\n- Code: none\n- Docs: none\n- Tests: parity tests\n\n**Reviewer:** <Security Lead>\n**Linked PR / ticket:** TEST-1\n\n**Diff summary:**\n- Test fixture entry.\n`;

const DOC_BEFORE = `# RBAC Matrix\n\nRoles and permissions per artifact.\n\n## Roles\n\n- viewer\n- editor\n- owner\n`;

const DOC_AFTER_REAL_CHANGE = `# RBAC Matrix\n\nRoles and permissions per artifact.\n\n## Roles\n\n- viewer\n- editor\n- owner\n- admin\n\n## Notes\n\nAdmins may bypass review gates only with CTO sign-off.\n`;

function buildInput(overrides: Partial<ParityCheckInput> = {}): ParityCheckInput {
  return {
    docPath: overrides.docPath ?? DOC_PATH,
    changelogPath: overrides.changelogPath ?? CHANGELOG_PATH,
    docContent: overrides.docContent ?? DOC_AFTER_REAL_CHANGE,
    docContentAtChangelog:
      overrides.docContentAtChangelog === undefined ? DOC_BEFORE : overrides.docContentAtChangelog,
    changelogContent: overrides.changelogContent ?? SAMPLE_CHANGELOG(TODAY),
    changelogLastEntryDate:
      overrides.changelogLastEntryDate === undefined ? TODAY : overrides.changelogLastEntryDate,
  };
}

// ============================================================================
// summarizeDocDiff
// ============================================================================

describe('summarizeDocDiff', () => {
  // 1
  it('first commit (null baseline) → meaningful=true', () => {
    const out = summarizeDocDiff(null, '# anything\n');
    expect(out.meaningfulChange).toBe(true);
    expect(out.addedLines).toBe(0);
    expect(out.removedLines).toBe(0);
  });

  // 2
  it('whitespace-only diff → meaningful=false', () => {
    const before = '# Title\n\nA paragraph of body text.\n';
    const after = '# Title  \n\n   A paragraph of body text.   \n\n';
    const out = summarizeDocDiff(before, after);
    expect(out.meaningfulChange).toBe(false);
    expect(out.addedLines).toBe(0);
    expect(out.removedLines).toBe(0);
  });

  // 3
  it('real prose diff → meaningful=true with positive added counts', () => {
    const out = summarizeDocDiff(DOC_BEFORE, DOC_AFTER_REAL_CHANGE);
    expect(out.meaningfulChange).toBe(true);
    expect(out.addedLines).toBeGreaterThan(0);
  });

  // 14
  it('comment-only diff (HTML comments) → meaningful=false', () => {
    const before = '# Title\n\nBody.\n';
    const after = '# Title\n\n<!-- TODO: revisit later -->\nBody.\n';
    const out = summarizeDocDiff(before, after);
    expect(out.meaningfulChange).toBe(false);
  });

  // 15
  it('markdown link target-only change → meaningful=false', () => {
    const before = '# Title\n\nSee [the runbook](https://example.com/v1).\n';
    const after = '# Title\n\nSee [the runbook](https://example.com/v2).\n';
    const out = summarizeDocDiff(before, after);
    expect(out.meaningfulChange).toBe(false);
  });
});

// ============================================================================
// expectedChangelogPath
// ============================================================================

describe('expectedChangelogPath', () => {
  // 4
  it('maps docs/foo/MY_DOC.md to <dir>/CHANGELOG_MY_DOC.md', () => {
    expect(
      expectedChangelogPath('docs/product/PRESENTATION_RBAC_MATRIX.md', 'docs/governance')
    ).toBe('docs/governance/CHANGELOG_PRESENTATION_RBAC_MATRIX.md');
  });

  it('handles trailing slash on changelogDir', () => {
    expect(expectedChangelogPath('docs/foo/BAR.md', 'docs/governance/')).toBe(
      'docs/governance/CHANGELOG_BAR.md'
    );
  });

  it('handles a doc path with no directory', () => {
    expect(expectedChangelogPath('BAR.md', 'docs/governance')).toBe(
      'docs/governance/CHANGELOG_BAR.md'
    );
  });
});

// ============================================================================
// extractLatestChangelogDate
// ============================================================================

describe('extractLatestChangelogDate', () => {
  // 16
  it('returns the topmost YYYY-MM-DD entry header', () => {
    const content =
      '# Changelog\n\n---\n\n## 2026-05-07 — Foo\n\nBody.\n\n---\n\n## 2026-04-01 — Bar\n\nBody.\n';
    expect(extractLatestChangelogDate(content)).toBe('2026-05-07');
  });

  it('returns null when no parseable entry exists', () => {
    expect(extractLatestChangelogDate('# Just a title\n\nNo entries yet.\n')).toBeNull();
  });

  it('returns null on empty input', () => {
    expect(extractLatestChangelogDate('')).toBeNull();
  });
});

// ============================================================================
// compareDocVsChangelog
// ============================================================================

describe('compareDocVsChangelog', () => {
  // 5
  it('doc changed without a fresh changelog entry → ERROR (FAIL verdict)', () => {
    const result = compareDocVsChangelog(
      buildInput({
        changelogContent: SAMPLE_CHANGELOG(YESTERDAY),
        changelogLastEntryDate: YESTERDAY,
      })
    );
    expect(result.verdict).toBe('FAIL');
    expect(result.issues.some((i) => i.field === 'doc_changed_without_changelog')).toBe(true);
  });

  // 6
  it('doc changed AND changelog updated today → PASS', () => {
    const result = compareDocVsChangelog(buildInput());
    expect(result.verdict).toBe('PASS');
    expect(result.issues).toHaveLength(0);
  });

  // 7
  it('doc unchanged but changelog added today → WARNING (PASS_WITH_WARNINGS)', () => {
    const result = compareDocVsChangelog(
      buildInput({
        docContent: DOC_BEFORE,
        docContentAtChangelog: DOC_BEFORE,
      })
    );
    expect(result.verdict).toBe('PASS_WITH_WARNINGS');
    expect(result.issues.some((i) => i.field === 'doc_unchanged_with_changelog')).toBe(true);
    expect(result.issues.every((i) => i.severity === 'warning')).toBe(true);
  });

  // 8
  it('empty changelog → changelog_missing ERROR', () => {
    const result = compareDocVsChangelog(
      buildInput({ changelogContent: '', changelogLastEntryDate: null })
    );
    expect(result.verdict).toBe('FAIL');
    expect(result.issues.some((i) => i.field === 'changelog_missing')).toBe(true);
  });

  it('empty doc → doc_missing ERROR', () => {
    const result = compareDocVsChangelog(buildInput({ docContent: '' }));
    expect(result.verdict).toBe('FAIL');
    expect(result.issues.some((i) => i.field === 'doc_missing')).toBe(true);
  });

  // 9
  it('result is JSON-serializable', () => {
    const result = compareDocVsChangelog(buildInput());
    const json = JSON.stringify(result);
    const parsed = JSON.parse(json);
    expect(parsed.docPath).toBe(DOC_PATH);
    expect(parsed.changelogPath).toBe(CHANGELOG_PATH);
    expect(Array.isArray(parsed.issues)).toBe(true);
    expect(['PASS', 'PASS_WITH_WARNINGS', 'FAIL']).toContain(parsed.verdict);
  });

  // 10
  it('never throws on garbage input', () => {
    expect(() =>
      compareDocVsChangelog({
        docPath: undefined as unknown as string,
        changelogPath: undefined as unknown as string,
        docContent: undefined as unknown as string,
        docContentAtChangelog: undefined as unknown as string | null,
        changelogContent: undefined as unknown as string,
        changelogLastEntryDate: undefined as unknown as string | null,
      })
    ).not.toThrow();

    expect(() => compareDocVsChangelog(null as unknown as ParityCheckInput)).not.toThrow();

    expect(() =>
      compareDocVsChangelog({
        docPath: 12345 as unknown as string,
        changelogPath: { foo: 'bar' } as unknown as string,
        docContent: ['array'] as unknown as string,
        docContentAtChangelog: 0 as unknown as string | null,
        changelogContent: false as unknown as string,
        changelogLastEntryDate: 999 as unknown as string | null,
      })
    ).not.toThrow();
  });

  // 11
  it('PASS verdict when no issues are produced', () => {
    const result = compareDocVsChangelog(buildInput());
    expect(result.verdict).toBe('PASS');
  });

  // 12
  it('FAIL verdict whenever any error issue is present', () => {
    const result = compareDocVsChangelog(
      buildInput({ changelogContent: '', changelogLastEntryDate: null })
    );
    expect(result.issues.some((i) => i.severity === 'error')).toBe(true);
    expect(result.verdict).toBe('FAIL');
  });

  // 13
  it('PASS_WITH_WARNINGS when only warning issues are present', () => {
    const result = compareDocVsChangelog(
      buildInput({
        docContent: DOC_BEFORE,
        docContentAtChangelog: DOC_BEFORE,
      })
    );
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues.every((i) => i.severity === 'warning')).toBe(true);
    expect(result.verdict).toBe('PASS_WITH_WARNINGS');
  });

  it('null docContentAtChangelog (first-run / git unavailable) flags meaningful change', () => {
    const result = compareDocVsChangelog(
      buildInput({
        docContentAtChangelog: null,
        changelogContent: SAMPLE_CHANGELOG(YESTERDAY),
        changelogLastEntryDate: YESTERDAY,
      })
    );
    expect(result.verdict).toBe('FAIL');
    expect(result.issues.some((i) => i.field === 'doc_changed_without_changelog')).toBe(true);
  });

  it('malformed changelogLastEntryDate emits a warning but does not throw', () => {
    const result = compareDocVsChangelog(
      buildInput({
        docContent: DOC_BEFORE,
        docContentAtChangelog: DOC_BEFORE,
        changelogLastEntryDate: 'not-a-date',
      })
    );
    expect(result.issues.some((i) => i.field === 'changelog_invalid')).toBe(true);
    expect(result.verdict).not.toBe('FAIL');
  });
});
