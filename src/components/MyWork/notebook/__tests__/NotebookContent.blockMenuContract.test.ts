import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.resolve(__dirname, '../../NotebookContent.tsx'), 'utf8');

describe('Notebook native block-menu contract', () => {
  it('opens the canonical SlashMenu registry from right click and keyboard', () => {
    expect(source).toContain('contextmenu: (view, event) =>');
    expect(source).toContain("event.key === 'ContextMenu'");
    expect(source).toContain("event.shiftKey && event.key === 'F10'");
    expect(source).toContain('setSlashState({');
    expect(source).toContain("mode: 'context'");
    expect(source).toContain('<SlashMenu');
    expect(source).toContain("'Insert block'");
    expect(source).toContain("mode: 'insert'");
  });

  it('moves the editor selection to the contextual click before opening actions', () => {
    expect(source).toContain('view.posAtCoords');
    expect(source).toContain('TextSelection.near');
    expect(source).toContain('view.dispatch(view.state.tr.setSelection(selection))');
  });

  it('keeps insert and contextual block lifecycle in the same canonical menu', () => {
    const menu = fs.readFileSync(path.resolve(__dirname, '../SlashMenu.tsx'), 'utf8');
    expect(menu).toContain("id: 'block-duplicate'");
    expect(menu).toContain("id: 'block-move-up'");
    expect(menu).toContain("id: 'block-move-down'");
    expect(menu).toContain("id: 'block-delete'");
    expect(menu).toContain("state.mode === 'context'");
    expect(menu).toContain('disabled={cmd.canRun ? !cmd.canRun(editor) : false}');
  });
});
