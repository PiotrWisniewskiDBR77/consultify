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

  it('FIX-14 (Day 3 acceptance): reveals on hovering the content area, not only the gutter itself', () => {
    // Regression guard for the reported "hover shows nothing" defect: `group`
    // was on the gutter's own (invisible, 0-opacity) div — a hover trigger
    // that can never fire, since the mouse can only land there after it is
    // already visible. `group` must be on the surrounding content wrapper,
    // and the gutter's reveal must key off `group-hover`, not only its own
    // `hover:opacity-100`.
    const wrapperIdx = source.indexOf(
      'className="group flex-1 overflow-y-auto nb-scroll relative"'
    );
    expect(wrapperIdx).toBeGreaterThan(-1);
    const gutterIdx = source.indexOf('data-testid="notebook-block-gutter"');
    expect(gutterIdx).toBeGreaterThan(wrapperIdx);
    expect(source).toContain('group-hover:opacity-100');
  });

  it('opens the same SlashMenu state modes as context and insert entry points', () => {
    expect(source).toContain("mode: 'context'");
    expect(source).toContain("mode: 'insert'");
    expect(source).toContain('<SlashMenu');
  });
});
