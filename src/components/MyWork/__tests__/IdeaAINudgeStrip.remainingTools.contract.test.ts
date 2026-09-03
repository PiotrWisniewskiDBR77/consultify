import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (name: string) => fs.readFileSync(path.resolve(__dirname, `../${name}`), 'utf8');

describe('AI nudge strip remaining tools', () => {
  it.each([
    ['IdeaTableTool.tsx', 'table', 'tbl_add_row'],
    ['IdeaProcessFlowTool.tsx', 'process_flow', 'pf_add_action'],
  ])('%s uses its own live quick-action receiver', (file, tool, action) => {
    const source = read(file);
    expect(source).toContain('<IdeaAINudgeStrip');
    expect(source).toContain(`activeTool="${tool}"`);
    expect(source).toContain(`action: '${action}'`);
    expect(source).toContain("status: 'handed_off'");
  });

  // MYW-IDEAS-011 (2026-09-03): the strip was mounted in both files but with
  // `isAccepted={false}` — a hardcoded, never-changing prop that makes
  // `IdeaAINudgeStrip` return `null` unconditionally (see its own
  // `if (!isAccepted || allNudges.length === 0) return null;`). A grep for
  // "<IdeaAINudgeStrip" therefore falsely reads as "done" while the strip is
  // dead on both surfaces. Whiteboard and Mind Map pass the bare boolean
  // shorthand `isAccepted` (== `isAccepted={true}`) — Table and Process Flow
  // must match that exactly, not carry their own `={false}` override.
  it.each([
    ['IdeaTableTool.tsx'],
    ['IdeaProcessFlowTool.tsx'],
  ])('%s does not hardcode isAccepted={false} on the nudge strip', (file) => {
    const source = read(file);
    expect(source).not.toContain('isAccepted={false}');
    expect(source).toMatch(/<IdeaAINudgeStrip[\s\S]*?\bisAccepted\b(?!=)/);
  });
});
