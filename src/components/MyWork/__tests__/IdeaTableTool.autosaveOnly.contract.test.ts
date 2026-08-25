import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.resolve(__dirname, '../IdeaTableTool.tsx'), 'utf8');
const persistenceSource = fs.readFileSync(
  path.resolve(__dirname, '../table/useTablePersistence.ts'),
  'utf8'
);

describe('Idea Table autosave-only contract', () => {
  it('does not expose a manual save control', () => {
    expect(source).not.toContain('idea-table-save-in-menu1');
    expect(source).not.toContain('idea-table-save-in-bar');
  });

  it('keeps the debounced persistence path and saved receipt callback', () => {
    expect(source).toContain('useTablePersistence({');
    expect(source).toContain('onSaved,');
    expect(persistenceSource).toContain('onSaved?.()');
    expect(persistenceSource).toContain("queueSync(buildPayload(), { reason: 'draft' })");
  });
});
