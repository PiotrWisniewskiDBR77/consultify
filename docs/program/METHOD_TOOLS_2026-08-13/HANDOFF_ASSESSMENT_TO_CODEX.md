# HANDOFF — ASSESSMENT → Codex

> Pakiet przejęcia. Każda liczba i każdy SHA poniżej został sprawdzony **bezpośrednio
> w Git i na dysku** w chwili pisania, nie przepisany z wcześniejszych raportów agentów.
> Gdzie czegoś nie zweryfikowałem — jest to napisane wprost.

---

## 1. TOŻSAMOŚĆ KANDYDATA

| Pole | Wartość | Weryfikacja |
| --- | --- | --- |
| Moduł | **ASSESSMENT** (+ współdzielony Method Core kernel) | — |
| Integration branch | `codex/method-assessment-clean-20260813` | `git rev-parse --abbrev-ref HEAD` |
| **Candidate SHA** | **`22815cd950`** (`22815cd950…`) | `git cat-file -t` → `commit` |
| **Baseline SHA** | **`f3e7df565e0da826ba110d85aad3c3c81a1087f1`** | `git cat-file -t` → `commit` |
| **Merge-base** | `f3e7df565e0da826ba110d85aad3c3c81a1087f1` | `git merge-base HEAD f3e7df565e` — **równy baseline**, historia liniowa od demo |
| Commitów od baseline | **154** (w tym **32** merge-commity) | `git rev-list --count` |
| `git status --porcelain` | **0** (czysto) | — |
| **Pushnięty?** | **NIE** | `git branch -r --contains HEAD` → **0** |

### ★ UWAGA KRYTYCZNA DLA INTEGRATORA — baseline ≠ aktualne `origin/demo`

```
git rev-list --left-right --count origin/demo...HEAD
47    154
```

| | |
| --- | --- |
| baseline (`f3e7df565e`) | `2026-08-12 09:56` — demo w chwili startu prac |
| **aktualne `origin/demo`** | **`e45904dc79`**, `2026-08-13 14:01` |
| commitów w demo, których kandydat **nie ma** | **47** |
| `git merge-base --is-ancestor f3e7df565e origin/demo` | **TAK** — demo poszło do przodu z tego samego punktu, brak rozjazdu historii |

**Kandydat jest o 47 commitów za aktualnym demo.** Integrator **musi** wykonać rebase
lub merge `origin/demo` przed jakąkolwiek promocją i **ponownie przepuścić bramki** —
liczby w tym dokumencie dotyczą wyłącznie SHA `22815cd950` na baseline `f3e7df565e`.

### Worktree modułu (33 sztuki, wszystkie zachowane — żadnego nie usunąłem)

| Worktree | SHA | Rola |
| --- | --- | --- |
| `~/.codex/worktrees/mac-clean-integ` | `22815cd950` | **integracyjny (kandydat)** |
| `~/.codex/worktrees/method-assessment-core` | `eb3e2b5c85` | poprzedni kandydat **przed** czyszczeniem historii |
| `~/.codex/worktrees/mac-clean-history` | — | izolowany klon użyty do `filter-repo` (zawiera `commit-map`) |
| `~/.codex/worktrees/mac-base6` | `f3e7df565e` | baseline do porównań regresji |
| `~/.codex/worktrees/mac-audit2-a`, `mac-audit2-b` | `e0afbc46a6` | drugi niezależny odbiór MPQ |
| `~/.codex/worktrees/mac-mpq-b` | `14e65cd768` | pierwszy odbiór MPQ (widoki 5-8) |
| `~/.codex/worktrees/mac-e2e-true` | `6d90112005` | prawdziwy browser E2E |
| `~/.codex/worktrees/mac-fix-focus` | `4b16de0244` | naprawa fokusu |
| `~/.codex/worktrees/mac-fix-hub` | `ab8ee5582b` | naprawa Library/Sessions |
| `mac-a2…a14`, `mac-p0*`, `mac-s1…s8` (22 szt.) | patrz `HANDOFF_ASSESSMENT_BRANCHES.tsv` | pakiety robocze |

★ **`mac-clean-history/.git/filter-repo/commit-map` jest jedynym zapisem mapy
stary→nowy SHA.** Nie kasuj tego worktree, dopóki nie przeniesiesz mapy gdzie indziej.

---

## 2. GENEALOGIA

Pełna tabela maszynowa: **`HANDOFF_ASSESSMENT_BRANCHES.tsv`**.

### ★ Pułapka: `--is-ancestor` KŁAMIE dla trzech gałęzi

Historia kandydata została przepisana (`git filter-repo`, usunięcie 2 blobów HAR = 248 MB).
Commity **dotykające usuwanych ścieżek** dostały nowe SHA; reszta zachowała stare.
Dlatego trzy gałęzie **nie są przodkami** kandydata, mimo że ich praca jest w środku:

| Gałąź | stary SHA | nowy SHA (z `commit-map`) | przodek kandydata? |
| --- | --- | --- | --- |
| `codex/mac-s2-roles-20260813` | `6a77a20b20` | `15b6643a28` | **TAK** (po zmapowaniu) |
| `codex/mac-s8-reopen-e2e-20260813` | `a032eec4c2` | `3ec45e0c45` | **TAK** (po zmapowaniu) |
| `codex/method-assessment-core-20260813` | `eb3e2b5c85` | `14e65cd768` | **TAK** (po zmapowaniu) |

**Nie wyciągaj wniosku „gałąź niescalona" z samego `--is-ancestor`.** Sprawdź przez mapę.

Pozostałe **25** gałęzi modułu jest przodkami kandydata **bezpośrednio** (zweryfikowane
`git merge-base --is-ancestor` dla każdej z osobna).

### Kolejność semantyczna scaleń (odtworzona z `git log --merges`)

```
f3e7df565e (baseline = origin/demo @ 2026-08-12)
 ├─ A2 kernel  → A3 DRD → A4 SIRI            (kontrakty + pakiety metod)
 ├─ A5 workspace shell → A6 DRD slice → A7 SIRI slice
 ├─ A8 outputs → A11 SIRI PM → A12 registers → A13 scoring v2 → A14 boot
 ├─ P0A bootstrap → P0 http → P0B freeze → P0C ui → P0D A9
 ├─ S1 artifacts → S2 roles → S3 offline → S4 teresa → S5 SIRI
 ├─ S6 dark+a11y → S7 A10 audit → S8 reopen+E2E
 ├─ [filter-repo: usunięcie HAR, przepisanie 154 commitów]   ← eb3e2b5c85 → 14e65cd768
 ├─ e2e-true       (prawdziwy browser E2E)
 ├─ fix-focus-ring (przeciek pierścienia w nawigatorze)
 └─ fix-hub-library(Library: chipy, wyciek błędu, loading)   → 22815cd950
```

