import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * ODRZUCENIE WŁAŚCICIELA 05.09 (odbiór na żywo, ekran `notebook-quick-capture`):
 *
 *   „to jest coś, z czym walczymy przez cały czas. […] Nie może być tak, że tak
 *    strasznie dużo przycisków jest w obszarze centralnym. To wszystko musi być
 *    wyrzucone do panelu albo w ogóle usunięte. Nie może być tak, że absolutnie
 *    większość ekranu to są przyciski."
 *
 * Ten test NIE liczy pikseli — pilnuje JEDNEGO, sprawdzalnego faktu: cztery
 * powierzchnie sterujące (pasek formatowania, pasek przepływu, chipy tematów,
 * mini-spis nagłówków) nie wracają nad dokument, tylko renderują się w prawym
 * panelu. Bez tej blokady odrastają przy pierwszej większej zmianie w
 * `NotebookContent.tsx` — dokładnie tak, jak odrastały do 05.09.
 */
const content = fs.readFileSync(path.resolve(__dirname, '../../NotebookContent.tsx'), 'utf8');
const rail = fs.readFileSync(path.resolve(__dirname, '../NotebookRightRail.tsx'), 'utf8');

describe('Notatnik — centrum bez ściany przycisków (odrzucenie właściciela 05.09)', () => {
  it('nie montuje paska formatowania, przepływu ani chipów tematów w centrum', () => {
    expect(content).not.toContain('<NotebookToolbar');
    expect(content).not.toContain('<NotebookProgressChip');
    expect(content).not.toContain('<NotebookTopicChips');
    // Mini-spis był surowym `<button>` na każdy nagłówek, budowanym w miejscu.
    expect(content).not.toContain("'notebook.notebookContent.label70'");
    expect(content).not.toContain('headingOutline.map(');
  });

  it('renderuje te same powierzchnie w prawym panelu — przeniesione, nie skasowane', () => {
    expect(rail).toContain('<NotebookToolbar editor={editor} />');
    expect(rail).toContain('<NotebookProgressChip');
    expect(rail).toContain('<NotebookTopicChips');
    expect(rail).toContain('<NotebookOutlineList');
    // Prawy panel dostaje handlery, a nie własną drugą implementację.
    expect(content).toContain('onOpenSources={() =>');
    expect(content).toContain('onCreateAIProposal={() => setAiCommand(');
    expect(content).toContain('onOpenTopic={(topicId) => setOpenTopicId(topicId)}');
  });

  it('zostawia w pasku nad dokumentem wyłącznie panel + kebab', () => {
    expect(content).toContain('data-testid="notebook-toolbar-right-actions"');
  });

  // ★ 2026-09-05 (decyzja CTO „jeden prawy panel", część II — Notatnik):
  // ostatnie dwie powierzchnie sterujące zeszły ze środka dokumentu.
  it('nie zostawia w centrum przycisku „Wstaw blok" ani edycji tagów', () => {
    expect(content).not.toContain("t('notebook.notebookContent.insertBlock', 'Insert block')");
    expect(content).not.toContain("t('notebook.notebookContent.placeholder2', '+ tag')");
    // Handlery ŻYJĄ — przeniesione, nie skasowane.
    expect(content).toContain('const handleAddTag');
    expect(content).toContain('const handleRemoveTag');
    expect(content).toContain('const handleInsertBlockFromPanel');
    expect(content).toContain('onAddTag={handleAddTag}');
    expect(content).toContain('onRemoveTag={handleRemoveTag}');
    expect(content).toContain('onInsertBlock={handleInsertBlockFromPanel}');
    expect(rail).toContain("t('notebook.rightRail.tags', 'Tagi')");
    expect(rail).toContain("t('notebook.rightRail.insertBlock', 'Wstaw blok')");
  });
});
