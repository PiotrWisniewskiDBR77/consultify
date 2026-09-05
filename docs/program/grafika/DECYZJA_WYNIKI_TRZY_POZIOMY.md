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

## Załącznik właściciela 05.09: „Apator szablon.xlsx” = raport KPI za miesiąc (analiza CTO)

Plik: `~/Downloads/Apator szablon (1).xlsx` (34 arkusze). Arkusz „Ogólny” = **Plant Balanced Scorecard** zakładu na rok (nagłówek: Zakład, Rok 2024, Edycja 01, Data rewizji, Przygotowany przez). To jest **poziom 2** koncepcji: jeden raport = jedna tabela = wiele mierników za okres.

**Wiersz tabeli = miernik, każdy z zestawem elementów (kolumny):**
| Element | Kolumna w szablonie | Znaczenie |
| --- | --- | --- |
| Właściciel nadrzędny | MD (np. `GD (SALES)`) | dyrektor odpowiadający za grupę |
| Obszar | MT / OBSZAR (`SPRZEDAŻ`, `Produkcja`, `Dyrektor Logistyka`, `Dyrektor Jakość`, `Dyrektor HR`, `CFO`, `Dyrektor Zakupy`, `Utrzymanie Ruchu`, `Growth Officer`, `R&D`, `EHS`, `Product Manager`, `Dyrektor IT/OT`, `PLANT DIRECTOR`) | 14 obszarów, 138 mierników — grupowanie wierszy |
| Nazwa wskaźnika | WSKAŹNIK | np. „WIELKOŚĆ SPRZEDAŻY NETTO (narastająco)” |
| Metoda liczenia | podkolumna | formuła słowna |
| Definicja | podkolumna | opis biznesowy |
| Kierunek + jednostka | Jednostka: `min.`/`max.` w 1. wierszu, jednostka (`LC/1000`, `%`, `szt.`) w 2. wierszu | „min.” = im więcej, tym lepiej (cel minimalny); „max.” = limit górny |
| Częstotliwość | `Miesiąc` (109), `Narastająco`, `Kwartał`, `2 tygodnie`, `Roczny` | okres rozliczenia miernika |
| Typ wskaźnika | `Rozliczeniowy` (93) / `Informacyjny` (29) | rozliczany z odpowiedzialnością vs. tylko obserwowany |
| Odpowiedzialność | dział/rola (`Sprzedaż`, `Technologia`, `COO`…) | kto raportuje |
| Benchmark | BENCHMARK TYC/SKA | wartość odniesienia (typowa/skala) |
| Dopuszczalne limity [%] | próg tolerancji odchylenia | z niego status Bezpieczne/Ostrzeżenie/Krytyczne |
| **Okresy** | 12 kolumn miesięcy + `YTD`, każda w **dwóch wierszach: CEL i Rezultat** | to jest sedno raportu: plan vs wykonanie per okres, narastająco |

**Arkusz per miernik (np. „OEE”, „Karta wskaźnika PRZYKŁAD”) = poziom 3, karta wskaźnika:** nagłówek (nazwa, lata), tabela **miesiąc → Czy osiągnięto cel? → Czy wymagane działania? → Opis problemu → Główna przyczyna → Opis działań → Odpowiedzialność → Data zakończenia → Komentarze → Status (OTWARTY/ZAMKNIĘTY)**. Czyli karta = historia okresów + odchylenie + RCA + działania korygujące + status — dokładnie sekcje dzisiejszego `KpiToolPage` (Wyniki · Kontrakt · Pomiary · Odchylenia · Działania korygujące · Historia).

**Wnioski wiążące dla P7K:**
1. Poziom 1 = raporty (np. „Plant Balanced Scorecard — Zakład X — 2024”, „OKR zakładu — maj”, „OKR projektu — czerwiec”, „OKR — Q1”); wiersz raportu ma: nazwa, zakres (zakład/projekt/dział), okres, edycja/rewizja, przygotowany przez, liczba mierników, stan.
2. Poziom 2 = **tabela mierników raportu** z kolumnami z tabeli wyżej, grupowana po Obszarze, z okresami jako kolumnami (CEL / Rezultat), YTD, i podsumowaniem stanu w nagłówku. Nie siatka kafelków. Dodawanie miernika do raportu w tym miejscu.
3. Poziom 3 = karta miernika: kontrakt (metoda, definicja, jednostka, kierunek, częstotliwość, typ, odpowiedzialność, benchmark, limity) + pomiary per okres (cel/rezultat) + odchylenia z RCA/działaniami/statusem + historia przez lata.
4. Model danych KPI musi nieść: kierunek (min/max), typ (rozliczeniowy/informacyjny), benchmark, limity %, obszar, właściciel nadrzędny, odpowiedzialność, częstotliwość (w tym „narastająco”), CEL i Rezultat per okres, YTD. Sprawdzić w `kpiTool`/`kpiScorecard` schemacie, które pola już są (rg `direction|target|threshold|frequency|owner` w `server/src/routes/resultsVnext` i migracjach `rvn_kpi_*`); brakujące = addytywna migracja.

