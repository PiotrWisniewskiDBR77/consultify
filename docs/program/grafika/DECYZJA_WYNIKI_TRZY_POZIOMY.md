---
doc_id: decyzja-wyniki-trzy-poziomy
status: canonical
truth_type: product-decision
established: 2026-08-30
decided_by: Piotr (właściciel)
---

# Wyniki — trzy poziomy zamiast dwóch (decyzja właściciela, 2026-08-30)

## Problem, słowami właściciela

Klikasz wiersz w tabeli Wyników i **od razu otwiera się pojedynczy wskaźnik**.
Brakuje poziomu pośredniego: **tabeli wskaźników za dany okres rozliczeniowy**.
Wskaźniki i cele rozlicza się w okresach — sierpień, Q3, rok — i to okres jest
jednostką pracy, a nie pojedynczy wskaźnik.

## Ustalona konstrukcja

**Wskaźniki (KPI) i Cele (OKR) — trzy poziomy:**

| Poziom | Co to jest | Co tu robisz |
| --- | --- | --- |
| **1. Rejestr zestawień** | „KPI procesowe — sierpień 2026", „OKR działu — Q3" | wybierasz okres rozliczeniowy |
| **2. Tabela zestawu** | dziesięć wskaźników w tym okresie | **dodajesz wskaźniki**, widzisz **podsumowanie stanu** |
| **3. Karta wskaźnika** | jeden wskaźnik: pomiary, kontrakt, odchylenia, historia | pracujesz na konkretnej rzeczy |

Poziom 2 podłącza się do **Menu 3 (dynamicznego)** jako osobny artefakt.

**Analizy ROI — dwa poziomy, bez środka:**

| Poziom | Co to jest |
| --- | --- |
| **1. Tabela analiz** | lista analiz ROI |
| **2. Karta analizy** | artefakt N-type ze wszystkim w środku |

Różnica jest merytoryczna, nie techniczna: **wskaźnik i cel rozliczasz cyklicznie,
analizę ROI robisz raz.**

## Cztery rozstrzygnięcia właściciela

**1. Tożsamość wskaźnika: JEDEN wskaźnik, WIELE okresów.**
OEE linii pakowania w sierpniu i we wrześniu to **ten sam** wskaźnik oglądany dwa
razy, nie dwa byty. Konsekwencja wiążąca: karta poziomu 3 musi nieść **historię
przez wszystkie okresy** — trend, zmiany definicji, przesunięcia progu.

**2. Płaska lista wszystkich wskaźników: NIEPOTRZEBNA.**
Dzisiejszy rejestr (płaska lista pojedynczych wskaźników) **przestaje być punktem
wejścia** i jego treścią stają się zestawienia. Wskaźnik osiąga się przez okres,
w którym jest mierzony. Odpowiedź na „gdzie w ogóle mierzymy OEE" daje sekcja
**„Karty wyników i kontrakty"** wewnątrz karty wskaźnika — bo wskaźnik wie, do
których zestawień należy.

**3. OKR: osoba to KOLUMNA, nie poziom.**
Cele mają tę samą konstrukcję co wskaźniki — trzy poziomy, nie cztery. Właściciel
celu jest kolumną, po której filtrujesz. Jedna konstrukcja dla obu rodzin.

**4. Podsumowanie: TYLKO na tabeli zestawu (poziom 2).**
Nagłówek poziomu 2 pokazuje stan całego okresu. Karta pojedynczego wskaźnika
otwiera się **od razu na detalach**, bez własnej strony podsumowania.

## Stan zastany — zmierzone 2026-08-30, nie założone

**Wszystkie trzy poziomy JUŻ ISTNIEJĄ jako osobne ekrany.** To nie jest budowa od
zera, tylko **przepięcie ścieżki**.

- **Poziom 2 istnieje** jako `results-vnext-kpi-scorecards`. Otwarta karta nazywa
  się „Karta wyników — Jakość Q3", ma pozycje wskaźników, przycisk **Dodaj KPI**,
  role (podstawowa / pomocnicza), kolejność — i **gotowe podsumowanie**:
  „Bezpieczne 1 · Ostrzeżenie 1 · Krytyczne 0 · Brak danych 1 (z 3)".
  To dokładnie nagłówek wymagany decyzją nr 4.
