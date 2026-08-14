# HANDOFF: moduł TOOLS → Codex

> Pakiet przejęcia. Wszystkie fakty zweryfikowane bezpośrednio w Git i na dysku
> w chwili pisania — **nie** przepisane z raportów agentów. Tam, gdzie raport
> agenta okazał się nieprawdziwy, jest to zapisane wprost.
>
> **Nie jest to zgłoszenie PRODUCT_COMPLETE.** `RUNTIME_ACTIVE = 0`.

---

## 1. TOŻSAMOŚĆ KANDYDATA

| Pole | Wartość |
|---|---|
| Moduł | **TOOLS** (Library → Sessions → Outputs → Reports → Initiatives) |
| Integration branch | `codex/final-f1-integ` |
| **Candidate SHA** | `11ea86bbf350ef4cfa40fc5c441219aa31512611` |
| **Baseline SHA** | `fb6dfedd4268171d0b81598ee571bb68cc182ce8` |
| merge-base | `fb6dfedd4268171d0b81598ee571bb68cc182ce8` — **równy baseline** (historia liniowa, bez rozjazdu) |
| Commity ponad baseline | **47** |
| `git status` | **1 plik zmodyfikowany**: `docs/program/METHOD_TOOLS_2026-08-13/test-inventory.json` (regeneracja manifestu; niezacommitowana) |
| Pushnięty? | **NIE** — `git branch -r --contains HEAD` = 0 |

Weryfikacja: `git cat-file -t` na obu SHA → `commit`. `git merge-base fb6dfedd42 HEAD` → baseline.

### Worktree związane z modułem

Wszystkie pod `/Users/piotrwisniewski/.codex/worktrees/`:
`f1-integ` (kandydat) · `wt-integration` · `wt-final` · `wt-ctrl` · `wt-uihttp` ·
`wt-mig948` · `wt-bootstrap` · `wt-idem` · `wt-outputs` · `harness-fix` ·
`s1-cas` `s2-artifact` `s3-teresa` `s4-outputs` `s5-e2e` `s6-integ` ·
`g1-evidence` `g2-idea` `g3-regress` `g3-baseline` `g4-roster` `g5-mpq` ·
`h1-speca` `h2-slide` `h3-manifest` `h4-regress` `h4-baseline` `h5-e2e`

**Żadnego nie usunięto.** Kontenery Postgres nadal działają (porty 56100–56813).

---

## 2. GENEALOGIA

Weryfikowana przez `git merge-base --is-ancestor <branch> 11ea86bbf3`, **nie** po nazwach.