### Gałęzie odrzucone

**Brak.** Żadna gałąź modułu nie została porzucona ani skasowana. Jedyna „martwa"
linia to `codex/method-assessment-core-20260813` (`eb3e2b5c85`) — zastąpiona przez
gałąź po czyszczeniu historii. **Zachowana celowo** jako punkt odniesienia; nie usuwać,
dopóki Codex nie potwierdzi kandydata.

### Backup refs

```
backup/assessment-preclean-20260813      -> eb3e2b5c85   (kandydat przed filter-repo)
backup/assessment-s8-preclean-20260813   -> a032eec4c2   (S8 przed filter-repo)
```

---

## 3. RZECZYWISTY DIFF

```
git diff --stat f3e7df565e...22815cd950
→ 641 files changed, 75204 insertions(+), 80 deletions(-)
```

★ **80 usunięć na 75 204 wstawień** — fala jest niemal wyłącznie addytywna.
Pełna lista z klasyfikacją: **`HANDOFF_ASSESSMENT_FILES.tsv`**.

| Kategoria | Plików |
| --- | ---: |
| `MODULE_OWNED` (produkcyjne modułu) | 109 |
| `SHARED_CONTRACT` (`src/method-core/contracts/**` + lustro serwerowe) | 5 |
| `MIGRATION` | 7 |
| `TEST` | 83 |
| `EVIDENCE` (`docs/qa/**`) | 397 |
| dokumentacja (`docs/**` poza `qa`) | 17 |
| `dev-render` (harnessy) | 23 |

### Pliki poza granicą modułu — każdy wyjaśniony

| Plik | Klasyfikacja | Pochodzenie / uzasadnienie |
| --- | --- | --- |
| `server/src/index.ts`, `Gateway.ts`, `startup/testModeGates.ts`, `startup/readinessRoutes.ts`, `startup/withTimeout.ts`, `controllers/HealthCheckController.ts` | **SHARED_CONTRACT** | P0A: bramki bootstrapu. Dwie bramki ignorowały `RUN_DB_TESTS=1` → sekwencja init bazy nigdy nie startowała. Dodano też guard: `MOCK_DB=true` **na produkcji** włączało atrapę bazy — jedyną ścieżkę ustawiającą `dbReady` z pominięciem migracji. |
| `server/src/test-utils/dbFailClosed.ts` | **TEST** | `assertRealPostgresTestDb()` — fail-closed dla testów bazodanowych (CEL 10). |
| `src/hooks/useFeatureFlags.tsx` | **SHARED_UI** | rejestracja 3 flag modułu, **wszystkie domyślnie OFF**. |
| `src/views/AssessmentSessionEditorView.tsx` | **MODULE_OWNED** | jedyny produkcyjny punkt montażu ekranu (`shouldMountDrdMethodWorkspace`). |
| `src/services/drdStructure.ts` | **MODULE_OWNED** | dodane `calculateOverallScoreV2` / `calculateAxisScoreV2` **obok** `legacy_v1` (zamrożonego bit w bit). |
| `src/services/siriPrioritisation.ts` | **MODULE_OWNED** | wersjonowanie `legacy_v1`/`siri_pm_v2` (COORD-08), domyślnie legacy. |
| `src/services/report/drdReportModel.ts` | **MODULE_OWNED** | `calculationVersion` w modelu raportu. |
| `src/services/assessmentKnowledge/maturityPathway*.ts` | **FOREIGN_OR_SUSPECT → wyjaśnione** | **Zmiana wyłącznie komentarzowa** (+68/+36 linii, zero kodu). COORD-06: model D1..D8 **NIE jest wpięty**; oznaczony `NOT_WIRED / NORMALISATION_MISSING`. Zweryfikowane `git diff` — same bloki komentarza. |
| `src/actions/teresaActionManifest.ts` | **SHARED_CONTRACT** | manifest zdolności Teresy dla Assessment. |
| `src/utils/drdScoringV2Flag.ts`, `src/utils/siriPmV2Flag.ts` | **MODULE_OWNED** | odczyt flag wersji obliczeń. |
| `public/locales/{en,pl}/translation.json` | **SHARED_UI** | klucze `assessment.hub.errors.{forbidden,notFound,server}` — przyjazne komunikaty zamiast surowego wyjątku. |
| `.claude/launch.json` | **FOREIGN_OR_SUSPECT → wyjaśnione** | plik **współdzielony z innymi sesjami**, w `.gitignore`, wymaga `git add -f`. Konflikty rozwiązywane przez **zachowanie obu stron**. Nie jest artefaktem produktu. |
| `.gitignore` | **MODULE_OWNED** | dodane `*.har` po incydencie z 248 MB. |
| `package.json` | **SHARED_CONTRACT** | 3 skrypty bramek (`test:method-core:server`, `:front`, `:front:live`), wszystkie z `--retry=0`. |
| `tsconfig.*-scoped.json` (9 plików), `server/tsconfig.*-scoped.json` (4) | **TEST** | ★ **DŁUG DO SPRZĄTNIĘCIA**: 13 jednorazowych configów `tsc` zostawionych przez agentów. Nieszkodliwe (nie wchodzą do buildu), ale zaśmiecają korzeń. |
| `scripts/dev/e2etrue-run-offline-suite.sh` | **TEST** | runner offline E2E. |
| `dev-render/**` (23 pliki) | **TEST** | harnessy zrzutowe. ★ `mpq-audit-hub*` powstały ad-hoc w audycie i **zostały wciągnięte moim `git add -A`** — świadomie zachowane jako obejście zepsutego rejestru `dev-render/main.tsx`. |

---

## 4. ŚLAD PRODUKTOWY

### Łańcuch DRD — zweryfikowany plik po pliku

