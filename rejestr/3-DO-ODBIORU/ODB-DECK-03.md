---
id: ODB-DECK-03
tytul: Deck — badge jakości na wyniku kreatora
typ: odbior-wizualny
waga: srednia
obszar: DOK
stan: do-odbioru
wlasciciel: piotr
partia: 2026-07-23
narzedzie: Deck
flaga: ENABLE_DECK_QUALITY_GATES (ON)
zrzut: rejestr/_zrzuty/ODB-DECK-03.png
zrzut_dark: rejestr/_zrzuty/ODB-DECK-03-dark.png
utworzone: 2026-07-23
---

## 1. CO SIĘ ZMIENIŁO

Po wygenerowaniu decka: nie-blokujący, zwijany badge „Jakość: N ostrzeżeń" + „Score N/100" z krytyka kompozycji i walidacji strukturalnej. Przy okazji naprawiony realny błąd: odpowiedź generacji gubiła te ostrzeżenia (stary snapshot zmiennej) — liczyły się „do szuflady".

## 2. NA CO PATRZEĆ

Czy chcesz widzieć wynik jakości od razu po generacji? Czy score/100 to dobra forma, czy wolisz słowny werdykt?

## 3. RYZYKO / ZNANE OGRANICZENIA

Świadomie NIE blokuje pobrania decka — to informacja, nie bramka.

## 4. JAK ZWERYFIKOWANO

Zrzut wykonany automatem (`scripts/odbior-zrzuty.mjs`) z harnessu dev-render na mock-danych — bez logowania, bez bazy.
Oba motywy (light + dark) zrzucone i obejrzane przez nadzorcę PRZED pokazaniem właścicielowi (CLAUDE.md reguła #7).
Zero błędów konsoli. Pełne zrzuty: `rejestr/_zrzuty/ODB-DECK-03.png` oraz `-dark.png`.

## 5. ODBIÓR

- **werdykt:** _(do wypełnienia: akceptuję / poprawka / odrzucam)_
- **komentarz:** _(tu wpisz uwagi — albo wypełnij w zakładce „Odbiór" w raporcie i pobierz JSON)_
- **data:**
