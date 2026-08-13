# Pełne porównanie regresji baseline vs candidate — 2026-08-13 (T6)

Status: **W TRAKCIE** — dokument aktualizowany przyrostowo, commitowany co ~5 partii.
Ten nagłówek mówi wprost, ile faktycznie zmierzono w danym momencie — patrz sekcja "Postęp pomiaru".

## Strony porównania

| Strona | Repo / gałąź | SHA | Katalog |
|---|---|---|---|
| candidate | `codex/asm-t6` (worktree t6) | `83fc62d70d7489793cdda9992b28cd8118630849` | `/Users/piotrwisniewski/consultify-wt/t6` |
| baseline | `origin/demo` | `e45904dc7940f259b9cf017c283264d5c166c9ab` | `/Users/piotrwisniewski/consultify-wt/t6-baseline` |

Baseline worktree utworzony poleceniem:
```
git worktree add --detach /Users/piotrwisniewski/consultify-wt/t6-baseline origin/demo
ln -sfn ".../node_modules" /Users/piotrwisniewski/consultify-wt/t6-baseline/node_modules
ln -sfn ".../server/node_modules" /Users/piotrwisniewski/consultify-wt/t6-baseline/server/node_modules
```

## Zakres plików tests/unit

Pełny wzorzec include z `vitest.config.ts` ograniczony do `tests/unit/**/*.{test,spec}.{js,ts,jsx,tsx}`:

- **candidate**: 1574 pliki testowe w `tests/unit`
- **baseline**: 1661 plików testowych w `tests/unit`

Liczby się różnią — candidate (`codex/asm-t6`) nie ma wszystkich testów, które istnieją na `origin/demo`
(gałęzie równoległe dodały testy, których ta gałąź jeszcze nie ma forward-portowanych). To zgodne
z wcześniejszymi ustaleniami w tym repo (branch drift vs `origin/demo`). Porównanie regresji robimy
**po nazwach testów** (pełny string `plik > describe > test`), nie po liczbach ani po pozycji pliku.

## Metoda

Komenda dla każdej partii (batch = zakres linii z posortowanej listy plików):
```
VITEST_HEAP_MB=8192 npx vitest run <pliki z partii> --maxWorkers=1 --maxConcurrency=1
```
uruchamiane **sekwencyjnie**, jedna partia po drugiej, nigdy dwie naraz. Rozmiar partii: 20-40 plików
(dostosowywany w trakcie — mniejsze partie tam, gdzie plik ma dużo testów i wykonanie jest wolniejsze).
Logi: `/tmp/claude-501/t6-cand-<nr>.log` (candidate) i `/tmp/claude-501/t6-base-<nr>.log` (baseline).

Dla każdego failującego testu (dopasowanie po **pełnej nazwie** `plik > describe > test`, ekstrahowane
z linii `FAIL` w logu) kategoria:
- `identical_pre_existing` — pada tak samo po obu stronach
- `fixed` — padał na baseline, przechodzi na candidate
- `introduced` — przechodził na baseline, pada na candidate ← **jedyna kategoria blokująca**
- `NOT_VERIFIED` — niezmierzone (partia nieuruchomiona albo ucięta timeoutem), z powodem

## Postęp pomiaru (aktualizowane przy każdym zapisie)

| Strona | Plików zmierzonych | Plików razem | % |
|---|---|---|---|
| candidate | 1260 | 1574 | 80% |
| baseline (pełny sekwencyjny) | 0 | 1661 | 0% |
| baseline (celowany — pliki failujące na candidate) | 60 | — | — |

**Uwaga**: pełny sekwencyjny przebieg baseline jeszcze nie uruchomiony — strategia w tej sesji: (1)
zmierz candidate sekwencyjnie, (2) dla KAŻDEGO pliku z failem na candidate odpal ten sam plik na
baseline od razu (pomiar celowany) — to najszybsza droga do wykrycia `introduced`, bo właśnie różnice
w already-failing testach są tam gdzie regresja się objawia najpierw. Pliki, które na candidate W
PEŁNI przechodzą, nie są jeszcze sprawdzone na baseline (mogłyby teoretycznie ujawnić `fixed`, ale nie
`introduced` — z definicji `introduced` wymaga failu na candidate).

