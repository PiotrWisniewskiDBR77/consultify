---
id: ODB-EXCEL-05
tytul: Excel — otwieranie arkuszy: koniec fałszywego pustego podglądu
typ: odbior-wizualny
waga: wysoka
obszar: DOK
stan: do-odbioru
wlasciciel: piotr
partia: 2026-07-23
narzedzie: Excel
flaga: bez flagi
ekran: excele-reopen-verify
wysokosc: 560
klik: "Ekran pokazuje stan po naprawie: uczciwy błąd zamiast pustej atrapy."
utworzone: 2026-07-23
---

## 1. CO SIĘ ZMIENIŁO

To jest odpowiedź na Twoje „nie mam czego otworzyć". Kliknięcie arkusza w Recent/Saved **udawało sukces**: otwierał się pusty podgląd „Spreadsheet, 1 arkusz, brak komórek". Powód: kod pytał o `/workbook/:id`, dostawał 404 i w `catch()` **fabrykował pustą atrapę** zamiast pokazać błąd.

Po naprawie: (a) jeśli arkusz pochodzi z żywej tabeli Table Platform — przekierowuje do jej **prawdziwej treści**; (b) jeśli źródła nie ma — pokazuje **uczciwy błąd** („Nie znaleziono treści tego arkusza"), a nie fałszywy pusty sukces.

## 2. NA CO PATRZEĆ

Czy wolisz uczciwy komunikat, czy jednak wolałbyś, żeby takie pozycje w ogóle nie pokazywały się na liście? (patrz sekcja 3 — czeka na Twoją decyzję)

## 3. RYZYKO / OGRANICZENIA

**★ USTALENIE, KTÓRE WYMAGA TWOJEJ DECYZJI.** Zweryfikowałem na żywej bazie demo: z 61 arkuszy widocznych w Twoim Recent/Saved tylko **6 to prawdziwe skoroszyty** z formułami, **14 to żywe tabele** (odzyskiwalne), a **41 (67%) to wiszące referencje — dane bezpowrotnie utracone**. Ta naprawa sprawia, że te 41 pokazuje uczciwy błąd zamiast atrapy, ale **nie przywraca treści, bo jej nie ma**. Osobna decyzja: czy posprzątać listę (ukryć/oznaczyć te pozycje), czy zostawić jako historię. Świadomie tego nie zrobiłem — to decyzja produktowa, nie techniczna.

## 4. JAK ZWERYFIKOWANO

Root cause potwierdzony liczbowo na bazie demo (trolley), niezależnie przeliczony przeze mnie: 61 widocznych = 6 + 14 + 41. esbuild czysty, zrzuty light+dark pokazujące nowy stan błędu zamiast atrapy.

## 5. ODBIÓR

- **werdykt:** _(akceptuję / poprawka / odrzucam)_
- **komentarz:**
- **data:**