| Ogniwo | Ścieżka / funkcja | Status |
| --- | --- | --- |
| route | `src/routes/AppRoutes.tsx:81` → `AssessmentSessionEditorView` (lazy) | **OK** |
| gate | `src/views/AssessmentSessionEditorView.tsx:114` `shouldMountDrdMethodWorkspace()`, montaż `:1766-1768` | **OK, za flagą OFF** |
| screen | `src/components/assessment/drd/DrdMethodWorkspaceScreen.tsx` | **OK** |
| screen (HTTP) | `src/components/assessment/drd/DrdHttpMethodWorkspaceScreen.tsx` (flaga `drdHttpSourceOfTruthV1`) | **OK, flaga OFF** |
| runtime | `src/method-core/methods/drd/drdHttpSessionRuntime.ts` | **OK** |
| client API | `src/method-core/api/methodCoreApi.ts`, `methodCoreRolesApi.ts` | **OK** |
| HTTP | `server/src/routes/method-core.routes.ts` — **23 endpointy** (pełna lista w §4a) | **OK** |
| serwisy | `server/src/method-core/`: `MethodSessionService.ts`, `MethodEventStore.ts`, `MethodPackRegistry.ts`, `MethodSessionRoleService.ts`, `TeresaProposalService.ts`, `demoBypass.ts` | **OK** |
| tabele | 14 × `method_*` (§5) | **OK** |
| migracje | `20260813_method_core_1..6` (§6) | **OK** |
| Output | `src/method-core/outputs/freeze.ts` → `AssessmentOutput` | **OK** |
| Report | `src/method-core/outputs/reportSnapshot.ts` `buildReportSnapshot()` → `MethodReportView` | **OK — podłączone 2026-08-13** |
| Presentation | `src/method-core/outputs/presentationFromOutput.ts` `buildPresentationBlocksFromOutput()` → `MethodPresentationView` | **OK — podłączone 2026-08-13** |
| Initiative | `src/method-core/outputs/initiativeDraft.ts` → panel w `FrozenOutputView` | **OK** |
| E2E | `tests/e2e/*-true.spec.ts` + `docs/qa/e2e-true-2026-08-13/` | **OK (13/14)** |

### ★ MISSING — ogniwo, którego NIE MA

| Ogniwo | Status | Dowód |
| --- | --- | --- |
| **Library → utworzenie sesji przez UI** | **MISSING** | `src/components/assessment/library/AssessmentLibraryTab.tsx:137` woła `V8AssessmentApi.getDefinitions('DRD')` → `GET /api/v8/assessment/definitions/DRD` → tabela `assessment_definitions` (**0 wierszy**). `canStart = supported && !!drdDefinition` → `false`. Nawet po wypełnieniu tabeli `handleStart` woła `V8AssessmentApi.createAssessment()`, czyli **inny system** (`assessments`), nie `method_sessions`. |
| **Live Artifact** jako osobny ekran | **MISSING** | `grep -rn "Live Artifact\|LiveArtifact" src/` → 0 trafień. Istnieje `LiveMatrix` jako **panel wewnątrz** Work View, nie odrębna powierzchnia SPEC-A. |

★ **Nie zastąpiłem tych ogniw testem ani harnessem.** E2E przechodzi przez harness
`dev-render` z **realnym HTTP** — i jest to w §9 oznaczone jako `BROWSER_PLUS_DIRECT_HTTP`,
nie `TRUE_BROWSER_UI`.

### §4a — 23 endpointy HTTP

```
POST   /api/method/sessions
GET    /api/method/sessions/:id
POST   /api/method/sessions/:id/events
GET    /api/method/sessions/:id/events
POST   /api/method/sessions/:id/transition
POST   /api/method/sessions/:id/freeze
POST   /api/method/sessions/:id/reopen
POST   /api/method/sessions/:id/teresa/preview
POST   /api/method/sessions/:id/teresa/commit
GET    /api/method/sessions/:id/lineage
GET    /api/method/sessions/:id/outputs
GET    /api/method/sessions/:id/reports
GET    /api/method/sessions/:id/presentations
GET    /api/method/sessions/:id/initiative-drafts
GET    /api/method/packs
GET    /api/method/outputs/:id
GET    /api/method/outputs/:id/revisions
POST   /api/method/outputs/:id/report
POST   /api/method/outputs/:id/presentation
POST   /api/method/outputs/:id/initiative-drafts
GET    /api/method/reports/:id
GET    /api/method/presentations/:id
GET    /api/method/initiative-drafts/:id
```

---

## 5. MODEL DANYCH I ŹRÓDŁO PRAWDY

### ★★★ KONFLIKT: `assessment_definitions` vs `method_packs` vs feature flags

**To jest najważniejsza rzecz w tym dokumencie.** Trzy rozłączne rejestry, a widoczny
przycisk czyta pusty.

| | Rejestr | Producent | Konsumenci | Seed | Migracja tworząca | Read path | Write path | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **A** | `assessment_definitions` | `server/src/controllers/AssessmentController.ts:365` (`CREATE TABLE IF NOT EXISTS` w kodzie!) | ★ **jedyny czytany przez przycisk „Start"** — `AssessmentLibraryTab.tsx:137` | **BRAK — 0 wierszy** | brak pliku migracji; tabela powstaje z kodu kontrolera | `GET /api/v8/assessment/definitions/:id` | endpointy publikacji istnieją, **zero kodu frontu je woła** | **LEGACY, PUSTY, BLOKUJĄCY** |
| **B** | `method_packs` | `server/src/method-core/MethodPackRegistry.ts` | silnik method-core (`canStartSession`) | zaseedowany: DRD `2.0.0-methodpack.1` (39 jednostek / 233 poziomy / 699 pytań) | `20260813_method_core_1_kernel.sql` | `MethodPackRegistry.listAll/getPack` | `register()` | **CURRENT — ale żaden widoczny komponent go nie sprawdza** |
| **C** | flagi klienckie | `src/hooks/useFeatureFlags.tsx` | `AssessmentSessionEditorView`, `DrdMethodWorkspaceScreen` | — | — | `isEnabled('drdMethodWorkspaceSliceV1')` itd. | — | **wszystkie OFF, brak działającej powierzchni do włączenia** |

**Ryzyko drugiego źródła prawdy: WYSOKIE i zmaterializowane.**
Skutek zmierzony: **na świeżej instalacji nie istnieje sekwencja kliknięć tworząca
sesję DRD ani SIRI.**

