# Gate E — FIXA HONEST UI — raport naprawy trzech defektów

**Worktree:** `/Users/piotrwisniewski/consultify-wt/fv3p-e-analysis`
**Gałąź:** `codex/fv3p-fixa-honest-ui`
**Punkt startowy:** `57fe0543cc2b8a026d137451a65b18da67d8bd1e`
**SHA końcowy:** `4ce91c1fe536a14cfe8257237158e52e9877399a`
**Data:** 2026-08-12

Trzy commity, jeden per defekt, zgodnie z poleceniem:

| Commit | Defekt |
|---|---|
| `bcca647860` | DEFEKT 1 — surowy `mapping_reason` |
| `6e3abacc93` | DEFEKT 2 — `aria-live` nie ogłasza |
| `4ce91c1fe5` | DEFEKT 3 — `EmptyStateInline` crimson + zaszyty `+` |

## `git diff --stat` (57fe0543cc..HEAD)

```
 src/components/Economics/FinanceHub.tsx            |   2 +
 .../Finance/Prediction/PredictionWorkspace.tsx     |   6 +-
 .../Finance/comments/FinanceCommentsPanel.tsx      |  67 +++---
 .../Finance/compare/FinanceComparePanel.tsx        |  54 ++---
 .../Finance/lineage/FinanceLineageNavigator.tsx    |  59 ++---
 .../Finance/savedViews/FinanceSavedViewsPanel.tsx  |  66 +++---
 .../Finance/shared/FinanceLegacyBridgeGate.tsx     |  23 +-
 .../__tests__/FinanceLegacyBridgeGate.test.tsx     |  33 ++-
 .../FinanceStatusAnnouncer.mutation.test.tsx       | 237 +++++++++++++++++++++
 .../shared/NModeBlocks/EmptyStateInline.tsx        |  23 +-
 .../__tests__/EmptyStateInline.test.tsx            |  52 +++++
 src/services/api/financeV2.types.ts                |  67 ++++++
 12 files changed, 577 insertions(+), 112 deletions(-)
```

No pliki spoza allowlisty (`server/**`, `rawEnumLeakScanner.test.ts`, pliki kroków wyceny odpowiedzialne
za szerokość układu) — nietknięte.

---

## DEFEKT 1 — surowy `mapping_reason` na ekranie

**Plik:** `src/components/Finance/shared/FinanceLegacyBridgeGate.tsx:69` (linia oryginalna).
**Naprawa:** `src/services/api/financeV2.types.ts` — nowa funkcja
`financeLegacyBridgeQuarantineReasonLabel(reason: string | null): string`, rozszerzająca **tę samą,
już istniejącą warstwę etykiet** (`financeValueStatusLabel` / `financeValueDisplayReasonLabel`), nie
nową równoległą implementację. `FinanceLegacyBridgeGate.tsx` woła ją zamiast interpolować
`state.reason` wprost.

### Pełny zbiór wartości server-side — jak został ustalony

`mapping_reason` to kolumna `finance_artifact_aliases.mapping_reason` (`TEXT`, **bez CHECK
constraint** — `server/migrations/20260809_finance_v3_b01_core_artifacts.sql:213`). Jedyny skrypt,
który KIEDYKOLWIEK do niej pisze, to `server/scripts/finance-v3-backfill-dry-run.ts` (grep
potwierdzony — `insertAlias(...)` to jedyne miejsce INSERT do tej tabeli w całym repo poza testem
`legacy-id-bridge.routes.pg.test.ts`, który wstawia ręcznie syntetyczny wiersz).

★ Ustalenie ważne dla uczciwości tego raportu: **to NIE jest zamknięty enum.** Dla czterech
legacy-tabel, które most faktycznie odpytuje (`LEGACY_FINANCE_TABLES` w `legacyIdBridgeService.ts`:
`financial_statement_packs`, `financial_analyses`, `financial_models`, `valuations`), klasyfikacja
tabelowa z manifestu WP-A01 (`docs/validation/finance-v3/generated/gate-a/WP-A01_inventory_manifest.json`)
to zawsze `AUTO_MIGRATE`/`MIGRATE_WITH_WARNING` — **żadna z tych czterech tabel nie jest dziś
klasyfikowana `QUARANTINE`/`EXCLUDE_WITH_REASON` na poziomie całej tabeli**, więc w obecnym stanie
backfill-scriptu żaden REALNY wiersz alias tych czterech tabel nie trafia do bazy z
`mapping_confidence=QUARANTINE`. Stan `QUARANTINED` w UI dziś pojawia się wyłącznie dla ręcznie
wstawionych/syntetycznych wierszy (test, dev-render harness) — ale kolumna jest wolnym tekstem i
backfill-script UŻYWA jej gdzie indziej (child-tabele, tabele row-level-quarantine) jako:
- krótkich kodów przypominających `reasonCode` (np. `APPROVED_WITHOUT_SNAPSHOT`),
- pełnych zdań diagnostycznych z `;`/`=` (np. `pack_status=draft;pack_readiness_status=pending`,
  `status=DRAFT; ORCH-DEC-002: financial_analyses is the sole canonical NPV/IRR/ROI source`).