- **Poziom 3 istnieje** jako `results-vnext-kpi-tool`. Lewe menu: Wyniki · Kontrakt ·
  Pomiary · Sprawy odchyleń · Działania korygujące · Inicjatywy wpływające ·
  **Karty wyników i kontrakty** · **Historia / rodowód**. Prawy panel niesie wersję
  definicji i wersję CAS.
- **Decyzja nr 1 jest już zaimplementowana.** Pozycja „Karty wyników i kontrakty"
  w karcie wskaźnika oznacza, że wskaźnik **z założenia należy do wielu zestawień**,
  a „Historia / rodowód" niesie ciągłość przez okresy. Nie trzeba tego budować —
  trzeba to pokazać.

**Czego brakuje:** `results-vnext-kpi-registry` listuje **pojedyncze wskaźniki**
(OEE-LINIA-PAKOWANIA, ZGŁOSZENIA-DO-ZATWIERDZENIA…), a nie zestawienia, i prowadzi
**prosto na poziom 3**, z pominięciem poziomu 2.

## Co z tego wynika dla pracy

1. **Poziom 1 zmienia treść:** rejestr listuje zestawienia okresowe, nie wskaźniki.
2. **Poziom 2 wchodzi na ścieżkę:** klik w zestawienie otwiera tabelę zestawu jako
   artefakt w Menu 3.
3. **Poziom 3 bez zmian konstrukcyjnych** — zmienia się tylko to, skąd się do niego
   wchodzi.
4. **OKR dostaje ten sam schemat** co wskaźniki (decyzja nr 3).
5. **ROI zostaje na dwóch poziomach** — nic nie ruszamy.

## Wpływ na trwający odbiór

Ekrany Wyników zostały ocenione **wizualnie** i te oceny zostają w mocy — zmiana
dotyczy **ścieżki**, nie wyglądu. Jeden ekran zmienia treść (`kpi-registry`,
analogicznie `okr-registry`) i wymaga **ponownego odbioru** po przebudowie.
Reszta ocen obowiązuje dalej.

---

## Uzupełnienie 2026-09-05 (słowa właściciela, odbiór MVP)

> „Omawialiśmy tabelę; z poziomu tabeli otwiera się lista. Lista ma opis KPI, kilka pozycji, a każdy KPI ma swoją kartę typu N.”
> „KPI, OKR i ROI zaczyna się od tego, że w menu głównym mamy 3 funkcje i każda z nich uruchamia tabelę na ekranie. Tabela jest listą, która oznacza raport.”

Odczyt CTO (do potwierdzenia wyłącznie zrzutem, nie pytaniem):
- **Poziom 1** = trzy funkcje w Menu 2 Wyników: KPI · OKR · ROI. Każda otwiera **tabelę raportów** (zestawień okresowych): wiersz = raport („KPI procesowe — sierpień 2026”, „OKR działu — Q3”), kolumny: nazwa · okres · opis · liczba pozycji · właściciel · stan (Bezpieczne/Ostrzeżenie/Krytyczne/Brak danych) · aktualizacja.
- **Poziom 2** = otwarty raport: **tabela pozycji** (dziesięć wskaźników / celów tego okresu) z nagłówkiem opisu i **podsumowaniem stanu**, akcja „Dodaj wskaźnik” — jako artefakt w Menu 3. To istniejący `ResultsKpiScorecardDetailPage` (`/results/kpi/scorecards/:id`), nie siatka kafelków.
- **Poziom 3** = karta N pojedynczego wskaźnika / celu (`KpiToolPage`, `OkrObjectiveCardPage`) z historią przez wszystkie okresy; przy celu **kluczowe rezultaty są sekcją karty, nie kolejnym poziomem**; właściciel celu jest kolumną tabeli poziomu 2.
- **ROI** = dwa poziomy (tabela analiz → karta N analizy) — bez zmian.

Co 05.09 zbudowano niezgodnie i podlega korekcie (P7K): poziom 2 jako siatka kafelków (`KpiCardSetPage`, trasa `/results/kpi/zestawienie/:id`) zamiast istniejącej tabeli zestawienia; OKR z czterema poziomami (zestaw → cele → karta celu → zbiór KR → karta KR) zamiast trzech; rejestr KPI bez wymiaru okresu.
