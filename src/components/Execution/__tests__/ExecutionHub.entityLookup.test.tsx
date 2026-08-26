/**
 * @vitest-environment node
 *
 * DEC-120 A2b — onOpenEntity used to ignore `entityType` entirely and open
 * the initiative side panel with a fabricated `{ id, name: id }` object, so
 * e.g. clicking a risk or a decision opened an "initiative" literally named
 * after its raw UUID. ExecutionHub is too heavy to mount in a unit test
 * (thousands of lines, large dependency graph — see the sibling
 * ExecutionHub.reportingMenu.smoke.test.tsx for the same source-regression
 * approach), so this locks the fix at the source level: a real lookup by
 * type + id, and an honest toast for anything that isn't found or isn't an
 * initiative.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const executionHubSource = readFileSync(new URL('../ExecutionHub.tsx', import.meta.url), 'utf8');

describe('ExecutionHub onOpenEntity — real lookup, not a fabricated panel (DEC-120 A2b)', () => {
  it('no longer fabricates a fake initiative from a raw id', () => {
    expect(executionHubSource).not.toContain('{ id, name: id } as any');
  });

  it('defines a real openEntityById lookup that both onOpenEntity call sites use', () => {
    expect(executionHubSource).toContain('const openEntityById = useCallback(');
    // ExecutionSummaryOneLook and ExecutionManagementView both wire onOpenEntity
    // to the same real lookup instead of separate inline fabrications.
    expect(executionHubSource.match(/onOpenEntity=\{openEntityById\}/g)).toHaveLength(2);
  });

  it('openEntityById looks up the real initiative by id and never opens an unsupported type', () => {
    const start = executionHubSource.indexOf('const openEntityById = useCallback(');
    const end = executionHubSource.indexOf('const handleCloseDocument', start);
    const fn = executionHubSource.slice(start, end);

    // Real lookup against the loaded initiatives, not a fabricated object.
    expect(fn).toContain('.find((i) => i.id === entityId)');
    expect(fn).toContain('handleOpenSidePanel(found');

    // Unsupported / not-found paths never call handleOpenSidePanel and
    // instead show a toast — same function used for both branches.
    const unsupportedBranch = fn.slice(fn.indexOf('toast.error('));
    expect(unsupportedBranch).not.toContain('handleOpenSidePanel(');
    expect(fn.match(/toast\.error\(/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
