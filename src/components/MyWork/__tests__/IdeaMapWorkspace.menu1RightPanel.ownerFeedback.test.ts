import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

// RUNDA2_RAPORT.md (odbiór żywy 2026-09-05, evidence/odbior-zywo-20260905/
// 02-moja-praca/wyniki.json id "ideas-teresa-panel"): "IdeaRightPanel to kod
// martwy — melsCanvasEnabled = true przybite na sztywno
// (IdeaMapWorkspace.tsx:3655); trzy ikony w Menu 1 (Narzędzia / Kontekst i
// powiązania / Sugestie AI) klikają się i podświetlają, ale ŻADEN panel się
// nie pojawia." Measured cause: the ONLY mount of `<IdeaRightPanel>` lived
// behind `!melsCanvasEnabled` inside `renderWorkspaceSiblings()`, and
// `melsCanvasEnabled` is a hardcoded `true` local (comment: "the canonical
// Ideas shell is no longer feature-gated") — so that branch was provably
// unreachable in the live render path.
//
// Source contract (not a full render test — IdeaMapWorkspace pulls in
// routing/GraphQL-runtime/canvas machinery far too costly to mount per
// CLAUDE.md's ban on heavy per-robot test runs; same pattern as
// `IdeaMapWorkspace.candidateGate.ownerFeedback.test.ts` and
// `ideaInspectorRailPanelGuard.contract.test.ts` for this exact file). The
// companion RTL coverage for the panel CONTENT itself (that the right
// `activeSection` opens for each Menu 1 icon) lives in
// `src/components/standard/__tests__/IdeaRightPanel.menu1Sections.test.tsx`.
const source = fs.readFileSync(path.resolve(__dirname, '../IdeaMapWorkspace.tsx'), 'utf8');

describe('MENU1-RPANEL: Menu 1 (Narzędzia/Kontekst/Sugestie AI) mounts the canonical right panel', () => {
  it('extracts the panel into its own renderIdeaRightPanel() function', () => {
    expect(source).toContain('function renderIdeaRightPanel(): React.ReactNode {');
  });

  it('the reported dead-code pattern ("!melsCanvasEnabled && (toolsPanelOpen || ...) && (() => {") no longer exists', () => {
    expect(source).not.toContain(
      "!melsCanvasEnabled && (toolsPanelOpen || contextPanelOpen || aiPanelOpen) && (() => {"
    );
  });

  it('renderIdeaRightPanel() gates ONLY on the Menu 1 panel state, not on melsCanvasEnabled', () => {
    const fnStart = source.indexOf('function renderIdeaRightPanel(): React.ReactNode {');
    const fnEnd = source.indexOf('\n  function renderWorkspaceSiblings(): React.ReactNode {');
    expect(fnStart).toBeGreaterThan(0);
    expect(fnEnd).toBeGreaterThan(fnStart);
    const fnBody = source.slice(fnStart, fnEnd);
    expect(fnBody).toContain(
      'if (!(toolsPanelOpen || contextPanelOpen || aiPanelOpen)) return null;'
    );
    expect(fnBody).not.toContain('melsCanvasEnabled');
    // Still the same canonical component/contract as before the fix — the
    // regression was the MOUNT condition, never the panel's own content.
    expect(fnBody).toContain('<IdeaRightPanel');
  });

  it('the live (melsCanvasEnabled) branch computes ideaRightPanelNode = renderIdeaRightPanel() before returning its JSX', () => {
    const liveBranch = source.indexOf('if (melsCanvasEnabled) {');
    const computeSite = source.indexOf('const ideaRightPanelNode = renderIdeaRightPanel();');
    expect(liveBranch).toBeGreaterThan(0);
    expect(computeSite).toBeGreaterThan(0);
    expect(computeSite).toBeLessThan(liveBranch);
  });

  it('the live (melsCanvasEnabled) branch actually renders {ideaRightPanelNode} inside its own returned JSX (before the unreachable legacy branch starts)', () => {
    const liveBranch = source.indexOf('if (melsCanvasEnabled) {');
    const mountSite = source.indexOf('{ideaRightPanelNode}');
    // Legacy/dead branch marker — its own unique comment (unreachable:
    // melsCanvasEnabled is hardcoded true, so this second `return` never
    // executes), used to delimit "the active melsCanvasEnabled-branch" from
    // "the dead legacy branch further down".
    const deadLegacyBranchStart = source.indexOf(
      "axe `landmark-main-is-top-level`: sam wzorzec co branch melsCanvasEnabled"
    );
    expect(mountSite).toBeGreaterThan(liveBranch);
    expect(deadLegacyBranchStart).toBeGreaterThan(0);
    expect(mountSite).toBeLessThan(deadLegacyBranchStart);
  });

  it('the panel column sits in a flex ROW beside the canvas, not in the flex-COL "siblings" overlay layer (which would stack it BELOW the canvas)', () => {
    // The outer MELS wrapper is flex-col (vertical stack: canvas row, then
    // floating dialogs). Mounting an <aside> there directly (as `siblings`
    // does for modals) would place a real accordion column underneath the
    // canvas instead of beside it. The fix wraps canvasContainerRef + the
    // panel in their own flex row.
    const wrapperIdx = source.indexOf(
      'className="w-full h-full flex flex-col overflow-hidden bg-c-surface-raised dark:bg-c-surface"'
    );
    expect(wrapperIdx).toBeGreaterThan(0);
    const rowWrapperIdx = source.indexOf(
      'className="flex flex-1 min-w-0 min-h-0 overflow-hidden"',
      wrapperIdx
    );
    expect(rowWrapperIdx).toBeGreaterThan(wrapperIdx);
    const canvasContainerIdx = source.indexOf(
      '<div ref={canvasContainerRef} className="flex-1 min-w-0 min-h-0 relative">',
      rowWrapperIdx
    );
    const mountSite = source.indexOf('{ideaRightPanelNode}', rowWrapperIdx);
    expect(canvasContainerIdx).toBeGreaterThan(rowWrapperIdx);
    expect(mountSite).toBeGreaterThan(canvasContainerIdx);
  });
});