### Partie zmierzone — candidate

| Partia(e) | Zakres linii (plik listy) | Plików | Log(i) | Wynik |
|---|---|---|---|---|
| 1 | 1-40 | 40 | t6-cand-1.log | 4 failed / 1010 |
| 2 | 41-80 | 40 | t6-cand-2.log | 2 failed / 445 |
| 3 | 81-120 | 40 | t6-cand-3.log | 1 failed / 707 |
| 4 | 121-160 | 40 | t6-cand-4.log | 0 failed |
| 5 | 161-200 | 40 | t6-cand-5.log | 5 failed |
| 6 | 201-240 | 40 | t6-cand-6.log | 0 failed |
| 7 | 241-280 | 40 | t6-cand-7.log | 0 failed |
| 8 | 281-320 | 40 | t6-cand-8.log | 1 failed |
| 9 | 321-360 | 40 | t6-cand-9.log | 2 failed / 344 |
| 10 | 361-400 | 40 | t6-cand-10.log | 0 failed / 165 |
| 11 | 401-440 | 40 | t6-cand-11.log | 3 failed / 223 |
| 12 | 441-480 | 40 | t6-cand-12.log | 8 failed |
| 13a | 481-500 | 20 | t6-cand-13a.log | 1 failed / 99 |
| 13b | 501-520 | 20 | t6-cand-13b.log | 1 failed / 138 |
| 14 | 521-540 | 20 | t6-cand-14.log | 1 failed / 104 |
| 15 | 541-570 | 30 | t6-cand-15.log | 1 failed / 193 |
| 16 | 571-600 | 30 | t6-cand-16.log | 0 failed / 218 |
| 17 | 601-630 | 30 | t6-cand-17.log | 4 failed / 153 |
| 18 | 631-660 | 30 | t6-cand-18.log | 2 failed / 183 |

Uwaga: oryginalna partia 13 (linie 481-520, 40 plików) padła z `EXIT=143` (proces ubity w trakcie,
prawdopodobnie limit czasu tła) po ok. 34/40 plikach — powtórzona jako 13a+13b (po 20 plików), obie
zakończone czysto (`Tests N failed | M passed` obecne).

| 19 | 661-690 | 30 | t6-cand-19.log | 1 failed (suite-level import error) / 265 |
| 20 | 691-720 | 30 | t6-cand-20.log | 1 failed (17 testów w środku) / 214 |
| 21 | 721-750 | 30 | t6-cand-21.log | 7 failed / 374 |
| 22 | 751-780 | 30 | t6-cand-22.log | 4 failed plików (6 testów + 1 suite-level) / 200 |
| 23 | 781-810 | 30 | t6-cand-23.log | 5 failed plików (9 testów) / 170 |
| 24 | 811-840 | 30 | t6-cand-24.log | 2 failed / 251 |
| 25 | 841-870 | 30 | t6-cand-25.log | 0 failed / 306 |
| 26 | 871-900 | 30 | t6-cand-26.log | 2 failed (suite-level) / 61 |
| 27 | 901-930 | 30 | t6-cand-27.log | 3 failed / 199 |
| 28 | 931-960 | 30 | t6-cand-28.log | 0 failed / 288 |
| 29 | 961-990 | 30 | t6-cand-29.log | 5 failed / 357 |
| 30 | 991-1020 | 30 | t6-cand-30.log | 5 failed / 357 |
| 31 | 1021-1050 | 30 | t6-cand-31.log | 0 failed / 369 |
| 32 | 1051-1080 | 30 | t6-cand-32.log | 4 failed / 215 |
| 33 | 1081-1110 | 30 | t6-cand-33.log | 2 failed / 476 |
| 34 | 1111-1140 | 30 | t6-cand-34.log | 0 failed / 334 |
| 35 | 1141-1170 | 30 | t6-cand-35.log | 2 failed / 383 |
| 36 | 1171-1200 | 30 | t6-cand-36.log | 1 failed / 284 |
| 37 | 1201-1230 | 30 | t6-cand-37.log | 23 failed / 227 |
| 38 | 1231-1260 | 30 | t6-cand-38.log | 2 failed / 252 |

