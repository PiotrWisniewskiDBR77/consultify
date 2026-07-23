---
id: ODB-EXCEL-04
tytul: Excel — prawdziwe nazwy arkuszy + zakresy parametrów
typ: odbior-wizualny
waga: srednia
obszar: DOK
stan: do-odbioru
wlasciciel: piotr
partia: 2026-07-23
narzedzie: Excel
flaga: ff_excele (istniejąca, ON)
ekran: gen-excel-templates-tab
wysokosc: 700
klik: "Wybierz „Budżet operacyjny" → zobacz zakresy pod polami → Zbuduj skoroszyt → zakładki arkuszy."
utworzone: 2026-07-23
---

## 1. CO SIĘ ZMIENIŁO

Dwie naprawy w podglądzie i formularzu Excela:
(a) **Prawdziwe nazwy arkuszy** — zakładki nad siatką pokazują „Założenia" / „Podsumowanie" / „Przepływy" zamiast „Sheet 1 / Sheet 2". Przyczyna była u źródła: `buildWorkbookGridSheets` czytał nazwę ze schematu, ale nie przenosił jej dalej — pole po prostu ginęło w mapowaniu. Naprawione w jednym miejscu, więc zyskują wszyscy konsumenci.
(b) **Zakresy parametrów** — pod każdym polem widać dozwolony zakres („zakres: −20 – 50%", „≥ 0"), a wartość spoza zakresu podświetla pole i blokuje „Zbuduj skoroszyt" z czytelnym komunikatem. Wcześniej dowiadywałeś się o tym dopiero z błędu serwera.

## 2. NA CO PATRZEĆ

Czy nazwy arkuszy są czytelne przy 3+ arkuszach? Czy komunikat o zakresie jest zrozumiały, czy przeszkadza?

## 3. RYZYKO / OGRANICZENIA

SPROSTOWANIE mojego wcześniejszego zgłoszenia: „procenty ×100" NIE było defektem produktu — to był błąd moich danych testowych w harnessie. Backend trzyma ułamki (0,03), formularz poprawnie pokazuje 3. Poprawiłem dane harnessu.

## 4. JAK ZWERYFIKOWANO

5 nowych testów jednostkowych podglądu siatki + regresja (4/4). esbuild czysty. Render-verify przeze mnie: defaulty 3 i 35 (nie 300/3500), zakresy widoczne, zakładki „Założenia"/„Podsumowanie", zero błędów konsoli.

## 5. ODBIÓR

- **werdykt:** _(akceptuję / poprawka / odrzucam)_
- **komentarz:**
- **data:**
