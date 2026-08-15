/** @vitest-environment jsdom */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * T20-KEBAB-K10 — `AssessmentHub`'s `list`-tab row kebab menu (`rowMenu` prop,
 * consumed by `StandardTable.buildSections`) used to duplicate the visible
 * "Open" action: `primary`'s `open` item and `universalHandlers.edit` both
 * called the identical `handleOpenDocument(row as any)` handler — two menu
 * labels ("Open" in the context section, "Edit" in the manage section) doing
 * the exact same thing, since assessments have no edit mode distinct from
 * opening the editor.
 *
 * Fix: `edit` is omitted (not replaced with a different handler — there is no
 * genuinely separate edit capability to give it). `primary`'s `open` and
 * `universalHandlers.preview` are untouched.
 *
 * Source-slice, mirroring T20-M14/T21's own test files — the component is not
 * mounted (heavy data-fetching hub, same rationale those suites used).
 */
describe('T20 AssessmentHub list-tab rowMenu: Open/Edit duplication removed', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/components/assessment/AssessmentHub.tsx'),
    'utf8'
  );

  const rowMenuStart = source.indexOf("rowMenu={(row): StandardRowMenu => ({");
  const rowMenuEnd = source.indexOf('})}', rowMenuStart) + '})}'.length;
  const rowMenuSlice = source.slice(rowMenuStart, rowMenuEnd);

  it('locates the list-tab rowMenu block', () => {
    expect(rowMenuStart).toBeGreaterThan(-1);
    expect(rowMenuEnd).toBeGreaterThan(rowMenuStart);
  });

  it('no "Start" label exists anywhere in the rowMenu block', () => {
    expect(rowMenuSlice).not.toMatch(/label:\s*['"`]Start/i);
    expect(rowMenuSlice).not.toContain("'Start'");
  });

  it('exactly one action in the block navigates via handleOpenDocument — the duplicate is gone', () => {
    const openNavigations = rowMenuSlice.match(/handleOpenDocument\(row as any\)/g) ?? [];
    expect(openNavigations).toHaveLength(1);
    // And it belongs to primary's `open`, not to `universalHandlers.edit`.
    expect(rowMenuSlice).toContain("id: 'open'");
    expect(rowMenuSlice).toContain('onClick: () => handleOpenDocument(row as any)');
    expect(rowMenuSlice).not.toContain('edit: () => handleOpenDocument(row as any)');
    expect(rowMenuSlice).not.toContain('edit:');
  });

  it('Open preview is present, canonically wired via universalHandlers.preview', () => {
    expect(rowMenuSlice).toContain('universalHandlers: {');
    expect(rowMenuSlice).toContain(
      'preview: () => setSelectedAssessmentId(String((row as any).id)),'
    );
  });

  it('primary Open, Duplicate, and destructive Delete are untouched', () => {
    expect(rowMenuSlice).toContain("label: t('common.open', 'Open')");
    expect(rowMenuSlice).toContain("id: 'duplicate'");
    expect(rowMenuSlice).toContain("onClick: () => void handleRowAction('duplicate', row as any)");
    expect(rowMenuSlice).toContain("onClick: () => void handleRowAction('delete', row as any)");
  });

  it('T20-M14 canonical bulk-row wiring remains present', () => {
    expect(source).toContain('<Menu3BulkRow');
  });
});

/*
 * ── Negative control ─────────────────────────────────────────────────────
 * Run manually against the real file (not committed as an additional
 * in-suite assertion — a string-mutation check inside this file would only
 * prove JS string logic works, not that these tests bite):
 *
 *   Reintroducing `edit: () => handleOpenDocument(row as any),` right after
 *   the `preview:` line inside `universalHandlers` → this suite drops to
 *   5/6 passed, 1 failed (the "exactly one Open-navigating action" test:
 *   `openNavigations` becomes length 2, and `not.toContain('edit: () =>
 *   handleOpenDocument(row as any)')` fails).
 *
 * Confirmed against the actual AssessmentHub.tsx source, then restored and
 * re-verified green (6/6) before this report.
 */
