import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.resolve(__dirname, '../../NotebookContent.tsx'), 'utf8');

describe('Notebook block gutter contract', () => {
  it('offers keyboard-focusable block actions and insertion controls', () => {
    expect(source).toContain('data-testid="notebook-block-gutter"');
    expect(source).toContain("'notebook.blockGutter.actions'");
    expect(source).toContain("'notebook.blockGutter.insertBelow'");
    expect(source).toContain('focus-within:opacity-100');
  });

  it('opens the same SlashMenu state modes as context and insert entry points', () => {
    expect(source).toContain("mode: 'context'");
    expect(source).toContain("mode: 'insert'");
    expect(source).toContain('<SlashMenu');
  });
});
