# M17 — Outputs (Outputs Library) — FAZA 2: Testy

Agent: TESTY · Data: 2026-06-11 · Branch: `feat/deliverables-light`
Moduł: `ReportsAndPresentationsHub` na rejestrze `GET /api/artifacts` (za `ENABLE_V8_GLOBAL` + `v8OutputsGate` = `createV8ModuleGate('outputs')`).
Evidence log: `Harvard/modules/M17-outputs/evidence/f2_tests.log`

---

## 1. INWENTARZ testów (M17-core)

### FE — komponenty / hooki / utils (vitest, jsdom)

| Plik | Czego dotyczy | # testów |
|---|---|---|
| `tests/components/ReportsAndPresentations/ReportsAndPresentationsHub.test.tsx` | routing zakładek, deep-link `artifactId`/`deck`, taksonomia Outputs Library, aliasy legacy `reports`/`documents` | 7 |
| `tests/components/ReportsAndPresentations/ReportsAndPresentationsHub.canonicalDataPath.test.tsx` | **real hooks** + aggregate table renderuje tytuły z `GET /api/artifacts?view=mine` (jedyny test z prawdziwą ścieżką danych) | 1 |
| `tests/components/ReportsAndPresentations/useRapData.canonicalArtifacts.test.tsx` | normalizacja rejestru, `useArtifactOutputsList(all/mine/review)`, `useReports/usePresentations/useSheetOutputs/useMyWorkArtifactOutputs`, action-target authority, fail-closed (404/501), **bramka eksportu `isExportApproved`** | 22 |
| `tests/components/ReportsAndPresentations/ArtifactTrustPreview.test.tsx` | sygnały trust (execution+review) w preview reportu/prezentacji | 2 |
| `tests/components/ReportsAndPresentations/OutputsAggregateTabContent.deeplink.test.tsx` | wybór wiersza mixed-kind z `initialArtifactId` | 1 |
| `tests/components/ReportsAndPresentations/ReportsTabContent.deeplink.test.tsx` | deep-link w zakładce reports | 2 |
| `tests/components/ReportsAndPresentations/PresentationsTabContent.deeplink.test.tsx` | deep-link w zakładce presentations | 3 |
| `tests/components/ReportsAndPresentations/SheetsTabContent.deeplink.test.tsx` | deep-link w zakładce sheets | 3 |
| `tests/components/ReportsAndPresentations/TemplatesTabContent.deeplink.test.tsx` | deep-link w zakładce templates | 2 |
| `tests/unit/components/ReportsAndPresentations/outputsLibraryTabQuery.test.ts` | mapowanie query↔tab (most My Work ↔ RAP) | 5 |
| `tests/unit/components/ReportsAndPresentations/artifactNavigation.test.ts` | `resolveArtifactOpenPath` per typ (doc/pres/sheet) | 6 |
| `tests/unit/hooks/useArtifactOutputsList.test.tsx` | ładowanie kanonicznych outputów z `/api/artifacts`, brak legacy-fallback przy błędzie | 3 |
| `tests/unit/hooks/useTemplates.canonicalArtifacts.test.tsx` | szablony z `/api/artifacts?artifactFamily=template` | (w grupie 1) |
| `tests/unit/reports/duplicateArtifactToDraft.test.ts` | duplikacja artefaktu do draftu | (w grupie 1) |
| `tests/unit/utils/artifactLinks.test.ts` | budowa linków do artefaktów | (w grupie 1) |

### BE — usługi / route / middleware (vitest, node)

| Plik | Czego dotyczy | # testów |
|---|---|---|
| `server/src/services/v8/artifactRegistryService.ts` ← `tests/integration/services/artifactRegistryService.sqlite.integration.test.ts` | persystencja rejestru, visibility scope (private/project/org), mine/review lanes, materialize report/pres/sheet, retry, **fail-closed materialize przed approve** | 20 |
| `tests/integration/routes/artifacts.routes.test.ts` | HTTP-kontrakt `/api/artifacts` (action-target, view=mine/review, trust-state, deprecate, access-grant, template review/publish rollback) — **serwis mockowany, gate mockowany ON** | 15 |
| `server/src/services/__tests__/artifactRegistryService.visibilityScope.test.ts` | `deriveArtifactVisibilityScope` | 3 |
| `tests/unit/backend/services/artifactRegistryService.test.ts` | mapowanie statusów → shared-delivery, schematy register/plan, lifecycle states | 9 |
| `server/src/services/v8/__tests__/publishReviewService.test.ts` | **stany publish (private_draft→…→published/recalled/archived), bramki review (peer/manager/compliance), izolacja org** | 103 |
| `server/src/services/v8/__tests__/reportsOutputRuntime.test.ts` | `getArtifactsByOrg/Template`, clone, quality scores, scheduleExport/recordExport | 49 |
| `server/src/services/v8/__tests__/reportsPresModelService.test.ts` | model danych reports&presentations | 103 |
| `tests/integration/routes/artifact-runs.approve-vs-review-boundary.sqlite.integration.test.ts` | **P17: approve(run) ≠ review(artifact)** — granica governance | 6 |
| `tests/unit/backend/routes/artifacts.draftPath.test.ts` | `POST /api/artifacts/runs/from-chat` (Teresa → Outputs draft), 401 bez auth | 3 |
| `tests/unit/backend/middleware/v8FeatureGate.middleware.test.ts` | **bramka flagi `ENABLE_V8_GLOBAL` + v8OrgGate + moduleGate** (cały moduł za tym) | 26 |