**NIE ROZSTRZYGAM tego konfliktu i nie usuwam żadnych danych.** Powody:
1. to decyzja produktowa (**który rejestr jest kanoniczny**),
2. legacy `assessments` może nieść wyniki istniejących klientów → wygaszenie jest
   **nieodwracalne**,
3. równoległa sesja pracuje w tym obszarze (kandydat `031772082b`) — duplikowanie
   dałoby konflikt.

Pełna analiza z trzema opcjami: `docs/program/METHOD_ASSESSMENT_CORE_2026-08-13/COORDINATION_REQUIRED_REJESTRY.md`.

### Tabele `method_*` (14) — wszystkie z jednego producenta

`method_sessions`, `method_events`, `method_evidence`, `method_findings`,
`method_outputs`, `method_snapshots`, `method_packs`, `method_report_snapshots`,
`method_initiative_drafts`, `method_teresa_previews`, `method_session_roles`,
`method_session_role_events`, `method_session_create_idempotency`,
`method_session_reopen_idempotency`.

Producent: wyłącznie `server/src/method-core/*`. Konsument runtime: `method-core.routes.ts`.
**Zero drugiego pisarza** — zweryfikowane `grep` po nazwach tabel poza `server/src/method-core/`.

---

## 6. MIGRACJE

### Kolejność (numeracja jest KONTRAKTEM, nie kosmetyką)

```
20260813_method_core_1_kernel.sql              sessions, events, evidence, packs, snapshots
20260813_method_core_2_outputs.sql             outputs, findings, report_snapshots, initiative_drafts, teresa_previews
20260813_method_core_3_http_idempotency.sql    session_create_idempotency
20260813_method_core_4_bypass_status.sql       kolumny demo-bypass
20260813_method_core_5_role_events.sql         session_roles, session_role_events
20260813_method_core_6_reopen_idempotency.sql  session_reopen_idempotency
```

### ★ Dwa defekty instalacji od zera — naprawione, ale ZAPAMIĘTAJ mechanizm

1. **Runner sortuje pliki tej samej daty leksykalnie** → konsument trafiał przed
   producenta (2 inwersje). Naprawa: jawna numeracja `_1_.._6_`.
2. ★★ **`isSqliteOnlyMigration()` (`server/src/database/migrate.postgres.ts` ~318-327)
   CICHO WYKLUCZA** każdy plik z `seed` / `mock` / **`demo`** w nazwie. Plik
   `..._demo_status.sql` **nigdy nie biegł** na świeżej instalacji, a runner zwracał
   `✅ complete`, **exit 0**. Naprawa: zmiana nazwy na `_4_bypass_status`.

**Kod wyjścia migracji NIE dowodzi kompletności schematu — pytaj `information_schema`.**

### Fresh bootstrap — zweryfikowany

```
docker run -d --name mac-pg-fresh8 -e POSTGRES_USER=t -e POSTGRES_PASSWORD=t \
  -e POSTGRES_DB=t_test -p 55530:5432 pgvector/pgvector:pg15
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
  DATABASE_URL='postgresql://t:t@127.0.0.1:55530/t_test' \
  npx tsx server/scripts/migrate.postgres.ts
→ exit 0, 6/6 migracji method_core w kolejności
→ information_schema: 14 tabel method_* POTWIERDZONE
```

★ `pgvector/pgvector:pg15` jest **wymagane** — zwykły `postgres:alpine` nie ma
rozszerzenia `vector` i `20260719_baseline_gap.sql` pada.
★ Runner **odrzuca localhost** bez `NODE_ENV=test` — to bezpiecznik, nie błąd.

### Migracja PRZYGOTOWANA, ALE NIEURUCHOMIONA

| Plik | Status | Powód |
| --- | --- | --- |
| `server/migrations/946_siri_16d_source_of_truth.sql` | **PREPARED, NOT APPLIED** | Zablokowana na COORD-02. Nagłówek pliku deklaruje to wprost. **Nie uruchomiona na żadnej bazie.** |

### Upgrade path
**NIE ZWERYFIKOWANY.** Wszystkie przebiegi robiłem na **świeżych** bazach jednorazowych.
Migracja istniejącej bazy z danymi (demo/staging) **nie była testowana** — `NOT_VERIFIED`.

**Zero uruchomień na demo, staging i PROD.**

---

## 7. FUNKCJE I DoD

| Wymaganie | implemented | wired in production | persisted | browser verified | evidence | status |
| --- | --- | --- | --- | --- | --- | --- |
| Kernel metodyczny (18 zdarzeń, maszyna stanów) | TAK | TAK | TAK | TAK | `e2e-true-2026-08-13/` | **PASS** |
| Sesja: create/read/events/transition | TAK | TAK | TAK | TAK | `drd-full-chain/step-verdicts.json` | **PASS** |
| Role i approval (segregacja obowiązków) | TAK | TAK | TAK | TAK | samonadanie `approver` → **403** | **PASS** |
| Freeze → niezmienny Output | TAK | TAK | TAK | TAK | `sql-reopen-content-hash-verification.txt` | **PASS** |
| Reopen → nowa rewizja | TAK | TAK | TAK | TAK | `sql-lineage.txt` | **PASS** |
| Supersession artefaktów | TAK | TAK | TAK | TAK | `extra-scenarios/sql-evidence.txt` | **PASS** |
| Idempotencja (duplicate submit) | TAK | TAK | TAK | TAK | `extra-scenarios/D-*.png` | **PASS** |
| CAS / 409 / stale version | TAK | TAK | TAK | TAK | `offline-and-two-tabs/06,07` | **PASS** |
| Offline → reconnect → **RECOVERED** | TAK | TAK | TAK | TAK | `offline-and-two-tabs/05-recovered.png` | **PASS** |
| Teresa Intent→Preview→Commit | TAK | TAK | TAK | TAK | live 8/8 + `B1/B2-*.png` | **PASS** |
| Voice transcript tym samym API | TAK | TAK | TAK | CZĘŚCIOWO | `C1/C2-*.png` | **PARTIAL** — realne audio `NOT_VERIFIED` (headless, brak mikrofonu) |
| **Report jako prawdziwy widok** | TAK | **TAK (2026-08-13)** | TAK | TAK | `wire-report-presentation-2026-08-13/` | **PASS** (jakość → §10) |
| **Presentation jako prawdziwy widok** | TAK | **TAK (2026-08-13)** | TAK | TAK | jw. | **PASS** (jakość → §10) |
| Initiative Proposal Draft | TAK | TAK | TAK | TAK | `drd-full-chain/` | **PASS** |
| Discovery artefaktów po restarcie | TAK | TAK | TAK | TAK | 9 endpointów GET, 200 | **PASS** |
| **Library → Session przez UI** | NIE | **NIE** | — | NIE | §5 konflikt rejestrów | **BLOCKED** |
| **Live Artifact (osobny ekran)** | NIE | NIE | — | NIE | grep = 0 trafień | **MISSING** |
| SIRI — silnik i struktura 16D | TAK | TAK | TAK | TAK | odmowa startu 422 | **PASS** (mechanika) |
| SIRI — treść 16 wymiarów | NIE | — | — | — | 0/16 | **BLOCKED** (legal) |
| DRD — `misScoringTraps` | NIE | — | — | — | 0/233 | **EVIDENCE_MISSING** |
| DRD — pola pomocy pytania | NIE | — | — | — | 0/699 | **EVIDENCE_MISSING** |
| Upgrade path istniejącej bazy | — | — | — | NIE | brak przebiegu | **NOT_VERIFIED** |