| Branch | SHA | Scalona? | Zakres | Nadal potrzebna? |
|---|---|---|---|---|
| `codex/method-tools-20260813` | `d358a9fbe6` | TAK | packi, kontrakt, walidator | nie |
| `codex/tools-integration-20260813` | `eb2a9370e6` | TAK | Gate I0/I1/I2, `migrationOrdering.ts` | nie |
| `codex/tools-wt-mig948-20260813` | `1ab4a4da92` | TAK | skonsolidowana migracja 948 | nie |
| `codex/tools-wt-ctrl-20260813` | `892dff8b94` | TAK | ręczne pogodzenie B+C w `promoteToOutput` | nie |
| `codex/sprint-s1-cas` | `5e6ae271a1` | TAK | CAS + adapter UI/HTTP | nie |
| `codex/sprint-s2-artifact` | `617b7c3eab` | TAK | Live Artifact | nie |
| `codex/sprint-s3-teresa` | `39a8e5ac86` | TAK | kernel Teresy + voice transcript | nie |
| `codex/sprint-s4-outputs` | `c8ac4ca68e` | TAK | trasy read/list/reopen Outputs | nie |
| `codex/sprint-s6-integ` | `9b511bc206` | TAK | fala A, harness, ledger | nie |
| `codex/final-f2-pres` | `bc9b8ae0cd` | TAK | naprawa persistence Presentation | nie |
| `codex/final-f3-status` | `f4f43cbc51` | TAK | kanon statusów | nie |
| `codex/final-f4-swotui` | `c5c8dc6a49` | TAK | selektor wpływu, diagnoza scrolla | nie |
| `codex/final-f6-disco` | `068adf2fcb` | TAK | klasyfikacja testów + bramka discovery | nie |
| `codex/g-g1-evidence` | `266ad20258` | TAK | Evidence UI + kanoniczna bramka Accept | nie |
| `codex/g-g2-idea` | `e9b617d2b2` | TAK | Idea persistence + audyt połykania błędów | nie |
| `codex/g-g3-regress` | `523d395679` | TAK | regresja A/B baseline↔candidate | nie |
| `codex/g-g4-roster` | `aff1158586` | TAK | macierz 19 narzędzi | nie |
| `codex/g-g5-mpq` | `cc479601dd` | TAK | MPQ + naprawa pętli renderowania | nie |
| `codex/h-h2-slide` | `0cdac670a8` | TAK | **Slide Mode** | nie |
| `codex/h-h3-manifest` | `b3ae18dbdd` | TAK | **19 manifestów gotowości** | nie |
| `codex/h-h4-regress` | `af54e2c051` | TAK | domknięcie partii regresji | nie |
| **`codex/h-h1-speca`** | **`1f04000c1d`** | **NIE** | **powłoka SPEC-A + polish Report** | **TAK — do scalenia** |
| **`fix/dev-render-dangling-import-20260813`** | **`8b379a0eb9`** | **NIE** | naprawa harnessu + strażnik rejestru | **TAK — osobny kandydat** |
| `codex/tools-wt-bootstrap-20260813` | `5d5646b3e3` | NIE (tip) | bootstrap + C14 | nie — treść weszła przez `s6-integ` |
| `codex/tools-wt-idem-20260813` | `ef29137d1e` | NIE (tip) | idempotencja C15/C16 | nie — skonsolidowana w 948 |
| `codex/tools-wt-outputs-20260813` | `b1692a29fa` | NIE (tip) | `tool_outputs` kanoniczny | nie — weszła przez `wt-ctrl` |
| `codex/tools-wt-uihttp-20260813` | `97e30b7940` | NIE (tip) | adapter HTTP sesji | nie — cherry-pick w `s1-cas` |

**Uwaga:** cztery ostatnie mają `NIE` przy teście „tip jest przodkiem", ale ich
**treść** weszła przez gałęzie pośrednie (konsolidacja migracji, cherry-pick,
ręczne pogodzenie). Nie scalać ich ponownie — spowoduje to duplikaty.

### Kolejność semantyczna scaleń (zastosowana)

`s1-cas → s4-outputs → s2-artifact → s3-teresa → s6-integ → f2-pres → f3-status → f4-swotui → f6-disco → g2-idea → g4-roster → g1-evidence → g5-mpq → h2-slide → h3-manifest → h4-regress`

S1 (CAS) zawsze pierwszy — definiuje kontrakt zapisu dla reszty.

### Gałęzie odrzucone

| Element | Powód |
|---|---|
| `948_tool_promotion_idempotency.sql` (stara, z fali B) | zawierała zakazane `CREATE TABLE tool_initiative_links`, czyniąc z konsumenta trzeciego producenta. Zastąpiona przez `948_tool_promotion_tenant_idempotency.sql` |
| `949_tool_initiative_links_org_scope.sql` | skonsolidowana w 948 decyzją koordynatora |
| `codex/sync-demo-20260729` | martwa baza, 695 commitów za `origin/demo` |

---

## 3. RZECZYWISTY DIFF

`git diff --stat fb6dfedd42..11ea86bbf3` → **251 plików, +329 862 / −315**

Ogromna liczba wstawek pochodzi z artefaktów dowodowych (PNG/PDF) i JSON-owego
manifestu testów, nie z kodu.

| Kategoria | Liczba plików | Znacznik |
|---|---|---|
| Produkcyjne (`src/`, `server/src/`) | 38 | `MODULE_OWNED` / `SHARED_UI` |
| Testy | 27 | `TEST` |
| Dokumentacja | 156 | `EVIDENCE` / dokumentacja |
| dev-render (harness) | 17 | `TEST` |
| Inne (configi, skrypty) | 13 | mieszane |
| **Migracje** | **0** | wszystkie 946–951 były już w baseline |

Pełna lista z klasyfikacją: **`HANDOFF_TOOLS_FILES.tsv`**.