### E2E (Playwright smoke)

| Plik | Czego dotyczy | # testów |
|---|---|---|
| `tests/e2e/smoke/outputs-library-canonical-artifacts.spec.ts` | Mine tab pokazuje wiersze z `GET /api/artifacts?view=mine` | 1 |
| `tests/e2e/presentations-artifact-engine-smoke.spec.ts` | silnik artefaktów prezentacji (powiązane) | 1 |

### Powiązane (nie liczone do M17-core, dotykają outputów z innych modułów)
`tests/components/MyWork/HomeView.outputs.test.tsx` (4), `NotebookContextPanel.outputs.test.tsx` (3), `ConvertToOutputMenu.notebook-readback.test.tsx` — surfacing outputów w My Work.

---

## 2. URUCHOMIENIE (własne wyniki)

| Grupa | PASS | FAIL | SKIP | Pliki | Czas |
|---|---|---|---|---|---|
| FE 1 — RAP component+unit+hooks | **68** | **1** | 0 | 15 | ~9.8s |
| BE 2 — registry+publish+runtime+gate | **227** | **25** | 0 | 7 | ~3.9s |
| BE 3 — integration routes+sqlite | **35** | **4** | 0 | 3 | ~3.0s |
| **RAZEM (M17-core uruchomione)** | **330** | **30** | **0** | 25 | ~16.7s |

> `artifacts.routes.test.ts` uruchomiony solo: 15/15 PASS.

### Root-cause awarii

**A) FE: `ReportsAndPresentationsHub.canonicalDataPath.test.tsx` (1 FAIL)** — **mock-drift react-i18next** (znany wzorzec).
Mock w teście: `t: (_key, fallback?: string) => fallback || _key`. Komponent woła `t(key, { defaultValue: '...' })`, więc `fallback` = **obiekt** `{defaultValue}`, który trafia jako dziecko Reacta → `Objects are not valid as a React child (found: object with keys {defaultValue})`. Bliźniaczy `ReportsAndPresentationsHub.test.tsx` ma ten sam naiwny mock, ale **stubuje wszystkie *TabContent**, więc wadliwe wywołanie `t({defaultValue})` w dziecku nie wykonuje się — dlatego przechodzi. `canonicalDataPath` używa real hooks + aggregate table i odsłania bug. **To defekt harnessu testu, nie produktu.** Fix: mock z `vi.importActual` + `t` zwracające `opts?.defaultValue ?? key` (jak w siostrzanym pliku).

**B) BE: `v8FeatureGate.middleware.test.ts` (25/26 FAIL)** — **stale tests vs cofnięta hardened-impl** (wariant „stale import/zachowanie po refaktorze").
Aktualny `server/src/middleware/v8FeatureGate.middleware.ts` to wersja prosta (5 ścieżek, bez defensywy). Testy napisano pod **utwardzoną** wersję, która miała: walidację `organizationId` (max length, control chars, placeholder), guardy `headersSent`, bezpieczne writery łapiące błąd i logujące `[v8:featureGate] V8 gate response invalid`, forward `next(error)`. Impl **nie zawiera żadnego z tych stringów** (`grep` = 0). Hardening został cofnięty (`9b794bb7f0 fix(v8): restore explicit production rollout control`), testy zostały. Błędy typu `TypeError: res.status is not a function` to testy podające celowo zepsute `res`, oczekując, że impl je „połknie" — czego cofnięta wersja nie robi. **Nie blokuje produktu** (działa prosta ścieżka 404/400/next), ale 25 testów to martwy kontrakt do skasowania albo impl do ponownego utwardzenia.

**C) BE: sqlite integration (4 FAIL)** — **luka fixture'a `tp_tables`** (wariant schema/seed-drift w harnessie sqlite).
Failujące: `materializeArtifactRun ... when config.tableId is provided` (1) + 3 z boundary (`materialize ...`, `startArtifactReview only works ...`, `records audit trail ...`). Wszystkie podają syntetyczne `config.tableId` (`tbl-boundary-1/4`), których **nigdy nie zaseedowano w `tp_tables`**, a fallback auto-create też pada → serwis **poprawnie fail-closed z 409** `ARTIFACT_MATERIALIZE_FAILED` (`requires config.tableId ... auto-create also failed`). To **gap setupu testowego**, nie regresja runtime'u — produkt zachowuje się poprawnie (nie materializuje sheeta bez realnej tabeli).

