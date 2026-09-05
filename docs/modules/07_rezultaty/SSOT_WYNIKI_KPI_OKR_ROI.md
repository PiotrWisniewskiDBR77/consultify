---
module_id: MODULE_RESULTS
doc_id: ssot-wyniki-kpi-okr-roi
truth_type: product-target
status: canonical
established: 2026-09-05
decided_by: Piotr (właściciel) — rozmowa odbiorowa MVP 05.09.2026, załączniki właściciela
supersedes: układ nawigacji KPI/OKR zbudowany 05.09 rano (b43cdf5ee8, 212265a793)
---

# Wyniki — jedno źródło prawdy: KPI · OKR · ROI

To jest dokument, do którego wracamy zamiast tłumaczyć po raz piętnasty. Zbiera decyzję z 30.08 (`docs/program/grafika/DECYZJA_WYNIKI_TRZY_POZIOMY.md`), słowa właściciela z 05.09, dwa załączniki właściciela i metodykę ROI właściciela. Szczegóły graficzne: `docs/program/grafika/WYNIKI_ZALOZENIA_GRAFICZNE_20260905.md`. Paczka wykonawcza: `docs/program/PROGRAM_NAPRAWCZY_20260905/P7K_WYNIKI_TRZY_POZIOMY_KOREKTA.md`.

## 0. Zasady nadrzędne (słowa właściciela)
- „KPI, OKR i ROI zaczyna się od tego, że w menu głównym mamy 3 funkcje i każda z nich uruchamia tabelę na ekranie. Tabela jest listą, która oznacza raport.”
- „OKR dotyczy człowieka, a KPI dotyczy procesu.”
- „Jeżeli w danym raporcie ocena jest zgodna z założonymi parametrami, nic się nie dzieje. Jeżeli nie, system od razu powinien sygnalizować to kolorem i zgłaszać problem osobie odpowiedzialnej za dane KPI, aby przygotowała kartę wymuszającą działanie w celu naprawy.”
- Wskaźnik ma jedną tożsamość na wszystkie okresy; płaska lista wszystkich wskaźników nie jest punktem wejścia; podsumowanie tylko na tabeli raportu; osoba w OKR to kolumna, nie poziom (30.08).

## 1. Konstrukcja: trzy poziomy (KPI, OKR) i dwa (ROI)

| Poziom | KPI (proces) | OKR (człowiek) | ROI (inwestycja) |
| --- | --- | --- | --- |
| 1 | **Tabela raportów KPI** = zestawień okresowych (zakład/projekt/dział × okres) | **Tabela raportów OKR** (zakres × cykl) | **Tabela analiz ROI** |
| 2 | **Raport** = tabela mierników z CEL/Rezultat per okres, YTD, podsumowanie, „Dodaj miernik” | **Raport** = tabela rezultatów grupowana temat → cel, właściciel jako kolumna | — |
| 3 | **Karta miernika N** | **Karta celu N** (rezultaty jako sekcja) | **Karta analizy N** |

## 2. KPI — wzorzec raportu (załącznik: `zalaczniki/Apator_szablon_raport_KPI_20260905.xlsx`, CSV obok)
Raport = „Plant Balanced Scorecard” zakładu na rok: nagłówek (zakład, rok, edycja, data rewizji, przygotował). 138 mierników w 14 obszarach. **Elementy miernika**: właściciel nadrzędny (MD) · obszar · nazwa · metoda liczenia · definicja · kierunek (min./max.) · jednostka · częstotliwość (miesiąc / narastająco / kwartał / 2 tygodnie / rok) · typ (rozliczeniowy / informacyjny) · odpowiedzialność · benchmark · dopuszczalny limit [%] · **okresy: 12 miesięcy + YTD, każdy jako para CEL / Rezultat**. Arkusz per miernik = karta: miesiąc → cel osiągnięty? → działania wymagane? → opis problemu → główna przyczyna → opis działań → odpowiedzialność → data zakończenia → komentarze → status OTWARTY/ZAMKNIĘTY.

Karta miernika (poziom 3), sekcje: Wyniki · Kontrakt · Pomiary · Odchylenia (karty działania) · Działania · Raporty (w których występuje) · Historia.

## 3. OKR — wzorzec tabeli (załącznik właściciela: obraz „OKR Planning (Q4)”, opis niżej) + teoria
Obraz: nagłówek z okresem, Description, Goal; tabela **Theme | Objective | Key Result | Owner | Team | Deadline**, cel rozpięty na swoje rezultaty, każdy rezultat z osobą, zespołem, terminem. (Plik obrazu nie został dołączony do repo — pochodzi z czatu; wzorzec jest opisany tu w całości.)
Teoria (Grove; Doerr „Measure What Matters”; Google re:Work; Wodtke „Radical Focus”): cel jakościowy, 3–5 na okres; rezultat mierzalny z datą, 2–5 na cel; ocena 0,0–1,0 (0,7 dobre dla aspiracji, 1,0 dla zobowiązań); pewność tygodniowa niezależna od postępu; check-in co 1–2 tyg.; refleksja końca cyklu; kaskada celów przy własności osobowej; OKR jawne. KPI to zdrowie procesu bez daty końca, OKR to zmiana z datą i właścicielem; KR może wskazywać KPI jako źródło pomiaru.
Kolumny raportu OKR: TEMAT · CEL (rozpięty; ambicja zobowiązanie/aspiracja) · REZULTAT · WŁAŚCICIEL · ZESPÓŁ · START/CEL/BIEŻĄCA · POSTĘP · PEWNOŚĆ · TERMIN · OSTATNI CHECK-IN · STAN. Filtr domyślny: właściciel. Karta celu: Cel · Kluczowe rezultaty (bloki z „Check-in”) · Check-iny · Powiązania · Refleksja.