**Podsumowanie: PASS 15 · PARTIAL 1 · BLOCKED 3 · MISSING 1 · EVIDENCE_MISSING 2 · NOT_VERIFIED 1**

---

## 8. TEST DISCOVERY I REGRESJA

### Odkrywalność — plików na dysku = plików raportowanych

| Bramka | Na dysku | Raportowanych | Pominiętych |
| --- | ---: | ---: | ---: |
| serwer (`server/src/method-core`) | **14** | **14** | **0** |
| front (zakres bramki) | **45** | **45** | **0** |

### Wyniki na SHA `22815cd950` (zmierzone przy pisaniu tego dokumentu)

```bash
# SERWER
DATABASE_URL='postgresql://t:t@127.0.0.1:55530/t_test' POSTGRES_SKIP_INIT_IN_TEST=1 \
  npm run test:method-core:server
→ Test Files 14 passed (14) | Tests 170 passed (170) | exit 0

# FRONT z żywym serwerem
RUN_TERESA_LIVE_TESTS=1 TERESA_LIVE_SERVER_URL=http://localhost:42210 \
  npm run test:method-core:front:live
→ Test Files 45 passed (45) | Tests 344 passed (344) | 0 skipped | exit 0

# FRONT bez żywego serwera (dla porównania)
npm run test:method-core:front
→ Tests 336 passed | 8 skipped (344)
```

| Pole | Wartość |
| --- | --- |
| retry | **`--retry=0`** wpisane na stałe w oba skrypty |
| worker count | serwer: `--no-file-parallelism` (1 plik naraz); front: domyślny |
| środowisko | `NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false` |
| baza | `mac-pg-fresh8` (`pgvector/pgvector:pg15`, port **55530**) — jednorazowa |
| żywy serwer | port **42210**, baza `mac-pg-team` (55495, zaseedowana) |

★ **`vitest.config.ts:297` ma `retry: process.env.CI ? 3 : 1`.** Kanoniczne skrypty
nadpisują to `--retry=0`. **Jeśli uruchomisz `vitest` gołe — bramka będzie ponawiać
i ukryje migotanie.**

### Pełna regresja frontu — obie strony mierzone przy PORÓWNYWALNYM obciążeniu

```bash
npx vitest run --config vitest.config.ts --exclude 'server/**' src --retry=0
```

| | HEAD | baseline `f3e7df565e` |
| --- | ---: | ---: |
| plików czerwonych | **33** | **33** |
| testów czerwonych | **90** | **90** |
| testów zielonych | 4 526 | 4 147 |

| Kategoria | Liczba |
| --- | ---: |
| **introduced** | **0** |
| **identical_pre_existing** | **33 pliki / 90 testów** |
| **fixed** | 0 |
| **flaky** | zawarte w powyższych (timeouty pod obciążeniem, po obu stronach tak samo) |

★★ **PUŁAPKA POMIAROWA — przeczytaj przed powtórzeniem.** Pierwszy pomiar HEAD dał
33/90 wobec zapamiętanych **32/88** z baseline → wyglądało na jedną wprowadzoną
regresję (`InitiativesHub.newModalA11y.test.tsx`, `Test timed out in 60000ms` przy
czasie **60 036 ms**). Po przemierzeniu baseline **tą samą komendą przy porównywalnym
`load average`** baseline dał również 33/90, a zbiory czerwonych plików są **identyczne**.
**Liczba czerwonych testów tego repo zależy od obciążenia maszyny** (podczas prac
`load average` sięgał **482** na 16 rdzeniach). Porównanie ma sens wyłącznie przy
zbliżonych warunkach.

### Testy PARTIAL / NOT_VERIFIED

| Element | Status | Komenda wznowienia |
| --- | --- | --- |
| 8 testów live Teresy | **wymagają żywego serwera** | patrz §14 |
| E2E offline (`tests/e2e/*-true.spec.ts`) | **NOT_VERIFIED w tej turze** — nie przepuszczone ponownie po ostatnich merge'ach | `scripts/dev/e2etrue-run-offline-suite.sh` |
| upgrade path migracji | **NOT_VERIFIED** | brak |

---

## 9. BROWSER E2E

### Klasyfikacja rzetelności — czytaj uważnie

| Klasa | Co obejmuje |
| --- | --- |
| `TRUE_BROWSER_UI` | **ŻADEN krok od Library.** Zobacz §4 MISSING. |
| **`BROWSER_PLUS_DIRECT_HTTP`** | **wszystkie 14 scenariuszy** — prawdziwa przeglądarka (Playwright/Chromium) + realne żądania HTTP do żywego serwera, ale wejście przez harness `dev-render`, bo produkcyjna ścieżka Library jest martwa |
| `HTTP_ONLY` | weryfikacje kontraktowe roli/idempotencji na poziomie API |
| `HARNESS_ONLY` | zrzuty MPQ |
| `UNIT_ONLY` | 344 testy frontowe |

★ **SQL użyty WYŁĄCZNIE do potwierdzenia, nigdy do wprowadzania danych.** Dane robocze
wprowadzane klikaniem i pisaniem w UI.