## Załącznik właściciela 05.09 (2): „OKR Planning (Q4)” — wzorzec tabeli OKR

Obraz od właściciela („to jest tabela OKR”): nagłówek raportu = **nazwa + okres** („OKR Planning (Q4)”), pod nim **Description** (co planujemy, jaką ramą — tu AARRR) i **Goal** (po co ten arkusz). Tabela: **Theme | Objective | Key Result | Owner | Team | Deadline**. Wiersze grupowane po Theme (Acquisition, Activation, Retention, Referrals, Revenue); **jeden Objective rozpina się na kilka wierszy Key Result**; każdy KR ma **własnego Ownera, Team i Deadline**.

**Wnioski wiążące dla OKR w P7K:**
1. Poziom 1 OKR = raporty OKR („OKR zakładu — maj”, „OKR projektu — czerwiec”, „OKR — Q1/Q4”) z opisem i celem raportu w nagłówku.
2. Poziom 2 OKR = **tabela kluczowych rezultatów zgrupowana po temacie i celu**: OBSZAR/TEMAT · CEL (Objective, komórka rozpięta na swoje KR) · KLUCZOWY REZULTAT · WŁAŚCICIEL · ZESPÓŁ · TERMIN · (STAN, POSTĘP — z naszego modelu). Osoba jest kolumną (decyzja nr 3). Podsumowanie stanu w nagłówku, akcja „Dodaj cel / Dodaj rezultat”.
3. Poziom 3 OKR = karta celu N z rezultatami jako sekcją (każdy KR: start/cel/bieżąca, właściciel, termin, check-iny) — bez osobnego poziomu KR.
4. Ta sama konstrukcja co KPI (raport → tabela pozycji → karta), różni się tylko tym, że pozycja OKR ma dwa szczeble w jednym wierszu (cel → rezultat), rozwiązane grupowaniem/rozpięciem komórki, nie kolejnym poziomem nawigacji.

**Rozstrzygnięcie właściciela 05.09 (dosłownie): „OKR dotyczy człowieka, a KPI dotyczy procesu.”**
Konsekwencje: (a) miernik KPI ma jako podmiot **proces/obszar** (Sprzedaż, Produkcja, Logistyka…), a odpowiedzialność jest jego atrybutem; (b) rezultat OKR ma jako podmiot **człowieka** (właściciel rezultatu) — w tabeli OKR kolumna WŁAŚCICIEL jest osią filtrowania i podsumowania („co ma dowieźć Fred w Q4”), w karcie celu każdy KR ma osobę i termin; (c) raport KPI podsumowuje stan procesów, raport OKR podsumowuje zobowiązania ludzi w okresie; (d) etykiety i puste stany mówią to wprost (KPI: „proces”, OKR: „właściciel rezultatu”), a karta celu pokazuje zespół i osoby, nie tylko liczby.

## Mechanika odchylenia — słowa właściciela 05.09 wieczór
> „Każdy miernik będzie u nas miał N-type tabelę, czy to raport, czy ileś kart. Jeżeli w danym raporcie ocena jest zgodna z założonymi parametrami, nic się nie dzieje. Jeżeli nie, system od razu powinien sygnalizować to kolorem i zgłaszać problem osobie odpowiedzialnej za dane KPI, aby przygotowała kartę wymuszającą działanie w celu naprawy.”

Odczyt CTO (potwierdzony przez właściciela opisem zwrotnym 05.09): po wpisaniu rezultatu system porównuje go z CEL i limitem odchylenia [%] → w granicach = brak reakcji; poza limitem = kolor na wierszu i raporcie (ostrzeżenie/krytyczne) + zgłoszenie do osoby z kolumny Odpowiedzialność + **wymuszona karta działania** dla tego okresu (problem · główna przyczyna · działania · odpowiedzialny · termin · komentarz · status OTWARTY/ZAMKNIĘTY), widoczna w karcie miernika i w raporcie, otwarta do zamknięcia działania. To jest istniejąca rodzina RES-F-007/011 (przypadek odchylenia, RCA, działanie korygujące, KPI Recovery Card) — do przepięcia pod ten wyzwalacz. Kanał zgłoszenia: powiadomienie w aplikacji + wpis w Skrzynce Mojej Pracy z linkiem do karty (e-mail: do potwierdzenia przez właściciela). OKR: ta sama mechanika, podmiot = właściciel rezultatu.