Zmierzone grepem WSZYSTKIE literały `reasonCode`/`mappingReason` w
`server/scripts/finance-v3-backfill-dry-run.ts` (jedyne źródło prawdy):

`APPROVED_WITHOUT_SNAPSHOT` · `DUPLICATE_VERSION_NUMBER` · `ORPHANED_ORG_REFERENCE` ·
`ORPHAN_STATEMENT_NO_PACK` · `CROSS_ORG_STATEMENT_PACK_MISMATCH` · `PARENT_STATEMENT_QUARANTINED` ·
`LEGACY_PARALLEL_STORE_UNRECONCILED` · `AMBIGUOUS_DECISION_EVENT_ZERO_AMOUNT` ·
`AMBIGUOUS_DECISION_EVENT_DUPLICATE` · `EVENT_ONLY_BASELINE_ARCHITECTURE` ·
`SOURCE_MODEL_NOT_MIGRATED` — plus wolnotekstowe zdania (`current_version;model_status=...`,
`superseded_by_next_version`, `child_of_pack=...`, `child_of_statement=...`, `status=...; ORCH-DEC-002:
...`) dla wierszy AUTO_MIGRATE/MIGRATE_WITH_WARNING (nie surfaceowane w UI, bo `hint` czyta `reason`
tylko dla `QUARANTINED`).

### Etykiety (pełna tabela)

| Wartość `mapping_reason` (znormalizowana) | Etykieta PL |
|---|---|
| `APPROVED_WITHOUT_SNAPSHOT` | „Rekord był oznaczony jako zatwierdzony, ale bez zapisanej migawki danych — nie mógł zostać bezpiecznie przeniesiony jako zatwierdzony. Skontaktuj się z zespołem finansowym, aby zweryfikować to zatwierdzenie." |
| `DUPLICATE_VERSION_NUMBER` | „W starym systemie ten sam numer wersji miał więcej niż jeden zapis, więc kolejność wersji nie była jednoznaczna. Wymaga ręcznego uzgodnienia przez zespół danych." |
| `ORPHANED_ORG_REFERENCE` | „Rekord odwoływał się do organizacji, która nie istnieje w systemie. Zgłoś to administratorowi." |
| `ORPHAN_STATEMENT_NO_PACK` | „Rekord nie miał przypisanego nadrzędnego zestawu sprawozdań w starym systemie, więc nie dało się go przenieść samodzielnie." |
| `CROSS_ORG_STATEMENT_PACK_MISMATCH` | „Rekord należał do innej organizacji niż jego nadrzędny zestaw sprawozdań — rozbieżność w starym systemie uniemożliwiła bezpieczne przeniesienie." |
| `PARENT_STATEMENT_QUARANTINED` | „Nadrzędny rekord również został wykluczony z przenoszenia, więc ten element odziedziczył ten sam status." |
| `LEGACY_PARALLEL_STORE_UNRECONCILED` | „Rekord pochodzi ze starszego, równoległego magazynu danych, jeszcze nie uzgodnionego z głównym źródłem. Wymaga decyzji zespołu danych, zanim trafi do nowego systemu." |
| `AMBIGUOUS_DECISION_EVENT_ZERO_AMOUNT` | „Powiązane zdarzenie decyzyjne miało zerową kwotę w starym systemie, co uniemożliwia jednoznaczną interpretację. Wymaga weryfikacji zespołu finansowego." |
| `AMBIGUOUS_DECISION_EVENT_DUPLICATE` | „Powiązane zdarzenie decyzyjne ma dokładny duplikat w starym systemie, co uniemożliwia jednoznaczne przeniesienie. Wymaga weryfikacji zespołu finansowego." |
| `EVENT_ONLY_BASELINE_ARCHITECTURE` | „Model bazuje wyłącznie na architekturze zdarzeń, która nie jest jeszcze obsługiwana w nowym systemie." |
| `SOURCE_MODEL_NOT_MIGRATED` | „Model źródłowy, z którego pochodzi ten rekord, nie został jeszcze przeniesiony do nowego systemu." |
| `null` / pusty | „Nie zapisano szczegółowego powodu." |
| **cokolwiek inne** (wolny tekst, zdania z `;`/`=`, przyszłe kody) | „Powód jest zapisany jako wewnętrzny, techniczny zapis zespołu ds. migracji danych — skontaktuj się z zespołem finansowym, jeśli potrzebujesz szczegółów." (fallback — NIGDY nie echuje surowej wartości) |

