---
doc_id: program-1-12-realizacja-plan
truth_type: plan
status: do-akceptu-wlasciciela
established: 2026-09-06
author: analityk-architekt (zlecenie 1.12)
pomiar: stanowisko lokalne, API 127.0.0.1:4100, konto audyt@dbr77.local, org DBR77 cc9db573-260f-4a19-927f-f3cc1fbaea38, 2026-09-06 16:10-16:20
---

# 1.12 Realizacja — metodyka PMO, inwentarz 6 zakładek, plan narzędzi i raportów

**Słowo właściciela (06.09 18:10):** „Tutaj wszystkie cztery funkcje w zasadzie leżą i nie
działają. […] Celem jest zarządzanie realizacją inicjatyw, tak jak robią to firmy
konsultingowe […]. Musimy zarządzać zasobami — ludźmi i realizacją zadań — zarządzać
opóźnieniami i przesunięciami, raportować krytyczne wydarzenia, śledzić decyzje, które nie
zostały podjęte na czas, oraz raportować to wszystko na różnych poziomach raportów.”

**Werdykt w jednym zdaniu:** moduł nie jest niezbudowany — jest **podłączony do pustej
rury**; cztery szczegółowe zakładki czytają szkielet runtime-v1, w którym dla DBR77 jest
**0 rekordów**, podczas gdy w tabelach zastanych leży **84 zadania, 35 decyzji (25
otwartych, 12 po terminie), 16 pozycji RAID i 32 sygnały opóźnień**, których żaden z tych
ekranów nie czyta.

---

# CZĘŚĆ A — METODYKA (jak to robią firmy doradcze)

## A1. Szkielet, który powtarza się u wszystkich

Cztery domy (McKinsey Wave/TMO, BCG, Bain Results Delivery Office, KPMG Transformation
Office) różnią się nazwami, a nie mechaniką. Wspólny szkielet:

1. **Biuro realizacji** (TMO / RDO / PMO) — mały, ale umocowany zespół, który **odblokowuje,
   a nie tylko raportuje**. Prowadzi rytm, eskalacje, zależności, śledzenie korzyści
   i uzgodnienie z Finansami.
2. **Rytm (kadencja)** — tygodniowy stand-up „co blokuje”, dwutygodniowy przegląd fali,
   miesięczny przegląd efektu (impact review), kwartalny przegląd wartości / odświeżenie
   portfela. McKinsey opisuje to jako cykl 8–12 tygodni z cotygodniowym „wave room”.
3. **Bramki (stage-gate L0–L5)** — inicjatywa nie „jest w realizacji”, tylko stoi na
   konkretnym poziomie: L0 pomysł → L1 walidacja założeń wartości → L2 business case
   zatwierdzony (zwykle przez Finanse) → L3 komplet kamieni milowych + miesięczny
   harmonogram wartości → L4 „money step” wykonany → L5 efekt potwierdzony przez Finanse.
   Twarda obserwacja branżowa: **wycena z L1 topnieje o ~70 % zanim dojdzie do L5** — dlatego
   plan i realizacja muszą być mierzone osobno, nie jedną liczbą „postęp %”.
4. **RAID** — jeden rejestr Ryzyk, Założeń, Problemów i Zależności. Różnica wobec rejestru
   ryzyk: RAID jest **narzędziem nadzoru** (jeden widok zdrowia dla sponsora/PMO), rejestr
   ryzyk jest narzędziem roboczym zespołu. Zakładany na starcie, przeglądany na każdym
   spotkaniu rytmu.
5. **Rejestr decyzji** — co, kto, kiedy, dlaczego i co z tego wynika; każda decyzja ma
   **termin** i **ścieżkę eskalacji** (np. „sponsor rozstrzyga w 5 dni roboczych”).
   Miernikami nadzoru są: czas rozstrzygania, liczba zaległych decyzji, częstość eskalacji.
6. **Baseline i przesunięcia** — wariancja liczona ZAWSZE względem zamrożonego planu
   bazowego. PRINCE2: przekroczenie tolerancji → **raport wyjątku** → plan wyjątku → nowy
   baseline po zatwierdzeniu. Zasada, która chroni przed oszukiwaniem siebie:
   **„spóźniamy się” NIE jest powodem do re-baseline’u** — re-baseline robi się przy
   zatwierdzonej zmianie zakresu, zdarzeniu zewnętrznym albo formalnym resecie; opóźnienie
   zarządza się planem naprawczym i jawną wariancją.
7. **Zasoby** — porównanie popytu (role × tygodnie) z realną podażą; „mapa cieplna”
   obłożenia zamiast tabeli liczb; konflikt alokacji ma być **ujawniony wcześnie i
   rozstrzygnięty pisemnie**, a nie wygrany przez najgłośniejszego.
8. **Raportowanie RAG na poziomach** — ten sam zestaw danych, trzy–cztery opakowania:
   właściciel inicjatywy (szczegół), PMO (portfel), komitet sterujący (RAG + decyzje),
   zarząd (jedna strona). Szary kolor obok czerwonego/żółtego/zielonego = **luka danych**
   (nie da się ocenić) — to ważne, bo dziś nasz kokpit pokazuje „—” bez wyjaśnienia.

