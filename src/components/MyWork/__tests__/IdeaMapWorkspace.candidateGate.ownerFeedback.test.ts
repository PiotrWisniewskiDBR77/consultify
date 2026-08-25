import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

// MYW-IDEAS-010: "explain the candidate → initiative path: discoverable,
// conscious review/confirm, source-idea lineage and duplicate prevention."
// The candidate→initiative affordance (getIdeaProcessFlowCandidate /
// previewIdeaProcessFlowCandidate / approveIdeaProcessFlowCandidate) is
// idea-level — it operates on the idea's canonical map
// (`/my-work/my-ideas/:id/map/candidate*`), the same shared graph all four
// tools (Mind Map / Whiteboard / Process Flow / Table) read and write —
// but was gated to `activeTool === 'process_flow'` in the UI, so the exact
// same idea only showed a ready candidate when Process Flow happened to be
// the open tool. Source-level regression lock (mirrors the established
// pattern in VaultDocumentsView.openedToolbar.ownerFeedback.test.ts for a
// component too large/stateful to mount wholesale in a unit test) — the
// active (`melsCanvasEnabled`, always-true) render path must no longer gate
// the candidate fetch or the floating candidate panel to Process Flow only.
const source = fs.readFileSync(
  path.resolve(__dirname, '../IdeaMapWorkspace.tsx'),
  'utf8'
);

describe('MYW-IDEAS-010 candidate→initiative path is no longer tool-gated', () => {
  it('does not gate the candidate-fetch effect to activeTool !== process_flow', () => {
    expect(source).not.toContain("if (activeTool !== 'process_flow' || !realId)");
  });

  it('fetches the candidate whenever the idea has a real id, regardless of active tool', () => {
    expect(source).toContain('useEffect(() => {\n    if (!realId) {\n      setCandidateHandoff(null);');
  });

  it('does not gate the floating candidate panel (mels/active render path) to activeTool === process_flow', () => {
    // The FIRST occurrence is the active melsCanvasEnabled-branch panel —
    // the dead legacy branch further down (unreachable: melsCanvasEnabled
    // is hardcoded true) is intentionally out of scope for this fix.
    const firstPanelGate = source.indexOf("{activeTool === 'process_flow' && (");
    const activeBranchEnd = source.indexOf('\n  return (\n    <div\n      ref={workspaceRootRef}');
    expect(activeBranchEnd).toBeGreaterThan(0);
    // Either there is no such gate before the active branch ends (fixed),
    // or if one exists it must be strictly after the active branch (dead code).
    if (firstPanelGate !== -1) {
      expect(firstPanelGate).toBeGreaterThan(activeBranchEnd);
    }
  });

  it('shows the candidate panel for any real idea in the active render path', () => {
    expect(source).toContain('{Boolean(realId) && (\n          <div className="absolute bottom-4 right-4');
  });
});
