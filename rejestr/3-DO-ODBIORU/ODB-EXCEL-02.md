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
ekran: gen-excel-templates-tab
wysokosc: 620
klik: "Kliknij „Budżet operacyjny" → „Zapisz zestaw parametrów"."
utworzone: 2026-07-23
---

## 1. CO SIĘ ZMIENIŁO

Parametry pogrupowane (Ogólne / Przychody / Koszty / Koszty stałe) z wartościami domyślnymi. Nowość: „Zapisz zestaw parametrów" → nazwany preset zapisywany lokalnie, wczytywany jednym kliknięciem, kasowalny.

## 2. NA CO PATRZEĆ

Czy preset parametrów to realna oszczędność w Twojej pracy? Czy zapis lokalny (per przeglądarka) wystarcza, czy ma być współdzielony w organizacji?

## 3. RYZYKO / ZNANE OGRANICZENIA

SPROSTOWANIE (2026-07-23): wcześniej zgłosiłem tu „błąd ×100" — to była MOJA pomyłka w danych testowych harnessu, nie defekt produktu. Backend trzyma procenty jako ułamki (0,03 = 3%), a formularz poprawnie pokazuje 3. Mój mock podawał 3 zamiast 0,03, stąd „300" na zrzucie. Produkt jest OK. Realna luka obok: formularz nie pokazuje ani nie egzekwuje dozwolonych zakresów — wartość spoza zakresu odrzuca dopiero serwer (w naprawie).

## 4. JAK ZWERYFIKOWANO

Zrzut wykonany automatem (`scripts/odbior-zrzuty.mjs`) z harnessu dev-render na mock-danych — bez logowania, bez bazy.
Oba motywy (light + dark) zrzucone i obejrzane przez nadzorcę PRZED pokazaniem właścicielowi (CLAUDE.md reguła #7).
Zero błędów konsoli. Pełne zrzuty: `rejestr/_zrzuty/ODB-EXCEL-02.png` oraz `-dark.png`.

## 5. ODBIÓR

- **werdykt:** _(do wypełnienia: akceptuję / poprawka / odrzucam)_
- **komentarz:** _(tu wpisz uwagi — albo wypełnij w zakładce „Odbiór" w raporcie i pobierz JSON)_
- **data:**