### Zmiany we współdzielonych komponentach (`SHARED_CONTRACT` / `SHARED_UI`)

| Plik | Charakter | Ryzyko |
|---|---|---|
| `server/scripts/migrate.postgres.ts` | wydzielenie czystej logiki do `migrationOrdering.ts`; runner pozostaje entrypointem | **dowiedzione zachowanie**: `--dry-run` przed i po = 576 migracji, 0 różnic w kolejności |
| `server/scripts/migrationOrdering.ts` | NOWY, czysty moduł (bez shebangu, bez env, bez DB) | niskie |
| `vitest.acceptance.config.ts` | dodany brakujący alias `@` | **zastany defekt** — bez niego 33 testy raportowały się jako „skipped" |
| `server/src/Gateway.ts` | montaż `/api/tool-outputs` | addytywne |
| `src/services/api.ts` | 6 nowych metod klienta | addytywne |
| `src/method-core/contracts/**` | scalone z `e3b8be6cd7` (Assessment/Core) | **cudza własność** — nie modyfikować |

### `FOREIGN_OR_SUSPECT`

| Plik | Pochodzenie |
|---|---|
| `src/method-core/contracts/{events,index,methodPack,session,teresa}.ts` | **własność zespołu Assessment/Core**, scalone z zamrożonego kontraktu `e3b8be6cd7` + manifest `eaa80cfedb`. Tylko do odczytu dla Tools. |
| `dev-render/screens/tools-sesja-wyjscie.tsx` | **NIE jest w kandydacie** — leży na niescalonym `fix/dev-render-dangling-import-20260813`. W głównym drzewie istnieje jako *untracked*. |
| `docs/program/METHOD_ASSESSMENT_CORE_2026-08-13/**` | dokumentacja cudzego zespołu, weszła z merge kontraktu |

---

## 4. ŚLAD PRODUKTOWY

| Ogniwo | Ścieżka / funkcja | Status |
|---|---|---|
| Route/ekran | `src/components/Discovery/DiscoveryToolsHub.tsx` (hub, Library) | OK |
| Sesja | `src/components/DiscoveryTools/ToolDocumentView.tsx`, `ToolWorkspace.tsx` | OK |
| Client API | `src/services/toolSessionApi.ts`, hook `src/hooks/useToolSessionSync.ts`, `src/services/api.ts` | OK |
| HTTP | `POST/GET/PUT /api/tools`, `/api/tools/:id/{request-review,approve,send-back,promote}`, `/api/tool-outputs/**` | OK |
| Router | `server/src/routes/tools.routes.ts`, `server/src/routes/toolOutputs.routes.ts` | OK |
| Controller | `server/src/controllers/ToolController.ts` → `promoteToOutput`; `ToolOutputsController.ts` | OK |
| Serwis snapshotu | `server/src/services/tools/toolOutputSnapshotService.ts` → `ensureToolOutputSnapshot` | OK |
| Silnik metody | `src/config/swot/swotTensionEngine.ts` (`isAcceptedSwotItem`, `deriveTensionCandidates`) | OK |
| Most sesja→Output | `src/toolOutputs/buildSwotOutput.ts` | OK — **tylko dla `dynamic-swot`** |
| Tabele | `tool_sessions`, `tool_outputs`, `tool_output_approvals`, `tool_reports`, `tool_report_sources`, `tool_output_initiative_proposals`, `tool_session_events`, `tool_initiative_links` | OK |
| Migracje | 946, 947, 948, 950, 951 (wszystkie już w baseline) | OK |
| Output | `src/toolOutputs/outputLifecycle.ts` (approve/reopen/immutability) | OK |
| Report/Presentation | `src/toolOutputs/renderReport.ts` → `src/components/DiscoveryTools/report/ToolReportView.tsx` | OK |
| **Slide Mode** | `src/toolOutputs/slides.ts` → `SlideDeckView.tsx` | OK |
| Initiative | `recordInitiativeProposal` w `ToolController.ts` | OK |
| **CTA Report/Presentation w produkcyjnym UI** | — | **MISSING** — istnieje tylko przez `ToolOutputsPanel`; `CONSULTING_TOOL_STANDARD_OUTPUTS = ['initiative']` w `src/config/consultingToolsStandard.ts:35` nadal zawęża CTA |
| **Browser E2E dla Dynamic SWOT** | — | **MISSING** — jedyny wykonany przebieg dotyczył modułu **Assessment (DRD)**, nie Tools |
| **Powłoka SPEC-A** | `codex/h-h1-speca` | **NIESCALONA** |