### Partie zmierzone — baseline

**Pomiar celowany (priorytet: wykryć `introduced` jak najszybciej)** — uruchomiono na baseline
DOKŁADNIE te 26 plików, które failują na candidate w liniach 1-660 (patrz sekcja niżej), zamiast
czekać na pełny sekwencyjny przebieg baseline. Dwa przebiegi:

1. `t6-base-targeted-2.log` — 25 z 26 plików (bez `workbook.routes.grounding-hydration.test.ts`,
   który zawieszał cały batch — patrz niżej), `--maxWorkers=1 --maxConcurrency=1`:
   `Tests 32 failed | 244 passed (276)`, `Test Files 25 failed (25)`.
2. `t6-base-workbook-hydration.log` — `tests/unit/backend/routes/workbook.routes.grounding-hydration.test.ts`
   osobno, z `--testTimeout=10000 --retry=0` (na baseline ten plik wisi ~120s/test przy domyślnym
   timeout+retry — DUŻO wolniej niż na candidate, gdzie te same testy padają w kilka ms na asercji;
   różny TRYB porażki, ale porażka po obu stronach): `Tests 4 failed (4)`, `Test Files 1 failed (1)`.
3. `t6-base-targeted-3.log` — 13 plików failujących na candidate w liniach 661-840, `--testTimeout=15000
   --retry=0`: `Tests 40 failed | 29 passed (69)`. Diff po pełnej nazwie testu ujawnił **1 test, który
   na baseline PRZECHODZI, a na candidate PADA** — `AdminCollaborationControlsPanel.test.tsx > loads
   controls and merges omitted values with defaults`. Zweryfikowane osobno na obu stronach z
   `-t "<pełna nazwa testu>"` (logi `verify-cand-admincollab.log` / `verify-base-admincollab.log`) —
   potwierdzone, nie flaky. Szczegóły w sekcji `introduced` niżej.
4. `t6-base-targeted-4.log` — 6 plików failujących na candidate w liniach 841-990, `--testTimeout=15000
   --retry=0`: `Tests 7 failed | 41 passed (48)`. Diff ujawnił **kolejny test, który na baseline
   PRZECHODZI, a na candidate PADA** — `artifactContractParity.test.ts > keeps origin runtime literals
   aligned`. Zweryfikowane osobno (`verify-cand-artifactparity.log` / `verify-base-artifactparity.log`)
   — potwierdzone. Szczegóły w sekcji `introduced` niżej.
5. `t6-base-targeted-5.log` — 3 pliki failujące na candidate w liniach 991-1110, `--testTimeout=15000
   --retry=0`: `Tests 11 failed | 16 passed (27)`. Diff ujawnił pozorny swap w `templateCrud.test.ts`
   — zweryfikowany jako flaky (order-dependent), nie regresja. Patrz notatka w sekcji `introduced`.
6. `t6-base-targeted-6.log` — 12 plików failujących na candidate w liniach 1111-1260,
   `--testTimeout=15000 --retry=0`: `Tests 24 failed | 58 passed (82)`. Diff ujawnił **4 kolejne testy,
   które na baseline PRZECHODZĄ, a na candidate PADAJĄ** — 1 w `kebabBezAtrap.test.tsx`, 3 w
   `dp5HeuristicAiGating.test.tsx` (`NodeContextMenu comingSoonIds gating`). Zweryfikowane niezależnie
   (`verify-cand-4tests.log` / `verify-base-4tests.log`), spójny powtarzalny wynik. Szczegóły w sekcji
   `introduced` niżej.

Brak jeszcze pełnego sekwencyjnego przebiegu baseline poza tym — to osobny, szerszy krok (patrz
NOT_VERIFIED niżej).