## A2. Wyciąg: praktyka → po co → minimalna forma → co raportuje i komu

| Praktyka | Po co | Minimalna forma w narzędziu | Co raportuje i komu |
| --- | --- | --- | --- |
| Rytm (tyg./mies.) | Wymusza świeżość danych | Data „stan na” + kolejny termin przeglądu na kokpicie | PMO: co jest nieodświeżone >7 dni |
| Bramki L0–L5 | Odróżnia „zaczęte” od „policzone” | Pole „poziom” na inicjatywie + data wejścia | SteerCo: ile inicjatyw stoi na L2 dłużej niż X |
| Kamienie milowe | Jednostka, na której widać poślizg | Lista kamieni z datą planowaną i faktyczną | Właściciel + PMO: kamienie w tym miesiącu |
| Baseline + wariancja | Uczciwy pomiar opóźnienia | `plannedStart/EndDate` zamrożone + `baselineVersion` | SteerCo: dni poślizgu vs baseline |
| Wniosek o przesunięcie | Zmiana daty ma autora i zgodę | Decyzja typu „re-baseline”, termin, zatwierdzający | SteerCo: kto zatwierdził przesunięcie |
| RAID | Jeden widok zagrożeń | Rejestr: typ · tytuł · właściciel · termin · ocena | PMO: TOP ryzyka; SteerCo: tylko czerwone |
| Rejestr decyzji z terminem | Śledzenie decyzji niepodjętych na czas | `dueDate` + `isOverdue` + poziom eskalacji | SteerCo: lista „czekamy na Was” |
| Zasoby (popyt vs podaż) | Wykrycie przeciążeń przed poślizgiem | Rola × tydzień, % obłożenia, luka | PMO/Zarząd: gdzie brakuje ludzi |
| Zdarzenia krytyczne | „Raportować krytyczne wydarzenia” | Sygnał (opóźnienie/blokada/przekroczenie) → interwencja | Wszystkie poziomy, z datą i właścicielem |
| Śledzenie wartości | Plan vs zrealizowany efekt | Wartość oczekiwana / zrealizowana per inicjatywa | Zarząd: mostek wartości |
| RAG + „szary = brak danych” | Uczciwość zamiast fałszywej zieleni | 4 kolory, szary z etykietą czego brakuje | Wszystkie poziomy |
| Migawka raportu | Odtwarzalność („co wiedzieliśmy 3 tyg. temu”) | Raport = zamrożony zrzut + `asOf` | Archiwum SteerCo |

## A3. Źródła (sprawdzone 06.09.2026)