Normalizacja (`.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_')`) łapie zarówno `APPROVED_WITHOUT_SNAPSHOT`
jak i `approved_without_snapshot` (forma widoczna na realnych zrzutach/testach) pod tym samym kluczem.

### Dlaczego rozszerzenie, nie nowa implementacja

`financeV2.types.ts` ma już sekcję „ID BRIDGE" z `LegacyBridgeQuarantinedDto` tuż nad miejscem
wstawienia — dodanie funkcji obok, w tym samym pliku, tą samą konwencją (czysty TS, polskie literały,
brak `t()`) co `financeValueStatusLabel`/`financeArtifactFreshnessLabel`, jest bezpośrednią
kontynuacją wzorca, a nie nową równoległą warstwą.

### Piąta granica `rawEnumLeakScanner`

`rawEnumLeakScanner.test.ts` (nietknięty, zgodnie z zakazem) NIE złapałby tego defektu — potwierdzone
uruchomieniem (patrz sekcja Testy niżej): skaner statycznie grepuje znane nazwy właściwości enumów
(`.status`, `.confidence`, `.readiness`, …) w LITERAŁACH kodu; `mapping_reason`/`reason` nie jest na
liście, a wartość pochodzi z ODPOWIEDZI API w runtime, nie z literału w kodzie źródłowym. To piąta
znana granica skanera obok czterech już udokumentowanych w jego nagłówku.

---

## DEFEKT 2 — obszar `aria-live` nie ogłasza

**Pliki:** `FinanceCommentsPanel.tsx`, `FinanceSavedViewsPanel.tsx` (wymagane w briefie) + naprawione
tym samym wzorcem `FinanceComparePanel.tsx`, `FinanceLineageNavigator.tsx` (te dwa dzielą DOKŁADNIE tę
samą klasę defektu — sprawdzone przy przeglądzie wszystkich konsumentów `FinanceStatusAnnouncer`, patrz
niżej). `FinanceExportImportPanel.tsx` (5. konsument) ma JEDEN `return` dla wszystkich stanów, więc
NIE ma tego defektu — nietknięty.

### Mechanizm defektu

`loading`/`error` zwracały `<>...</>` (Fragment) jako korzeń, `loaded` zwracał `<div data-testid="...">`.
Zmiana TYPU korzenia między renderami powoduje w React pełne odmontowanie poprzedniego poddrzewa
(łącznie z `FinanceStatusAnnouncer`) i zamontowanie nowego węzła DOM dla kolejnego stanu — więc
`role="status"` teoretycznie „jest", ale to inny obiekt DOM za każdym razem, gdy panel przechodzi
przez `loading`.

### Naprawa

Jeden stabilny korzeń `<>` dla WSZYSTKICH trzech stanów w każdym z czterech plików;
`FinanceStatusAnnouncer` zawsze pierwszym, tym samym-typu dzieckiem; `content` (drugie dziecko) niesie
różny kształt (loading/error/loaded). Ten sam wzorzec zastosowany identycznie w czterech plikach.

### Dowód `MutationObserver` — przed i po

Nowy plik: `src/components/Finance/shared/__tests__/FinanceStatusAnnouncer.mutation.test.tsx`.

★ Ważna korekta w trakcie pracy: pierwszy szkic testu używał `mockResolvedValueOnce` (natychmiast
rozwiązywana obietnica) dla ponownego `load()` po akcji — React 18 batchuje wtedy przejście przez
`loading` w JEDNYM commit razem z finalnym `loaded`, więc stan `loading` NIGDY nie trafia realnie do
DOM-u jako osobny commit — test przechodził (fałszywie zielono) NAWET na kodzie z defektem. Naprawiony
test trzyma `load()` otwarte ręcznie kontrolowaną obietnicą, wymusza commit `loading`
(`await waitFor(() => expect(screen.getByTestId('comments-panel-loading')).toBeInTheDocument())`),
DOPIERO wtedy sprawdza tożsamość węzła.