## Lista `introduced` (blokujące)

**1 znaleziony i zweryfikowany (2× osobno na obu stronach, nie tylko w batchu):**

### `tests/unit/components/Admin/AdminCollaborationControlsPanel.test.tsx`
Test: `AdminCollaborationControlsPanel > loads controls and merges omitted values with defaults`

- **candidate**: FAIL (potwierdzone osobnym uruchomieniem `-t "loads controls and merges omitted values with defaults"`, log `/tmp/claude-501/verify-cand-admincollab.log`)
- **baseline**: PASS (potwierdzone tą samą metodą, log `/tmp/claude-501/verify-base-admincollab.log`)

Błąd na candidate:
```
AssertionError: expected "vi.fn()" to be called with arguments: [ { guestAccessEnabled: true, …(2) } ]
Received:
  1st vi.fn() call:
  [
    {
      "externalLinkSharing": false,
-     "guestAccessEnabled": true,
+     "guestAccessEnabled": false,
      "toolApprovalRequired": true,
    },
  ]
```
Komponent na candidate merge'uje domyślną wartość `guestAccessEnabled` inaczej niż na baseline —
przy częściowym payloadzie z API (bez pola `guestAccessEnabled`) candidate wychodzi na `false`,
baseline poprawnie merge'uje `true` z defaultów. To wygląda na realną regresję w logice merge
domyślnych wartości panelu (nie flaky — dwa niezależne uruchomienia po obu stronach dały spójny wynik).

### `tests/unit/contracts/artifactContractParity.test.ts`
Test: `Artifact client/server contract parity > keeps origin runtime literals aligned`

- **candidate**: FAIL (potwierdzone osobno, log `/tmp/claude-501/verify-cand-artifactparity.log`)
- **baseline**: PASS (potwierdzone osobno, log `/tmp/claude-501/verify-base-artifactparity.log`)

Błąd na candidate:
```
AssertionError: expected [ 'report', 'presentation', …(8) ] to deeply equal [ 'report', 'presentation', …(9) ]
- Expected
+ Received
  [
    "report", "presentation", "sheet", "native_artifact",
-   "assessment_report",
    "report_template", "presentation_template", "sheet_template", "document_template", "work_canvas",
```
Client-side runtime lista `ClientArtifactOriginRuntimeValues` na candidate **nie zawiera**
`assessment_report`, którą server-side lista (`ServerArtifactOriginRuntimeValues`) wciąż ma — kontrakt
klient/serwer rozjechał się na tej gałęzi. To jest test kontraktowy zaprojektowany specjalnie do
wyłapywania takiego rozjazdu, więc wygląda na realną, świeżą regresję (literał usunięty po jednej
stronie, nie po drugiej), nie na flaky test.

### Uwaga: 1 para testów FLAKY (order-dependent), NIE regresja

W liniach 991-1110 diff pokazał pozorny swap w `tests/unit/deliverables/templateCrud.test.ts`:
`updateDeliverableTemplate throws...` failuje TYLKO na candidate, `deleteDeliverableTemplate
throws...` failuje TYLKO na baseline — wygląda jak 1 introduced + 1 fixed jednocześnie. Zweryfikowane
osobno: uruchomienie **obu** testów razem przez `-t "throws TemplateForbiddenError for system
templates"` (bez reszty pliku dookoła) daje **PASS na candidate dla obu** (log
`verify-cand-templatecrud.log`, `Tests 2 passed`). To jest zanieczyszczenie międzytestowe w obrębie
pliku (`order: 'random'` w `vitest.config.ts` + współdzielony mock/stan), nie realna regresja kodu —
NIE liczone jako `introduced`/`fixed`, oznaczone jako `identical_pre_existing (flaky, order-dependent)`.

### `tests/unit/kebabBezAtrap.test.tsx` (1 test)
Test: `RowActionsMenu — menu bez atrap > ukrywa „jeszcze tego nie ma", zostawia „nie wolno, bo…"`

- **candidate**: FAIL — `Unable to find an element with the text: /Safes are automatic/`
- **baseline**: PASS

