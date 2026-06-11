# M18 — Dokumenty (Document Studio) · FAZA 2 — Raport testów

Data: 2026-06-11 · Branch: `feat/deliverables-light` · Agent: TESTY
Log surowy: `Harvard/modules/M18-dokumenty/evidence/f2_tests.log`

---

## 0. Podsumowanie liczbowe

| Grupa | Pliki | Testy | Wynik | Czas |
|---|---|---|---|---|
| A — serwis `documentStudio/__tests__` | 74 | 855 | **PASS** | ~2.1 s |
| B — routes (share-links, assets) + template-architect | 3 | 25 | **PASS** | ~1.3 s |
| C — FE panel + root be/integration (org-guard, policy-order, export-trace) | 4 | 9 | **PASS** | ~1.7 s |
| D — E2E smoke (`document-studio-word-flow`) | 1 | 1 | **SKIP (env)** | — |
| **RAZEM uruchomione** | **81** | **889 PASS / 0 FAIL** | ✅ | — |

Brak FAIL. Brak skipów logicznych w kodzie testów (jedyny SKIP to E2E ze względu na brak żywego stacka — patrz §5). **Zero root-cause do naprawy.** Żaden ze znanych wzorców awarii z M17 (mock-drift i18n `t(key,{defaultValue})`, stale-importy po przeniesieniu routes, brak `<Router>`, schema-drift PG, rola „iris", 25 stale middleware) nie wystąpił w M18 — suite jest spójny z aktualną implementacją.

---

## 1. Inwentarz testów (żywe pliki, bez backupów/worktree/quarantine)

### A. Serwis — `server/src/services/documentStudio/__tests__/` (74 pliki / 855 testów)
Najważniejsze dla scenariuszy:
- `documentStudioEditorStatePersistence.test.ts` (7) — **S4** write-through DAO + cold-start hydration (DAO **mockowany** — patrz §4).
- `documentStudioRollback.test.ts` (10) — **S7** rollback + revert-snapshot + error-vocabulary (tenant/404).
- `documentVersionSnapshotService.test.ts` (10), `documentStudioSnapshotIntegration.test.ts` (6) — **S7** wersje/snapshoty.
- `documentStudioExportQaGate.test.ts` (10) — **S6** bramka QA na poziomie serwisu (`QaBlockingError`, `qaOverride`, deny-by-default, audyt). Patrz §4.
- `documentStudioMode3.test.ts` (4) — **S3** generacja z zatwierdzonego szablonu + odrzucenie draftu + cross-tenant.
- `documentTemplateService.test.ts` (7), `documentTemplateRegistryPersistence.test.ts` (8), `documentTemplateRefiner.test.ts` (7) — **S2** plan(draft)→approve→deprecate + guard re-approval + izolacja tenant.
- `documentApprovalService.test.ts` (33) — **S5** kworum approve/reject (unanimous/majority/single), precedencja reject/changes_requested, hydracja cold-start.
- `documentEditorRefiner.test.ts` (11), `documentEditorRefinerScopes.test.ts` (15), `documentEditorProposalSpecFields.test.ts` (23), `documentStudioEditor*Scope*.test.ts` — **S5** edytor proposalowy: scope'y `micro/section/document/methodology/source/transformative` (to są „poziomy") + guard zachowania źródeł.
- `documentShareLinkService.test.ts` (36), `documentShareLinkRegistryDao.test.ts` (2) — **S8** linki współdzielenia (serwis + DAO).
- `documentStudioService.test.ts` (8), `documentStudioPreflight.test.ts` (6), `documentSourcePackService.test.ts` (14), `documentSourcePackConnectors.test.ts` (19) — **S1** intake→outline + źródła.
- pozostałe: QA (executive/data/risk/format/completeness/source-drift/brand-voice…), renderery DOCX/PDF, komentarze, audience, brand-voice, asset-registry — bogate pokrycie domenowe.

### B. Routes — `server/src/routes/__tests__/` (3 pliki / 25)
- `document-studio-share-links.routes.test.ts` (20) — **S8** REST: list/get/revoke/audit + **publiczny `POST /share-links/resolve` (unauthenticated)**, 404/409/410 dla revoked/expired/cross-tenant.
- `document-studio-assets.routes.test.ts` (3) — upload/registry assetów.
- `server/src/services/__tests__/presentationTemplateArchitectService.test.ts` (2) — architekt szablonów (współdzielony z prezentacjami; styczny do **S2**).

### C. FE + root be/integration (4 pliki / 9)
- `src/components/DocumentStudio/__tests__/DocumentStudioDocumentPanel.test.tsx` (5) — **jedyny FE** test panelu dokumentu.
- `tests/unit/backend/routes/document-studio.routes.org-guard.test.ts` (1) — 403 RBAC gdy brak organizacji (uderza w realny router via supertest).
- `tests/unit/backend/routes/document-studio.policy-route-order.test.ts` (1) — kolejność montowania routerów (publiczny przed authed).
- `tests/integration/routes/document-studio.export-trace.routes.test.ts` (2) — trace eksportu 200/5xx (serwis eksportu **mockowany**).

### D. E2E — `tests/e2e/smoke/document-studio-word-flow.spec.ts` (1)
- **S1+eksport** Mode1 happy-path przez API (intake→outline→document→export DOCX). Wymaga żywego API.

---

## 2. Uruchomienie — wyniki (własne, nie cytowane)

Komendy (z `server/` dla A/B; z root dla C — root `vitest.config.ts`):
```
# A
(server) npx vitest run src/services/documentStudio/__tests__
# B
(server) npx vitest run src/routes/__tests__/document-studio-share-links.routes.test.ts \
  src/routes/__tests__/document-studio-assets.routes.test.ts \
  src/services/__tests__/presentationTemplateArchitectService.test.ts
# C
(root) npx vitest run src/components/DocumentStudio/__tests__/DocumentStudioDocumentPanel.test.tsx \
  tests/unit/backend/routes/document-studio.routes.org-guard.test.ts \
  tests/unit/backend/routes/document-studio.policy-route-order.test.ts \
  tests/integration/routes/document-studio.export-trace.routes.test.ts
```
- A: **74 files / 855 tests PASS** (2.11 s)
- B: **3 files / 25 tests PASS** (1.35 s)
- C: **4 files / 9 tests PASS** (1.72 s)
- D: **NIE URUCHOMIONO** — wymaga żywego API `127.0.0.1:3001` + `E2E_OWNER_*` / `testSupportState` token.

---

## 3. Mapa pokrycia scenariuszy S1–S8

| Scen. | Opis | FE | BE (unit/serwis) | BE (route/integration) | E2E | Gate na PR? |
|---|---|:--:|:--:|:--:|:--:|:--:|
| **S1** | Mode1 intake→outline→document | częśc. (panel) | ✅ silne (service/preflight/sourcePack) | — | ✅ (env-skip) | ❌ |
| **S2** | Mode2 template architect (plan/approve/deprecate) | ❌ | ✅ silne (templateService/registry/refiner) | częśc. (architect svc) | ❌ | ❌ |
| **S3** | Mode3 generacja z szablonu (walidacja źródeł) | ❌ | ✅ (Mode3: draft-reject, cross-tenant) | — | ❌ | ❌ |
| **S4** | Persistencja write-through DAO (resume po reload) | ❌ | ⚠️ **tylko z mockiem DAO** | — | ❌ | ❌ |
| **S5** | Edytor proposalowy approve/reject (poziomy/scope) | ❌ | ✅ silne (approval kworum + refiner scopes) | — | ❌ | ❌ |
| **S6** | Bramka eksportu QA 403 + qaOverride | ❌ | ✅ serwis (`QaBlockingError`) | ⚠️ **brak asercji route 403** | ❌ | ❌ |
| **S7** | Wersje / rollback | ❌ | ✅ silne (rollback + snapshot) | — | ❌ | ❌ |
| **S8** | Share-linki publiczny konsument | ❌ | ✅ (shareLink service+DAO) | ✅ route (resolve unauth, revoke/expired) | ❌ | ❌ |

### Co REALNIE gate'uje PR na `feat/deliverables-light`?
**Praktycznie nic z testów M18.** Analiza `.github/workflows/`:
- `test-suite.yml` (vitest+playwright PR-gate) odpala się **tylko** na push/PR do `main` lub `develop`. Default branch = **Londyn**, a PR z `feat/*` celuje w Londyn → workflow **nie wystartuje**. Dodatkowo joby coverage są jawnie „Deferred" poza main/develop (`if: github.ref_name == 'main'/'develop'`).
- `i18n-check.yml` — jedyny z `pull_request`, ale tylko gdy zmienione `public/locales/en/**` lub `scripts/i18n/**` (paths-filter). Dla zwykłego PR M18 nie odpali.
- `module-contract-rerun.yml` — schedule (poniedziałki) + tagi `v*`/`release-*` + manual. Nie na PR.
- `e2e-nightly.yml` / `e2e-weekly.yml` — cron + manual. Tu „mieszka" smoke S1, ale poza PR.
- `railway-deploy.yml` — push do `develop`. `security-scan.yml`, `domain-closure-smoke.yml` — cron/manual.

**Wniosek:** identycznie jak w M17 — suite M18 jest zielony lokalnie, ale **żaden test M18 nie blokuje merge'a PR z feat/* do Londyn**. Bramka jakości to wyłącznie ręczne `npx vitest run` lub przepięcie default-brancha / dodanie `pull_request: [Londyn]` do `test-suite.yml`.

---

## 4. Pułapki (mock-vs-zachowanie)

1. **S4 — persistencja to test mocka, NIE realnego write-through.**
   `documentStudioEditorStatePersistence.test.ts` robi `vi.mock('../documentEditorStateRegistryDao.js')`. Test weryfikuje, że serwis **wywołuje** `persistProposal`/`persistAuditEntry` i że cold-start hydruje z **mocka** zwracającego wiersz. **Nie dotyka realnego Postgresa** — nie udowadnia, że SQL DAO faktycznie zapisuje/odczytuje (schema, kolumny, JSON-serializacja, idempotencja). To kluczowe, bo S4 to właśnie naprawa „znikania po reload" względem 06-02. **Brak jakiegokolwiek testu uderzającego w realny `documentEditorStateRegistryDao` z bazą** (grep: 0 plików testowych importuje DAO bezpośrednio z PG).

2. **S6 — bramka eksportu testowana na poziomie serwisu, nie HTTP.**
   `documentStudioExportQaGate.test.ts` sprawdza, że `exportDocument(...)` **rzuca** `QaBlockingError` / `QaOverrideUnauthorizedError` (deny-by-default dla braku roli). To dobra walidacja logiki. Ale **route'owy `res.status(403)`** (`document-studio.routes.ts:3386` `qa_override_unauthorized`, `:3394` `qa_blocking`) **nie jest asertowany przez żaden test** (grep `qa_blocking|qa_override_unauthorized` w `tests/` i `routes/__tests__/` = 0). Integracyjny `export-trace.routes.test.ts` **mockuje `exportDocumentArtifact`** (resolve `{ok:true}` / reject `Error('boom')`) — więc realna ścieżka gate→403 nigdy nie jest wykonywana przez HTTP. Pokrycie bezpieczeństwa eksportu jest serwerowe-logiczne, ale nie end-to-end-HTTP.

3. **Integracja export-trace = walidacja trace, nie eksportu.** Mock serwisu sprawia, że test mówi tylko „przy 200 zapisuję trace completed, przy throw — failed". Nie waliduje renderowania DOCX/PDF ani gate.

4. Większość testów serwisowych (np. share-links route) używa **in-memory fake registry/DAO** zamiast PG — typowy dla tego repo. Akceptowalne dla logiki, ale ślepe na schema-drift PG (znany wzorzec z M17/staging).

---

## 5. Backlog testowy

| # | Typ | Plik (proponowany / istniejący) | Scenariusz | Priorytet |
|---|---|---|---|---|
| B1 | Integration (PG real) | nowy: `documentEditorStateRegistryDao.integration.test.ts` | **S4** — realny write-through + cold-start z prawdziwej bazy (resume po reload). Domknięcie luki mock-only. | **P0** |
| B2 | Route/HTTP | rozszerzyć `tests/integration/routes/document-studio.export-trace.routes.test.ts` lub nowy `…export-qa-gate.routes.test.ts` | **S6** — asercja realnego **403 `qa_blocking`** i **403 `qa_override_unauthorized`** przez supertest (bez mockowania `exportDocumentArtifact`). Bezpieczeństwo eksportu. | **P0** |
| B3 | E2E (CI) | `tests/e2e/smoke/document-studio-word-flow.spec.ts` (istnieje) | **S1+export** — zapewnić uruchamianie (env/creds) i wpięcie w gate, nie tylko nightly. | P1 |
| B4 | FE component | nowy: `DocumentStudioExportPanel`/`…ProposalPanel.test.tsx` | **S5/S6** — FE jest pokryty tylko 1 plikiem (panel dokumentu). Brak FE dla proposal approve/reject i UI bramki eksportu (qaOverride). | P1 |
| B5 | Route/HTTP | nowy: `document-studio.share-resolve.public.test.ts` (lub rozszerzyć istniejący) | **S8** — twarda asercja, że publiczny konsument z hasłem/wygasłym/odwołanym linkiem dostaje właściwe kody i **nie wycieka treści cross-tenant** (część jest, dodać password-path). | P1 |
| B6 | Integration (PG real) | nowy: rollback/version snapshot z PG | **S7** — rollback testowany na fake store; realny snapshot+revert na PG potwierdzi trwałość wersji. | P2 |
| B7 | CI config | `.github/workflows/test-suite.yml` | **gate** — dodać `pull_request: branches: [Londyn]` (lub przepiąć default), bo dziś żaden test M18 nie blokuje merge'a. | P1 |

---

## 6. Root-cause (znane wzorce)

Brak. Wszystkie 889 uruchomionych testów przeszły. Żaden z wzorców awarii M17 nie wystąpił:
- i18n mock-drift `t(key,{defaultValue})` → obiekt — **nie wystąpił** (FE M18 minimalny, 1 plik, zielony);
- stale-import po przeniesieniu routes — **nie wystąpił**;
- brak `<Router>` — **nie wystąpił**;
- schema-drift PG — **nie wykryty** (ale i nie testowany realnie — patrz §4/B1);
- rola „iris" — **brak w testach M18**;
- 25 stale testów middleware vs cofnięta impl — **brak analogu w M18**.