---

## 3. MAPA POKRYCIA SCENARIUSZY S1–S7

| # | Scenariusz | FE | BE | E2E | W PR-gate? |
|---|---|---|---|---|---|
| **S1** | Lista artefaktów z rejestru (za flagą) | ✅ `useRapData.canonicalArtifacts`, `useArtifactOutputsList`, `canonicalDataPath`(FAIL) | ✅ `artifacts.routes` (list+action), `artifactRegistryService.sqlite` | ✅ `outputs-library-canonical-artifacts` | ❌ |
| **S2** | Filtry + liczniki per tab | 🟡 query↔tab mapping (`outputsLibraryTabQuery`), `view=mine/review` param | 🟡 `passes mine/needs-review queue filter`, `outputType` filter | ❌ | ❌ |
| **S3** | **Bramka eksportu za aprobatą** (`isExportApproved`) | ✅ blokada klienta dla `draft`/`in_review`, proceed dla `approved`/brak-governance | ⚠️ **TYLKO quality-gate** (`enforceQualityGatesForExport`/`checkQualityGates`) — **brak testu, że serwer odrzuca eksport po `publishState`** | ❌ | ❌ |
| **S4** | Review / publish flow | 🟡 trust preview (review signals) | ✅ `publishReviewService` (103), `artifacts.routes` start-review/publish rollback, P17 boundary | ❌ | ❌ |
| **S5** | Trust-state 5 filarów | 🟡 `ArtifactTrustPreview` (execution+review), `TrustStatePreviewSection` (5 pillars w źródle) | ✅ `artifacts.routes` trust-state payload (execution/review separation), 409 review-przed-execution | ❌ | ❌ |
| **S6** | Akcje wierszowe (open/export/archive) | ✅ `useRapData` open/export/archive(delete) przez action-target authority | 🟡 action-target metadata (`artifacts.routes`) | ❌ | ❌ |
| **S7** | **Public share viewer** | ❌ **brak** dla artefaktów RAP | ⚠️ `public-artifacts.routes.ts` = share **work-canvas drafts** (inny moduł), NIE reports/presentations; `document-studio-share-links` (28) = doc studio | ❌ | ❌ |

Legenda: ✅ solidne · 🟡 częściowe · ⚠️ pozornie pokryte ale luka · ❌ brak.

### Rzeczywistość PR-gate (krytyczne)
`test-suite.yml` triggeruje **wyłącznie** `push`/`pull_request` na `[main, develop]`. **Default branch = Londyn**, praca na `feat/deliverables-light`. PR `feat/* → Londyn` **NIE odpala test-suite** (target ≠ main/develop). Nawet gdyby — joby coverage/L1-L5 są pod `if: ref_name == main/develop` → „Deferred outside main/develop". Pozostałe workflow: `module-contract-rerun` (schedule/tag/manual), `domain-closure-smoke` (manual), `security-scan` (schedule/manual), `i18n-check` (PR tylko gdy zmiana w `public/locales/en/**` lub `scripts/i18n/**`). **Wniosek: ŻADEN test vitest/integration M17 nie gate'uje PR do Londyn.** Cała egzekucja = lokalna/manualna lub tylko main/develop. Kolumna „W PR-gate?" = ❌ dla wszystkich S1–S7.

---

## 4. PUŁAPKI

1. **Cały moduł za flagą ON — nikt nie testuje OFF.** Wszystkie 15 testów `artifacts.routes.test.ts` mockują `v8OutputsGate → next()` (gate wymuszony ON). **Brak testu, że `GET /api/artifacts` zwraca 404/`V8_DISABLED` gdy `ENABLE_V8_GLOBAL≠true`** dla tej trasy. Ścieżka OFF jest pokryta tylko abstrakcyjnie w `v8FeatureGate.middleware.test.ts` — który **failuje 25/26**. Tj. faktycznie OFF→pustka/404 dla M17 jest *nietestowana zielono*.

