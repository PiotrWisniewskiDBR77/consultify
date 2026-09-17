/**
 * @vitest-environment node
 *
 * OP-1/W205: Assessment → Insights row click must keep opening the frozen
 * Output preview; the live AssessmentSessionEditorView is exposed only as an
 * additional preview/menu action when a canonical session editor path exists.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../AssessmentOutputsTab.tsx', import.meta.url), 'utf8');

describe('AssessmentOutputsTab — live session opening contract', () => {
  it('builds the canonical assessment editor path from sessionId and method pack', () => {
    expect(source).toContain('function sessionEditorPath');
    expect(source).toContain('`/assessment/${frameworkPathForMethodPack(row.methodPackId)}/${encodeURIComponent(sessionId)}`');
  });

  it('row click opens the frozen Output preview and does not navigate to the session editor', () => {
    const rowClick = source.slice(source.indexOf('onRowClick={(row) => {'), source.indexOf('rowMenu={rowMenu}'));
    expect(rowClick).toContain('jedenPanel.otworz();');
    expect(rowClick).toContain('setSelectedOutputId(String(row.id));');
    expect(rowClick).not.toContain('navigate(sessionPath);');
  });

  it('menu and preview expose Open session only when sessionEditorPath exists', () => {
    expect(source).toContain("id: 'open-session'");
    expect(source).toContain("label: t('assessment.outputs.rowMenu.openSession', 'Open session')");
    expect(source).toContain('if (sessionPath) {');
  });
});
