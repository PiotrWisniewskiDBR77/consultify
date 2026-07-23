---
id: ODB-EXCEL-02
tytul: Gen. Excel — formularz parametrów + zapis presetu
typ: odbior-wizualny
waga: srednia
obszar: DOK
stan: do-odbioru
wlasciciel: piotr
partia: 2026-07-23
narzedzie: Gen. Excel
flaga: ff_excele (istniejąca, ON)
zrzut: rejestr/_zrzuty/ODB-EXCEL-02.png
zrzut_dark: rejestr/_zrzuty/ODB-EXCEL-02-dark.png
utworzone: 2026-07-23
---

## 1. CO SIĘ ZMIENIŁO

Parametry pogrupowane (Ogólne / Przychody / Koszty / Koszty stałe) z wartościami domyślnymi. Nowość: „Zapisz zestaw parametrów" → nazwany preset zapisywany lokalnie, wczytywany jednym kliknięciem, kasowalny.

## 2. NA CO PATRZEĆ

Czy preset parametrów to realna oszczędność w Twojej pracy? Czy zapis lokalny (per przeglądarka) wystarcza, czy ma być współdzielony w organizacji?

## 3. RYZYKO / ZNANE OGRANICZENIA

ZNANY BŁĄD (nie z tej nocy): pola procentowe pokazują wartość ×100 (3% → „300"). Do naprawy osobno — powiedz czy priorytetowo.

## 4. JAK ZWERYFIKOWANO

Zrzut wykonany automatem (`scripts/odbior-zrzuty.mjs`) z harnessu dev-render na mock-danych — bez logowania, bez bazy.
Oba motywy (light + dark) zrzucone i obejrzane przez nadzorcę PRZED pokazaniem właścicielowi (CLAUDE.md reguła #7).
Zero błędów konsoli. Pełne zrzuty: `rejestr/_zrzuty/ODB-EXCEL-02.png` oraz `-dark.png`.

## 5. ODBIÓR

- **werdykt:** _(do wypełnienia: akceptuję / poprawka / odrzucam)_
- **komentarz:** _(tu wpisz uwagi — albo wypełnij w zakładce „Odbiór" w raporcie i pobierz JSON)_
- **data:**
