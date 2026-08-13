# Finance — rekomendacje dokończenia modułu

Data: 2026-08-09  
Status: `TARGET RECOMMENDATION / ARCHITECTURE_DECISIONS_MISSING / NO-GO`  
Baseline audytu: `9c23e3d80e`  
Wejścia: rejestr 22 uwag właścicielskich, audyt finansowy, techniczny i UX, ponowna inspekcja kodu oraz ekranów runtime.

Uzupełnienie obowiązkowe przed implementacją: `FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md`.

## 1. Decyzja nadrzędna

Docelowy łańcuch produktu:

`Statement Pack Version → Historical Analysis Version → Baseline Model Version → Scenario Version → Valuation Version`

Każdy element łańcucha jest wersjonowany, ma trwałe źródło, status lifecycle i freshness. Zatwierdzona wersja jest niezmienna. Zmiana źródła nie nadpisuje wyników potomnych, tylko oznacza je jako `stale`.

Nie należy traktować obecnych statusów `Ready/Approved` jako dowodu poprawności. Aktualny moduł pozostaje `NO-GO`, dopóki dane źródłowe, analiza, modele i wyceny nie przejdą niezależnego tie-out oraz testów realDB/runtime.

## 2. Fundament wspólny dla całego Finance

### Rekomendacje funkcjonalne

1. Wprowadzić wspólny lifecycle: `DRAFT → READY_FOR_REVIEW → IN_REVIEW → APPROVED → SUPERSEDED/ARCHIVED`, z `NEEDS_CHANGES` wracającym do Draft.
2. Zatwierdzony artefakt jest immutable; `Otwórz ponownie/Utwórz nową wersję` tworzy Draft vN+1 z rodzicem, powodem, autorem i timestampem.
3. Oddzielić lifecycle od freshness: `Never computed`, `Current`, `Stale: source`, `Stale: assumptions`, `Compute failed`.
4. Zbudować kanoniczny kontrakt wersji artefaktów, optimistic concurrency, idempotency, audyt i atomowe transition services.
5. Zbudować append-only `Finance Lineage`: source artifact/version, target artifact/version, transformation, assumption snapshot/hash, org, author/time. Zakazać cykli i relacji cross-tenant.
6. Ujednolicić semantykę okresów, walut, skali i jednostek. `Missing/N/A` nigdy nie staje się zerem; prawdziwe zero jest osobnym stanem.
7. Operacje długie prowadzić jako compute runs: queued/running/succeeded/failed/cancelled, progress, last success, idempotent retry i cold reopen.
8. Zintegrować fail-closed ochronę lokalnej bazy, audytować historyczne mutacje i utrzymać read-only defense-in-depth; wyjątek auth ograniczyć wyłącznie do sesji.

### Rekomendacje graficzne

1. Zachować zaakceptowany kierunek list i ciemny canvas. Nie redesignować list od zera.
2. W każdym workspace wdrożyć jeden sticky `Finance Workspace Bar` (52–56 px):
   - lewa: powrót, typ, edytowalna nazwa, status, wersja i zwarte meta;
   - środek: główne widoki danego narzędzia;
   - prawa: freshness, ostatnie przeliczenie, primary CTA, secondary actions, More, fullscreen.
3. Usunąć powtórzone tytuły i konkurencyjne nagłówki.
4. Fullscreen/focus mode pozostawia Menu 1, pasek i workspace; `Esc` wychodzi, a tab, scroll, filtry i niezapisany Draft pozostają.
5. Wprowadzić wspólne stany loading/empty/error/stale/unsaved/success oraz lokalny error boundary per workspace.
6. Desktop 1920/1440/1280, tablet 768 i mobile 390; kontrolki min. 44 px, WCAG AA, keyboard-only i statusy niezależne od koloru.

## 3. Statements

### Rekomendacje funkcjonalne

1. Ustanowić Statement Pack Version jako atom źródłowy: P&L, BS, CF, entity/org, okresy, waluta/skala, canonical line i evidence per value.
2. `Ready` dopiero po mapping, period lineage, unit normalization, duplicate policy i reconciliation. Usunąć fallback `confirmed/mapped ⇒ ready`.
3. Obowiązkowe kontrole: Assets = Liabilities + Equity, CF closing cash = BS cash, subtotal/sign convention, kompletność okresów i źródeł.
4. Rozdzielić obecne `Report section` na: `Generuj szkic sekcji raportu`, `Otwórz wynik`, `Opublikuj/Dołącz do raportu`.
5. Panel `Powiązane` pokazuje Analysis, Models, Prediction i Valuation wynikające z trwałego lineage oraz umożliwia `+ New` z preselected source version.

