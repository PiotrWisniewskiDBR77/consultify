/**
 * @vitest-environment node
 *
 * [ODMROZENIE 06_EXECUTION DEC-453] E1b/R2 — kebab wiersza w Realizacja →
 * Realizacje (`ExecutionHub.tsx`, `buildInitiativeRowMenu`).
 *
 * ODBIÓR ADWERSARYJNY 10.09.2026 (`ODBIOR_W1B_INICJATYWY_REALIZACJA_20260910.md`
 * §2): kebab miał 4 pozycje — „Otwórz podgląd" ×2 (DUPLIKAT) i „Usuń" trwale
 * wyłączone BEZ wyjaśnienia.
 *
 * POMIAR ŹRÓDŁA: `buildInitiativeRowMenu` deklarował RĘCZNIE
 * `primary: [{ id: 'open_preview', label: t('common.openPreview', …) }]`
 * ORAZ `universalHandlers.preview` — `StandardTable.rowMenuToSections` renderuje
 * z KAŻDEGO z nich osobną pozycję „Otwórz podgląd"/„Open preview" (ten sam
 * klucz i18n `common.openPreview`), stąd duplikat. `destructive: {}` był
 * pustym obiektem (prawdziwy w JS) → sekcja „danger" renderowała się, ale bez
 * `note`/`label` — przycisk disabled bez ŻADNEGO wyjaśnienia (komentarz nad
 * kodem twierdził, że „StandardTable dokłada notę sama" — fałsz, sprawdzone
 * w `StandardTable.tsx:rowMenuToSections`: `description: d.note` jest
 * `undefined`, gdy `note` nie jest podane).
 *
 * Dlaczego na ŹRÓDLE, a nie na zamontowanym drzewie: `ExecutionHub` ma ~6 tys.
 * linii — montowanie w vitest jest znanym źródłem OOM (patrz
 * `ExecutionHub.kanonPaskow.source.test.ts`).
 *
 * MUTACJA (weryfikacja ręczna): przywrócenie usuniętego `primary: [...]` →
 * ten test czerwony na asercji (a); usunięcie `note:` z `destructive` →
 * czerwony na (b).
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const hub = readFileSync(new URL('../ExecutionHub.tsx', import.meta.url), 'utf8');

// Ciało buildInitiativeRowMenu — od deklaracji do "[handleOpenDocument,"
// (dep array useCallback). NA SUROWYM ZRODLE, bez usuwania komentarzy: ten
// plik ma tysiace blokow komentarzy JSX przed ta funkcja, a naiwny regex
// czyszczacy komentarze zjada od pierwszego niesparowanego otwarcia az do
// odleglego zamkniecia gdzies dalej w pliku — to zjada DEKLARACJE, zanim
// test zdazy ja znalezc (zmierzone: dzieje sie to rowniez na pliku SPRZED
// tej naprawy, wiec to wlasciwosc pliku, nie regresja). Test celuje w
// literalny fragment kodu wprost, bez tej pulapki.
const wycinekFunkcji = (() => {
  const start = hub.indexOf('const buildInitiativeRowMenu = useCallback(');
  expect(start).toBeGreaterThan(-1);
  const end = hub.indexOf('[handleOpenDocument, isPilotParticipant, t]', start);
  expect(end).toBeGreaterThan(start);
  return hub.slice(start, end);
})();

describe('E1b/R2 — kebab „Realizacje" bez duplikatu i z uczciwym podpisem Usuń', () => {
  it('(a) BRAK ręcznej pozycji "open_preview" w primary — zostaje wyłącznie universalHandlers.preview', () => {
    expect(wycinekFunkcji).not.toMatch(/id:\s*['"]open_preview['"]/);
    // universalHandlers.preview musi zostać — to JEDYNE źródło "Otwórz podgląd".
    expect(wycinekFunkcji).toMatch(/preview:\s*\(\)\s*=>\s*\{/);
  });

  it('(a2) wywolanie t("common.openPreview", ...) nie wystepuje w kodzie tej funkcji (etykieta idzie wylacznie z StandardTable.rowMenuToSections)', () => {
    expect(wycinekFunkcji).not.toMatch(/t\(\s*['"]common\.openPreview['"]/);
  });

  it('(b) destructive (Usuń) ma jawny "note" — nie jest pustym obiektem bez wyjaśnienia', () => {
    const destructiveStart = wycinekFunkcji.indexOf('destructive: {');
    expect(destructiveStart).toBeGreaterThan(-1);
    const destructiveEnd = wycinekFunkcji.indexOf('},', destructiveStart);
    const destructiveBlock = wycinekFunkcji.slice(destructiveStart, destructiveEnd);
    expect(destructiveBlock).toMatch(/note:\s*t\(/);
  });

  it('(b2) klucz i18n usunięcia ma angielski defaultValue (bramka jezykRealizacji — polski defaultValue w kodzie = FAIL)', () => {
    expect(hub).toMatch(
      /execution\.list\.deleteDisabledNote['"],\s*['"]Only draft or rejected initiatives/
    );
  });
});
