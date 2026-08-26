import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

// RowDetailPanel parity (P0, 2026-08-26 — STOP `f864a060f0`, day 3).
//
// Source contract, not a full render test — IdeaMapWorkspace/IdeaTableTool
// pull in the entire idea-workspace subsystem, far too costly to mount per
// CLAUDE.md's ban on heavy per-robot test runs (same rationale as
// `ideaInspectorRailPanelGuard.contract.test.ts`). Behavioral coverage for
// the underlying render logic lives in `IdeaElementInspector.historyAi.test.tsx`
// and `IdeaElementInspector.behavior.test.tsx`; this test proves the specific
// gap-closing wiring lines are actually present in the two callers, not just
// in the shared component.
const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, '..', rel), 'utf8');

describe('RowDetailPanel → IdeaElementInspector parity wiring (P0)', () => {
  it('IdeaTableTool: reports priority, semanticType, and activity in the selection meta (previously dropped)', () => {
    const source = read('IdeaTableTool.tsx');
    expect(source).toContain('priority:');
    expect(source).toContain('typeof detailNode.data?.priority === \'number\'');
    expect(source).toContain('semanticType:');
    expect(source).toContain('activity: Array.isArray(detailNode.data?.activity)');
  });

  it('IdeaMapWorkspace: derives real Powiązania (relations) from connected graph edges, not a hardcoded empty list', () => {
    const source = read('IdeaMapWorkspace.tsx');
    expect(source).toContain('const inspectorRelations = useMemo<IdeaInspectorItem[]>');
    expect(source).toContain('relations: inspectorRelations,');
  });

  it('IdeaMapWorkspace: wires priority into the inspector element', () => {
    const source = read('IdeaMapWorkspace.tsx');
    expect(source).toContain('priority: selection.meta?.priority,');
  });

  it('IdeaMapWorkspace: wires a real AI-insights generator (RowDetailPanel "AI Insights" tab parity)', () => {
    const source = read('IdeaMapWorkspace.tsx');
    expect(source).toContain('const handleGenerateInspectorInsights = useCallback(async () => {');
    expect(source).toContain('await Api.getIdeaAISuggestions(realId,');
    expect(source).toContain('onGenerateInsights={handleGenerateInspectorInsights}');
  });

  it('IdeaMapWorkspace: wires the Table activity log into the inspector (RowDetailPanel "Activity" tab parity)', () => {
    const source = read('IdeaMapWorkspace.tsx');
    expect(source).toContain("activeTool === 'table'");
    expect(source).toContain('selection.meta?.activity as IdeaInspectorActivityItem[] | undefined');
  });

  it('IdeaMapWorkspace: Table tool section columns are editable (not read-only text) unless the canvas is locked', () => {
    const source = read('IdeaMapWorkspace.tsx');
    expect(source).toContain("nodeId && !canvasLocked ? (");
    expect(source).toContain('void handleNodeDataChange(nodeId, { [col.key]: e.target.value } as any);');
  });
});
