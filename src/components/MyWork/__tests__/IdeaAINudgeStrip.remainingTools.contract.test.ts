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
});