### 14 scenariuszy — `docs/qa/e2e-true-2026-08-13/`

| # | Scenariusz | Wynik | Dowód |
| --- | --- | --- | --- |
| 1 | DRD pełny łańcuch, 19 kroków, **2 restarty API+FE** | **PASS** | `drd-full-chain/step-verdicts.json` (19× `"verdict":"PASS"`) |
| 2 | SIRI — bramka gotowości odmawia startu | **PASS** (poprawne zachowanie) | HTTP **422 `pack_not_released`** |
| 3 | Teresa Intent→Preview→Commit | **PASS** | `extra-scenarios/B1,B2-*.png` |
| 4 | voice transcript tym samym API | **PASS** | `C1,C2-*.png` |
| 5 | offline → realny reconnect → **RECOVERED** | **PASS** | `offline-and-two-tabs/05-recovered.png` |
| 6 | dwie karty + konflikt CAS/409 | **PASS** | `06-,07-*.png`, wersje 3 vs 4 |
| 7 | stale version | **PASS** | 409 `version_conflict` |
| 8 | duplicate submit (idempotencja) | **PASS** | SQL: 1 wiersz |
| 9 | cross-org | **PASS** | 403/404, brak wycieku istnienia |
| 10 | unauthorized (self-grant approver) | **PASS** | HTTP 403 |
| 11 | send-back | **PASS** | krok 12/13 |
| 12 | reopen + `content_hash` | **PASS** | `sql-reopen-content-hash-verification.txt` |
| 13 | supersession | **PASS** | 3 artefakty `superseded` |
| 14 | błąd Report/Presentation + retry | **FAIL → naprawione** | `G1,G2-*.png`; naprawa: kanał `actionError` + test regresyjny |

★ **Restart z nowym PID** — udokumentowane znaczniki czasu i PID przed/po.
★ Pliki `.har` (setki MB) **celowo NIE commitowane** (`*.har` w `.gitignore`) —
leżą na dysku pod `docs/qa/e2e-true-2026-08-13/**/har/`.

---

## 10. MPQ, TRIADA I ACCESSIBILITY

### Drugi (ostatni) niezależny odbiór — SHA **`e0afbc46a6`**

★ Odbiór wykonano na `e0afbc46a6`. Po nim wprowadziłem naprawy (kandydat `22815cd950`),
które **NIE ZOSTAŁY PONOWNIE OCENIONE**. Poniższe liczby są **przedostatnim** stanem.

| Widok | Light | Dark | Próg | Werdykt | URL / harness | Viewport |
| --- | ---: | ---: | ---: | --- | --- | --- |
| Sessions | **29** | **29** | 27 | **PASS** | `mpq-audit-hub.html` | 1440 |
| Work View | **27** | **27** | 27 | **PASS** (granicznie) | `drd-workspace.html` | 1440 |
| Library | **24** | **27** | 27 | Light **FAIL** / Dark PASS | `mpq-audit-hub.html` | 1440 |
| Report | **25** | **25** | 29 | **FAIL** | `drd-workspace.html?screen=report` | 1440 |
| Presentation | **25** | **25** | 29 | **FAIL** | jw. | 1440 |
| Output | **15** | **15** | 27 | **FAIL** | jw. | 1440 |
| Initiative Proposal | **17** | **17** | 27 | **FAIL** | jw. | 1440 |
| Live Artifact | — | — | — | **NOT_IMPLEMENTED** | — | — |

### TRIADA
**Zero twardych błędów** w ocenianych plikach: brak własnych tabel zamiast `StandardTable`
(jedyny bespoke `<table>` to `LiveMatrix.tsx` z jawnym `{/* §27-exempt */}` — archetyp
Matryca), zero `primary-*`/crimson jako CTA, focus ring obecny, kolor nigdy nie jest
jedynym nośnikiem informacji.

### Accessibility
- **Keyboard-only**: 20× Tab bez pułapki fokusa; ring zmierzony `getComputedStyle` →
  Light `rgba(37,99,235,0.4)`, Dark `rgba(91,141,239,0.45)` = token `c-focus`.
- **axe-core** (prawdziwy Chromium, nie jsdom): 0 naruszeń w 8 plikach `method-workspace`;
  wynik w `docs/qa/screens/axe-results-2026-08-13.json`.
- **Zoom 200%**: Work View — treść pytania ląduje poniżej zagięcia (defekt D-W3, §13).
- **VoiceOver / NVDA**: **NOT_VERIFIED** — wyłącznie asercje strukturalne ARIA + axe.

### Weryfikacja fizyczna dowodów (`test -f`)

Sprawdziłem **każdy** plik śledzony w `docs/qa/**` dla katalogów tej fali:

| Katalog | Plików w git | Brakujących na dysku |
| --- | ---: | ---: |
| `a9-2026-08-13` | 37 | **0** |
| `a10-2026-08-13` | 124 | **0** |
| `mpq-2026-08-13` | 18 | **0** |
| `mpq-independent-2026-08-13` | 46 | **0** |
| **`mpq-reaudit-2026-08-13`** | **33** | **0** ★ dodane w `22815cd950` |
| `mpq-workview-2026-08-13` | 4 | **0** |
| `e2e-full-2026-08-13` | 18 | **0** |
| `e2e-true-2026-08-13` | 42 | **0** |
| `offline-real-2026-08-13` | 7 | **0** |
| `wire-report-presentation-2026-08-13` | 9 | **0** |
| `fix-focus-2026-08-13` | 4 | **0** |
| `fix-hub-2026-08-13` | 14 | **0** |
| `screens/dark-a11y-2026-08-13`, `screens/teresa-2026-08-13` | obecne | **0** |

★ **`mpq-reaudit-2026-08-13` (33 zrzuty) nie były częścią kandydata** — audytorzy
pracowali we własnych worktree. Skopiowane i zacommitowane, żeby dowód nie zginął.
To jedyna zmiana „produktowa" w tej turze i **nie dotyka kodu**.

### MISSING_EVIDENCE

| Brak | Powód |
| --- | --- |
| ponowna ocena MPQ **po** naprawach z `22815cd950` | naprawy weszły po odbiorze; **nie oceniałem własnej pracy** |
| VoiceOver / NVDA | brak realnego czytnika w środowisku |
| realne audio (voice) | headless, brak mikrofonu |
| pliki `.har` | celowo poza gitem (setki MB); ścieżki podane w §9 |
| upgrade path migracji | brak przebiegu |