---

## 5. MODEL DANYCH I ŹRÓDŁO PRAWDY

| Tabela | Producent | Konsumenci | Status |
|---|---|---|---|
| `tools` (rejestr 31) | migracje 559/562 + `KnownToolsService.ensureToolsSeedOnce` | `DiscoveryToolsHub`, `/api/known-tools` | current |
| `tool_sessions` | `ensureToolsSchema()` w `ToolController.ts` | wszystko | current; kolumna `version` = CAS |
| **`tool_outputs`** | migracja **946** | Report/Presentation/Initiative | **kanoniczny niezmienny snapshot** |
| `tool_initiative_links` | **`20260719_baseline_gap.sql:9533`** | promocja, dedup, lineage | current — **projekcja zgodności, NIE drugie źródło prawdy** |
| `my_ideas` | `755_my_ideas_00base.sql` + `20260220_my_work_my_ideas.sql` | `/api/my-work/my-ideas` | current |
| `presentation_decks` / `presentation_cards` | istniejące migracje prezentacji | `registerArtifactOrigin`, reopen | current |
| `v8_output_artifacts` | rejestr artefaktów | listy Outputs/Reports | current |
| `v8_artifact_runs` | `20260324_v81_artifact_runs_wave1.sql` | **wyłącznie** planowanie artefaktów z czatu | **NIE dla Tools** — historyczny błąd, naprawiony |
| `swot_proposals` | `20260802_swot_proposals.sql` | `acceptSwotProposal` | **legacy, przed zamrożonym kontraktem Teresy** — brak `previewId`, brak wygaśnięcia |

### Konflikty źródeł prawdy — do rozstrzygnięcia, NIE przez usuwanie danych

1. **`swot_proposals` vs kernel Teresy** (`tool_session_events`). Dwa niezależne mechanizmy propozycji. Legacy nie spełnia kontraktu Intent→Preview→Commit.
2. **`tool_initiative_links` vs `tool_outputs`**. Kanoniczny jest `tool_outputs`; links to projekcja. Zapisane w komentarzach kodu — utrzymać.
3. **`ensureToolsSeedOnce` vs migracje 559/562** (defekt L11). Naprawione mergem per-locale/per-pole, ale **dwa producenci treści Library nadal istnieją**.

---

## 6. MIGRACJE

Kolejność **udowodniona testem** `tests/unit/migrationRunnerOrdering.test.ts` (13/13):

```
946_tool_outputs_reports_lineage.sql        (faza 0)
947_tool_outputs_idempotency_guard.sql      (faza 0)
950_initiatives_priority_order_gap.sql      (faza 0)
951_report_builder_reports_source_refs_json_gap.sql (faza 0)
20260719_baseline_gap.sql                   (faza 1) ← KANONICZNY producent tool_initiative_links
948_tool_promotion_tenant_idempotency.sql   (faza 2, LATE_PHASE_MANIFEST)
```

- **Fresh bootstrap**: `NODE_ENV=test DB_TYPE=postgres DATABASE_URL=... npx tsx server/scripts/migrate.postgres.ts` → complete, 583 migracje. `NODE_ENV=test` jest **wymagane** (runner odrzuca localhost). **Nigdy `--safe`** — zamienia pad w „skipped + exit 0".
- **Obraz**: `pgvector/pgvector:pg15`. `postgres:15-alpine` **nie przechodzi** — `20260719_baseline_gap.sql` wymaga `CREATE EXTENSION vector`.
- **Migracje pomijane przez filtry**: `isSqliteOnlyMigration()` wyklucza wszystkie numerowane < 500, chyba że są w `PROMOTED_LEGACY_PRODUCERS`. Dotyczy `291_tools_initiatives.sql` (historyczny producent `tool_initiative_links`) i `247_initiative_enhancements.sql`.
- **Runner jest NIEREKURENCYJNY** — cokolwiek w `server/migrations/never-ran/` nigdy się nie uruchomi.
- **Na demo/staging/PROD nie uruchamiano niczego.**