### Rekomendacje graficzne

1. Pasek: nazwa packa, status, okres, `PLN · tys.`, liczba dokumentów; środek P&L/BS/CF; akcje Add file, Recalc, More, fullscreen.
2. Usunąć osobne pionowe linie statusów. W linii tabeli umieścić opisane disclosure buttons: `Jakość 5/5`, `Mapping pełny`, `Okresy: 1 uwaga`, `Źródła 3`.
3. Sticky header i Line item, jawna waluta/skala, hierarchia z opisanym expand/collapse.
4. Panel źródeł resizable/collapsible; na tablet/mobile jako drawer.

### Bramka odbioru

4 firmy × minimum 3 okresy; 100% krytycznych wartości ma period/unit/source; balance i CF tie-out w tolerancji `max(1 jednostka źródłowa, 0,1%)`; non-ready jest blokowane downstream; cold reopen i tenant isolation przechodzą.

## 4. Analysis

### Rekomendacje funkcjonalne

1. Zastąpić prosty modal kreatorem:
   1. source pack/version, okresy, skala;
   2. branża, cel i typ analizy;
   3. rekomendowany zestaw branżowy + pełny katalog KPI + custom formula DSL;
   4. preflight składników, denominatorów, jednostek i benchmarków;
   5. create + compute.
2. Oddzielić Analysis Definition Version, Compute Run i Report/Downstream Selection.
3. KPI przechowuje formula version, składniki i lineage, wartość per period, benchmark source/date/industry, jakość i `N/A reason`.
4. Approved Analysis jest immutable; reopen tworzy nową wersję. Approval wymaga świeżego compute i walidacji.
5. Analysis jest diagnostyką historyczną; nie może nadpisywać kwot ze statementu.

### Rekomendacje graficzne

1. Głównym płótnem jest tabela KPI zgodna ze standardem tabel.
2. Kontroler `Kolumny`: widoczność, kolejność, pin, saved views; presety Zarząd/Analityk/Raport.
3. Kolumny: KPI/kategoria, formuła, dynamiczne okresy, Δ i %, benchmark ze źródłem/datą, interpretacja wyniku/trendu, jakość, downstream uses.
4. Kebab per wiersz i karta szczegółowa: wykres, okresy, formuła, benchmark, interpretacja, lineage i historia.
5. Pusty Draft ma primary CTA `Skonfiguruj wskaźniki`, nie Approve.

### Bramka odbioru

42 kanoniczne ratios + composites albo jawny subset; niezależne przeliczenie ≤0,1%; missing/div-zero daje N/A z powodem; approve blokowane dla stale/error/missing critical; vN+1 zachowuje poprzednie Approved.

## 5. Models

### Rekomendacje funkcjonalne

1. Models = `Baseline / no-decision model`: neutralna kontynuacja relacji historycznych, bez inicjatyw, wydarzeń i decyzji.
2. Źródło: dokładna Approved Statement Pack Version + zgodna Approved Historical Analysis Version. Statement pozostaje SSOT kwot.
3. Dwa widoki: `Założenia` i `Wyliczenia`.
4. Założenia zawierają driver/KPI, actual history, okres bazowy, metodę kalibracji, jednostkę, źródło i forecast value. Brak debt/CAPEX/WC itp. blokuje lub wymaga jawnej estimate — nie fallback do zera.
5. Compute tworzy przyszłe P&L/BS/CF na horyzont wynikający z celu modelu, z P&L→CF→BS, WC, CAPEX, depreciation, odsetkami wynikającymi z istniejącego zadłużenia i retained earnings. Baseline nie stosuje cash/debt plug ani automatycznych decyzji finansowych: wyliczona gotówka może być ujemna (czerwony alarm/funding gap) albo rosnąć jako nadwyżka. Finansowanie, spłata lub alokacja nadwyżek należą do Prediction.
6. Usunąć Events Timeline oraz `Valuate model` z głównego toku Models; eventy migrują semantycznie do Prediction.
7. Po zmianie założeń wyniki są stale do ponownego Compute.

