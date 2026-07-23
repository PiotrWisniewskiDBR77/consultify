---
id: ODB-WORD-03
tytul: Word — badge fabrykacji w panelu QA
typ: odbior-wizualny
waga: srednia
obszar: DOK
stan: do-odbioru
wlasciciel: piotr
partia: 2026-07-23
narzedzie: Word
flaga: bez flagi (sygnał liczy się zawsze)
zrzut: rejestr/_zrzuty/ODB-WORD-03.png
zrzut_dark: rejestr/_zrzuty/ODB-WORD-03-dark.png
ekran: word-quality-badge
wysokosc: 420
klik: "Kliknij „Uruchom QA" → badge, rozwiń."
utworzone: 2026-07-23
---

## 1. CO SIĘ ZMIENIŁO

Panel QA pokazuje wynik detektora fabrykacji: „Zweryfikowane — brak niepopartych liczb" albo „Zdegradowane (N nieoznaczonych liczb)" z rozwijaną listą podejrzanych wartości. Sygnał istniał, ale nie był widoczny.

## 2. NA CO PATRZEĆ

Czy to jest ostrzeżenie, które chcesz widzieć przed wysłaniem dokumentu klientowi? Czy próg (precyzyjne liczby bez „(założenie)") jest dobrze ustawiony?

## 3. RYZYKO / ZNANE OGRANICZENIA

Nie blokuje pracy; twarda bramka eksportu partnerskiego działa osobno i bez zmian.

## 4. JAK ZWERYFIKOWANO

Zrzut wykonany automatem (`scripts/odbior-zrzuty.mjs`) z harnessu dev-render na mock-danych — bez logowania, bez bazy.
Oba motywy (light + dark) zrzucone i obejrzane przez nadzorcę PRZED pokazaniem właścicielowi (CLAUDE.md reguła #7).
Zero błędów konsoli. Pełne zrzuty: `rejestr/_zrzuty/ODB-WORD-03.png` oraz `-dark.png`.

## 5. ODBIÓR

- **werdykt:** _(do wypełnienia: akceptuję / poprawka / odrzucam)_
- **komentarz:** _(tu wpisz uwagi — albo wypełnij w zakładce „Odbiór" w raporcie i pobierz JSON)_
- **data:**
