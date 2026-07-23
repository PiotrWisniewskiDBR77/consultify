---
id: ODB-EXCEL-03
tytul: Gen. Excel — wynik: mini-wykres + siatka formuł + badge jakości
typ: odbior-wizualny
waga: srednia
obszar: DOK
stan: do-odbioru
wlasciciel: piotr
partia: 2026-07-23
narzedzie: Gen. Excel
flaga: ff_excele (istniejąca, ON)
zrzut: rejestr/_zrzuty/ODB-EXCEL-03.png
zrzut_dark: rejestr/_zrzuty/ODB-EXCEL-03-dark.png
ekran: gen-excel-templates-tab
wysokosc: 700
klik: "Kliknij „Model P&L" → „Zbuduj skoroszyt", rozwiń badge."
utworzone: 2026-07-23
---

## 1. CO SIĘ ZMIENIŁO

Po zbudowaniu skoroszytu widzisz OD RAZU: badge jakości z krytyka (wynik/100 + uwagi), mini-wykres słupkowy z danych liczbowych, siatkę komórek z ŻYWYMI formułami (=y1*1.12, =SUM(...)) w foncie mono. Wcześniej był tylko link do pobrania.

## 2. NA CO PATRZEĆ

Czy podgląd „przed pobraniem" daje Ci zaufanie do modelu? Czy wykres jest potrzebny, czy zbędny ozdobnik?

## 3. RYZYKO / ZNANE OGRANICZENIA

Zakładki arkuszy pokazują „Sheet 1/2" zamiast nazw („Założenia"/„Podsumowanie") — drobiazg do poprawy.

## 4. JAK ZWERYFIKOWANO

Zrzut wykonany automatem (`scripts/odbior-zrzuty.mjs`) z harnessu dev-render na mock-danych — bez logowania, bez bazy.
Oba motywy (light + dark) zrzucone i obejrzane przez nadzorcę PRZED pokazaniem właścicielowi (CLAUDE.md reguła #7).
Zero błędów konsoli. Pełne zrzuty: `rejestr/_zrzuty/ODB-EXCEL-03.png` oraz `-dark.png`.

## 5. ODBIÓR

- **werdykt:** _(do wypełnienia: akceptuję / poprawka / odrzucam)_
- **komentarz:** _(tu wpisz uwagi — albo wypełnij w zakładce „Odbiór" w raporcie i pobierz JSON)_
- **data:**