---

## 11. ARTEFAKTY I LINEAGE

Z **jednorazowej** bazy `mac-pg-e2etrue` (`pgvector/pgvector:pg15`, port 55540).
Źródło: `docs/qa/e2e-true-2026-08-13/drd-full-chain/sql-lineage.txt`.

```
SESJA ROOT      f87f0923-f76f-49f9-b8e9-c56ae4244d77   state=frozen   version=5
  ├─ rewizja    e857a69f-574f-4204-905c-74199a452d09   state=active   revision_of=f87f0923…
  └─ rewizja    2105ce12-df71-4e81-8e9a-f5ef71a9c579   state=frozen   revision_of=f87f0923…

OUTPUT v1       989b058c-fd97-4bc3-a39e-4b6e059bcbe0   session=f87f0923…  revision_of=NULL
                content_hash = 1ef997a7c9428337f25ff64cd4b6d37e495a6d5a571927628a3de3a6eb85efe9
OUTPUT v2       4b6bb882-adda-40cf-97ee-93e9ae7dd290   session=2105ce12…  revision_of=989b058c…
                content_hash = 27b6751a763727461cdc0890a6e02e376b2dbd869b267d92a843dd0ee440ad69
```

**Dowód, że artefakty pochodzą z tego samego Outputu:** każdy Report / Presentation /
Initiative Draft niesie `source_output_id`; po reopen artefakty v1 zostają oznaczone
`superseded` (3 wiersze, `extra-scenarios/sql-evidence.txt`), a `content_hash` Outputu
v1 pozostaje **niezmieniony** — reopen tworzy nową rewizję, nigdy nie mutuje zamrożonej.

★ Hash v1 ≠ hash v2 i **tak ma być** — to dwie różne rewizje. Niezmienność dotyczy
hasha **v1 przed i po** cyklu reopen.

---

## 12. READINESS

| Wymiar | DRD | SIRI | Dowód |
| --- | --- | --- | --- |
| **Technical** | **PASS** | **PASS** | serwer 170/170, front 344/344 bez pominiętych, `--retry=0`; E2E 13/14; fresh bootstrap z `information_schema` |
| **Methodology** | **BLOCKED** | **BLOCKED** | `canStartSession()` = **false** dla obu; DRD: 0/233 `misScoringTraps`, 0/699 pól pomocy; SIRI: 0/16 wymiarów |
| **Legal** | n/d | **BLOCKED** | Module 2 str. 32-69, klauzula zakazu reprodukcji; **zero wygenerowanej treści licencjonowanej** |
| **Runtime** | **warunkowe** | **warunkowe** | 3 flagi domyślnie OFF; brak działającej powierzchni do ich włączenia |
| **Client publication** | **NIE** | **NIE** | MPQ: Report 25/30 i Presentation 25/30 przy progu 29; Output 15, Initiative 17 przy progu 27 |

### Kontrola: bramka gotowości NIE została podniesiona

| Kontrola | Wynik |
| --- | --- |
| `canStartSession()` DRD / SIRI | **false** / **false** |
| demo-bypass zmienia `method_packs.readiness`? | **NIE** — test przed i po całym przepływie freeze→Output→Report |
| Output z bypassem odróżnialny od produkcyjnego? | **TAK** — jawny znacznik; produkcyjny ma `demoBypassActive: false` |
| ścieżka HTTP omijająca bramkę? | **NIE** — test „production always refuses session start against methodology_review" |
| SIRI przez UI | **HTTP 422 `pack_not_released`** |

**Nie podniosłem readiness. Nie zmieniłem żadnej flagi.**

---

## 13. ZNANE DEFEKTY I BRAKI

| ID | Waga | Defekt | Reprodukcja | Przyczyna | Plik / funkcja | Proponowana naprawa | Ryzyko | Brakujący test |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **R-1** | **P0** | Nie da się utworzyć sesji przez UI | świeża instalacja → Assessment → Library → „Start" wyszarzony | 3 rozłączne rejestry; przycisk czyta pustą `assessment_definitions` i woła V8 `createAssessment()` | `AssessmentLibraryTab.tsx:137`; `AssessmentController.ts:365` | **decyzja właściciela** (§5), potem most addytywny | **wysokie** — dotyka danych istniejących klientów | E2E „klik z menu głównego tworzy sesję" |
| **D-L1** | **P1** | Baner błędu nieczytelny w Light (kontrast **1.38:1** przy progu 4.5:1) | wymuś błąd sieci na Library | komponent pisany dark-first, `text-amber-100` na `bg-amber-500/10` | `AssessmentHub.tsx` ~2619 | **naprawione w `22815cd950`** (tokeny `c-warning`) — wymaga potwierdzenia odbiorem | niskie | test kontrastu dla stanów błędu |
| **D-W3** | **P2** | Zoom 200%: treść pytania poniżej zagięcia | viewport 720×450 | stos: baner + oś + toolbar + status + macierz | `MethodWorkspaceShell.tsx:406-421` | zwinąć „Macierz na żywo" domyślnie przy niskiej wysokości | niskie | test wysokości viewportu |
| **A10-D2** | **P2** | Hydration warning `whitespace text nodes… <table>` | render `LiveMatrix` | białe znaki w JSX tabeli | `LiveMatrix.tsx` | usunąć whitespace między znacznikami | niskie | brak |
| **M-1** | **P1** | Output 15/30, Initiative 17/30 | odbiór MPQ | panele nigdy nie były projektowane, tylko debugowe | `DrdMethodWorkspaceScreen.tsx` `FrozenOutputView` | zastosować wzorzec z `MethodReportView` | średnie | MPQ ≥27 |
| **M-2** | **P1** | Report/Presentation 25/30 przy progu 29 | odbiór MPQ | przyczyny (surowe id) naprawione po odbiorze | `MethodReportView`, `presentationFromOutput` | **ponowny odbiór** | niskie | — |
| **T-1** | **P2** | 13 jednorazowych `tsconfig.*-scoped.json` w korzeniu | `ls` | dług po agentach | korzeń repo + `server/` | usunąć albo przenieść do `tools/` | zerowe | — |
| **E-1** | **P2** | `dev-render/main.tsx` importuje nieistniejący `./screens/tools-sesja-wyjscie` | start wspólnego harnessu | brakujący plik | `dev-render/main.tsx:59` | naprawia inna sesja (`fix/dev-render-dangling-import-20260813`) | zerowe | — |