**Z defektem** (kod przywrócony do `57fe0543cc` na czas próby, potem odtworzony fix):
```
LOADING STATE COMMITTED. announcer present? true same node as before? false
```
— węzeł `role="status"` uchwycony PRZED kliknięciem to LITERALNIE INNY obiekt DOM niż ten widoczny
podczas `loading`. Test failuje na `expect(...).toBe(announcerBefore)`.

**Po naprawie:**
```
LOADING STATE COMMITTED. announcer present? true same node as before? true
records count 14
characterData ... ->added 0 removed 0
```
— ten sam węzeł, `MutationObserver` zarejestrował realną mutację `characterData`.

### Wszystkie miejsca użycia `FinanceStatusAnnouncer` (sprawdzone)

| Plik | Miał defekt? | Naprawiono |
|---|---|---|
| `FinanceCommentsPanel.tsx` | TAK | TAK |
| `FinanceSavedViewsPanel.tsx` | TAK | TAK |
| `FinanceComparePanel.tsx` | TAK (ten sam wzorzec) | TAK |
| `FinanceLineageNavigator.tsx` | TAK (ten sam wzorzec) | TAK |
| `FinanceExportImportPanel.tsx` | NIE — jeden `return`, announcer zawsze w tym samym miejscu | nietknięty |

---

## DEFEKT 3 — `EmptyStateInline` crimson + zaszyty `+`

**Plik:** `src/components/shared/NModeBlocks/EmptyStateInline.tsx`.

### Naprawa

