---
id: ODB-WORD-02
tytul: Gen. Word — podgląd struktury dokumentu
typ: odbior-wizualny
waga: srednia
obszar: DOK
stan: do-odbioru
wlasciciel: piotr
partia: 2026-07-23
narzedzie: Gen. Word
flaga: ff_tpl_editor (istniejąca, ON)
zrzut: rejestr/_zrzuty/ODB-WORD-02.png
zrzut_dark: rejestr/_zrzuty/ODB-WORD-02-dark.png
utworzone: 2026-07-23
---

## 1. CO SIĘ ZMIENIŁO

Przyklejony panel „Structure preview": sylwetka dokumentu — wcięcie wg poziomu nagłówka, liczba linii proporcjonalna do oczekiwanej długości sekcji, kropka przy sekcjach obowiązkowych. Pokazuje „kształt" dokumentu bez zmyślania treści.

## 2. NA CO PATRZEĆ

Czy sylwetka pomaga ocenić proporcje dokumentu przed generacją? Czy powinna pokazywać też tytuły sekcji?

## 3. RYZYKO / ZNANE OGRANICZENIA

Świadomie bez tekstu — tylko geometria, żeby nie sugerować nieistniejącej treści.

## 4. JAK ZWERYFIKOWANO

Zrzut wykonany automatem (`scripts/odbior-zrzuty.mjs`) z harnessu dev-render na mock-danych — bez logowania, bez bazy.
Oba motywy (light + dark) zrzucone i obejrzane przez nadzorcę PRZED pokazaniem właścicielowi (CLAUDE.md reguła #7).
Zero błędów konsoli. Pełne zrzuty: `rejestr/_zrzuty/ODB-WORD-02.png` oraz `-dark.png`.

## 5. ODBIÓR

- **werdykt:** _(do wypełnienia: akceptuję / poprawka / odrzucam)_
- **komentarz:** _(tu wpisz uwagi — albo wypełnij w zakładce „Odbiór" w raporcie i pobierz JSON)_
- **data:**