---

## 7. FUNKCJE I DoD

| Wymaganie | Kod | Podłączone | Trwałe | Browser | Dowód | Status |
|---|---|---|---|---|---|---|
| Rejestr 31 narzędzi | TAK | TAK | TAK | — | żywa baza + testy | **PASS** |
| 19 Tool Packów | TAK | TAK | TAK | — | 367/367 | **PASS** |
| Kanoniczny `tool_outputs` | TAK | TAK | TAK | nie | 10/10 immutability | **PASS** |
| Idempotencja + wyścig | TAK | TAK | TAK | nie | 6/6, 12- i 25-krotna zbieżność | **PASS** |
| CAS (428/409) | TAK | TAK | TAK | nie | 27/27 + fail-closed | **PASS** |
| Izolacja tenanta | TAK | TAK | TAK | nie | cross-org 404 | **PASS** |
| Persistence Presentation | TAK | TAK | TAK | nie | 6/6 z reprodukcją | **PASS** |
| Idea bez fałszywego sukcesu | TAK | TAK | TAK | nie | 54/54 | **PASS** |
| Kanon statusów | TAK | TAK | — | nie | 83/83 | **PASS** |
| Live Artifact | TAK | TAK | — | częściowo | 14/14 + zrzuty | **PASS** |
| Kernel Teresy | TAK | **NIE** | TAK | nie | 11/11 | **PARTIAL** — brak trasy HTTP |
| Evidence UI + Accept gate | TAK | TAK | TAK | nie | 44/44 | **PARTIAL** — brak przeglądu wizualnego |
| **Slide Mode** | TAK | TAK | — | TAK | 64/64 + 22 PNG + 2 PDF | **PASS** |
| Voice | transcript | NIE | — | nie | ścieżka transcript | **PARTIAL** — `REAL_AUDIO_NOT_VERIFIED` |
| **Powłoka SPEC-A** | TAK | — | — | — | **niescalona** | **BLOCKED** |
| **MPQ 4 widoki** | — | — | — | — | 3/7 poniżej progu | **FAIL** |
| **Browser E2E Tools** | — | — | — | — | testowano Assessment | **NOT_VERIFIED** |
| **Zoom 200%** | — | — | — | — | mechanizm nieosiągalny | **NOT_VERIFIED** |
| **VoiceOver** | — | — | — | — | świadomie nieuruchomiony | **NOT_VERIFIED** |
| **Readiness 19 narzędzi** | TAK | TAK | — | — | 19 manifestów | **FAIL** — 0/19 publikowalnych |

**Podsumowanie:** PASS 12 · PARTIAL 3 · FAIL 3 · NOT_VERIFIED 3 · BLOCKED 1

---

## 8. TEST DISCOVERY I REGRESJA

**Bramka discovery** (`npm run test:discovery-gate`): **4239 odkrytych = 4239 w manifeście, 0 niesklasyfikowanych → PASS**. Wykonanych: 3947 (reszta to świadome wykluczenia: Playwright, wizualne, dług).

Klasyfikacja **przez realne A/B** na dwóch drzewach (kandydat + `fb6dfedd42`), własne bazy, `--retry=0`:

| Partia | introduced | fixed | identical_pre_existing | flaky |
|---|---|---|---|---|
| `src-and-server-src` (920 plików, ~13,5 tys. testów) | **0** | 0 | 279 | 0 |
| `hooks-store` | 0 | 0 | 12 | 0 |
| `tests/integration` (622 pliki) | 0 | 0 | ~710 | 4 |
| `backend-sec-perf` (bez memory-leak) | 0 | 0 | 3 | 0 |
| `component-singular` (631 plików) | 0 | 0 | 246 | 3 |
| **RAZEM domknięte** | **0** | **0** | **~1250** | **7** |

Siedem flaky zbadano indywidualnie — dla każdego `git diff` na pliku komponentu
i testu jest **pusty**, więc regresja jest fizycznie niemożliwa.

### PARTIAL / NOT_VERIFIED