- [McKinsey — The role of the transformation office](https://www.mckinsey.com/capabilities/transformation/our-insights/the-role-of-the-transformation-office)
- [McKinsey — Keeping transformations on target](https://www.mckinsey.com/capabilities/transformation/our-insights/keeping-transformations-on-target)
- [McKinsey Transformation Office / model falowy (opis frameworku)](https://umbrex.com/resources/frameworks/organization-frameworks/mckinsey-transformation-office-wave-based-transformation-model/)
- [Transformation Management Office (TMO) — kadencje i eskalacje](https://umbrex.com/resources/frameworks/project-management-frameworks/transformation-management-office-tmo/)
- [Bain — Results Delivery Office](https://www.bain.com/consulting-services/change-management-results-delivery/results-delivery-office/)
- [Bain — Results Delivery: managing the highs and lows of change](https://www.bain.com/insights/results-delivery-managing-the-highs-and-lows-of-change)
- [BCG — How to create a transformation that lasts](https://www.bcg.com/publications/2024/how-to-create-a-transformation-that-lasts)
- [KPMG — Transformation office setup and delivery (PDF)](https://assets.kpmg.com/content/dam/kpmg/ae/pdf-2021/11/transformation-office-setup-and-delivery.pdf)
- [Stage-gates w zarządzaniu portfelem projektów](https://www.nordantech.com/en/blog/project-portfolio-management/understanding-stage-gates-in-project-portfolio-management)
- [RAID log — czym jest i jak prowadzić](https://asana.com/resources/raid-log)
- [RAID log vs rejestr ryzyk — różnica ról](https://blog.asa.team/raid-log-vs-risk-register/)
- [PRINCE2 — zarządzanie wyjątkami (exception report/plan)](https://www.knowledgetrain.co.uk/project-management/exception-management)
- [PRINCE2 wiki — baselines](https://prince2.wiki/management-products/baselines/)
- [Planview — resource management i capacity planning](https://www.planview.com/resources/articles/mastering-resource-management-and-capacity-planning/)
- [Meisterplan — mapa cieplna obłożenia](https://meisterplan.com/blog/resource-management/allocation-heatmaps-for-capacity-planning/)
- [RAG status — znaczenia i dobre praktyki 2026](https://eleco.com/pm3/knowledge-centre/how-many-rags/)
- [Escalation procedures and decision rights (log decyzji, terminy)](https://umbrex.com/resources/carve-out-playbook/escalation-procedures-and-decision-rights/)

---

# CZĘŚĆ B — INWENTARZ ZASTANEGO (pomiar, nie dokumentacja)

## B1. Główne odkrycie: dwa rozłączne światy danych

Moduł Realizacja czyta z **dwóch niepołączonych źródeł**. Kokpit i część powłoki czytają
tabele zastane (dane są). Cztery szczegółowe zakładki czytają szkielet `runtime-v1`
(danych nie ma). Pomiar HTTP na żywo, org DBR77:

| Endpoint | Wynik | Liczba |
| --- | --- | --- |
| `GET /api/initiatives/runtime-v1/execution-cases` | 200, 12 B | **0 realizacji** |
| `GET /api/initiatives/runtime-v1/my-work/execution` | 200 | 0 zadań, 0 decyzji |
| `GET /api/initiatives/runtime-v1/management-signals` | 200 | **0** |
| `GET /api/initiatives/runtime-v1/interventions` | 200 | **0** |
| `GET /api/initiatives/runtime-v1/report-definitions` | 200 | **0** |
| `GET /api/initiatives/runtime-v1/report-runs` | 200 | **0** |
| `GET /api/initiatives/runtime-v1/capacity-scenarios` | 200 | 1 (rekord z dziś, P11/DEC-421) |
| `GET /api/initiatives/runtime-v1/initiatives` | 200 | 5 (wszystkie utworzone dziś przez P11) |
| — | — | — |
| `GET /api/initiatives?limit=200` | 200, 105 kB | **72 inicjatywy** (EXECUTING 17, BLOCKED 6, TRACKING 3, SCHEDULED 7, DRAFT 9, …) |
| `GET /api/tasks` | 200, 122 kB | **84 zadania** (todo 31, in_progress 30, blocked 10, review 4, done 9); 82 z terminem, 81 z osobą, 64 z inicjatywą, **20 po terminie** |
| `GET /api/decisions` | 200, 28 kB | **35 decyzji**; otwartych 25 (PENDING 10, ESCALATED 15), **12 po terminie**, eskalacja: red 3 / amber 9 |
| `GET /api/raid` | 200, 6,4 kB | **16 pozycji** (RISK 9, ISSUE 4, DEPENDENCY 3), wszystkie OPEN, 16 z właścicielem, **0 z terminem** |
| `GET /api/execution-control/delay-signals` | 200, 15 kB | **32 sygnały** (CRITICAL 20, WARNING 12; LATE_START 13, OVERDUE 19) z uzasadnieniem `whySlipReasons` |
| `GET /api/execution-control/warnings` | 200 | 6 blokad |
| `GET /api/execution-control/risk-signals` | 200 | **0** (mimo 16 pozycji RAID obok) |
| `GET /api/execution-control/capacity/timeline` | 200 | 12 tygodni, **`capacityHours = 0` w każdym**, `allocatedHours = 89,3` → obłożenie 0 % |
| `GET /api/report-builder/definitions?kind=EXECUTION_PACK` | 200, 10 kB | **11 definicji raportów** (globalne, `organizationId: null`), każda z audytorium, kadencją, 5 sekcjami i logiką RAG — **wszystkie po angielsku** |

**Skąd bierze się pustka.** `docs/ssot/KREGOSLUP_WARTOSCI.md` (konwersje #17 i #18) już to
zmierzył: przejście „inicjatywa → przekazanie do Realizacji (handoff)” ma status
**WOŁACZ BEZ EKRANU** (kolejki wycofane z `MyWorkHub`), a „sprawa realizacji → zadanie”
powstaje **wyłącznie z zaakceptowanego handoffu**. Nikt nie może wysłać handoffu → nie
powstaje ani jedna sprawa realizacji → 4 zakładki są puste. Moje liczby potwierdzają to
niezależnie: 26 inicjatyw w locie, 0 spraw realizacji.

**Drugie zawężenie: filtr po projekcie.** `ExecutionHub.tsx:1602,1621,1641,1660,1694` woła
`/tasks?projectId=…`, `/decisions?projectId=…`, `/pmo/health/{projectId}`,
`/execution/{projectId}/health`, `/execution/{projectId}/action-queue` — wszystko zawężone
do JEDNEGO bieżącego projektu. Tymczasem **43 z 72 inicjatyw i 20 z 35 decyzji nie ma
`projectId`** (pomiar). Dlatego kafel „Do rozstrzygnięcia” pokazał **1** zamiast **25**.

## B2. Sześć zakładek — co renderuje, skąd dane, czy działa

| Zakładka | Komponent (plik) | Źródło danych | Stan na pomiarze | Uwagi |
| --- | --- | --- | --- | --- |
| **Kokpit** | `ExecutionSummaryOneLook.tsx` (676 l.), montaż `ExecutionHub.tsx:5924` | `execution-control/*` + `/tasks`+`/decisions` per projekt | **częściowo** — Kondycja i Na czas liczą się, Wartość vs plan = „Brak policzonego ROI”, Obłożenie = „—”, Do rozstrzygnięcia = 1 z 25 | Dobrze zaprojektowany (5 pytań menedżera). Obłożenie „—”, bo `capacityHours = 0` we wszystkich 12 tygodniach; TOP ryzyka puste, bo czyta `risk-signals` (0), a nie `/api/raid` (16) |
| **Realizacje** | tabela w `ExecutionHub.tsx` | `runtime-v1/execution-cases` | **pusto (0)** | Audyt 05.09: kolumny STATUS/TERMIN ucinane bez elipsy (`FilterableTable.tsx:789`, `minWidth: 90`), zimny start 6–8 s z angielskim „Loading…” |
| **Praca** | `ExecutionWorkSurface.tsx` (1218 l.), montaż `:5812/:5821` | `runtime-v1/.../work` przez `fanOutExecutionCases` | **wisi 15–22 s, potem dane stagingowe** | 11 presetów Menu 3 (`:204-216`) — kanon dopuszcza ≤3. Kolumna „Termin / SLA” zawsze „SLA brak”, bo realne zadania nie niosą `slaAt` (komentarz `:219-220`) |
| **Zasoby** | `ExecutionResourcesSurface.tsx` (775 l.), montaż `:5831` | `readOperationalAllocations` + `readExecutionWork` | **szkielet / pusto** | Przyczyna w B3 |
| **Sterowanie** | `ExecutionControlSurface.tsx` (1346 l.), montaż `:5849` | `listManagementSignals()`, `listInterventions()` (`:377-378`) | **0 rekordów u nas; u właściciela 1 rekord po angielsku** | Angielski w B5 |
| **Raporty** | `ExecutionReportsSurface.tsx` (1238 l.), montaż `:5857` | definicje z `/api/report-builder/definitions` (`ExecutionHub.tsx:4291`), migawki z `runtime-v1/report-runs` | **definicje 11 (po angielsku), migawki 0 u nas** | Najlepiej oceniony ekran audytu 05.09 (3/3) |

Zakładka „Kokpit” pojawia się w Menu 2 tylko przy fladze `summaryOneLook`
(`executionModuleTabs.ts:44`); pozostałe pięć jest stałe (`EXECUTION_BASE_TAB_IDS`).

**Flagi** (`executionFeatureFlags.ts`): kolejność URL → localStorage → `import.meta.env` →
domyślna. `ganttBaseline`, `rolloutStages`, `benefits`, `summaryOneLook` są **domyślnie ON
wszędzie poza publiczną produkcją** (ostatnia linia `isPublicProductionHost`).
`execReportsIntelligence` ma **twardy `return false`** przed tą regułą → cztery gotowe
raporty (`reports-intelligence/`: `WorkIntelligenceReport` 535 l., `ResourcesCapacityReport`
303 l., `ControlLoopReport` 238 l., `UnifiedExecutionReportGenerator` 371 l.) są
**napisane, przetestowane i niedostępne dla nikogo** — kształt „biblioteka bez wywołania”.
Ten plik nie ma pułapki rozdzielonego `import.meta.env` (czyta `env?.[key]` bezpośrednio).

## B3. Dlaczego Zasoby się nie ładują — przyczyna z kodu

Trzy warstwy, każda mierzalna:

1. **Endpoint listy jest N+1.** `initiativesExecutionRuntime.routes.ts:4081-4093` — po
   `listExecutionCases()` idzie **sekwencyjna pętla** `for (…) { await findById(); await
   authorize(); }`. Przy 6 realizacjach to kilka sekund, zanim cokolwiek się zacznie.
2. **Jedna realizacja nie odpowiada.** Udokumentowane w `executionCaseFanOut.ts:6-14`:
   `/execution-cases/a3e05d4a-…--acceptance--execution-case/work` nie zwraca odpowiedzi
   (curl 30 s, http 000). Zabezpieczenie `EXECUTION_CASE_FANOUT_TIMEOUT_MS = 12_000`
   degraduje ją do siebie samej. Ale **12 s liczy się dopiero po punkcie 1**, więc audyt
   05.09 zmierzył realnie **15,5–22 s** do rozwiązania
   (`docs/program/AUDYT_AWARD_20260905/B_ocena_inicjatywy_realizacja_wyniki.md`, wiersz
   „Praca”) — powyżej deklarowanego limitu.
3. **Druga ścieżka nie ma zabezpieczenia.** `ExecutionResourcesSurface.tsx:151-190`
   (`loadCases`) używa wachlarza, ale `:215-230` (`load(id)` — wybór pojedynczej realizacji
   z listy) nadal robi goły `Promise.all([readExecutionCase, readOperationalAllocations,
   readExecutionWork])` **bez `AbortSignal` i bez limitu czasu**. Kliknięcie wiszącej
   realizacji przywraca defekt w całości.
   Po 15 s `useDeferredLoading` (`src/hooks/useDeferredLoading.ts:11-13`) przełącza na
   `ErrorState variant="timeout"` — właściciel opisał „szkielet na zawsze”, bo prawdopodobnie
   nie czekał 15 s; nie mogę tego rozstrzygnąć bez zrzutu z jego sesji.

**Czego NIE zmierzyłem:** nie odtworzyłem zawieszenia lokalnie — DBR77 ma 0 realizacji,
więc `/work` odpowiada 404 w 12 ms. Zawieszenie jest własnością konkretnego rekordu na
bazie właściciela. Sposób pomiaru: `curl -m 30` na `/execution-cases/<id>/work` dla każdej
realizacji z listy i porównanie czasów — to samo, co zrobiono 05.09.

## B4. Skąd 4× powtórzone zadania w „Pracy”

**Sprawdziłem i wykluczyłem** oba podejrzenia ze zlecenia:
- `server/scripts/seed-execution-reports-data.ts` — sieje **angielskie** tytuły („Migrate auth
  service to Azure”, „Set up AKS cluster”, …) do własnej, sztucznej organizacji. To nie to.
- `executionCaseFanOut.ts` — **spłaszcza** wyniki z wielu realizacji, nie mnoży rekordów;
  duplikat na wyjściu oznacza duplikat w źródle.
- `executionLocalReviewData.ts` — atrapa 576 linii (2 realizacje pokazowe: „Supply Chain
  Optimization — fala 1”, „Procurement AI Copilot — pilotaż”), aktywna **wyłącznie** przy
  `import.meta.env.DEV && MODE !== 'test'` (`:8`), więc na stagingu (build produkcyjny) nie
  działa. Uwaga dla mierzących: **lokalnie w dev ta atrapa podmienia pustą listę** i
  ekran wygląda na „działający” — pułapka pomiarowa.

**Wniosek:** ciągi „Potwierdzenie planu działań z właścicielem…” i „Wdrożenie i pomiar
efektu pierwszego etapu” **nie istnieją nigdzie w repozytorium** poza fiksturą testu
`ExecutionSurfaces.hangingCase.test.tsx:260` (skopiowaną z ekranu). To są **rekordy w bazie
właściciela** — najpewniej ten sam domyślny plan wygenerowany przy kilku kolejnych
przebiegach akceptacji (daty co dzień = kolejne przebiegi). **Nie potwierdziłem tego
pomiarem** — do rozstrzygnięcia potrzeba zapytania SQL na bazie stagingu: `select
execution_case_id, title, created_at from … order by created_at` i policzenia, ile spraw
realizacji ma identyczny zestaw tytułów.

## B5. Angielski i rekordy testowe w danych właściciela

Trzy ciągi, które właściciel zobaczył, prowadzą do **jednego źródła**:
`tests/e2e/initiatives-execution/aco-definition-browser.spec.ts` — przebieg akceptacyjny
„ACO” (`docs/implementation/FINAL_ACCEPTANCE_CASE_ACO.md`, krok 43):

- `„Apply independently approved Plan resequence”` → `:1367`, `:1385`, `:1398`
- `„Intervention Authority”` → etykieta roli (audyt 05.09 nie znalazł jej w kodzie UI;
  `:1534` ustawia `Intervention verifyBy` na **2026-12-15**)
- `„ACO execution control · 16/17 gru 2026”` → `:1619` (`asOf: 2026-12-16`), `:1649`,
  `:1721` (`asOf: 2026-12-17`), `:1733`

Sam plik testu ma bezpiecznik (`:22-26`: odmawia pracy na bazie innej niż `consultify_b1_`),
więc **test nie zapisał tego na stagingu**. Zapisał to **ręczny przebieg ACO** wykonany na
żywym środowisku. Efekt: w danych właściciela leżą rekordy testowe z datami z przyszłości —
naruszenie zasady „dane demo = twarz produktu, zero rekordów testowych”.

Pozostały angielski: 11 definicji raportów (nazwy, audytorium, kadencja, wszystkie sekcje),
kolumny `Work item / Type / Status / Owner / decision maker / Due / SLA`
(`ExecutionWorkSurface.tsx:172-202` — fallbacki `t()` po angielsku), wartość `MONTH`
w kolumnie OKRES w Zasobach.

## B6. Co jeszcze leży w module (nie na 6 zakładkach)

`RolloutTab` (1605 l.), `ExecutionTimelineView` (Gantt, 1593 l.), `ExecutionWorkloadView`
(752 l.), `BudgetControlPanel` (947 l.), `RolloutStagesPanel`/`RolloutBaselinePanel`/
`CutoverRunbookPanel`/`BenefitsRegisterPanel`/`MitigationPanel`, `WhyRedChain` (łańcuch
„dlaczego czerwone”: sygnały → ryzyka → decyzje → zadania), `Manager/` (6 pasów problemów).
Razem ok. **9 000 linii już napisanego kodu**. Pomiar wykazał, że część ma martwe trasy:
`/api/benefits-register` → 404, `/api/rollout-ext/cutover` → 404, `/api/execution/stats`
i `/api/execution/escalations` → 404 (mimo definicji w `execution.routes.ts`).
Pułapka nazewnicza: `resourceManagement.routes.ts` **nie dotyczy zasobów ludzkich w
realizacji** — to plany abonamentowe i budżet administracyjny.

---

# CZĘŚĆ C — PLAN (do akceptu właściciela; rekomendacja CTO: Tak)

## C1. Model docelowy w jednej stronie

**Obiekty i przepływ:**

```
inicjatywa (zatwierdzona)
   └─ REALIZACJA (jedna na inicjatywę, poziom L2–L5, baseline dat)
        ├─ KAMIENIE MILOWE  (data planowana zamrożona | data aktualna | fakt)
        │     └─ ZADANIA     (właściciel · termin · status · pracochłonność)
        ├─ ZASOBY            (osoba/rola × tydzień: popyt vs podaż vs luka)
        ├─ RAID              (ryzyko · problem · zależność · założenie; właściciel, termin)
        ├─ DECYZJE           (termin · zatwierdzający · poziom eskalacji · co blokuje)
        └─ SYGNAŁY           (opóźnienie · blokada · przeciążenie · przekroczenie budżetu)
              └─ INTERWENCJA (kto, co robi, do kiedy, czy zadziałało)

RAPORT = zamrożona migawka powyższego na dzień X, dla jednego z 4 audytoriów
```

**Przepływ tygodnia (kadencja — to samo, co robi konsultant ręcznie w Excelu):**

| Kiedy | Co system robi sam | Co robi człowiek | Gdzie w module |
| --- | --- | --- | --- |
| Poniedziałek rano | Liczy sygnały: co po terminie, co bez ruchu, kto przeciążony | — | Kokpit + Sterowanie |
| Poniedziałek stand-up | — | Przegląda blokady, przypisuje interwencje | Sterowanie |
| Środa | Przypomina o decyzjach z terminem ≤3 dni | Rozstrzyga albo eskaluje | Decyzje i ryzyka |
| Piątek | Generuje „Tygodniowy pakiet realizacji” | Zatwierdza i wysyła | Raporty |
| Co 2 tyg. | Składa „Zdrowie programu” (RAG per inicjatywa) | SteerCo decyduje | Raporty |
| Miesięcznie | Składa przegląd PMO + wartość plan/wykonanie | Zarząd czyta 1 stronę | Raporty |

**Zasada nadrzędna (z metodyki, A1 pkt 6):** data planowana bez zatwierdzonej decyzji
o przesunięciu **jest niezmienna**. Przesunięcie = decyzja typu „re-baseline” z autorem,
uzasadnieniem i zatwierdzającym. Wtedy „zarządzanie opóźnieniami” przestaje być opinią.

## C2. Sześć zakładek — co ma być

Nazwy proponuję po polsku, bez żargonu. **Odstępstwo od propozycji CTO w zleceniu**:
metodyka rozdziela **rejestr RAID** (nadzór nad zagrożeniami) od **rejestru decyzji**
(śledzenie terminów i eskalacji) — to dwa różne rytmy i dwa różne audytoria. Ale DEC-426
już rozstrzygnęła jeden przełącznik Ryzyka/Rozstrzygnięcia, więc **utrzymuję jedną zakładkę
z przełącznikiem w Menu 3** i tylko zaznaczam, że w Fali 2 warto to rozdzielić.

| # | Zakładka (nazwa) | Cel jednym zdaniem | Menu 3 (chipy ≤3) | Kolumny tabeli | Karta N | CTA Menu 2 | Z zastanego | Rozmiar |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **Kokpit** | Pięć odpowiedzi menedżera w 5 sekund | — (bez Menu 3) | — (kafle + 2 panele) | — | „Tygodniowy pakiet” | ZOSTAJE `ExecutionSummaryOneLook`; NAPRAWIĆ: TOP ryzyka z `/api/raid`, Obłożenie z realnej podaży, zdjąć filtr `projectId`; DOBUDOWAĆ: „stan na” + szary RAG z etykietą braku | **M** |
| 2 | **Inicjatywy w realizacji** | Gdzie stoi każda inicjatywa i o ile się spóźnia | Wszystkie · Zagrożone · Po terminie | Inicjatywa · Poziom (L2–L5) · Właściciel · Start/koniec plan · Odchylenie (dni) · RAG | Realizacja (rekord) | „Przejmij do realizacji” | NAPRAWIĆ źródło: czytać inicjatywy `EXECUTING/BLOCKED/TRACKING` (26 szt.), nie pustą listę spraw; USUNĄĆ zależność od handoffu jako jedynej drogi; NAPRAWIĆ ucinane kolumny | **L** |
| 3 | **Praca** | Co jest do zrobienia, przez kogo, do kiedy | Wszystkie · Po terminie · Zablokowane | Zadanie · Inicjatywa · Osoba · Termin · Status · Poślizg | Zadanie | „Nowe zadanie” | NAPRAWIĆ źródło → `/api/tasks` (84 realne zadania); USUNĄĆ 8 z 11 presetów; USUNĄĆ kolumnę SLA (zawsze puste) — zastąpić „Poślizg (dni)” | **M** |
| 4 | **Zasoby** | Kto jest przeciążony i gdzie brakuje ludzi | Osoby · Role · Konflikty | Osoba/rola · Tydzień · Popyt (h) · Podaż (h) · Obłożenie % · Luka | Osoba (obłożenie) | „Dodaj dostępność” | NAPRAWIĆ: `load(id)` bez limitu czasu (`:215`), N+1 w endpoint (`:4081`); DOBUDOWAĆ **źródło podaży** (bez niego obłożenie zawsze 0) — patrz pytanie 2 | **L** |
| 5 | **Decyzje i ryzyka** | Co czeka na rozstrzygnięcie i co nam grozi | Decyzje · Ryzyka · Po terminie | Tytuł · Typ · Właściciel · Termin · Dni po terminie · Eskalacja | Decyzja / Pozycja RAID | „Nowa decyzja” | ZOSTAJE przełącznik z DEC-426; NAPRAWIĆ źródło → `/api/decisions` (25 otwartych, 12 po terminie, poziomy eskalacji już policzone) + `/api/raid` (16); DOBUDOWAĆ termin na pozycjach RAID (dziś 0 z 16) | **M** |
| 6 | **Raporty** | Zamrożona migawka dla konkretnego audytorium | Raporty · Definicje | Raport · Poziom · Stan na · Autor · Status | Raport (dokument) | „Nowy raport” | ZOSTAJE układ (najlepszy ekran modułu); NAPRAWIĆ: 11 definicji na polski; DOBUDOWAĆ generowanie migawki i eksport DOCX/PDF przez generator z 1.6; USUNĄĆ rekordy „ACO execution control” | **L** |

Wszystko na `StandardModuleBar` / `StandardTable` / `StandardPreview` — zero własnych tabel.

## C3. Raporty na czterech poziomach

| Poziom | Raport | Sekcje | Kadencja | Źródło w systemie | Czy jest w kodzie | Forma |
| --- | --- | --- | --- | --- | --- | --- |
| Właściciel inicjatywy | **Karta realizacji** | postęp, kamienie, zadania po terminie, blokady, decyzje ode mnie | tygodniowo | `/api/tasks` + kamienie + `/api/raid` | częściowo (`WorkIntelligenceReport` 535 l., flaga OFF) | ekran |
| PMO | **Tygodniowy pakiet realizacji** (`weekly-exec`) | postęp, blokady i eskalacje, po terminie, najbliższe kamienie, potrzebne decyzje | tygodniowo | delay-signals (32) + tasks (84) + decisions (25) | definicja **jest** (`report-builder`, EN) | ekran + DOCX |
| PMO | **Poślizg kamieni** (`milestone-slippage`) | 5 sekcji wg definicji | tygodniowo | baseline vs aktualne daty | definicja jest; **danych brak** (kamienie nie istnieją) | ekran |
| PMO | **Zaległe decyzje** (`decision-backlog`) | 5 sekcji, starzenie się decyzji | tygodniowo | `/api/decisions` (12 po terminie) | definicja jest; dane **są** | ekran + DOCX |
| PMO | **Obłożenie zasobów** (`capacity-utilization`) | 5 sekcji | miesięcznie | capacity/timeline | definicja jest; `ResourcesCapacityReport` (303 l., OFF); **brak podaży** | ekran |
| PMO | **Pętla sterowania** | sygnały → interwencje → skutek | tygodniowo | management-signals / interventions | `ControlLoopReport` (238 l., flaga OFF) | ekran |
| SteerCo | **Zdrowie programu** (`program-health`) | RAG per inicjatywa, alerty, pewność dowiezienia + trend, narracja, decyzje do podjęcia | co 2 tyg. | agregat wszystkich powyżej | definicja jest (EN) | ekran + PDF |
| SteerCo | **Pewność dowiezienia** (`delivery-confidence`) | 5 sekcji | miesięcznie | on-time + ryzyka | definicja jest | ekran |
| SteerCo | **Wariancja budżetu** (`budget-variance`) | 5 sekcji | miesięcznie | `budget_entries` | definicja jest + `BudgetControlPanel` (947 l.) | ekran + DOCX |
| Zarząd | **Jedna strona dla sponsora** (`sponsor-onepager`) | postęp, TOP 3 ryzyka, najbliższe kamienie, decyzje od sponsora, osiągnięcia okresu | na żądanie | agregat | definicja jest (EN) | **PDF/DOCX** (generator z 1.6) |
| Zarząd | **Miesięczny przegląd PMO** (`monthly-pmo`) | trend portfela MoM, poślizg, budżet, pewność, obłożenie | miesięcznie | agregat | definicja jest (EN) | PDF |

Pozostałe 2 z 11 definicji (`blockers-recovery`, `cross-dependency`) trzymam jako Falę 2.
**Nie budujemy nowego katalogu raportów** — 11 definicji z audytorium, kadencją, 5 sekcjami
i logiką RAG **już leży w bazie**. Praca to: tłumaczenie, podpięcie realnych danych,
migawka i eksport.

## C4. Kolejność wdrożenia — pięć pakietów

| # | Pakiet | Co dokładnie | Dlaczego tu | Dowód (DEC-400) | Rozmiar |
| --- | --- | --- | --- | --- | --- |
| **R1** | **Dane realne zamiast pustej rury** | Zakładki 2/3/5 czytają `/api/initiatives` (26 w locie), `/api/tasks` (84), `/api/decisions` (25), `/api/raid` (16); zdjąć filtr `projectId` z 5 wołań w `ExecutionHub.tsx`; usunąć rekordy ACO z danych właściciela | Bez tego wszystko inne jest pracą nad pustym ekranem | Jeden zrzut: Praca pokazuje ≥80 wierszy, Decyzje ≥25 (w tym 12 czerwonych), Ryzyka ≥16 | **L** |
| **R2** | **Zasoby przestają wisieć** | `load(id)` z `AbortSignal` + limitem (`ExecutionResourcesSurface.tsx:215`); N+1 w `:4081` na jedno zapytanie; źródło podaży godzin (pytanie 2) | Druga najgorzej oceniona zakładka; przyczyna znana i wąska | Czas do pierwszego wiersza <3 s przy realizacji, która nie odpowiada; mutacja: usunięcie limitu → test RED | **M** |
| **R3** | **Kamienie milowe i baseline** | Obiekt kamienia (data planowana zamrożona / aktualna / fakt); decyzja „re-baseline” z zatwierdzającym; kolumna „Odchylenie (dni)” | Bez kamieni nie ma poślizgu, a bez baseline’u nie ma uczciwego opóźnienia | Zrzut: inicjatywa z odchyleniem +40 dni (mamy taki sygnał: „Legacy Decommission”, LATE_START, 40 dni) | **L** |
| **R4** | **Raporty na 4 poziomach** | 11 definicji na polski; migawka `asOf`; eksport DOCX/PDF generatorem z 1.6; włączenie `execReportsIntelligence` po akcepcie na zrzucie | Materiał gotowy w 80 %; to jest to, o co właściciel prosi wprost | Cztery pliki (właściciel/PMO/SteerCo/zarząd) otwarte i przeczytane; zero angielskiego | **L** |
| **R5** | **Rytm i zdarzenia krytyczne** (Fala 2) | Sygnał opóźnienia → powiadomienie do Skrzynki → karta działania (dziś KRĘGOSŁUP #23: 32 sygnały, **zero powiadomień**); „stan na” i przypomnienia kadencji | Domyka pętlę P7K dla Realizacji, ale nie blokuje pokazu | Odchylenie → powiadomienie → karta działania, jeden przebieg klikany | **M** |

**MVP właściciela = R1 + R2 + R4.** R3 jest metodycznie konieczne, ale można je pokazać na
danych zastanych (`plannedStartDate`/`plannedEndDate`/`baselineVersion` **już są kolumnami**
inicjatywy — pomiar B1). R5 = Fala 2.

## C5. Pięć pytań do właściciela

| # | Pytanie | Rekomendacja CTO |
| --- | --- | --- |
| 1 | Czy „Realizacja” ma pokazywać **wszystkie inicjatywy w toku** (26), czy tylko te formalnie przekazane handoffem (dziś: 0)? | **Wszystkie w toku.** Handoff zostaje jako opcjonalna bramka jakości, nie jako warunek istnienia. Inaczej moduł jest pusty do końca Fali 2. |
| 2 | Skąd bierzemy **podaż godzin** dla obłożenia — etat z profilu osoby, ręczna dostępność tygodniowa, czy nie liczymy obłożenia w MVP? | **Etat z profilu** (np. 40 h/tydz. × dostępność %) — jedna liczba na osobę, edytowalna. Bez tego kafel „Obłożenie” zostaje „—” na zawsze. |
| 3 | Czy przesunięcie terminu ma **wymagać decyzji z zatwierdzającym** (metodyka), czy właściciel inicjatywy zmienia datę sam? | **Wymagać** — to jest cała wartość „zarządzania przesunięciami”. Kompromis: pierwsze przesunięcie swobodne, kolejne przez decyzję. |
| 4 | Ile raportów w MVP: **4 (po jednym na poziom)** czy wszystkie 11 definicji? | **4.** Reszta zostaje w katalogu Definicje jako widoczne, ale niewygenerowane. Lepiej cztery działające niż jedenaście pustych. |
| 5 | Czy mogę **usunąć rekordy testowe ACO** („ACO execution control · 16/17 gru 2026”, „Apply independently approved Plan resequence”) z Pana danych? | **Tak, usunąć.** To ślad po ręcznym przebiegu akceptacyjnym z datami z przyszłości; psuje każdy zrzut i każdy pokaz. |

---

## Załącznik — czego NIE zmierzyłem (uczciwie)

1. **Nie odtworzyłem zawieszenia Zasobów/Pracy** — lokalna organizacja ma 0 realizacji, więc
   `/work` odpowiada 404 w 12 ms. Opieram się na pomiarze z 05.09 (15,5–22 s) i na kodzie.
2. **Nie potwierdziłem źródła 4× powtórzonych zadań** — tych ciągów nie ma w repozytorium;
   to rekordy w bazie właściciela. Potrzebne zapytanie SQL na stagingu.
3. **Nie sprawdziłem, czy staging niesie naprawę `fanOutExecutionCases`** — nie wolno mi
   dotykać stagingu. Kod jest w gałęzi bazowej; wdrożenie do zweryfikowania osobno.
4. **Nie liczyłem wierszy wprost w bazie** (brak dostępu do `DATABASE_URL` z mojego
   worktree) — wszystkie liczby pochodzą z odpowiedzi API na koncie właściciela DBR77, czyli
   z tego, co widzi produkt. To mocniejszy dowód niż `count(*)`, ale nie zastępuje go przy
   pytaniu „ile rekordów jest, a ile widać”.