---

## 14. NASTĘPNE KROKI DLA CODEX

### Krok 0 — checkout i weryfikacja

```bash
git checkout codex/method-assessment-clean-20260813   # 22815cd950
git rev-parse HEAD                                     # musi dać 22815cd950…
git rev-list --objects f3e7df565e..HEAD | \
  git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' | \
  awk '$1=="blob" && $3>5000000'                       # MUSI być PUSTE
```

### Krok 1 — ★ NAJPIERW zsynchronizuj z aktualnym demo

Kandydat jest **47 commitów za `origin/demo`**. Historie się nie rozjechały
(`merge-base` = baseline), więc:

```bash
git merge origin/demo        # albo rebase, jeśli wolisz liniowo
# po scaleniu OBOWIĄZKOWO powtórz obie bramki (Krok 3)
```

**Konflikty semantyczne, których się spodziewaj:**
- `.claude/launch.json` — **zawsze zachowaj OBIE strony**, plik jest współdzielony
  między sesjami (wymaga `git add -f`, katalog jest w `.gitignore`);
- `package.json` — sekcja `scripts`, trzy skrypty bramek;
- `src/hooks/useFeatureFlags.tsx` — rejestr flag;
- `server/src/index.ts` / `startup/*` — jeśli demo też ruszało bootstrap.

### Krok 2 — gałęzie do scalenia

**Żadnych.** Wszystkie 28 gałęzi modułu jest już w kandydacie (§2). Nie scalaj
`codex/method-assessment-core-20260813` — to **przed-czyszczeniowa** wersja, wciągnie
z powrotem 248 MB blobów HAR.

### Krok 3 — bramka po każdym scaleniu

```bash
# 1. baza jednorazowa
docker run -d --name codex-pg -e POSTGRES_USER=t -e POSTGRES_PASSWORD=t \
  -e POSTGRES_DB=t_test -p 55600:5432 pgvector/pgvector:pg15

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
  DATABASE_URL='postgresql://t:t@127.0.0.1:55600/t_test' \
  npx tsx server/scripts/migrate.postgres.ts

# 2. schemat — NIE ufaj kodowi wyjścia
docker exec codex-pg psql -U t -d t_test -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_name LIKE 'method\_%'"
# oczekiwane: 14

# 3. bramka serwera
DATABASE_URL='postgresql://t:t@127.0.0.1:55600/t_test' POSTGRES_SKIP_INIT_IN_TEST=1 \
  npm run test:method-core:server          # 170/170, 14 plików

# 4. bramka frontu (bez serwera — 8 testów będzie POMINIĘTYCH)
npm run test:method-core:front             # 336 passed | 8 skipped
```

### Krok 4 — pierwsza PRAWDZIWA bramka runtime (wznowienie 8 testów PARTIAL)

```bash
# a) baza zaseedowana: org test-org-id, user test-user-id, pack drd@2.0.0-methodpack.1
# b) serwer:
cd server && NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
  ENABLE_TEST_AUTH_BYPASS=true METHOD_CORE_DEMO_BYPASS_PACK_READINESS=true \
  PORT=42210 DATABASE_URL='postgresql://t:t@127.0.0.1:55600/t_test' \
  POSTGRES_SKIP_INIT_IN_TEST=1 npx tsx src/index.ts
# ★ czekaj do ~60 s na /api/ready; bez RUN_DB_TESTS=1 init bazy NIGDY nie ruszy
#   i /api/ready zostanie w not_ready NA ZAWSZE, bez błędu

# c) pełna bramka frontu z żywymi testami:
RUN_TERESA_LIVE_TESTS=1 TERESA_LIVE_SERVER_URL=http://localhost:42210 \
  npm run test:method-core:front:live      # 344/344, 0 pominiętych
```

### Krok 5 — decyzja produktowa (blokuje wszystko dalej)

Rozstrzygnij konflikt rejestrów z §5. **Dopóki nie zapadnie, „Library → Session"
pozostaje BLOCKED, a moduł nie jest używalny przez klienta**, niezależnie od jakości kodu.

### Krok 6 — domknięcie jakości

Zamów **trzeci** niezależny odbiór MPQ na `22815cd950` (naprawy po drugim odbiorze
nie były oceniane), następnie napraw Output (15/30) i Initiative (17/30).

---

## 15. ZAKAZY I STAN KOŃCOWY

| Zakaz | Stan | Weryfikacja |
| --- | --- | --- |
| merge do `demo`/`main` | **ZERO** | `git branch -r --contains HEAD` → 0 |
| push | **ZERO** | jw.; żadna gałąź modułu nie istnieje na `origin` |
| deploy | **ZERO** | — |
| PROD nietknięty | **TAK** | wszystkie bazy to jednorazowe kontenery `mac-pg-*` |
| `git reset --hard` / `clean` / `stash` | **ZERO** | — |
| usuwanie worktree | **ZERO** — 33 worktree modułu zachowane | `git worktree list` |
| podniesienie `RUNTIME_ACTIVE` | **ZERO** | 3 flagi nadal OFF |
| przepisywanie wspólnej historii | **ZERO** | `filter-repo` uruchomiony **wyłącznie na izolowanym klonie**, z `--refs f3e7df565e..HEAD`; baseline i wszystkie gałęzie innych sesji **nietknięte** |

★ Jedyny worktree porządkowy, który usunąłem, to `mac-regbase` — utworzony przeze mnie
na potrzeby jednego pomiaru regresji i skasowany po nim (`git worktree remove`).
Jego następca `mac-base6` **istnieje** i jest w tabeli §1.

---

## Pliki maszynowe

| Plik | Zawartość |
| --- | --- |
| `HANDOFF_ASSESSMENT_BRANCHES.tsv` | gałąź, SHA, baseline, zakres, scalona, potrzebna, kolizje |
| `HANDOFF_ASSESSMENT_FILES.tsv` | każdy zmieniony plik + klasyfikacja |
| `HANDOFF_ASSESSMENT_TESTS.tsv` | bramki, komendy, wyniki, środowisko |
| `HANDOFF_ASSESSMENT_EVIDENCE.tsv` | każdy artefakt dowodowy + `test -f` |
