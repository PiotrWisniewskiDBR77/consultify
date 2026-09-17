/**
 * @vitest-environment node
 *
 * OP-1/W101: Assessment → Insights "Session record" must open the live
 * AssessmentSessionEditorView by row click and by the preview/menu action. A
 * row without a live sessionId must not get a dead "Open session" action.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../AssessmentOutputsTab.tsx', import.meta.url), 'utf8');

describe('AssessmentOutputsTab — live session opening contract', () => {
  it('builds the canonical assessment editor path from sessionId and method pack', () => {
    expect(source).toContain('function sessionEditorPath');
    expect(source).toContain('`/assessment/${frameworkPathForMethodPack(row.methodPackId)}/${encodeURIComponent(sessionId)}`');
  });

  it('row click navigates to the session editor before falling back to preview', () => {
    const rowClick = source.slice(source.indexOf('onRowClick={(row) => {'), source.indexOf('rowMenu={rowMenu}'));
    expect(rowClick).toContain('const sessionPath = sessionEditorPath(row as OutputRow);');
    expect(rowClick).toContain('navigate(sessionPath);');
    expect(rowClick.indexOf('navigate(sessionPath);')).toBeLessThan(rowClick.indexOf('jedenPanel.otworz();'));
  });

  it('menu and preview expose Open session only when sessionEditorPath exists', () => {
    expect(source).toContain("id: 'open-session'");
    expect(source).toContain("label: t('assessment.outputs.rowMenu.openSession', 'Open session')");
    expect(source).toContain('if (sessionPath) {');
  });
});