### Rekomendacje graficzne

1. `Założenia`: pełnoszeroka tabela driverów zamiast małych kart po lewej.
2. Kontrolki zależne od typu: slider/stepper + precise input dla %, localized number dla kwot, select dla reguł; undo/reset, safe range i effect preview.
3. Sticky change/validation summary oraz `Potwierdź zestaw założeń`.
4. `Wyliczenia`: ten sam układ P&L/BS/CF co Statements; actual oddzielone od forecast, tie-out summary sticky, kliknięcie linii pokazuje assumption→formula→output.
5. Compute pokazuje progress, last success, stale reason i retry.

### Bramka odbioru

3 okresy historyczne + minimum 3 forecast; miesięczny compute i roczny roll-up; każdy okres bilansuje BS i cash; deterministic/idempotent retry; approve→cold reopen zachowuje exact output hash; brak eventów w baseline.

## 6. Prediction

### Rekomendacje funkcjonalne

1. Źródło = exact Approved Baseline Model Version.
2. Trzy tryby jednego scenario engine:
   - Base/Upside/Downside;
   - manual KPI/driver overrides;
   - fundamental initiatives/decisions.
3. Inicjatywa przechowuje: source version, driver/KPI, statement line, sign/unit, start, ramp-up, duration, implementation cost, owner/source/confidence i formułę.
4. `Compute` uruchamia najpierw preflight założeń: wykrywa overlap, konflikt, double counting i braki, a następnie przedstawia listę rozstrzygnięć z rekomendowanymi rozwiązaniami i wpływem liczbowym. Użytkownik akceptuje lub zmienia propozycje; właściwy compute rozpoczyna się po domknięciu wymaganych rozstrzygnięć. Konflikty nigdy nie są sumowane po cichu.
5. Oddzielić Scenario Assumption Set Version od Compute Run/Output Version.
6. Base scenario musi być identyczne z baseline modelem. CAPEX, WC i financing są jawne.

### Rekomendacje graficzne

1. Dokładnie dwa widoki: `Budowa założeń` oraz `Modele/Wyniki`.
2. Builder: scenario selector, trzy tryby A/B/C, tabela driver deltas i karty/timeline inicjatyw.
3. Prawy impact/validation panel: pokrycie okresów, konflikty, missing source i net impact preview.
4. Wyniki: scenario P&L/BS/CF, variance vs baseline, absolute/Δ/%, porównanie 2–4 scenariuszy; waterfall/tornado jako dodatek.
5. Aktywny scenario/version i freshness zawsze widoczne.

### Bramka odbioru

Base bit-for-bit = baseline; Bull/Bear monotonic tam, gdzie wymuszają to założenia; trzy sprawozdania bilansują się; initiative effects reconciled do delta vs baseline; retry/cold reopen i stale propagation przechodzą.

## 7. Enterprise Valuation

### Rekomendacje funkcjonalne

1. Źródło DCF = exact Approved Baseline Model Version albo Approved Scenario Version z forecastem. Historical Analysis dostarcza diagnostykę, nie forecast DCF.
2. Kanoniczny FCFF: `EBIT(1-t) + D&A - ΔWC - CAPEX`.
3. Pełny WACC breakdown/provenance, `g < WACC`, convention, terminal share warning i EV→Equity bridge.
4. Dodać wersjonowane `Methods & weights`: tylko kompletne metody, suma aktywnych wag = 100%, N/A bez wagi i bez PLN 0; ujawnić korelację wariantów DCF.
5. DCF, multiples/comps i pozostałe metody muszą mieć as-of date, source, normalization i unit contract.
6. `Valuation Advisor` działa na świeżej computed version; oddziela facts/risks/hypotheses/actions, wskazuje evidence, impact i confidence; nie zatwierdza sam.
7. Jedna Valuation Case obsługuje wiele nazwanych i opisanych wariantów/wersji założeń. Historia umożliwia ich otwieranie, porównywanie i zatwierdzanie bez nadpisania poprzednich rezultatów. Advisor analizuje wariant oraz disagreement między wariantami, a wyniki zasila trwały kontekst rozmowy z TRS-em przez artifact/version references.
8. Approval snapshot + status update muszą być jedną transakcją z UNIQUE(version) i idempotent retry.
9. Dokończyć monetary-unit contract i lokalne error boundaries.

