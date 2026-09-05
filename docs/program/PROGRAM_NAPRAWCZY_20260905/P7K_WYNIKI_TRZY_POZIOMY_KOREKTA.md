# P7K — Wyniki: trzy poziomy wg decyzji właściciela (korekta budowy z 05.09)

## 1. Cel dla użytkownika
W Wynikach klikam KPI, OKR albo ROI w Menu 2 i widzę **tabelę raportów** (zestawień okresowych). Otwieram raport i mam **tabelę jego pozycji** z podsumowaniem stanu i przyciskiem „Dodaj wskaźnik”. Klikam pozycję i pracuję na **karcie N** jednego wskaźnika lub celu, z historią przez wszystkie okresy. ROI: tabela analiz → karta analizy.

## 2. Zakres
Moduł 09 Wyniki (niezamrożony). Ekrany: `results-vnext-kpi-registry`, `results-vnext-kpi-scorecards` (L2), `wskaznik-jedna-karta` (L3), `results-vnext-okr-registry`, `cel-jedna-karta`, `roi-jedna-karta`. Źródło koncepcji: `docs/program/grafika/DECYZJA_WYNIKI_TRZY_POZIOMY.md` (30.08 + uzupełnienie 05.09 — słowa właściciela). Dowody stanu dzisiejszego: `evidence/odbior-zywo-20260905/kpi-3poziomy/`, `evidence/odbior-zywo-20260905/08-wyniki/okr-cel/`.

## 3. Przyczyna źródłowa
Budowa z 05.09 (`b43cdf5ee8`, `212265a793`) wprowadziła: (a) L2 jako siatkę `StandardGridCard` w nowym `KpiCardSetPage.tsx` pod `/results/kpi/zestawienie/:scorecardId`, choć L2 istnieje jako tabela z podsumowaniem („Bezpieczne · Ostrzeżenie · Krytyczne · Brak danych”) i „Dodaj KPI” w `src/components/ResultsVNext/kpiScorecards/ResultsKpiScorecardDetailPage.tsx` (`/results/kpi/scorecards/:scorecardId`, `kpiScorecardPresenters.tsx:333-336`, `:661`); (b) rejestr KPI bez wymiaru okresu (zestawienie = raport za okres; snapshoty przeglądu istnieją: `review-snapshots` w `server/src/routes/resultsVnext/kpiScorecard.routes.ts`); (c) OKR z czterema poziomami (`OkrKeyResultSetPage`, `OkrKeyResultCardPage`) — decyzja nr 3 z 30.08 mówi: trzy poziomy, osoba to kolumna, KR w karcie celu.

## 4. Projekt rozwiązania
- **L1 KPI** (`ResultsKpiRegistryPage.tsx`): tabela raportów = zestawienie × okres przeglądu (ostatni opublikowany snapshot lub bieżący okres wg `reviewCadence`); kolumny: NAZWA · OKRES · OPIS · POZYCJE · WŁAŚCICIEL · STAN (rozkład Bezpieczne/Ostrzeżenie/Krytyczne/Brak) · AKTUALIZACJA; `StandardTable` + `StandardPreview` (podgląd = opis + rozkład + pozycje jako relacje + „Otwórz raport”). Pigułka „Wszystkie wskaźniki” znika z Menu 3 (decyzja nr 2: płaska lista niepotrzebna); dostęp do wskaźnika przez raport lub wyszukiwarkę.
- **L2 KPI**: klik wiersza → istniejący `ResultsKpiScorecardDetailPage` (tabela pozycji, podsumowanie w nagłówku, „Dodaj KPI” → etykieta „Dodaj wskaźnik”), montowany jako artefakt w Menu 3 z okruszkiem „Rejestr KPI › <raport>”. Usunąć `KpiCardSetPage.tsx`, trasę `CARD_SET` i `kpiCardSetPath.ts` LUB zredukować `kpiCardSetPath.ts` do budowy okruszka (bez własnej strony). Wiersz L2 → L3.
- **L3 KPI**: `KpiToolPage` bez zmian kompozycji; okruszek 3 stopnie; sekcja „Karty wyników i kontrakty” pokazuje wszystkie raporty, w których wskaźnik występuje (jedna tożsamość, wiele okresów).
- **OKR**: L1 tabela raportów OKR = zestaw × cykl (`cycleId`, `/results/okr/cycles` już istnieje), kolumny jak KPI + WŁAŚCICIEL celu jako kolumna filtrowalna na L2; L2 = tabela celów zestawu (istniejąca lista celów w `ResultsOkrHub`/`OkrSetOverviewView` sprowadzona do `StandardTable`); L3 = `OkrObjectiveCardPage` z KR jako sekcją (dzisiejsza sekcja „Kluczowe rezultaty” zostaje); **usunąć** trasy i strony `OkrKeyResultSetPage`, `OkrKeyResultCardPage` (KR otwiera się w karcie celu, nie osobno).
- **ROI**: bez zmian (2 poziomy).
- Kanon: StandardModuleBar/StandardTable/StandardPreview/N-card, `c-*`, zero `primary-*`, kebab pionowy, i18n pl+en; brak danych = „—”/„Brak danych”, nigdy 0.

