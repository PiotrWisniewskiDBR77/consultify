import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * ★ [ODMROZENIE 07_MY_WORK_AGENT DEC-397] — właściciel (06.09): „potrzebuję
 * możliwości edycji tytułu tej notatki — teraz nie mogę tej nazwy edytować”.
 *
 * `NotebookContent.tsx` jest zbyt stanowy (edytor Tiptap, autosave z
 * debounce, konflikty optymistycznej blokady, kilkanaście efektów), żeby
 * renderować go w teście jednostkowym bez pełnego środowiska przeglądarki —
 * żaden istniejący test tego pliku tego nie robi (wzorzec:
 * `NotebookCentreLightweight.ownerFeedback.test.ts`,
 * `NotebookToolbarSimplification.ownerFeedback.test.ts` — obie czytają
 * źródło jako tekst). Ten test idzie tą samą drogą: pilnuje KONKRETNYCH
 * fragmentów kodu, które naprawiają zgłoszenie, i celowo mutowalny —
 * usunięcie/cofnięcie któregokolwiek z nich (np. przywrócenie pola tytułu
 * do gołego `value/onChange` bez `onFocus`/`onKeyDown`) przełącza test na
 * RED.
 *
 * Odbiór na żywo (przeglądarka, realne API, realny PUT
 * /api/v8/my-work/notebook/pages/:id) — zrzuty i opis w
 * evidence/1-1-i/*.png — potwierdza, że `onChange` faktycznie prowadzi do
 * wywołania API z nowym tytułem; ten test pilnuje, żeby ten sam PRZEWÓD
 * (onChange → setTitle → scheduleSave) nie odrósł/nie zniknął przy kolejnej
 * zmianie pliku, i dokłada asercje dla nowej ergonomii (select-all na focus,
 * Enter/Escape).
 */
const source = fs.readFileSync(
  path.resolve(__dirname, '../../NotebookContent.tsx'),
  'utf8'
);

describe('Notatnik — edycja tytułu w miejscu (DEC-397, 06.09)', () => {
  it('every keystroke still routes through scheduleSave (the API-call path) — mutation: remove the call → RED', () => {
    // Ten fragment ISTNIAŁ już przed naprawą (pole było TECHNICZNIE
    // edytowalne) — pilnujemy, żeby naprawa go nie usunęła, bo TO jest
    // przewód, który faktycznie wywołuje PUT /notebook/pages/:id
    // (persistNotebookDraft, wołane z scheduleSave po debounce 350ms).
    expect(source).toContain(
      "onChange={(e) => {\n                              setTitle(e.target.value);\n                              scheduleSave({ title: e.target.value });\n                            }}"
    );
  });

  it('selects the whole title on focus, so click-then-type REPLACES it instead of inserting mid-string — mutation: drop onFocus → RED', () => {
    // Przyczyna zgłoszenia właściciela: klik w pole (wartość realna, nie
    // placeholder — patrz `NewPageModal`/szablon „Blank page" zapisujący
    // "Untitled" jako prawdziwy tytuł) + pisanie WSTAWIAŁO tekst w miejscu
    // kursora zamiast zastępować całość — dla użytkownika wyglądało to jak
    // "nie mogę edytować nazwy" (zmierzone na żywo: klik + pisanie dawało
    // "UntitledNowyTytuł").
    expect(source).toContain('titleBeforeEditRef.current = title;');
    expect(source).toContain('e.target.select();');
  });

  it('Enter commits by blurring, Escape restores the pre-edit value and blurs — mutation: drop onKeyDown → RED', () => {
    expect(source).toContain("if (e.key === 'Enter') {");
    expect(source).toContain("if (e.key === 'Escape') {");
    // Escape musi wołać TEN SAM przewód (setTitle + scheduleSave) z wartością
    // sprzed edycji — inaczej „Esc anuluje” tylko odświeża UI bez cofnięcia
    // zapisu w toku.
    expect(source).toContain('const restored = titleBeforeEditRef.current;');
    expect(source).toContain('setTitle(restored);');
    expect(source).toContain('scheduleSave({ title: restored });');
  });

  it('names the field for assistive technology in Polish (i18n pl+en, not a bare placeholder)', () => {
    expect(source).toContain(
      "aria-label={t('notebook.notebookContent.titleAriaLabel', 'Tytuł notatki')}"
    );
  });

  it('the ariaLabel key resolves to real Polish and English strings (not the fallback leaking through)', () => {
    const pl = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../../../../../public/locales/pl/translation.json'), 'utf8')
    );
    const en = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../../../../../public/locales/en/translation.json'), 'utf8')
    );
    expect(pl.notebook.notebookContent.titleAriaLabel).toBe('Tytuł notatki');
    expect(en.notebook.notebookContent.titleAriaLabel).toBe('Note title');
    // Empty title fallback ("Bez tytułu"/"Untitled") already existed and
    // must keep working — this is the other half of the owner's ask ("pusty
    // tytuł → Bez tytułu"), already wired through `p.title ||
    // t('notebook.notebookContent.label40', ...)` on the list row and
    // `activePage.title || t('notebook.rightRail.untitled', ...)` on the
    // panel header.
    expect(pl.notebook.notebookContent.label40).toBe('Bez tytułu');
    expect(pl.notebook.rightRail.untitled).toBe('Bez tytułu');
  });
});
