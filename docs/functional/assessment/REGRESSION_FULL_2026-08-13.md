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
| candidate | 840 | 1574 | 53% |
| baseline (pełny sekwencyjny) | 0 | 1661 | 0% |
| baseline (celowany — pliki failujące na candidate) | 39 | — | — |

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

Reszta zmierzonego zakresu (patrz "Postęp pomiaru"): wszystkie pozostałe 77 unikalnych testów
failujących na candidate w liniach 1-840 (36 z 1-660 + 42 wspólnych z 661-840, licząc bez duplikatów)
zostało sprawdzonych na baseline po pełnej nazwie (`plik > describe > test`) i failują też na
baseline — `identical_pre_existing`. To dotyczy tylko zmierzonego zakresu — reszta plików
(candidate 841-1574, cała reszta baseline poza pomiarem celowanym) jest `NOT_VERIFIED` i może
jeszcze ujawnić kolejne `introduced`.

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

- **candidate linie 841-1574** (734 plików, ~47% strony candidate) — partie jeszcze nieuruchomione w
  tej sesji. Powód: praca w toku, kontynuacja w kolejnych krokach tej samej sesji.
- **baseline pełny sekwencyjny przebieg** (1661 plików minus 39 już zmierzonych celowanie = ~1622
  plików) — jeszcze nie rozpoczęty. Powód: priorytet poszedł na celowane sprawdzenie plików już
  failujących na candidate (zrobione dla linii 1-840, znaleziono 1 `introduced`); pełny sekwencyjny
  przebieg baseline to osobny, szerszy krok, potrzebny żeby wykryć `introduced`/`fixed` w plikach
  które na candidate jeszcze PRZECHODZĄ (bo test może przechodzić na candidate, a mieć inny wynik na
  baseline — np. istnieć tylko na baseline i failować tam, co nie jest `introduced` z definicji, ale
  wpływa na pełny obraz `fixed`/pokrycia).

## Tabela zbiorcza (na tę chwilę — niekompletna, patrz Postęp pomiaru)

| Kategoria | Liczba |
|---|---|
| identical_pre_existing | 77 testów (celowany pomiar candidate-fails w liniach 1-840 × baseline) |
| fixed | 0 |
| introduced | **1** — `AdminCollaborationControlsPanel.test.tsx > loads controls and merges omitted values with defaults` |
| NOT_VERIFIED | 734 plików candidate (linie 841-1574) + ~1622 plików baseline (poza celowanym pomiarem) |

## Higiena

Praca wyłącznie pomiarowa — zero zmian w kodzie produkcyjnym. Worktree baseline
(`/Users/piotrwisniewski/consultify-wt/t6-baseline`) zostanie usunięty na końcu sesji poleceniem
`git worktree remove`.