1. `text-primary-500 hover:text-primary-600` → `text-c-focus-solid hover:underline` (ten sam token
   linku-akcji co „Zastosuj"/„Otwórz ponownie"/„Kopiuj link" gdzie indziej w Finance).
2. Nowe pole `action.showPrefix?: boolean` (domyślnie `true` — zero zmiany zachowania dla istniejących
   wywołań), sterujące prefiksem `+ `.

### Lista WSZYSTKICH konsumentów (sprawdzona przed zmianą sygnatury) i ocena ryzyka kolizji

```
src/components/Economics/FinanceHub.tsx                         Finance — dotknięty (showPrefix:false na 1 call site)
src/components/Finance/Prediction/PredictionWorkspace.tsx       Finance — dotknięty (showPrefix:false na 3 call sites)
src/components/Finance/shared/FinanceLegacyBridgeGate.tsx       Finance — dotknięty (showPrefix:false na 2 call sites)
src/components/Initiatives/InitiativeDocumentView.tsx           poza Finance — NIETKNIĘTY
src/components/Initiatives/sections/DecisionsSection.tsx        poza Finance — NIETKNIĘTY
src/components/Initiatives/sections/GateReadinessSection.tsx    poza Finance — NIETKNIĘTY
src/components/Initiatives/sections/InitiativeTeamSection.tsx   poza Finance — NIETKNIĘTY
src/components/Initiatives/sections/KpisSection.tsx              poza Finance — NIETKNIĘTY
src/components/Initiatives/sections/TargetStateSection.tsx      poza Finance — NIETKNIĘTY
src/components/Initiatives/sections/TasksMilestonesSection.tsx  poza Finance — NIETKNIĘTY
src/components/Interview/InsightCreatorModal.tsx                poza Finance — NIETKNIĘTY
src/components/Interview/InsightViewer.tsx                      poza Finance — NIETKNIĘTY
src/components/Interview/InterviewHub.tsx                       poza Finance — NIETKNIĘTY
src/components/MyWork/Calendar/CalendarView.tsx                 poza Finance — NIETKNIĘTY
src/components/MyWork/DecisionDetailView.tsx                    poza Finance — NIETKNIĘTY
src/components/MyWork/Home/HomeView.tsx                         poza Finance — NIETKNIĘTY
src/components/MyWork/IdeaProcessFlowTool.tsx                   poza Finance — NIETKNIĘTY
src/components/MyWork/IdeaRecommendationMap.tsx                 poza Finance — NIETKNIĘTY
src/components/MyWork/IdeaTableTool.tsx                         poza Finance — NIETKNIĘTY
src/components/MyWork/index.ts                                  poza Finance — reeksport, NIETKNIĘTY
src/components/MyWork/mindmap/NodeDetailDrawer.tsx               poza Finance — NIETKNIĘTY
src/components/MyWork/mindmap/UnifiedNodeDetailDrawer.tsx        poza Finance — NIETKNIĘTY
src/components/MyWork/shared/EmptyState.tsx                     poza Finance — NIETKNIĘTY
src/components/MyWork/table/__tests__/TablePlatformFrontend.test.tsx  test poza Finance — NIETKNIĘTY, re-uruchomiony (przechodzi)
src/components/shared/ToolWizard/ToolWizardShell.tsx            poza Finance — NIETKNIĘTY
src/views/docs/DocsApiReferenceView.tsx                          poza Finance — NIETKNIĘTY
```

**Ocena ryzyka:** ~22 konsumentów POZA Finance. Zmiana koloru (`text-primary-500` → `text-c-focus-solid`)
JEST widoczną zmianą wizualną dla wszystkich (link akcji zmienia kolor z crimson na niebieski) —
ale to bezpośrednie naprawienie naruszenia REPO-WIDE kanonu CLAUDE.md („primary w tailwind = crimson
— zakazany jako kolor UI"), nie nowa decyzja projektowa specyficzna dla Finance — więc NIE zgłaszam
tego jako kolizji wymagającej integratora: to jest dokładnie ten sam token-swap co wykonano już w tej
sesji w Finance-panelach (Comments/SavedViews) do identycznego `text-c-focus-solid`, spójny z resztą
repo. Zmiana `action.showPrefix` (dodanie pola) jest ADDYTYWNA — domyślnie `true` = identyczne
zachowanie jak dziś dla WSZYSTKICH ~22 konsumentów poza Finance, żaden z nich nie renderuje się inaczej
(nie przekazują tego pola). Żaden plik poza Finance nie został zmieniony.

---

## Zrzuty przed/po (Playwright, świeże konteksty)

Harness: `dev-render/screens/finance-id-bridge.tsx` (istniejący, real `<FinanceLegacyBridgeGate>` +
mockowany `fetch`), uruchomiony przez `vite --config dev-render/vite.config.ts --port 58023`.
Scenariusz: `?screen=finance-id-bridge&kind=baseline&state=quarantined&theme=light|dark` — jeden ekran
niesie dowód OBU defektów naraz (surowy `mapping_reason` + crimson „+ Wróć do listy").

Każdy zrzut = **nowy `chromium.newContext()`** (izolowany storage), zero `screencapture`.

| Plik | Opis |
|---|---|
| `screens/fixa/before-light.png` | PRZED (kod z `57fe0543cc`) — jasny: „Powód: approved_without_snapshot.", „+ Wróć do listy" crimson |
| `screens/fixa/before-dark.png` | PRZED — ciemny: to samo |
| `screens/fixa/after-light.png` | PO (bieżący HEAD) — jasny: pełne polskie zdanie, „Wróć do listy" niebieski, bez `+` |
| `screens/fixa/after-dark.png` | PO — ciemny: to samo |

Procedura cofania kodu do stanu PRZED użyła WYŁĄCZNIE `git show 57fe0543cc:<plik> > <plik>`, nigdy
`git stash/reset/clean`. Po każdym zrzucie „przed" pliki przywrócone z kopii zapasowej w `/tmp` i
potwierdzone `git diff --stat` (zero różnicy względem HEAD) — patrz sekcja Kontrole negatywne.

---

## Kontrole negatywne (wszystkie trzy defekty)

Metoda cofania: WYŁĄCZNIE `git show 57fe0543cc:<plik> > <plik>` (nigdy stash/reset/clean — stash jest
współdzielony między worktree). Po każdym mutancie: przywrócenie z kopii `/tmp` + `git diff --stat`
potwierdzający pusty diff względem HEAD.

| # | Co cofnięto | Test | Wynik z defektem | Wynik po przywróceniu |
|---|---|---|---|---|
| 1 | `FinanceLegacyBridgeGate.tsx` | `FinanceLegacyBridgeGate.test.tsx` | **2/6 czerwone** (`toContain('approved_without_snapshot')` znajduje surowy string; fallback-test też łapie `pack_status=draft`) | 6/6 zielone |
| 2 | `FinanceCommentsPanel.tsx` + `FinanceSavedViewsPanel.tsx` | `FinanceStatusAnnouncer.mutation.test.tsx` | **2/2 czerwone**, dokładnie na asercji tożsamości węzła mid-`loading` (`toBe(announcerBefore)` — inny obiekt) | 2/2 zielone |
| 3 | `EmptyStateInline.tsx` | `EmptyStateInline.test.tsx` | **2/4 czerwone** (crimson klasa obecna, prefiks bezwarunkowy) | 4/4 zielone |

Po KAŻDEJ kontroli negatywnej: plik przywrócony z kopii zapasowej `/tmp`, `git diff --stat` = pusty
(zero zmian względem HEAD tej sesji).

---

## Wyniki testów (kody wyjścia + czasy — mierzone `cmd > plik 2>&1; code=$?`, nigdy przez potok)

| Zestaw | Wynik | Czas |
|---|---|---|
| `FinanceLegacyBridgeGate.test.tsx` (6 testów) | **PASS**, exit 0 | 6.18s |
| `FinanceStatusAnnouncer.mutation.test.tsx` (2 testy) | **PASS**, exit 0 | ~2s |
| `EmptyStateInline.test.tsx` (4 testy) | **PASS**, exit 0 | ~1s |
| Pełny `src/components/Finance/**` + `financeV2.types.ts` + `NModeBlocks/**` (64 pliki, 511 testów) | **PASS**, exit 0 | 34.42s |
| `tests/unit/finance/rawEnumLeakScanner.test.ts` | **1 FAIL** (4 PASS) — patrz niżej | 1.37s |
| `npm run type-check` (`tsc --noEmit`, korzeń) | zobacz sekcję TSC niżej | zobacz niżej |

### `rawEnumLeakScanner.test.ts` — 1 istniejący offender, NIE dodany przez tę sesję

```
newOffenders = [
  "src/components/Finance/Prediction/PredictionWorkspace.tsx: {mountCheck.version.status}"
]
```
Zweryfikowane `git show 57fe0543cc:src/components/Finance/Prediction/PredictionWorkspace.tsx` —
**dokładnie ta sama linia istnieje już w punkcie startowym tej sesji** (linia 250, niezmieniona przez
żaden z trzech commitów tej sesji — moje zmiany w tym pliku to wyłącznie 3× `showPrefix: false` w
zupełnie innych blokach `return`). To defekt PRZEDISTNIEJĄCY, poza zakresem trzech naprawianych
defektów, prawdopodobnie terytorium FIX-B (luki dowodowe/skaner). Zero NOWYCH wycieków wniesionych
przez ten pakiet.

### `tsc --noEmit`

```
npm run type-check   (NODE_OPTIONS=--max-old-space-size=8192 tsc --noEmit, korzeń repo)
START 22:05:49
END   22:07:41        (1m52s / 112s — pełny przebieg, nie ucięty; zgodnie z oczekiwaniem ~100–300s)
TSC_EXIT=0
```
Kod wyjścia zmierzony bez potoku (`cmd > plik 2>&1; echo "TSC_EXIT=$?" >> plik`) — nie
`PIPESTATUS`/`| tee` (znana pułapka gubiąca kod wyjścia `tsc`). **Zero błędów.**

---

## Rzeczy niedostarczone i uzasadnienie

- **Nie naprawiono `{mountCheck.version.status}` w `PredictionWorkspace.tsx`** — przedistniejący
  offender `rawEnumLeakScanner`, spoza zakresu trzech zleconych defektów; ryzyko kolizji z FIX-B
  (dowody/skaner) większe niż korzyść z cichej naprawy przy okazji.
- **Nie rozszerzono `showPrefix: false` na konsumentów `EmptyStateInline` spoza Finance** —
  świadomie: sygnatura jest addytywna i bezpieczna wszędzie, ale DECYZJA "które z ich akcji to
  nawigacja a nie tworzenie" należy do właścicieli tamtych ekranów, nie do tego pakietu.
- **Nie podłączono `showPrefix` do `FinanceHub.tsx`'s pozostałych ~56 zakładek** — hook przy commit
  defektu 3 zgłosił ostrzeżenie „hub ma 57 zakładek (limit ≤6)" — to PRZEDISTNIEJĄCE ostrzeżenie
  strukturalne pliku, niezwiązane z tym pakietem (nie dotyczy EmptyStateInline), niezmienione przez
  ten commit.

---

## Podsumowanie dla orkiestratora

Trzy defekty naprawione, każdy: własny commit, własny test regresji, własna kontrola negatywna
(czerwono→zielono, przywrócone bez `stash/reset/clean`), zrzuty przed/po light+dark dla defektów 1 i 3
z realnego harnessu przez Playwright (świeże konteksty). Zero plików z listy zakazanej dotkniętych.
Pełny pakiet Finance (511 testów) zielony. Jeden pre-existing, niezwiązany offender w
`rawEnumLeakScanner` — udokumentowany, nie mój.