### `tests/unit/mindmap/dp5HeuristicAiGating.test.tsx` — `NodeContextMenu comingSoonIds gating` (3 testy)
Testy: `does not gate real-LLM context actions (What if, Competitors)`,
`leaves ctx_dependencies clickable when comingSoonIds is empty`,
`renders ctx_dependencies disabled with "Coming soon" badge when listed`

- **candidate**: FAIL na wszystkich 3 — `Unable to find an element with the text: AI`, a w wyrenderowanym
  DOM widać surowy, nieprzetłumaczony klucz i18n `myWorkMindmap.ctxMenu.group.edit` zamiast tekstu
  etykiety grupy menu — wygląda na regresję renderowania/i18n w `NodeContextMenu` (menu kontekstowe
  mapy myśli), nie tylko problem z tym jednym testem.
- **baseline**: PASS na wszystkich 3 (pozostałe 3 testy w tym samym pliku — `AIActionsPopover heuristic
  action gating` — failują na OBU stronach, to osobna, już znana `identical_pre_existing` grupa).

Wszystkie 4 potwierdzone niezależnie: uruchomienie kombinacji obu plików razem na candidate
(`verify-cand-4tests.log`) i na baseline (`verify-base-4tests.log`) dało spójny, powtarzalny wynik —
te same testy failują/przechodzą, nie ma śladu flaky/kolejności.

Reszta zmierzonego zakresu (patrz "Postęp pomiaru"): wszystkie pozostałe 117 unikalnych testów
failujących na candidate w liniach 1-1260 (93 z 1-1110 + 24 nowych solidnych z 1111-1260, wykluczając
4 introduced opisane wyżej) zostały sprawdzone na baseline po pełnej nazwie (`plik > describe >
test`) i failują też na baseline — `identical_pre_existing`. To dotyczy tylko zmierzonego zakresu —
reszta plików (candidate 1261-1574, cała reszta baseline poza pomiarem celowanym) jest `NOT_VERIFIED`
i może jeszcze ujawnić kolejne `introduced`.

## Lista `fixed`

**PUSTA** w zmierzonym zakresie — `comm -13` (testy failujące tylko na baseline, nie na candidate)
też dało zero wyników dla tych 26 plików. Żaden z testów, które failują na baseline w tych plikach,
nie został naprawiony na candidate — bo to te same testy, failujące identycznie po obu stronach.

## Failujące testy na candidate (linie 1-660) — kandydaci do klasyfikacji

36 unikalnych failujących testów w 30 plikach (pełne nazwy `plik > describe > test`):

