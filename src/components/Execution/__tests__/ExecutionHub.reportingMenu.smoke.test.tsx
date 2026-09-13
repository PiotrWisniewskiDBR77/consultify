/**
 * @vitest-environment node
 *
 * Regression guard for the Execution → Reporting row-menu declaration.
 * StandardTable uses the same composed sections for kebab and context menu,
 * so keeping one declaration here preserves their parity.
 *
 * The guard points at ExecutionReportsSurface: it is the component the
 * 'reports' tab actually renders. The former ExecutionHub-internal report
 * catalog (renderReportsCatalog + buildReportRowMenu) sat behind an earlier
 * unconditional `return <ExecutionReportsSurface />` and was unreachable, so
 * it was deleted together with this guard's old anchor.
 */

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const reportsSurfaceSource = readFileSync(
  new URL('../ExecutionReportsSurface.tsx', import.meta.url),
  'utf8'
);

describe('ExecutionReportsSurface row menus', () => {
  it('declares one context Open per table and delegates preview to the manage block', () => {
    // No hand-rolled preview entry — StandardTable composes block 4 itself.
    expect(reportsSurfaceSource).not.toContain("id: 'open_preview'");
    expect(reportsSurfaceSource).not.toContain("id: 'open-preview'");

    const rowMenus = reportsSurfaceSource.match(/rowMenu=\{\([^)]*\) => \(\{[\s\S]*?\}\)\}/g) ?? [];
    // Definitions register + Runs register.
    expect(rowMenus).toHaveLength(2);

    for (const menu of rowMenus) {
      expect(menu.match(/id: '[^']+'/g)).toHaveLength(1);
      expect(menu.match(/universalHandlers: \{ preview: \(\) =>/g)).toHaveLength(1);
    }
  });

  it('the Execution hub no longer carries its own report catalog kebab', () => {
    const executionHubSource = readFileSync(new URL('../ExecutionHub.tsx', import.meta.url), 'utf8');
    expect(executionHubSource).not.toContain('buildReportRowMenu');
    expect(executionHubSource).not.toContain('renderReportsCatalog');
    expect(executionHubSource).toContain('<ExecutionReportsSurface');
  });
});