## 5. Kroki wykonania
1. [S] Okruszek: `kpiCardSetPath.ts` → tylko budowa ścieżki `Rejestr KPI › raport › wskaźnik`; usunąć eksport strony. 
2. [M] L1 KPI: kolumny raportu (okres + rozkład stanu z `statusDistribution` — już liczone w `kpiScorecardPresenters.tsx`), klik → `/results/kpi/scorecards/:id`; usunąć pigułkę „Wszystkie wskaźniki”; „Bez zestawienia” zostaje jako raport systemowy.
3. [S] L2 KPI: `ResultsKpiScorecardDetailPage` dostaje okruszek + etykietę „Dodaj wskaźnik”; klik pozycji → `/results/kpi/:kpiId?zbior=<id>`.
4. [M] Usunięcie `KpiCardSetPage.tsx`, trasy `CARD_SET` (`routeConfig.ts:178`, `AppRoutes.tsx`), testów siatki; test `KpiTrzyPoziomy.test.tsx` przepisany na L1 tabela → L2 tabela zestawienia → L3 karta.
5. [M] OKR L1: tabela raportów (zestaw × cykl) w `ResultsOkrHub`/rejestrze; L2: tabela celów zestawu z kolumną WŁAŚCICIEL (filtr); klik → `OkrObjectiveCardPage`.
6. [M] OKR: usunąć `OkrKeyResultSetPage`, `OkrKeyResultCardPage`, ich trasy i linki; sekcja „Kluczowe rezultaty” w karcie celu jest jedynym miejscem KR (rozwijane bloki z START/CEL/BIEŻĄCA — już są).
7. [S] i18n pl+en dla nowych kolumn/etykiet; test okruszków dla KPI i OKR z dowodem mutacyjnym (zła kolejność poziomów → test pada).
Moduł 09 nie jest zamrożony — bez markerów.

## 6. Testy
Jednostkowe: kolumny L1 (okres, rozkład), klik wiersza L1 → trasa scorecard; L2 → L3 z `?zbior`; OKR: brak tras KR; okruszki 3-stopniowe. Wizualne: L1 z podglądem, L2 tabela z podsumowaniem, L3 karta — 1280/1440/1920, jasny+ciemny. Przepływ: Wyniki → KPI → raport → pozycja → karta → „Karty wyników i kontrakty” pokazuje raport, z którego przyszedłem.

## 7. Kryterium odbioru właściciela
Klikam KPI, widzę tabelę raportów; klikam raport, widzę tabelę jego wskaźników z podsumowaniem i „Dodaj wskaźnik”; klikam wskaźnik, widzę kartę. To samo dla OKR (cele, właściciel jako kolumna, rezultaty w karcie celu). ROI: tabela analiz → karta.

## 8. Ryzyka i cofanie
Ryzyko: rozkład stanu wymaga snapshotu — bez niego „Brak danych” (uczciwie). Cofanie: revert merge P7K; tagi `mvp-final-*` nie dotyczą 09.

## 9. Nakład
~2,5 dnia Sonnet (przepięcie istniejących ekranów; zero nowych komponentów, dwa usunięte).

## 10. Cel osiągnięty = samokontrola Codexa
| Komenda | Oczekiwany wynik |
| --- | --- |
| `npx esbuild <zmienione pliki> --bundle --platform=browser --outdir=/tmp/esb --log-level=error --loader:.png=file --loader:.svg=file` | exit 0 |
| `npx vitest run tests/components/ResultsVNext/KpiTrzyPoziomy.test.tsx tests/unit/results-okr src/components/ResultsVNext/__tests__` | PASS; dowód mutacyjny: zamiana kolejności poziomów lub przywrócenie trasy KR → testy padają |
| `rg -n -e "KpiCardSetPage" -e "OkrKeyResultSetPage" -e "OkrKeyResultCardPage" -e "zestawienie/:scorecardId" src` | 0 trafień |
| `bash scripts/check-list-canon.sh && bash scripts/check-artefakt.sh` | `OK`, dług nie rośnie |

