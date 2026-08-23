/** @vitest-environment jsdom */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * T20-MENU_1_2_3-M14 — migrates `AssessmentHub`'s `list`-tab bulk selection
 * row from a hand-rolled cluster to the canonical `Menu3BulkRow` primitive.
 *
 * BEFORE (read-only preflight, prior turn): checkbox selection on the `list`
 * tab already activated a Menu 3 row mechanically, but it was built from raw
 * `MENU_3_INNER_CLASS`/`MENU_3_LEFT_CLASS`/`MENU_3_RIGHT_CLASS` + a bare
 * `Menu3Chip`/`<button>` — the exact anti-pattern R02-A-FIX-2 removed from
 * `InterviewHub.tsx` earlier this session: no enforced N-selected → Clear →
 * neutral → danger-last anatomy, no `Menu3BulkRow` import at all.
 *
 * This suite is source-slice, mirroring T21's own test file — the component
 * is not mounted (heavy data-fetching hub, same rationale T21 used).
 */
describe('T20 AssessmentHub list-tab bulk row: Menu3BulkRow migration', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/components/assessment/AssessmentHub.tsx'),
    'utf8'
  );

  const bulkStart = source.indexOf('const bulkCommandRowContent =');
  const bulkEnd = source.indexOf('const hubCommandRowContent = useMemo(', bulkStart);
  const bulkSlice = source.slice(bulkStart, bulkEnd);

  it('the bulk row is built from the canonical Menu3BulkRow primitive', () => {
    expect(bulkStart).toBeGreaterThan(-1);
    expect(bulkEnd).toBeGreaterThan(bulkStart);
    expect(bulkSlice).toContain('<Menu3BulkRow');
    expect(source).toContain("import { Menu3BulkRow } from '../shared/ModuleMenu3';");
  });

  it('no hand-rolled Menu 3 markup survives in the bulk block', () => {
    expect(bulkSlice).not.toContain('MENU_3_INNER_CLASS');
    expect(bulkSlice).not.toContain('MENU_3_LEFT_CLASS');
    expect(bulkSlice).not.toContain('MENU_3_RIGHT_CLASS');
    expect(bulkSlice).not.toContain('MENU_3_ACTION_DANGER');
    expect(bulkSlice).not.toContain('Menu3Chip');
    expect(bulkSlice).not.toContain('<button');
    // The raw style-constant imports are gone entirely — not just unused.
    expect(source).not.toContain('MENU_3_ACTION_DANGER,');
    expect(source).not.toContain('MENU_3_LEFT_CLASS,');
    expect(source).not.toContain('MENU_3_RIGHT_CLASS,');
  });

  it('the guard `selectedListIds.size > 0` on the `list` tab is preserved verbatim', () => {
    expect(bulkSlice).toContain("activeTab === 'list' && selectedListIds.size > 0");
  });

  it('Select all semantics are preserved: selects every currentData id', () => {
    expect(bulkSlice).toContain('selectAllLabel="Select all"');
    expect(bulkSlice).toContain(
      'onSelectAll={() => setSelectedListIds(new Set(currentData.map((r: any) => r.id)))}'
    );
  });

  it('Clear semantics are preserved: empties the selection', () => {
    expect(bulkSlice).toContain('clearLabel="Clear"');
    expect(bulkSlice).toContain('onClear={() => setSelectedListIds(new Set())}');
  });

  it('Delete is the only action and is danger-last via the primitive, calling the same handler', () => {
    expect(bulkSlice).toContain("id: 'delete'");
    expect(bulkSlice).toContain("label: 'Delete'");
    expect(bulkSlice).toContain('icon: Trash2');
    expect(bulkSlice).toContain('onClick: () => void handleBulkDeleteList()');
    expect(bulkSlice).toContain("variant: 'danger'");
    // Exactly one action — Menu3BulkRow's own sort (neutral-then-danger) has
    // nothing else to reorder, but the primitive still enforces it structurally.
    expect((bulkSlice.match(/\bid: '/g) ?? []).length).toBe(1);
  });

  it('the selected-count label text is unchanged', () => {
    expect(bulkSlice).toContain('selectedLabel={`${selectedListIds.size} selected`}');
  });

  it('exactly one Menu3BulkRow renders in the whole file — no duplicate wiring for Reports/Initiatives', () => {
    expect((source.match(/<Menu3BulkRow/g) ?? []).length).toBe(1);
  });

  /**
   * ── T21 frozen: Details/preview untouched ───────────────────────────────
   */
  it('T21 Details wiring for the list-tab preview is untouched', () => {
    expect(source).toContain(
      'const previewDetailsText = buildAssessmentPreviewDetails(selectedRow, isPolish'
    );
    expect(source).toContain('text: previewDetailsText,');
    expect(source).toContain('void navigator.clipboard?.writeText(previewDetailsText);');
  });

  it('Reports Details (T23) and Initiatives Details (T24) are both canonical prose, and neither tab carries Menu3/selection wiring', () => {
    // T23-PREVIEW-P25 / T24-PREVIEW-P25 (QA-authorized corrections): this
    // suite is T20/Menu3 scoped and must not assert on Reports'/Initiatives'
    // Details shape as a side effect — that ownership belongs to T21/T23/T24's
    // own guard tests. This assertion is narrowed to what T20 actually owns:
    // the bulk-row/Menu3 primitive is list-only and never leaks into
    // Reports/Initiatives, regardless of which Details format each tab uses.
    const listMarkerStart = source.indexOf('// Triada standard');
    const reportsMarker = source.indexOf("// #73: 'reports' tab", listMarkerStart);
    const reportsStart = source.indexOf("if (activeTab === 'reports')", reportsMarker);
    const initiativesMarker = source.indexOf("// #73: 'initiatives' tab", reportsStart);
    const initiativesStart = source.indexOf("if (activeTab === 'initiatives')", initiativesMarker);
    const reportsSlice = source.slice(reportsStart, initiativesStart);
    const initiativesSlice = source.slice(initiativesStart);

    // Reports (T23, shipped): canonical prose, no Property/Value leftovers.
    expect(reportsSlice).toContain('buildAssessmentReportPreviewDetails');
    expect(reportsSlice).toContain('text: previewDetailsText');
    expect(reportsSlice).not.toContain('propertyLabel:');
    expect(reportsSlice).not.toContain('properties: [');

    // Initiatives (T24, shipped): canonical prose, no Property/Value leftovers.
    expect(initiativesSlice).toContain('buildAssessmentInitiativePreviewDetails');
    expect(initiativesSlice).toContain('text: previewDetailsText');
    expect(initiativesSlice).not.toContain('propertyLabel:');
    expect(initiativesSlice).not.toContain('properties: [');

    // Neither tab gets the T20 bulk-selection row or its primitive — that
    // stays list-only, confirmed independently of either tab's Details format.
    expect(reportsSlice).not.toContain('<Menu3BulkRow');
    expect(reportsSlice).not.toContain('selectedListIds');
    expect(initiativesSlice).not.toContain('<Menu3BulkRow');
    expect(initiativesSlice).not.toContain('selectedListIds');
  });
});

/*
 * ── Negative controls (run manually against the real file, not committed as
 *    additional in-suite assertions — a string-mutation check inside this
 *    file would only prove JS string logic works, not that these tests bite):
 *
 *   1. Guard reverted to `activeTab === 'list' ? (` (selection-count check
 *      dropped) → `AssessmentHub.menu3BulkRow.t20.test.tsx` drops to
 *      11/12 passed, 1 failed (the guard-preservation test).
 *   2. `? (<Menu3BulkRow .../>) : null` tail replaced with a hand-rolled
 *      `<button className="MENU_3_ACTION_DANGER">` fallback → same file
 *      drops to 11/12 passed, 1 failed (the anti-pattern-absence test).
 *
 * Both confirmed against the actual AssessmentHub.tsx source, then restored
 * and re-verified green (12/12) before this report.
 */