### Rekomendacje graficzne

1. Prowadzony flow: `Source → Assumptions → Methods & weights → Results → Sensitivity → Valuation Advisor → Export`.
2. Nazwany stepper complete/current/needs-attention/locked zamiast czerwonych kropek.
3. Methods table: enable, readiness, result, weight, contribution i komunikat czego brakuje.
4. Results: EV/equity, weighted range, contribution chart; każda liczba z PLN/skala/as-of/source version. Brak comps = `Nie skonfigurowano` + CTA.
5. Sensitivity: 5×5, zaznaczona komórka bazowa, wartości + dostępny kolor, tooltip; tornado z formatowaną walutą.
6. Export wybiera wersję, metody, widoki i Advisor oraz pokazuje manifest/provenance.

### Bramka odbioru

Niezależny DCF ≤0,1%; 25 poprawnych i monotonicznych cells; weights=100%; 15/15 compute→approve→reopen/version; Apator około PLN 466 mln, nie 466 tys.; brak całomodułowego crasha i eksport zachowuje wartości, units i sources.

## 8. Nawigacja między modułami

### Rekomendacje funkcjonalne

1. Wspólny lineage navigator pokazuje ancestors, children, indirect descendants, siblings/variants i versions.
2. Source change propaguje `stale`, nie przelicza ani nie zatwierdza automatycznie.
3. Archive zachowuje edges; delete Approved z downstream jest blokowane lub soft-delete z impact preview.
4. Listy filtrują/grupują po source statement, analysis, model, scenario, variant, version i status.

### Rekomendacje graficzne

1. Kompaktowy breadcrumb pod/pomiędzy elementami Workspace Bar: `Statement v3 → Analysis v2 → Baseline v4 → Bull v2 → Valuation v1`.
2. Resizable panel `Powiązane`: Parents, Children, Indirect, Siblings oraz `+ New`.
3. Pełny graf wyłącznie jako widok pomocniczy `Pokaż mapę rodziny`, nie podstawowa nawigacja.
4. Powrót zachowuje filtry, scroll i zaznaczony wiersz listy.

## 9. Kolejność realizacji

1. **P0-0 Security:** zintegrować guard, audyt mutacji, pojedynczy bezpieczny runtime.
2. **P0-1 Data primitives:** period/unit/null semantics, immutable versions, lifecycle, transactions, optimistic concurrency.
3. **P0-2 Lineage:** artifact edges, staleness, tenant isolation, cycle prevention.
4. **P0-3 Statements:** source truth, readiness i reconciliation.
5. **P0-4 Analysis:** creator, KPI engine, compute runs, lifecycle.
6. **P0-5 Models:** neutralny 3-statement baseline i async compute.
7. **P0-6 Prediction:** causal scenario engine.
8. **P0-7 Valuation:** unit/version/FCFF, methods/weights, atomic approval, Advisor grounding.
9. **P1-1 Shared UX:** Workspace Bar, fullscreen, local boundaries i wspólne stany, równolegle po ustabilizowaniu action contracts.
10. **P1-2 Module UX:** Statements compact controls, Analysis table, Models/Prediction workspaces, Valuation 7-step flow.
11. **P2 Polish:** saved views, pełny graf, język/formatowanie, secondary comparisons/exports.

## 10. Dowody wymagane przed GO

- Czysty candidate SHA i kontrolowana lineage zmian; migracje na disposable real Postgres, następnie staging.
- Exact HTTP + SQL readback, fault injection, concurrency i tenant-isolation tests.
- Golden datasets dla minimum 4 firm i 3 okresów; niezależne tie-out P&L/BS/CF, ratios, forecast i DCF.
- Playwright na exact SHA: 1920/1440/1280/768/390, keyboard-only, PL/EN, loading/empty/error/stale/unsaved/success.
- Create/compute/review/approve/reopen/version/compare/export/cold reopen dla każdego typu artefaktu.
- Brak globalnego crasha, timeoutów pozostawiających świeże wyniki, silent-zero, niejawnych jednostek i relacji opartych na nazwach.

Do czasu spełnienia wszystkich bramek status pozostaje `NO-GO / EVIDENCE_MISSING`.