Pomiar na żywo (własny vite, sesja `ODBIOR_AUTH_STATE`, host 127.0.0.1): `zrzut.mjs --url=/results/kpi` (L1 z kolumną OKRES i STAN), `--klik="css=tbody tr:first-child"` (podgląd), `--url=/results/kpi/scorecards/<id>` (L2: tabela pozycji, nagłówek z podsumowaniem „Bezpieczne · Ostrzeżenie · Krytyczne · Brak danych”, przycisk „Dodaj wskaźnik”, okruszek 2 stopnie), `--url=/results/kpi/<kpiId>?zbior=<id>` (L3: okruszek 3 stopnie, sekcja „Karty wyników i kontrakty” z raportem), `--url=/results/okr` (tabela raportów OKR z OKRESEM), L2 OKR (tabela celów z kolumną WŁAŚCICIEL), L3 karta celu z sekcją KR; `--url=/results/okr/<set>/objectives/<id>/rezultaty` → **przekierowanie lub 404 aplikacji**, nie strona.
Progi: `dom.aside.count` ≤ 1; `bledyKonsoli` = 0; `status ≥ 400` = 0 poza udokumentowanym `review-snapshots/published`; zero „0” tam, gdzie brak snapshotu („—”/„Brak danych”); zrzut L2 pokazuje TABELĘ (element `table`), nie siatkę kart; porównanie z obrazem odniesienia L3: `evidence/odbior-zywo-20260905/kpi-3poziomy/L3-karta-N-wskaznika.png`.
**STOP:** progi spełnione → commit `evidence/p7k-wyniki/` + raport; niejasność koncepcyjna → STOP i cytat z `DECYZJA_WYNIKI_TRZY_POZIOMY.md`, nie zgadywanie. Zakazy: `--no-verify`, `git stash`, nowe komponenty tabel/kafelków, flagi.

## 11. Wklejka dla Codexa
```
ZADANIE P7K — Wyniki: trzy poziomy dokładnie wg decyzji właściciela (korekta). Praca do celu.

Katalog: świeży worktree z origin/staging (git worktree add -b codex/p7k-wyniki <dir> origin/staging). Commit per krok, bez push, autor Piotr <piotr.wisniewski@dbr77.com>.
Specyfikacja: docs/program/PROGRAM_NAPRAWCZY_20260905/P7K_WYNIKI_TRZY_POZIOMY_KOREKTA.md + koncepcja docs/program/grafika/DECYZJA_WYNIKI_TRZY_POZIOMY.md (czytaj obie w całości; słowa właściciela w uzupełnieniu 05.09 są wiążące).

CEL: Menu 2 Wyników = KPI · OKR · ROI. KPI: (1) tabela RAPORTÓW = zestawień okresowych (kolumny NAZWA · OKRES · OPIS · POZYCJE · WŁAŚCICIEL · STAN · AKTUALIZACJA, StandardTable + StandardPreview) → (2) klik = istniejąca strona zestawienia /results/kpi/scorecards/:id jako TABELA pozycji z podsumowaniem stanu i „Dodaj wskaźnik” (okruszek Rejestr KPI › raport) → (3) klik pozycji = karta N wskaźnika (KpiToolPage, okruszek 3 stopnie, historia przez okresy). OKR identycznie: raporty = zestaw × cykl → tabela celów (WŁAŚCICIEL jako kolumna) → karta celu z kluczowymi rezultatami JAKO SEKCJĄ. ROI: tabela analiz → karta (bez zmian). USUNĄĆ: siatkę KpiCardSetPage i trasę /results/kpi/zestawienie/:id, pigułkę „Wszystkie wskaźniki”, strony OkrKeyResultSetPage i OkrKeyResultCardPage z trasami. Zero nowych komponentów — tylko przepięcie istniejących.

KROKI: §5 (1→2→3→4, równolegle 5→6, potem 7). Moduł Wyniki niezamrożony — bez markerów.
CEL OSIĄGNIĘTY = §10: rg usuniętych stron = 0, testy poziomów z dowodem mutacyjnym, canon OK; zrzuty L1 (kolumny OKRES i STAN), L2 (TABELA pozycji + podsumowanie + „Dodaj wskaźnik”), L3 (okruszek 3 stopnie, sekcja „Karty wyników i kontrakty” z raportem) dla KPI i OKR, trasa KR nie istnieje; aside ≤ 1, 0 błędów konsoli, brak danych jako „—”. Raport ze ścieżkami zrzutów i SHA. Niejasność koncepcji → STOP z cytatem z decyzji, nie zgadywanie. Zakazy: --no-verify, git stash, nowe komponenty, flagi.
```