```
tests/unit/AIChat/agentPlanPanel.blocksToSteps.test.ts > AgentPlanPanel.blocksToSteps (AGT-008 — klocek niesie wybrane narzędzie) > FALLBACK: krok bez toolInput.phase dostaje CZYTELNĄ etykietę narzędzia, nie snake_case
tests/unit/api.test.ts > Frontend API Circuit Breaker (Transport Safeguard) > should clear circuit on clearGlobalTransportFailure
tests/unit/api.test.ts > Frontend API Circuit Breaker (Transport Safeguard) > should trigger circuit on 502 or Network Error
tests/unit/auth/auth.middleware.private.test.ts > auth.middleware private helpers > mapRole maps superadmin to owner
tests/unit/backend/agentProductionBuildBoundary.test.ts > Agent production build boundary > runs the packaged strict Postgres migrator before the Railway API starts
tests/unit/backend/aiActionExecutor.wave3-runtime.test.ts > AIActionExecutor Wave 3 runtime lifecycle > creates an AIRun proposal and does not mutate before explicit approve and execute
tests/unit/backend/assessment/assessmentInitiativeService.test.ts > AssessmentInitiativeService > generateFromAssessment > should use different methodology configurations
tests/unit/backend/generateDeliverable.canvasTools.test.ts > generate_deliverable(type:note) > creates a real notebook page and emits onDeliverable with the DB id when the flag is ON
tests/unit/backend/harvardCrossModuleFlows.test.ts > Harvard cross-module flows — contract anchors exist > every flow targetTable lands in a migration-defined table (data has somewhere real to go)
tests/unit/backend/harvardCrossModuleFlows.test.ts > Harvard cross-module flows — contract anchors exist > tracks known-broken (stub) flows explicitly so they cannot silently pass as healthy
tests/unit/backend/harvardModuleContract.test.ts > Harvard module contract — every module has a mounted backend > M07 Ideas — Process Flow — primary endpoint base is mounted in the route layer
tests/unit/backend/helpChat.routes.test.ts > Help Chat Routes > POST /api/help/chat > returns 500 on AI pipeline error
tests/unit/backend/middleware/rateLimiting.middleware.test.ts > rateLimiting.middleware (L1) > fails open to next when Date.now throws during limiter evaluation
tests/unit/backend/permissionService.test.ts > PermissionService > Database-Backed PBAC > hasPermission() > should check explicit GRANT override
tests/unit/backend/permissionService.test.ts > PermissionService > Multi-Tenant Isolation > should not allow user from Org A to access Org B permissions
tests/unit/backend/routes/document-studio.routes.leak-guard.test.ts > document-studio /templates/:templateId/approve — 500-leak guard > does NOT echo a raw/unexpected exception message to the client
tests/unit/backend/routes/metricsOrgRoutes.test.ts > Metrics Organization Routes > GET /api/metrics/org/overview > should return 500 on service error
tests/unit/backend/routes/pmo-decisions.routes.org-guard.test.ts > pmo decisions routes org guard > returns 403 RBAC code when authenticated user has no organization
tests/unit/backend/routes/tools.routes.org-guard.test.ts > tools.routes org guard > returns 403 RBAC code when org context is missing
tests/unit/backend/routes/workbook.routes.grounding-hydration.test.ts > workbook.routes — grounding hydration from artifactRunId > does not hydrate when explicit sourcePack was already sent (no lookup)
tests/unit/backend/routes/workbook.routes.grounding-hydration.test.ts > workbook.routes — grounding hydration from artifactRunId > fails soft (generation still succeeds, ungrounded) when the run lookup throws
tests/unit/backend/routes/workbook.routes.grounding-hydration.test.ts > workbook.routes — grounding hydration from artifactRunId > fails soft when the run exists but has no execution goal
tests/unit/backend/routes/workbook.routes.grounding-hydration.test.ts > workbook.routes — grounding hydration from artifactRunId > hydrates researchContext from the run when only artifactRunId is sent
tests/unit/backend/routes/workbook.routes.templates-c3.test.ts > workbook.routes — C3 parametric templates > builds an org-owned custom template snapshot and preserves workbook features
tests/unit/backend/routes/workbook.routes.templates-c3.test.ts > workbook.routes — C3 parametric templates > does not return success or register an artifact when durable persistence fails
tests/unit/backend/scripts/verifySchemaParser.test.ts > parseExpectedSchema > parses the real migrations dir without throwing and finds known tables
tests/unit/backend/services/adminSessionService.test.ts > adminSessionService > clamps JIT sessions to short-lived expiry and preserves session metadata
tests/unit/backend/services/artifactRegistryService.test.ts > artifactRegistryService > uses canonical deck_json cards over a stale materialized slide_count
tests/unit/backend/services/documentStudio/documentBlockProseGenerator.warnings.test.ts > generateBlockProse + generation warnings > records llm_prose_fallback and returns stubs unchanged when the LLM throws
tests/unit/backend/services/generateDeliverableTool.test.ts > generate_deliverable tool (SPEC_01 Tryb A) > maps sheet → sheet and presentation → deck with a default deck setup
tests/unit/backend/services/presentationGeneratorService.evidencePersist.test.ts > presentationGeneratorService.generateDeck — HP-17 evidence persist > persists the deck EvidenceContract as an EvidenceEnvelope (artifactType=deck)
tests/unit/backend/services/presentationGeneratorService.narrativeExtended.test.ts > generateDeck — FALA D narrative-extended intent gate + template briefing > ENABLE_DECK_NARRATIVE_EXTENDED='false' reverts to legacy gate: root_cause is skipped
tests/unit/backend/services/presentationGeneratorService.narrativeExtended.test.ts > generateDeck — FALA D narrative-extended intent gate + template briefing > default (flag unset = ON): root_cause slide reaches generateNarrative and gets _narrative_enrichment
tests/unit/backend/services/presentationGeneratorService.narrativeExtended.test.ts > generateDeck — FALA D narrative-extended intent gate + template briefing > folds the outline item keyMessage + dataNeeded into user_instruction for generateNarrative
tests/unit/backend/services/systemAlertNotifier.test.ts > systemAlertNotifier > dispatches a system alert to Slack and WhatsApp
tests/unit/backend/services/systemAlertNotifier.test.ts > systemAlertNotifier > throttles repeated alerts for the same key
```

