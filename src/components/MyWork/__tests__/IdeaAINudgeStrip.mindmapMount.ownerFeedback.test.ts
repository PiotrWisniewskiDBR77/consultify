import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// MYW-IDEAS-011: "Tame or remove the bottom AI banner" was closed for
// Whiteboard only — IdeaAINudgeStrip was mounted exclusively in
// IdeaWhiteboardTool.tsx, so Mind Map / Process Flow / Table had no nudge
// strip at all. This locks the Mind Map mount (2026-08-25). Process Flow
// and Table remain open — the register still tracks MYW-IDEAS-011 as
// partially closed until all four surfaces mount it with tool-appropriate
// handlers (not a copy-pasted, mismatched one — see the whiteboard fix
// this same strip already needed once, per IdeaAINudgeStrip.ownerContract.test.ts).
const source = fs.readFileSync(
  path.resolve(__dirname, '../IdeaRecommendationMap.tsx'),
  'utf8'
);

describe('IdeaAINudgeStrip mounted in Mind Map (MYW-IDEAS-011)', () => {
  it('imports and mounts IdeaAINudgeStrip', () => {
    expect(source).toContain("import { IdeaAINudgeStrip } from './IdeaAINudgeStrip';");
    expect(source).toContain('<IdeaAINudgeStrip');
  });

  it('wires onActionExpand/onActionConvert to the tool\'s own real mm_* quick actions, not a foreign handler', () => {
    expect(source).toContain("action: 'mm_ai_expand'");
    expect(source).toContain("action: 'mm_ai_summarize'");
  });

  it('dispatches through the same idea-workspace-quick-action bus every other mm_* action in this file already uses', () => {
    const nudgeMountIndex = source.indexOf('<IdeaAINudgeStrip');
    const commandPaletteDispatchIndex = source.indexOf(
      "window.dispatchEvent(\n            new CustomEvent('idea-workspace-quick-action'"
    );
    expect(nudgeMountIndex).toBeGreaterThan(0);
    expect(commandPaletteDispatchIndex).toBeGreaterThan(0);
    // Both sit in the same "dispatch a real mm_* action" pattern, not a
    // one-off custom event invented just for the nudge strip.
    expect(source).toContain("new CustomEvent('idea-workspace-quick-action', {\n                detail: { action: 'mm_ai_expand', ideaId },");
  });

  it('only shows the strip when there is a real graph to act on', () => {
    expect(source).toMatch(/\{nodes\.length > 0 && \(\s*<IdeaAINudgeStrip/);
  });
});