| Partia | Powód | Komenda wznowienia |
|---|---|---|
| `tests/performance/memory-leak.test.ts` | domyślny przebieg **60 minut** przy nieustawionym `MEMORY_TEST_DURATION` | `MEMORY_TEST_DURATION=30000 npx vitest run tests/performance/memory-leak.test.ts --retry=0` |
| `unit-backend` | biegła w chwili raportu | `scripts/testing/run-regression-batches-h4.sh` (wznawialny) |
| `unit-rest` | w kolejce | j.w. |

**Żadnej partii nie oznaczono PASS bez pełnego przebiegu.**

---

## 9. BROWSER E2E

| Przebieg | Klasyfikacja | Uwaga |
|---|---|---|
| Assessment (DRD): Library → sesja → evidence → accept → complete → promote → **restart z nowym PID** → reopen | `TRUE_BROWSER_UI` + `BROWSER_PLUS_DIRECT_HTTP` | **to NIE jest moduł Tools** |
| SWOT: wpisy w 4 ćwiartkach, add/accept/reject, zmiana wpływu, autosave, reload | `TRUE_BROWSER_UI` | strumień F4, własny Playwright |
| Report / Presentation / Slide Mode | `HARNESS_ONLY` | dev-render, nie produkcyjne UI |
| Output list/reopen | `HARNESS_ONLY` | j.w. |
| Freeze → Output → Report → Presentation → Initiative w **module Tools** | **MISSING** | nigdy nie przejechane w przeglądarce |

**Dowody E2E z Assessment (`evidence/h5-e2e/`) NIE ISTNIEJĄ na dysku** — patrz §10.

---

## 10. MPQ, TRIADA, ACCESSIBILITY

Pomiar na SHA `773c72d371` (poprzedzającym kandydata), rubryka 6 kryteriów × 5:

| Widok | Wynik | Próg | Status |
|---|---|---|---|
| Library detail | 28/30 | 27 | PASS |
| Live Artifact | 28/30 | 27 | PASS |
| Initiative Proposal | 27/30 | 27 | PASS |
| Report | 28/30 | **29** | **FAIL** |
| **Session Workspace** | **21/30** | 27 | **FAIL** |
| **Output** | **24/30** | 27 | **FAIL** |
| **Presentation** | **24/30** | **29** | **FAIL** |

**TRIADA**: dług `check-triada` spadł 3292 → 3269, zero nowego długu. Wszystkie hooki przechodzą.

### MISSING_EVIDENCE — zweryfikowane przez `test -d` / `ls`

| Katalog | Zadeklarowano | **Fizycznie** |
|---|---|---|
| `evidence/h2-slide/` | zrzuty + PDF | ✅ **22 PNG + 2 PDF** |
| `evidence/g5-mpq/` | 70 zrzutów | ✅ **70 PNG** |
| **`evidence/h1-speca/`** | **37 zrzutów** | ❌ **KATALOG NIE ISTNIEJE** |
| **`evidence/h5-e2e/`** | transkrypty HTTP + SQL | ❌ **KATALOG NIE ISTNIEJE** |

**To jest wzorzec, nie pojedyncza pomyłka: dwa agenty zadeklarowały dowody,
których nie ma.** Ich ustalenia opisowe mogą być prawdziwe, ale **nie mają
pokrycia w artefaktach** i nie wolno ich zaliczać.

- **Zoom 200%**: `ZOOM_NOT_VERIFIED`. Wyczerpano mechanizmy (`resize_window` zmienia tylko viewport; akcja `zoom` jest read-only ze `scale<=1`; skróty klawiszowe nie zmieniły `devicePixelRatio`; `computer-use` daje przeglądarkom tier read-only). **CSS `zoom` świadomie NIE użyty jako dowód.**
- **VoiceOver**: `VOICEOVER_NOT_VERIFIED`. Most AppleScript był osiągalny, ale agent **świadomie go nie uruchomił** — to żywa maszyna właściciela, a VoiceOver włącza mowę i przemapowuje klawiaturę globalnie. Decyzja bezpieczeństwa, nie blokada techniczna. **Podtrzymuję ją.**

---

## 11. ARTEFAKTY I LINEAGE

Udowodnione na jednorazowym Postgresie:

```
tool_sessions.id
  → tool_sessions.version (source_revision)
    → tool_outputs (niezmienny snapshot, content_hash, supersedes_id)
      ├→ tool_reports + tool_report_sources   (Report i Presentation)
      ├→ tool_output_initiative_proposals     (source_conclusion_id)
      └→ tool_initiative_links                (projekcja dedup/lineage)
```

**Dowód wspólnego pochodzenia**: jedna rewizja sesji daje **dokładnie jeden**
snapshot; Report, Presentation i Initiative mają **identyczny `tool_output_id`**
w `tool_report_sources` i `tool_initiative_links` — potwierdzone SQL-em.
Późniejsza edycja sesji **nie zmienia** snapshotu (hash bajtowo identyczny).
Korekta tworzy **nową rewizję** (`supersedes`), nigdy mutację.

---

## 12. READINESS

| Kategoria | Status | Dowód |
|---|---|---|
| **Techniczna** | **PARTIAL** | 419/419 na kandydacie; regresja 0 introduced; discovery PASS |
| **Metodyczna** | **PARTIAL** | 19/19 Packów kompletnych; tylko `dynamic-swot` ma realny most silnik→Output |
| **Prawna** | **BLOCKED** | 31/31 `LEGAL_REVIEW_REQUIRED`; zero atrybucji w repo. Najwyższe ryzyko: `narrative-engine` (Minto/McKinsey wymienieni w `CONCLUSION_LAYER_STANDARD.md`), `portfolio-priority` (BCG = żywa konkurencja), `smed-planner` (Shingo) |
| **Runtime** | **FAIL** | **0/19** — każdemu brakuje `manualAcceptancePassed` i obu ocen MPQ |
| **Publikacja klientowi** | **FAIL** | 4 widoki poniżej progu MPQ; brak powłoki SPEC-A |

**Żadnej flagi nie podniesiono. `RUNTIME_ACTIVE = 0` dla wszystkich 31 narzędzi.**

---

## 13. ZNANE DEFEKTY

### P0

| # | Defekt | Plik / funkcja | Reprodukcja | Ryzyko |
|---|---|---|---|---|
| 1 | Powłoka SPEC-A niescalona; konflikt z Slide Mode | `ToolOutputsPanel.tsx`, `dev-render/screens/tools-swot-report.tsx` | `git merge codex/h-h1-speca` → 2 konflikty | 4 widoki zostają poniżej MPQ |
| 2 | Brak trwałych dowodów MPQ | `evidence/h1-speca/`, `evidence/h5-e2e/` | `ls` → brak | **0/19 narzędzi nie może dostać RUNTIME_ACTIVE** |
| 3 | Brak browser E2E dla **Tools** | — | jedyny przebieg dotyczył Assessment | DoD nie do domknięcia |

### P1

| # | Defekt | Plik | Uwaga |
|---|---|---|---|
| 4 | `ensurePublishedDefinition()` używa SQLite `INSERT OR IGNORE` → **na Postgresie nigdy się nie powiedzie** | Assessment | zgłoszone przez H5, **dowody nie istnieją — wymaga potwierdzenia** |
| 5 | Promocja nieidempotentna na poziomie śladu audytowego (`promotionTraces`) | `ToolController.ts` | materializacja downstream JEST idempotentna |
| 6 | `CONSULTING_TOOL_STANDARD_OUTPUTS = ['initiative']` zawęża CTA | `src/config/consultingToolsStandard.ts:35` | backend obsługuje 4 typy |
| 7 | Kernel Teresy bez trasy HTTP | `server/src/services/teresa/**` | dowiedziony na poziomie serwisu |
| 8 | `swot_proposals` = drugi, legacy mechanizm propozycji | `20260802_swot_proposals.sql` | brak `previewId`, brak wygaśnięcia |

### P2

| # | Defekt | Plik |
|---|---|---|
| 9 | `respondDeduplicated` — gałąź `presentation` ma to samo okno wyścigu, które naprawiono dla `idea` | `ToolController.ts` |
| 10 | `247_initiative_enhancements.sql` nie wykonuje się przy świeżym bootstrapie | runner |
| 11 | `test-inventory.json` niezacommitowany na kandydacie | `git status` |
| 12 | `check-gestosc.sh` — doradcze ostrzeżenie „9 akcji" na `ToolWorkspace.tsx` | heurystyka |