2. **Testy walidacji-nie-zachowania (mock serwisu).** `artifacts.routes.test.ts` mockuje cały `artifactRegistryService` — weryfikuje kontrakt HTTP/kształt payloadu, **nie** rzeczywiste zachowanie rejestru (to robi dopiero `*.sqlite.integration`, gdzie 4 failują z powodu fixture'a). Trust-state/action-target są asercją na zmockowanym zwrocie, nie na realnej derywacji.

3. **S3 — pozorny serwerowy backstop.** Komentarz w teście „server gate is the backstop" + obecność `enforceQualityGatesForExport` sugerują ochronę serwerową. Ale to **quality-gate, nie approval-gate**: serwer nie re-sprawdza `publishState ∈ {approved,published}`. Bramka aprobaty eksportu jest **klient-only**. To ścieżka bezpieczeństwa bez testu serwerowego.

4. **S7 — mylna nazwa „public-artifacts".** `public-artifacts.routes.ts` udostępnia **work-canvas drafts** (token 32-hex, TTL 7 dni), nie outputy RAP. Dla reports/presentations z M17 **nie istnieje** publiczny viewer ani test → S7 dla M17 = brak ścieżki i brak testu.

5. **Fabrykowane DEMO_* — czysto.** `DEMO_REPORTS`/`DEMO_PRESENTATIONS` w `useRapData.ts` są **zakomentowane** i jawnie nigdy nie wstrzykiwane; testy `useReports/usePresentations` wprost asertują „returns empty list (never demo rows)" przy 404/501. Pułapka demo-fixtures **nie występuje** w warstwie testowej M17.

---

## 5. BACKLOG TESTOWY

| # | Typ | Plik docelowy | Scenariusz | Priorytet |
|---|---|---|---|---|
| T1 | **fix harness** | `tests/components/ReportsAndPresentations/ReportsAndPresentationsHub.canonicalDataPath.test.tsx` | Napraw mock react-i18next (`importActual` + `t` honoruje `defaultValue`) → odblokuj jedyny test real-data-path | **P0** |
| T2 | **decyzja+fix** | `tests/unit/backend/middleware/v8FeatureGate.middleware.test.ts` | Albo skasuj 25 testów martwego kontraktu, albo przywróć utwardzony middleware (org-id walidacja, headersSent guard, safe writers) | **P0** |
| T3 | **fix fixture** | `*.sqlite.integration.test.ts` (registry + boundary) | Zaseeduj realne `tp_tables` rows dla `config.tableId` zanim materialize sheet → 4 zielone zamiast 409 | **P1** |
| T4 | **integration BE (SECURITY)** | `tests/integration/routes/report-builder.export-gate.test.ts` (nowy) | **S3 backstop:** serwer MUSI odrzucić `GET /:id/export/pdf|docx|pptx` dla artefaktu `draft`/`in_review` (nie tylko quality-gate) → 403/409. Dziś bramka aprobaty = klient-only | **P0 (bezpieczeństwo)** |
| T5 | **integration BE (SECURITY)** | `tests/integration/routes/artifacts.gate-off.test.ts` (nowy) | **OFF-path:** `GET /api/artifacts` z `ENABLE_V8_GLOBAL` OFF → 404/`V8_DISABLED`; cross-org IDOR na `view=mine` | **P1** |
| T6 | **E2E/integration (SECURITY)** | — | **S7:** jeśli RAP ma mieć public share — brak trasy i testu; jeśli nie ma — udokumentować jako „brak ścieżki" (dziś `public-artifacts` to work-canvas, nie outputy). Decyzja produktowa przed testem | **P2** |
| T7 | **FE component** | `tests/components/ReportsAndPresentations/OutputsTabContent.counters.test.tsx` (nowy) | **S2:** liczniki per tab (mine/review/all) — obecnie tylko mapping query↔tab, zero asercji na badge/count | **P2** |
| T8 | **E2E** | rozszerzyć `outputs-library-canonical-artifacts.spec.ts` | S3 (próba eksportu draftu blokowana w UI), S4 (review→publish), S6 (archive) — dziś E2E = 1 test (tylko S1 mine-tab) | **P2** |

### Ścieżki bezpieczeństwa (podsumowanie)
- **S3 bramka eksportu:** klient blokuje (✅ test FE), **serwer NIE re-waliduje publishState** (tylko quality) — **brak testu serwerowego = realna luka** → T4.
- **S7 public share:** dla M17 **nie istnieje** (mylna nazwa `public-artifacts` = work-canvas) → T6 (najpierw decyzja produktowa).