## NOT_VERIFIED

- **candidate linie 1261-1574** (314 plików, ~20% strony candidate) — partie jeszcze nieuruchomione w
  tej sesji. Powód: praca w toku, kontynuacja w kolejnych krokach tej samej sesji.
- **baseline pełny sekwencyjny przebieg** (1661 plików minus 60 już zmierzonych celowanie = ~1601
  plików) — jeszcze nie rozpoczęty. Powód: priorytet poszedł na celowane sprawdzenie plików już
  failujących na candidate (zrobione dla linii 1-1260, znaleziono 6 `introduced` + 1 flaky para);
  pełny sekwencyjny
  przebieg baseline to osobny, szerszy krok, potrzebny żeby wykryć `introduced`/`fixed` w plikach
  które na candidate jeszcze PRZECHODZĄ (bo test może przechodzić na candidate, a mieć inny wynik na
  baseline — np. istnieć tylko na baseline i failować tam, co nie jest `introduced` z definicji, ale
  wpływa na pełny obraz `fixed`/pokrycia).

## Tabela zbiorcza (na tę chwilę — niekompletna, patrz Postęp pomiaru)

| Kategoria | Liczba |
|---|---|
| identical_pre_existing | 117 testów (celowany pomiar candidate-fails w liniach 1-1260 × baseline) + 2 flaky (order-dependent, nie regresja) |
| fixed | 0 |
| introduced | **6** — patrz pełna lista niżej |
| NOT_VERIFIED | 314 plików candidate (linie 1261-1574) + ~1601 plików baseline (poza celowanym pomiarem) |

### Pełna lista `introduced` (6, wszystkie zweryfikowane niezależnie po obu stronach)

1. `tests/unit/components/Admin/AdminCollaborationControlsPanel.test.tsx > AdminCollaborationControlsPanel > loads controls and merges omitted values with defaults`
2. `tests/unit/contracts/artifactContractParity.test.ts > Artifact client/server contract parity > keeps origin runtime literals aligned`
3. `tests/unit/kebabBezAtrap.test.tsx > RowActionsMenu — menu bez atrap > ukrywa „jeszcze tego nie ma", zostawia „nie wolno, bo…"`
4. `tests/unit/mindmap/dp5HeuristicAiGating.test.tsx > DP-5: NodeContextMenu comingSoonIds gating > does not gate real-LLM context actions (What if, Competitors)`
5. `tests/unit/mindmap/dp5HeuristicAiGating.test.tsx > DP-5: NodeContextMenu comingSoonIds gating > leaves ctx_dependencies clickable when comingSoonIds is empty`
6. `tests/unit/mindmap/dp5HeuristicAiGating.test.tsx > DP-5: NodeContextMenu comingSoonIds gating > renders ctx_dependencies disabled with "Coming soon" badge when listed`

## Higiena

Praca wyłącznie pomiarowa — zero zmian w kodzie produkcyjnym. Worktree baseline
(`/Users/piotrwisniewski/consultify-wt/t6-baseline`) zostanie usunięty na końcu sesji poleceniem
`git worktree remove`.