---

## 14. NASTĘPNE KROKI DLA CODEX

1. **Checkout**: `git checkout 11ea86bbf350ef4cfa40fc5c441219aa31512611`. Zacommituj albo odrzuć `test-inventory.json`.
2. **Scal `codex/h-h1-speca` (`1f04000c1d`) — RĘCZNIE.** Dwa konflikty semantyczne:
   - `src/components/DiscoveryTools/report/ToolOutputsPanel.tsx` — H2 wpiął tam `SlideDeckView`, H1 dodał `onOpenReport`. **Obie funkcje są potrzebne**: H1 otwiera dokument w powłoce, H2 renderuje go jako slajdy. Docelowo: `onOpenReport` przełącza na powłokę, a wewnątrz niej Presentation domyślnie w Slide Mode.
   - `dev-render/screens/tools-swot-report.tsx` — H2 dodał `mode=slides&chrome=`, H1 dodał `I18nextProvider`. **Zachowaj oba.**
3. **Po scaleniu uruchom**: `npx vitest run src/toolPacks src/toolOutputs src/components/DiscoveryTools --no-coverage` — musi zostać ≥ 419 zielonych i **0 padów**.
4. **Wygeneruj i FIZYCZNIE ZWERYFIKUJ** zrzuty MPQ (`ls` po każdym). Bez nich readiness nie ruszy.
5. **Niezależna ocena MPQ** — oceniający **nie może być autorem** zmian.
6. **Browser E2E na Dynamic SWOT w module Tools** (nie Assessment):
   ```
   # API — Z KORZENIA repo, nie z cd server (alias @/* rozwiąże się względem cwd)
   PORT=<wolny> DB_TYPE=postgres MOCK_DB=false ENABLE_TEST_GATEWAY=true \
     ENABLE_V8_GLOBAL=true ENABLE_TEST_SUPPORT=true TEST_SUPPORT_KEY=<secret> \
     npx tsx server/src/index.ts
   until curl -sf http://127.0.0.1:<PORT>/api/ready; do sleep 3; done
   ```
7. **Wznów partie regresji**: `scripts/testing/run-regression-batches-h4.sh`; memory-leak z `MEMORY_TEST_DURATION=30000`.
8. **Osobno**: `fix/dev-render-dangling-import-20260813` (`8b379a0eb9`) — naprawa harnessu + strażnik. Zweryfikuj kontrolę negatywną przed scaleniem.

### Pierwsza prawdziwa bramka runtime

Podniesienie **jednego** narzędzia (`dynamic-swot`) do `RUNTIME_ACTIVE` wymaga w jego manifeście:
`manualAcceptancePassed=PASS` + `lightMpq>=29` + `darkMpq>=29` + niepustych `evidenceLedgerRefs` + `verifiedAgainstSha` **równego** SHA kandydata. Walidator to egzekwuje — nie da się obejść.

---

## 15. ZAKAZY I STAN KOŃCOWY

| Zakaz | Potwierdzenie |
|---|---|
| Merge do `demo`/`main` | ✅ nie wykonano |
| Push | ✅ `git branch -r --contains HEAD` = **0** |
| Deploy | ✅ nie wykonano |
| Operacje na PROD | ✅ **PROD nietknięty**; `.env.local` (centerbeam) nigdy nie użyty |
| `reset` / `clean` / `stash` na cudzej pracy | ✅ nie wykonano |
| Usunięcie worktree | ✅ **żadnego nie usunięto** |
| Podniesienie `RUNTIME_ACTIVE` | ✅ **0/31**, żadnej flagi nie zmieniono |
| Przepisanie wspólnej historii | ✅ nie wykonano |

Migracje uruchamiano **wyłącznie** na jednorazowych kontenerach Docker.
Baza demo (`trolley`) czytana **tylko** zapytaniami `SELECT` przy Gate T0.

---

## Pliki maszynowe

`HANDOFF_TOOLS_BRANCHES.tsv` · `HANDOFF_TOOLS_FILES.tsv` · `HANDOFF_TOOLS_TESTS.tsv` · `HANDOFF_TOOLS_EVIDENCE.tsv`
