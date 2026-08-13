# AP-09 / AP-10 / AP-11 — Finance shared workspace layer (contracts only)

**Zakres pakietu:** AP-09 Finance Workspace Bar + Focus mode, AP-10 module adapters (5 modułów),
AP-11 Lineage Navigator.
**Data:** 2026-08-10
**Worktree:** `/Users/piotrwisniewski/consultify-wt/gate-a-20260809`, branch `codex/finance-v3-gate-a-20260809`
**Status:** `CODE + TESTS — realny kod, realny przebieg vitest (80/80), BEZ bazy, BEZ deployu, BEZ UI.`

> ## ⚠️ React / UI jest POZA zakresem tego kroku
>
> W `server/src/services/finance/workspace/` **nie ma ani jednego pliku `.tsx`, ani jednego importu
> Reacta i ani jednego odwołania do DOM** — to jest zamierzone i zweryfikowane
> (`grep -rn "from 'react'"` → 0 trafień; katalog zawiera wyłącznie `.ts`).
>
> Ten pakiet mówi **CO** pasek zawiera, **KTÓRE** konfiguracje są nielegalne i **JAK** dane lineage
> zamieniają się w ślad/panel. Nie mówi, jak to wygląda.
>
> Powłoka wizualna (komponent Workspace Bar, layout focus mode, panel „Powiązane") to **osobny krok,
> który wymaga akceptu właściciela na zrzutach** — `CLAUDE.md` reguła 7: „Piotr nigdy nie jest
> pierwszym testerem wizualnym". Kolejność jest nienaruszalna: prototyp → wstępny OK → JA renderuję
> i robię zrzut sam → dopiero potem Piotr patrzy, do akceptu.
>
> To ten sam podział, który AP-01 stosuje między czystą logiką siatki a przyszłym `FinanceDataGrid`,
> a AP-03 między rejestrem komend a przyszłym hookiem klawiatury.

---

## 1. Wejścia przeczytane

| Dokument | Co z niego weszło |
|---|---|
| `FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md` §11 | Struktura paska (lewa/Context popover/środek/prawa), **max 5 bezpośrednich kontrolek po prawej**, „Valuation stepper jest osobnym kompaktowym row", Focus mode (co zostaje/znika, Esc, brak refetchu, zachowanie selection/filters/scroll/focus/draft), Viewport policy, A11y (44 px, status niezależny od koloru, focus restore) |
| `FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md` §5–§9 | Statements P&L/BS/CF + rozbicie „Report section"; Analysis (`Configure KPIs` zamiast Approve na pustym Draftcie); Baseline 2 widoki; Prediction 2 widoki + dwuetapowy Compute; Valuation 7-krokowy flow, „Named step states zamiast czerwonych kropek" |
| `FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md` §6–§8 | Odchudzenie paska (1 primary, max 1 secondary, lifecycle jako jedna kontrolka, More, fullscreen; freshness zlane z CTA); kryterium 1280 px / 60 znaków; DAG nieobowiązkowy łańcuch (Scenario opcjonalne); minimalny ledger krawędzi przed pełnym grafem; DEC-FIN-001…012 |
| `OWNER_REVIEW_REGISTER_2026-08-09.md` | OWN-FIN-004, 005, 007, 011, 012, 013, 016, 017, 018, 019, 020, 021, 022 |
| `server/src/types/finance/{ArtifactRef,WorkspaceState,CellRef,financeValueSemantics}.ts` (AP-00) | `ArtifactRef`, `FinanceWorkspaceState`, `FinanceArtifactFreshness` — użyte, nie przedefiniowane |
| `server/src/services/finance/canonical/lineageService.ts` (WP-B03) | `LineageEdgeRow`, `LineageEdgeType`, `stageRank`, `getAncestors`/`getDescendants` — **opakowane, nie przepisane** |
| `server/src/services/finance/canonical/lifecycleService.ts` (WP-B02) | `BusinessVersionStatus`, `FinanceRole`, `LifecycleAction` |
| `server/src/services/finance/keyboard/*` (AP-03) | Wzorzec pakietu „deklaratywny kontrakt bez DOM" + konwencja `KeyboardCommand.id`, do której pasek się podpina przez `keyboardCommandId` |

---

## 2. Co powstało

Nowy katalog `server/src/services/finance/workspace/` (wcześniej pusty — pierwsza praca AP-09/10/11).

| Plik | Linie | Zawartość |
|---|---|---|
| `workspaceBarContract.ts` | 862 | Twarde limity (`WORKSPACE_BAR_MAX_DIRECT_RIGHT_CONTROLS = 5`, `WORKSPACE_BAR_INLINE_VIEW_LIMIT = 2`, nazwa 120/60 znaków, 1280 px, 44 px); `WorkspaceBarLabel` (klucz i18n + PL); `mergeFreshnessIntoPrimaryLabel` (→ `Nieaktualne · Przelicz`); `WorkspaceBarEnablement` + `resolveControlState` (whitelist, fail-closed); identity (`back`, edytowalna nazwa, `version`, `status`, `freshness`, 6 pól Context popover); `canRenameArtifact` + `validateWorkspaceName`; view navigation (`tabs`/`stepper`, `resolveViewNavigationPlacement`, named step states); kontrolki prawej strony; **`validateWorkspaceBarConfig`** (15 kodów błędów, zwraca WSZYSTKIE naruszenia); `estimateWorkspaceBarLayout` (budżet 1280 px) |
| `focusModeContract.ts` | 348 | 11 regionów chrome z dowodem podziału (`assertFocusModeRegionPartition`); `FOCUS_MODE_PRESERVED_STATE_KEYS` + mapowanie na pola `FinanceWorkspaceState`; `FocusModeSession` + `enterFocusMode`/`exitFocusMode` (przenoszą stan **przez referencję**); `FocusModeEffect` — typ, w którym `refetch` jest **niereprezentowalny**; `ESCAPE_PRECEDENCE` + `resolveEscapeKey`; viewport policy (`classifyViewport`, `viewportCapability`, mobile fail-closed) |
| `moduleAdapters.ts` | 907 | 5 adapterów jako DANE + wspólne `standardLifecycleControl` (11 przejść w jednym menu), `standardMoreItems`, `standardFullscreenControl`, `relatedSecondaryAction`; `buildWorkspaceBarConfig`; `resolvePrimaryAction` (kandydaci w kolejności); `validateModuleAdapter`; `WORKSPACE_VIEW_MANDATES` |
| `lineageNavigatorContract.ts` | 712 | `lineageStageRank` (z `FinanceArtifactTypeValues`, test na rozjazd z `stageRank`); `LINEAGE_EDGE_TOPOLOGY` + `allowedDownstreamCreations`; `LINEAGE_REQUIRED_PARENT_EDGES` + `isOrphaned`; odznaki stale (6 rodzajów); **`buildLineageTrail`** (dane strukturalne, nie string; deterministyczny wybór rodzica; zwijanie środka); **`buildRelatedPanel`** (parents/children/indirect/siblings + `+ Nowy` z preselected source); `computeDepths` (BFS); `LINEAGE_FULL_GRAPH_VIEW` (`auxiliary: true, defaultVisible: false`); `LineageServicePort` + `loadLineageNavigator` |
| `index.ts` | 16 | Barrel export |
| `__tests__/workspaceContracts.test.ts` | 1078 | 80 testów |

---

## 3. Jak spełniono kryteria zadania

### 3.1 Odrzucenie konfiguracji z >5 bezpośrednimi kontrolkami

`WorkspaceBarActions` ma pięć nazwanych slotów (`primary`, `secondary?`, `lifecycle?`, `more?`,
`fullscreen`) **plus** jawną furtkę `extraDirectControls`. Furtka istnieje wyłącznie po to, by
„konfiguracja z 6 kontrolkami" była w ogóle **reprezentowalna, a więc testowalna** — moduł nie ma
powodu jej używać, a jej wypełnienie jest właśnie tym, co wywala walidator.

`countDirectRightControls` liczy menu jako **jedną** kontrolkę — dlatego długa lista życzeń
lifecycle z OWN-FIN-012 (11 przejść) i 9-pozycyjne More nie rozsadzają paska.

Wszystkie pięć modułów ląduje **dokładnie na 5**: `[primary] [Powiązane] [Status ▾] [⋯] [⛶]`.

### 3.2 Freshness zlane z CTA

`mergeFreshnessIntoPrimaryLabel` zwraca strukturę (`prefix` + `action` + spłaszczone `pl`), a nie
sklejony string — żeby prefiks dało się ostylować osobno i podać czytnikowi ekranu jako oddzielną
część. `CURRENT` → brak prefiksu. `STALE_SOURCE` → `Nieaktualne · Przelicz`.

### 3.3 Focus mode: „nie refetchuje" jako gwarancja, nie obietnica

Dwie rzeczy zamiast deklaracji w dokumencie:

1. `enterFocusMode`/`exitFocusMode` przenoszą `FinanceWorkspaceState` **tą samą referencją** — test
   sprawdza `toBe` (tożsamość), nie `toEqual`. Obiekt, który jest tym samym obiektem, nie mógł zostać
   pobrany na nowo, nie mógł zresetować scrolla i nie mógł zgubić draftu.
2. `FocusModeEffect` to unia czterech wariantów: `hide-region`, `show-region`, `move-focus`,
   `announce`. **Nie ma wariantu `refetch`** — efekt danych jest niewyrażalny w typie.

`Esc` nie jest bezwarunkowe: AP-03 wiąże `Escape` z `grid.cancelEdit` w kontekście edycji komórki, a
modal/popover/paleta muszą zamknąć się przed zmianą layoutu. `ESCAPE_PRECEDENCE` rozstrzyga to raz
dla całego modułu.

### 3.4 Adaptery — mandaty widoków

| Moduł | Widoki | Źródło mandatu | Nawigacja |
|---|---|---|---|
| Statements | `P&L`, `Bilans`, `Cash flow` (3) | `PROGRAM_DOC` — handoff §5 | osobny wiersz |
| Analysis | `Wskaźniki`, `Porównanie` (2) | **`INFERRED`** — brak liczby od właściciela | w pasku |
| Baseline Model | `Założenia`, `Wyliczenia` (2) | `OWNER_MANDATED` — OWN-FIN-017 | w pasku |
| Prediction | `Budowa założeń`, `Modele/Wyniki` (2) | `OWNER_MANDATED` — OWN-FIN-019 | w pasku |
| Valuation | 7 kroków w kolejności `Źródło → Założenia → Metody i wagi → Wyniki → Wrażliwość → Doradca wyceny → Eksport` | `OWNER_MANDATED` — OWN-FIN-021 | stepper, osobny wiersz |

Pole `viewsMandate` niesie źródło i referencję **w danych**, a `validateModuleAdapter` porównuje
faktyczną liczbę widoków z mandatem. Dodanie trzeciego widoku do Baseline Model to nie „drobna
zmiana" — to czerwony test z komunikatem cytującym OWN-FIN-017.

### 3.5 Primary zależny od stanu, bez drugiego primary

`primaryCandidates` to lista uporządkowana; wygrywa pierwszy spełniony. Tak wyrażono strukturalnie
regułę OWN-FIN-012 („dla pustej analizy główne CTA prowadzi do uzupełnienia konfiguracji KPI, a nie
do pozornego zatwierdzenia") **bez** dawania paskowi dwóch primary:

- pusty Draft Analysis → `Skonfiguruj wskaźniki`; skonfigurowana → `Nieaktualne · Przelicz`;
- Prediction bez rozstrzygniętych konfliktów → `Sprawdź założenia` (DEC-FIN-004 etap 1), po → `Przelicz`;
- Statements bez mapowania → `Zmapuj źródła`, po → `Uzgodnij`;
- Baseline bez potwierdzonych założeń → `Potwierdź założenia`;
- Valuation bez metod → `Wybierz metody`.

`validateModuleAdapter` wymaga, by **ostatni** kandydat był bezwarunkowy — dzięki temu primary
zawsze się rozstrzyga (test: nawet `viewer` na artefakcie `INVALIDATED` dostaje primary).

`Zatwierdź` wymaga jednocześnie statusu `IN_REVIEW`, roli approver+, **freshness `CURRENT`** i bramek
kompletności. Bramki są whitelistą po nazwie i **brak bramki w kontekście = niespełniona** — pozorny
Approve jest niemożliwy przez konstrukcję, nie przez czujność implementatora.

`Valuate model` **nie istnieje nigdzie** w pasku Models (OWN-FIN-018) — test sprawdza to regexem po
wszystkich identyfikatorach adaptera. Wycena zostaje osiągalna wyłącznie jako relacja downstream.

### 3.6 Lineage Navigator

- **Ślad kompaktowy jako dane, nie string.** `buildLineageTrail` zwraca listę węzłów, z których każdy
  niesie własne `status`, `freshness`, `periodLabel`, `versionLabel` i własną odznakę — czyli dokładnie
  to, czego żąda OWN-FIN-022 („z okresem, statusem i aktualnością **każdego** elementu"). String tego
  nie uniesie. `displayName` (`Scenario Bull v2`) jest składane z metadanych, nigdy parsowane wstecz.
- **Deterministyczny wybór rodzica.** DAG bywa rozgałęziony (Baseline Model ma i Statement Pack, i
  Analysis jako rodzica). Ślad wybiera najbliższy stage upstream, potem priorytet typu krawędzi, potem
  `created_at`, potem id — test podaje te same krawędzie w odwróconej kolejności i oczekuje tego samego
  śladu. Ścieżki nieużyte nie giną: `hasAlternatePaths` je zgłasza, panel „Powiązane" i graf je niosą.
- **Panel „Powiązane"**: rodzice bezpośredni, dzieci bezpośrednie, potomkowie pośredni (`depth ≥ 2`,
  liczony BFS-em — bo `SELECT DISTINCT` w `getAncestors`/`getDescendants` gubi kolumnę `depth`, a
  zmiana zadziałanego, przetestowanego SQL-a byłaby ryzykowniejsza niż policzenie tego po stronie
  wywołującego), rodzeństwo/warianty, oraz `+ Nowy` per dozwolony typ downstream z **preselected
  source = konkretne immutable version id**, nie nazwa.
- **Odznaki**: `SOURCE_CHANGED`, `ASSUMPTIONS_CHANGED`, `DOWNSTREAM_STALE`, `ORPHANED`,
  `NEVER_COMPUTED`, `COMPUTE_FAILED` — każda z etykietą tekstową i `severity` (A11y: status nie może
  zależeć od koloru).
- **Pełny graf jawnie pomocniczy**: `LINEAGE_FULL_GRAPH_VIEW = { auxiliary: true, defaultVisible: false,
  entryPoint: 'related-panel-footer' }` plus pole `rationale` cytujące OWN-FIN-022 i addendum §6.2.
  Przyszły komponent nie promuje grafu na widok domyślny bez edycji flagi, która na piśmie mówi,
  dlaczego jest wyłączona.
- **Opakowanie, nie przepisanie**: `LineageServicePort` jest strukturalnie spełniony przez dzisiejsze
  `lineageService.getAncestors`/`getDescendants`. Import typów jest `import type` — runtime'owy
  wciągnąłby `PostgresDatabase.js` do każdego konsumenta (w tym przyszłego bundla przeglądarkowego)
  tylko po to, żeby odczytać tabelę rang.

---

## 4. Testy

**Realny przebieg:** `npx vitest run server/src/services/finance/workspace/__tests__/workspaceContracts.test.ts`
→ **80 passed / 80**, 1 plik, ~1,2 s.
Typecheck moich plików: `tsc --noEmit --strict` → **0 błędów** (jedyny błąd w wyjściu pochodzi z
nietkniętego `canonical/lineageService.ts` i jest wcześniejszy — patrz §6).

### 4.1 Dlaczego bez bazy — decyzja udokumentowana

Cały pakiet to **kontrakt**: deklaratywna konfiguracja plus czyste transformacje nad danymi, które
podaje wywołujący. Żadna funkcja tu nie otwiera połączenia, a jedyna rzecz o kształcie I/O —
`loadLineageNavigator` — przyjmuje serwis lineage jako wstrzykiwany `LineageServicePort` właśnie po
to, by dało się ją przećwiczyć na zamockowanych wynikach `getAncestors`/`getDescendants`.

Bazodanowa połowa lineage jest już przetestowana tam, gdzie należy, i **na realnym Postgresie**:
`canonicalServices.pg.test.ts` pokrywa `insertEdge`/`getAncestors`/`getDescendants` razem z triggerem
cyklu, a `lineageService.test.ts` czystą kopię reguły rang. Powtórzenie tego tutaj zdublowałoby
pokrycie, nie dodając go. Czego baza **nie** powie: czy pasek modułu ma sześć kontrolek — a to jest
dokładnie to, co ten plik mierzy.

Tam, gdzie mock mógłby ukryć rozjazd, użyto realnej kontroli krzyżowej: test rang importuje
**prawdziwy** `lineageService.stageRank` i porównuje z lokalnie wyprowadzoną kolejnością dla wszystkich
sześciu typów — obie strony nie mogą się rozjechać po cichu.

### 4.2 Pokrycie kryteriów z zadania

| Wymagane kryterium | Test | Wynik |
|---|---|---|
| Konfiguracja z 6 kontrolkami **ODRZUCONA** | „REJECTS a configuration with six direct right-hand controls" — sprawdza też, że legalna konfiguracja siedzi dokładnie na 5 i przechodzi | ✅ |
| Każdy z 5 adapterów przechodzi walidację | `it.each` × 3 zestawy: `validateModuleAdapter`, `validateWorkspaceBarConfig` na skonfigurowanym artefakcie, i to samo na pustym Draftcie (`NEVER_COMPUTED`, zero bramek) | ✅ 15 testów |
| baselineModel **DOKŁADNIE 2** widoki | „Baseline Model has EXACTLY two views: Założenia and Wyliczenia (OWN-FIN-017)" + regresja: adapter z 3. widokiem → `VIEW_COUNT_VIOLATES_MANDATE` | ✅ |
| prediction **DOKŁADNIE 2** widoki | „Prediction has EXACTLY two views: Budowa założeń and Modele/Wyniki (OWN-FIN-019)" | ✅ |
| valuation **7 kroków** | „Valuation has EXACTLY seven steps in the mandated order" — liczba, identyfikatory, kolejność, `stepper` | ✅ |
| Ślad lineage z mocków lineageService | 6 testów śladu + „assembles trail + related panel from mocked getAncestors/getDescendants" (port ze sztucznymi implementacjami, sprawdza też argumenty wywołań) | ✅ |

Pozostałe 50 testów: budżet layoutu, freshness-CTA, kontrolowana zmiana nazwy, fail-closed enablement,
regiony focus mode, tożsamość referencyjna stanu, precedencja `Esc`, viewport policy, topologia DAG,
odznaki stale, sieroty, warianty/rodzeństwo, BFS-owe głębokości, graf pomocniczy.

### 4.3 Kontrola negatywna (czy testy w ogóle potrafią zaczerwienić)

Trzy zamierzone uszkodzenia, każde cofnięte po pomiarze:

| Uszkodzenie | Wynik |
|---|---|
| Limit kontrolek `> 5` zamieniony na `> 99` | 1 failed / 79 passed ✅ |
| Trzeci widok („Oś zdarzeń") dodany do Baseline Model | 3 failed / 77 passed ✅ |
| `enterFocusMode` klonuje `workspaceState` zamiast przenosić referencję | 1 failed / 79 passed ✅ |

Po przywróceniu: 80/80 zielone. Testy nie są dekoracją.

### 4.4 Co znalazła kontrola layoutu (realne ustalenie, nie ozdoba)

Pierwsza wersja `estimateWorkspaceBarLayout` rezerwowała **sztywne** 60 znaków na nazwę i orzekła, że
Analysis potrzebuje 1484 px z 1280 — test poszedł na czerwono. To był błąd modelu, nie paska: w
prawdziwym pasku nazwa jest **jedynym elementem elastycznym** i się skraca z tooltipem, a skrócenie to
nie jest nakładanie. Estymator przepisano: kryterium „brak nakładania" = `treść stała + minimum nazwy
≤ viewport`, a „60 znaków" raportowane jest osobno jako `fitsWithoutTruncation` /
`displayableNameChars`.

Zmierzone przy 1280 px, w najgorszym przypadku (prefiks `Nieaktualne ·` poszerza CTA):

```
statements:    stałe 754px, nazwa dostaje 527px = 70 znaków
analysis:      stałe 960px, nazwa dostaje 320px = 42 znaki
baselineModel: stałe 960px, nazwa dostaje 320px = 42 znaki
prediction:    stałe 1020px, nazwa dostaje 260px = 34 znaki
valuation:     stałe 806px, nazwa dostaje 474px = 63 znaki
```

**Wniosek do przekazania na krok wizualny:** pełne 60 znaków mieści się przy 1280 px tylko tam, gdzie
nawigacja widoków zeszła z paska (Statements, Valuation). Trzy moduły z zakładkami w pasku pokażą
34–42 znaki i będą skracać. To nie jest usterka kontraktu — to konsekwencja reguł odchudzania z
addendum §7 — ale właściciel/design musi to zobaczyć jako świadomą decyzję (skracanie + tooltip),
a nie odkryć na zrzucie.

**Estymator NIE jest testem renderowania.** Nie udowodni „braku nakładania" — to potrafi wyłącznie
realny zrzut przy 1280 px, który (reguła 7) robię ja, zanim Piotr cokolwiek zobaczy. Wartość
estymatora jest inna: to tani, deterministyczny bezpiecznik w CI — dodanie kontrolki albo szerszej
etykiety zaczerwieni test, zanim ktokolwiek cokolwiek wyrenderuje.

---

## 5. Decyzje i osądy własne (do potwierdzenia)

1. **Próg nawigacji w pasku = 2 → Statements ląduje na osobnym wierszu.**
   Addendum §7 mówi literalnie „w pasku dla dwóch widoków, osobna kompaktowa linia przy większej
   liczbie kroków", a handoff §5/§11 nazywa P&L/BS/CF „głównymi widokami" i sadza „główne views" na
   środku paska. Przy trzech widokach Statements te dwa zdania się kłócą. Przyjąłem literalne
   brzmienie nowszego, zawężającego dokumentu (którego kryterium zadanie cytuje wprost) i **zgłaszam
   napięcie zamiast po cichu je rozstrzygać**. Zmiana decyzji = zmiana jednej stałej
   `WORKSPACE_BAR_INLINE_VIEW_LIMIT`; wszystkie adaptery wyprowadzają placement z niej.
2. **Analysis: 2 widoki oznaczone `INFERRED`.** Właściciel nie podał liczby dla Analysis. Wyprowadziłem
   `Wskaźniki` + `Porównanie` z handoff §6 (siatka KPI jako główne płótno; „review startuje w
   changed-only compare"). Oznaczone w danych jako `INFERRED`, żeby nikt nie wziął tego za mandat.
   **Do potwierdzenia przez właściciela.**
3. **`Powiązane` jako jedyne secondary we wszystkich pięciu modułach.** OWN-FIN-022 chce wejścia do
   lineage „z poziomu paska/panelu". Ujednolicenie tego slotu daje wszystkim modułom identyczny pasek
   i dokładnie 5 kontrolek. Alternatywa (Powiązane w More) zwalniałaby slot secondary na coś modułowego
   — do rozważenia, jeśli któryś moduł będzie miał mocniejszego kandydata.
4. **Zmiana nazwy zablokowana na `APPROVED` i statusach terminalnych.** OWN-FIN-011 wiąże rename ze
   statusem i uprawnieniami, ale nie mówi wprost, czy Approved wolno przemianować. Nazwa jest
   metadaną, jednak przemianowanie zatwierdzonego artefaktu już cytowanego downstream to dokładnie ten
   rodzaj cichego przepisania historii, któremu służą reguły lineage (DEC-FIN-007). Ścieżka wspierana:
   reopen / nowa wersja. **Osąd zawodowy wg DEC-FIN-012, do rewizji jeśli właściciel chce inaczej.**
5. **Bramki kompletności jako NAZWY, nie predykaty.** Pasek nie ma dostępu do treści artefaktu, więc
   `requiresGates` niesie nazwy (`analysis.hasConfiguredKpis`), a kontekst wywołania podaje mapę
   `nazwa → bool`. Bramka nieobecna w mapie = **niespełniona** (fail-closed). Kto wylicza te bramki,
   to zakres modułów domenowych — tu jest tylko kontrakt.
6. **Metryki layoutu (`charPx`, `minNamePx` itd.) to szacunki, nie pomiary.** Do skalibrowania przy
   kroku wizualnym realnym fontem; do tego czasu służą jako względny bezpiecznik regresji.
7. **`extraDirectControls` jest furtką celową.** Bez miejsca na szóstą kontrolkę reguła „odrzuć
   konfigurację z 6 kontrolkami" byłaby niereprezentowalna, a więc nietestowalna.

---

## 6. Czego ten pakiet NIE robi (żeby nikt nie policzył tego jako zrobione)

- **Zero UI.** Brak komponentu paska, layoutu focus mode, panelu „Powiązane", steppera wyceny.
  Osobny krok, akcept właściciela na zrzutach.
- **Zero endpointów.** Kontrolowana zmiana nazwy ma tu tylko **walidację**; zapis, readback i historia
  (OWN-FIN-011) to przyszła trasa.
- **Zero migracji i zero dotknięcia bazy.** Nic nie poszło na demo/dev/prod.
- **Nie zmieniono ani jednego pliku poza allowlistą.** `git status` przed commitem pokazuje wyłącznie
  `server/src/services/finance/workspace/` (moje) oraz nietknięte, cudze pliki równoległego pakietu
  Valuation Advisor, których **nie** dodałem do commita.
- **Błąd `tsc` w `canonical/lineageService.ts:177`** (`ASSUMPTION_SNAPSHOT_HASH_FORBIDDEN` spoza unii
  `InsertEdgeResult`) jest **wcześniejszy i cudzy** — plik jest poza moją allowlistą i nietknięty.
  Zgłaszam, nie naprawiam.
- Wykonanie akcji (`Przelicz`, `Zatwierdź`, `+ Nowy`) to silniki, które już istnieją albo powstaną w
  swoich pakietach; ten kontrakt tylko je deklaruje i mówi, kiedy wolno je pokazać.

---

## 7. Bramki, których ten krok NIE otwiera

Zgodnie z sekwencją z addendum §9, Workspace UX to **Gate H**, po Gate A–G. Ten pakiet dostarcza
kontrakt, na którym Gate H będzie można zbudować — nie jest dowodem, że Gate H jest domknięty.
Odbiór wizualny (SPEC-A/TRIADA, lista czekowania, dark+light) w ogóle się jeszcze nie zaczął.