## 4. ROI — metodyka właściciela (pełny tekst: `docs/program/grafika/ROI_METODYKA_WLASCICIELA_20260905.md`)
Dwa poziomy: tabela analiz → karta N. **Karta analizy ma trzy części, w tej kolejności:**
1. **Założenia** — przedmiot i cel, problem, zakres, horyzont (3/5/7–10 lat), wariant bazowy (BAU) i warianty (0/1/2/3), CAPEX z contingency, ΔNWC, incremental OPEX, korzyści identyfikowane oddzielnie (praca, produktywność × marża, jakość, przestoje, energia, maintenance, zapasy, uniknięte koszty, wartość rezydualna), klasy Hard/Avoided/Soft/Strategic, łańcuch KPI → pieniądze, ryzyka; zasady: sunk costs poza, opportunity cost w środku, zakaz podwójnego liczenia, finansowanie ≠ ekonomika.
2. **Wyliczenia** — cash flow rok 0–n (z tax shield w pełnym modelu); wskaźniki: CAPEX, Annual Net Benefit, ROI (z horyzontem), ARR, Payback, Discounted Payback, NPV, IRR, PI, BCR, Break-even, Margin of Safety; wrażliwość ±20 % (value drivers); scenariusze Conservative/Base/Upside; scoring wielokryterialny; rekomendacja **GO / CONDITIONAL GO / NO-GO**.
3. **Realizacja (Post Investment Review)** — po 3/6/12 mies.: Expected vs Actual per KPI i per korzyść (CAPEX, output, FTE, roczna korzyść, payback) z wariancją; **opis prawdziwości założeń**; **ROI po realizacji**; zamknięcie cyklu Idea → Baseline → Business Case → Investment → Implementation → Measurement → Benefit Realization.
Struktura raportu ROI (Executive Summary … Recommendation, 13 rozdziałów) = kolejność sekcji karty i eksportu do Materiałów.

## 5. Mechanika odchylenia (KPI i OKR)
Wpis rezultatu / check-in → porównanie z CEL i limitem [%] → stan (w normie / ostrzeżenie / krytyczne / brak danych) → kolor na wierszu raportu, w podsumowaniu rejestru i na bloku w karcie → **zgłoszenie do osoby odpowiedzialnej** (powiadomienie w aplikacji + wpis w Skrzynce Mojej Pracy z linkiem; e-mail: do potwierdzenia) → **karta działania** otwarta automatycznie dla okresu (pola z arkusza: problem, główna przyczyna, działania, odpowiedzialny, termin, komentarz, status), widoczna w karcie i w raporcie (ikona przy wierszu) do zamknięcia. W normie = nic się nie dzieje.

## 6. Kanon graficzny (skrót; pełnia w WYNIKI_ZALOZENIA_GRAFICZNE)
Menu 1 okruszek `Wyniki › KPI › raport › miernik`; Menu 2 = KPI · OKR · ROI; Menu 3 dynamiczne z jedną akcją „Dodaj”; StandardTable na poziomach 1–2 (grupowanie po obszarze / temat→cel; kolumny okresów przewijane, stałe przypięte, YTD z prawej; CEL nad Rezultatem w komórce); karta N na poziomie 3; jeden zwijany prawy panel z Teresą jako zakładką; czerwień tylko „poza limitem / otwarta karta działania”, bursztyn „ostrzeżenie”; brak danych = „—”, nigdy 0; polszczyzna bez wyjątku; nazwiska, nie identyfikatory.

## 7. Co dziś jest niezgodne i podlega przebudowie (P7K)
Poziom 2 KPI jako siatka kafelków (`KpiCardSetPage`, `/results/kpi/zestawienie/:id`) zamiast tabeli raportu; rejestr bez wymiaru okresu; OKR z czterema poziomami (`OkrKeyResultSetPage`, `OkrKeyResultCardPage`); brak wyzwalacza odchylenia → karta działania; brak elementów miernika (kierunek, typ, benchmark, limit, CEL/Rezultat per okres) w modelu — do zmapowania w kroku 0 P7K. ROI: karta z narracją (05.09) do rozłożenia na trzy części §4.

## 8. Rytm pracy
Prototyp (dev-render, dane DBR77) → zrzuty nadzorcy → akcept właściciela → budowa (Codex, praca do celu wg §10 paczki) → odbiór nadzorcy → zamrożenie modułu. Właściciel nie odpowiada na pytania o szczegóły; rozstrzyga ten dokument.