## 12. Uzupełnienie 05.09 wieczór — wzorzec raportu z załącznika właściciela
Wiążący wzorzec poziomów 2 i 3: „Apator szablon.xlsx” (analiza w `docs/program/grafika/DECYZJA_WYNIKI_TRZY_POZIOMY.md`, załącznik). Do §4 dochodzi:
- **L2 = tabela mierników raportu** (StandardTable, grupowanie po Obszarze), kolumny: OBSZAR · WSKAŹNIK (metoda/definicja w dymku lub podglądzie) · JEDNOSTKA · KIERUNEK (min/max) · CZĘSTOTLIWOŚĆ · TYP (rozliczeniowy/informacyjny) · ODPOWIEDZIALNOŚĆ · BENCHMARK · LIMIT % · okresy raportu z podwierszem CEL / Rezultat · YTD · STAN. Nagłówek raportu: zakres (zakład/projekt), okres, edycja, rewizja, przygotował, podsumowanie stanu. Akcja „Dodaj miernik”.
- **L3 = karta miernika** z sekcjami: Kontrakt (wszystkie elementy z tabeli), Pomiary (cel/rezultat per okres, YTD, wykres), Odchylenia (miesiąc → cel osiągnięty? → działania wymagane? → problem → przyczyna → działania → odpowiedzialność → termin → komentarz → status OTWARTY/ZAMKNIĘTY), Działania korygujące, Historia przez lata, Karty wyników i kontrakty (raporty, w których miernik występuje).
- **Krok 0 (przed §5):** zmapować elementy miernika na istniejący schemat (`rvn_kpi_*`, `kpiTool` DTO) i wypisać brakujące pola; brakujące dodać addytywną migracją + polem w kontrakcie L3 i kolumną L2. Wynik mapowania w raporcie PRZED kodem (nadzorca potwierdza zakres).
- §10 dodatkowo: zrzut L2 pokazuje kolumny CEL/Rezultat dla ≥ 2 okresów i YTD; zrzut L3 pokazuje sekcję Odchylenia z kolumnami z szablonu; raport mapowania pól z listą „jest / brak / dodano”.

## 13. Uzupełnienie 05.09 wieczór — wzorzec tabeli OKR (obraz właściciela „OKR Planning (Q4)”)
- **L2 OKR = tabela rezultatów zgrupowana po temacie i celu**: kolumny TEMAT · CEL (rozpięty na swoje KR) · KLUCZOWY REZULTAT · WŁAŚCICIEL · ZESPÓŁ · TERMIN · POSTĘP · STAN; nagłówek raportu z nazwą, okresem (cykl), opisem i celem raportu; podsumowanie stanu; akcje „Dodaj cel”, „Dodaj rezultat”. StandardTable z grupowaniem wierszy (rg `groupBy`/`rowGroup` w `FilterableTable`; jeśli brak — komórka celu z `rowSpan` w prezenterze, bez nowego komponentu).
- Klik w wiersz KR → karta celu (L3) przewinięta do tego KR w sekcji „Kluczowe rezultaty”; klik w komórkę celu → karta celu od góry.
- §10 dodatkowo: zrzut L2 OKR pokazuje grupowanie po temacie i celu z rozpiętą komórką celu oraz kolumny WŁAŚCICIEL/ZESPÓŁ/TERMIN; brak trasy osobnej karty KR.

## 14. Rozstrzygnięcie właściciela 05.09: „OKR dotyczy człowieka, KPI dotyczy procesu”
- KPI: podmiot wiersza = proces/obszar; kolumny OBSZAR i ODPOWIEDZIALNOŚĆ; podsumowanie raportu per obszar.
- OKR: podmiot wiersza = człowiek; kolumna WŁAŚCICIEL jest filtrem domyślnym i osią podsumowania („Fred: 3 rezultaty, 1 zagrożony”); karta celu pokazuje osoby i zespoły przy każdym KR; puste stany i etykiety używają słów „właściciel rezultatu”, nie „zasób”.
- §10 dodatkowo: podgląd raportu OKR ma rozkład stanu per właściciel; podgląd raportu KPI ma rozkład per obszar.
