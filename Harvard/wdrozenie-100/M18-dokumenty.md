# TECZKA M18 — Dokumenty (Document Studio)

> Teczka = **cienki indeks + reconciliation**, NIE duplikat. Linkuje kartę audytu + INV_E + kod i dokłada brakujące ogniwa. Pogłębiona do poziomu PODŁOGI [`M13-inicjatywy.md`](M13-inicjatywy.md) (2026-06-13): C = **pełen per-warstwowy model persystencji (8 warstw, write-through DAO)** z dowodem `INSERT INTO` per-DAO + cold-start proof; B = Mode1/Template Architect/edytor proposalowy; F = epiki→stories Gherkin→L-xx. Wzór: [`_WZORZEC_TECZKI.md`](_WZORZEC_TECZKI.md).

## 00 · Nagłówek
- **Moduł:** M18 Document Studio · **Pula:** beta (closed; mount BE bez `v8FeatureGate` — zawsze włączony)
- **Ocena audytu:** 54/100 · **Tier:** Alpha · **Status:** FAZA 1 (cold-start proof + migracja wave5) → FAZA 3/4 · **Rozmiar:** M-L (2–4 dni)
- **Żywy bloker:** brak P0 (P1 „data-loss in-memory" — **CZĘŚCIOWO STALE**: 3/8 warstw persystują, **5/8 nadal in-memory** — patrz C/R3)
- **Właściciel:** Piotr · **Daty:** karta 2026-06-11 · teczka 2026-06-13 (pogłębiona)
- **Karta:** `Harvard/modules/M18-dokumenty/KARTA_AUDYTU.md` · **Evidence:** `…/evidence/f1_code_truth.md`, `f2_tests_report.md`, `f56_kanon_sec.md` · **INV_E:** `…/INV_E_outputs_studia_meeting.md` (DOKUMENTY poz.1-9)
- **Kod:** FE `src/components/DocumentStudio/` (`DocumentStudioView/IntakeForm/Outline/Editor/Qa/DocumentPanel/TemplateArchitectView` + `api.ts`/`types.ts`) · BE `server/src/services/documentStudio/` (~45 plików: `documentStudioService.ts` + 10 par `…RegistryDao`/`…Service` + renderery docx/pdf/chart + intake/outline/refiner) · `server/src/routes/document-studio.routes.ts` (**96 endpointów**) · migracje `776_document_studio_wave5_persistence.sql`, `20260603_document_studio_editor_state.sql`, `769_document_studio_templates.sql`

## MAPA POKRYCIA
| Warstwa | Stan | Źródło (istnieje) | Co dokłada teczka |
|---|---|---|---|
| A Intencja | 🟢 | karta §0 + INV_E DOKUMENTY | job-to-be-done + role + zakres (niżej) |
| B UX docelowe | 🟡 | karta §5 (MELS, ale View go nie używa — L-07) | **3 tryby + edytor proposalowy 6 poziomów + stany** (niżej) |
| C Dane+API+reguły | 🟢 | karta §1e/§1f + DAO + migracje | **per-warstwowy model 8 warstw (R3) + enum 96 endpointów + bramki** (niżej) |
| D AI/Teresa | 🟢 | karta §1a (Mode1/2/3 + edytor proposalowy 6 poz.) | Mode3 placeholder (L-04) + kręgosłup #1 |
| E Integracje | 🟢 | karta §1g | M17 approval-gate czyta publish M18 (niżej) |
| F Epiki | 🟢 | karta §7 (3 fale) | **epiki→stories Gherkin→L-xx** (niżej) |
| G DoD/jakość | 🟢 | karta §0/§2/§7 | **liczby grep 2026-06-13** (niżej) |
| H Governance | 🟢 (dołożone) | karta §1/§6 | **Rejestr Wejść + Decyzji + korekta R3 zaostrzona** |

---

## A · INTENCJA *(link + uzupełnienie)*
- **Job-to-be-done:** wytworzyć dokument doradczy end-to-end — od intake/outline (Mode1), przez szablon firmowy (Template Architect, Mode2/3), edytor proposalowy z approve/reject, po eksport za bramką QA i publiczny share.
- **Persony/role:** konsultant (autoring), członek org (edycja w obrębie org), admin/owner (approve/deprecate szablonów firmowych — **wymaga gatingu serwerowego, L-05**), publiczny konsument share-linka (read sanitizowany). Override QA-gate role-gated `SUPERADMIN/OWNER/ADMIN/PM/MANAGER` (`canOverrideQa`).
- **Zakres v1:** Mode1 intake→outline→document (LLM) · Mode2 Template Architect (mig.769) · Mode3 generate z szablonu · edytor proposalowy 6 poziomów · editor-state write-through (mig.`20260603`) · wersje/komentarze (mig.776) · approvals/content-blocks/brand-voice/audience/source-packs (DAO, **wave5 pending**) · bramka eksportu QA serwerowa · public share (whitelist 5 pól, token 256-bit HMAC, revoke+rotate). **POZA v1:** Mode3 z pełną prozą LLM (obecnie placeholder-szkielet, D-02).
- **Metryka:** wersje/komentarze przeżywają restart (cold-start); pozostałe 5 warstw stanu po migracji wave5; export tylko po QA; 0 ścieżek cross-org.

## B · UX DOCELOWE *(pogłębione — 3 tryby + edytor + stany)*
- **Wzorzec:** MELS (`ExecutiveModuleShell`). **Delta L-07:** `DocumentStudioView.tsx:193-219` ma ręczny header+taby; MELS użyty tylko wewnątrz `DocumentStudioDocumentPanel.tsx:1996` → ujednolicić View na MELS.
- **3 tryby autoringu (kanon docelowy):**
  - **Mode1** — intake (`DocumentStudioIntakeForm.tsx`) → outline (`OutlinePanel`) → document (LLM gdy `useLlm=true`).
  - **Mode2** — Template Architect (`DocumentStudioTemplateArchitectView.tsx`): plan/approve/deprecate + audit szablonu firmowego (mig.769).
  - **Mode3** — generate z zatwierdzonego szablonu; **L-04: wymusza `useLlm:false` → placeholder-szkielet** (kontrast z Mode1, D-02).
- **Edytor proposalowy 6 poziomów** (`DocumentStudioEditorPanel.tsx` + 6 endpointów `/editor/proposals/{local,section,global,methodology,source,transformative}` + approve/reject): każda propozycja AI z approve/reject + audit.
- **Edytor 3-szynowy:** Outline · Editor · QA (`DocumentStudioQaPanel.tsx`).
- **Stany ekranu:** loading/error/empty pokryte; drobny silent-fail listy szablonów (`refreshApprovedTemplates` swallow→`[]`, L-08).
- **§27:** głównie N/D (edytor 3-szynowy); jedyna lista (szablony, `DocumentStudioTemplateArchitectView.tsx:302`) = ad-hoc `<ul>/<li>` → FilterableTable (L-08); grep `<table>`=0.

## C · DANE + API + REGUŁY *(pogłębione — 8-warstwowy model persystencji + enum 96 endpointów + bramki)*
- **Wiring FE↔BE↔DB:** karta §1e. **Flagi:** karta §1f (mount bez `v8FeatureGate` `Gateway.ts:758` → zawsze ON na BE; beta-lock tylko nawigacyjny, L-06).
- **MODEL PERSYSTENCJI — 8 warstw, write-through DAO (KOREKTA R3 ZAOSTRZONA — patrz H/02):** każdy `…RegistryDao` = persistence-layer za in-process `Map` cache w `…Service` (API synchroniczne, write-through best-effort, lazy-hydration na cold-start, fail-tolerant `{ok:false}` bez throw). **ALE realny `INSERT INTO` ma TYLKO 3/8 warstw** (grep `INSERT INTO` 2026-06-13):
  | Warstwa | DAO | Migracja | `INSERT INTO` | Persystuje? |
  |---|---|---|---|---|
  | editor-state | `documentEditorStateRegistryDao` | `20260603` | **3** (`ON CONFLICT`+hydration) | ✅ TAK |
  | wersje/snapshoty/rollback | `documentVersionSnapshotRegistryDao` | **776** (`document_version_snapshots` l.6) | **1** (`:103`) | ✅ TAK |
  | komentarze/threads | `documentCommentsRegistryDao` | **776** (`document_comments` l.24) | **1** (`:114`) | ✅ TAK |
  | szablony | `documentTemplateRegistryDao` | 769 | 2 | ✅ TAK |
  | **approvals/decisions/audit** | `documentApprovalRegistryDao` | — | **0** | ❌ **in-memory** (nagłówek l.21: „in-memory only; wave5 migration ships in a follow-up") |
  | **content-blocks** | `documentContentBlockRegistryDao` | — | **0** | ❌ **in-memory** (l.20) |
  | **brand-voice** | `documentBrandVoiceRegistryDao` | — | **0** | ❌ **in-memory** (l.19) |
  | **audience-profiles** | `documentAudienceProfileRegistryDao` | — | **0** | ❌ **in-memory** (l.23) |
  | **source-packs** | `documentSourcePackRegistryDao` | — | **0** | ❌ **in-memory** (l.19) |
  | **share-links** | `documentShareLinkRegistryDao` | — | **0** | ❌ **in-memory** (l.26) |

  > **Wniosek (precyzyjny):** karty „8/8 write-through" i „wszystko in-memory" są OBA niedokładne. Prawda: **editor-state + wersje + komentarze + szablony PRZEŻYWAJĄ restart** (mig.776/`20260603`/769, `INSERT INTO` w kodzie); **approvals, content-blocks, brand-voice, audience-profiles, source-packs, share-links NIE — znikają po deployu** (DAO literalnie „in-memory until wave5 ships"). To NIE jest dziura bezpieczeństwa (cache org-scoped, fail-closed), ale **utrata danych po deployu** dla 6 warstw → wymaga migracji wave5 (L-01). Cold-start proof na staging rozstrzyga live.
- **Bramka eksportu QA (serwerowa):** `QaBlockingError`→403 (`documentStudioService.ts:744`); override role-gated PRZED uruchomieniem QA — `if (options.qaOverride && !canOverrideQa(options.userRole)) throw QaOverrideUnauthorizedError` (`:672`), próba nieautoryzowanego override logowana niezależnie (`qa_override_denied` audit). **Lepiej niż M17/M19** (override per-rola w serwisie, nie query-param).
- **Org-scope (czysty):** `getAuthContext` z tokena → `getWave5Artifact`→`WHERE artifact_id=? AND organization_id=?` (`wave5ArtifactRuntimeService.ts:578`). 4. moduł z rzędu bez IDOR.
- **Reguła bramki szablonów (L-05):** `templates/:id/approve` + `/deprecate` (`document-studio.routes.ts:616,642`→`documentTemplateService.ts:429-475`) **bez gatingu roli serwerowo** — każdy członek org zatwierdza/deprecjonuje (M17 wymaga `canPublishOrgTemplate`).
- **Enum API (96 endpointów, grupy):** core (`/plan`, `/generate`, `/chat/create-from-sources`, `/policy`) · artefakt-scoped (`/:artifactId` + diff/lifecycle/status/qa/variants) · **8 warstw** każda z CRUD+audit: `/snapshots`(+rollback), `/comments`(+threads/resolve/reopen/reply/counts), `/approvals`(+decisions/cancel/audit/active), `/content-blocks`(+insert/instantiate/activate/archive/audit), `/brand-voice/profiles`, `/audience-profiles`, `/source-packs`(+items/attach/ready), `/share-links`(+revoke/rotate/audit) · editor-proposals 6 poziomów+approve/reject+audit · assets/logo · `/export/:format`. Wszystkie org z tokena.

## D · AI / TERESA *(link + kręgosłup)*
- **Co generuje:** Mode1 intake→outline→document (LLM gdy `useLlm=true`); edytor proposalowy 6 poziomów (local/section/global/methodology/source/transformative) z approve/reject; `documentBlockProseGenerator`/`documentNarrativePlanner`/`documentContentGenerator` (proza).
- **L-04 Mode3:** generate z szablonu wymusza `useLlm:false` → treść = placeholder-szkielet (kontrast z Mode1). Decyzja D-02.
- **Kręgosłup (Uwaga #1):** deliverable „z czatu zrób doc" idzie przez `UnifiedChatPanel`+pipeline→`WorkCanvasDocumentPanel` — pęknięcie więzi opisane w `SPEC_ZADANIE_01` (zależność programowa, nie lokalna luka M18). Niezweryfikowane w specu: czy standalone Document Studio reużywa tego panelu, czy to osobna powierzchnia (do potwierdzenia przy fixie #1).

## E · INTEGRACJE
Karta §1g. **WEJŚCIE ←** M17 Outputs („New AI document"→`/document-studio`). **WYJŚCIE →** M17 (rejestracja artefaktu dokumentu — **M17 approval-gate L-01 czyta stan publish/wersji M18**, zależność blokująca: M18 musi trwale persystować publish, więc kolejność MASTER §5 = M18 przed szlifem M17), pliki (md/docx/pdf za QA-gate; renderery `documentDocxRenderer`/`documentPdfRenderer`), public (share sanitizowany `consumeShareLink`). **Kręgosłup:** auto-trigger z czatu = Faza 0 (SPEC_01).

## F · EPIKI → STORIES → ZADANIA *(pogłębione, Gherkin → L-xx)*
- **EPIK 1 — Dowieść/domknąć trwałość (P1):**
  - Story 1.1: jako system chcę by approvals/content-blocks/brand-voice/audience/source-packs/share-links przeżyły restart, aby decyzje aprobacyjne i szablony brand nie znikały po deployu.
    - Gherkin: *dany* utworzony approval/content-block · *gdy* restart serwera · *wtedy* dane nadal czytelne (nie pusty `Map`). [Z → **L-01**: migracja wave5 dla 6 warstw na wzór mig.776]
  - Story 1.2: cold-start proof S4/S7 na staging dla 3 już-persystujących warstw (wersje/komentarze/editor-state). [Z → **L-01**]
- **EPIK 2 — Bezpieczeństwo:**
  - Story 2.1: jako security chcę gating roli na template approve/deprecate. Gherkin: *gdy* członek bez ADMIN/OWNER woła `/templates/:id/approve` · *wtedy* 403. [Z → **L-05**]
  - Story 2.2: beta-guard route; rate-limit public share-resolve; usunąć `organizationId` z payloadu share. [Z → **L-06**]
- **EPIK 3 — Treść:**
  - Story 3.1: Mode3 `useLlm:true` LUB jawny szkielet w UI (D-02). [Z → **L-04**]
- **EPIK 4 — Test prawdy:**
  - Story 4.1: S4 realny DAO+PG (nie `vi.mock`) — cold-start. Gherkin: *gdy* test wstawia wersję realnym DAO i czyta po reconnect · *wtedy* wiersz w PG. [Z → **L-02**]
  - Story 4.2: S6 HTTP route 403 `qa_blocking` (grep `qa_blocking` w testach=0). [Z → **L-03**]
- **EPIK 5 — Kanony:**
  - Story 5.1: View na MELS [Z → **L-07**]; i18n `t()` w 5 plikach [Z → **L-09**]; tokeny [Z → **L-10**]; lista szablonów → FilterableTable [Z → **L-08**]; CI `Londyn`.
- **EPIK 6 — Higiena migracji:**
  - Story 6.1: usunąć duplikat `776 … 2.sql` (byte-identyczny). [Z → **L-12**, D-03]

## G · JAKOŚĆ / DoD *(skwantyfikowane — grep 2026-06-13)*
| # | Kryterium | Miara M18 |
|---|-----------|-----------|
| 1 | Front↔back | **6/8 warstw (approvals/content-blocks/brand-voice/audience/source-packs/share-links) z `Map`→DB** + cold-start proof; 3/8 już persystują (wersje/komentarze/editor-state, `INSERT INTO` w kodzie); Mode3 proza lub jawny szkielet; 0 martwych przepływów |
| 2 | Bezpieczeństwo | template approve/deprecate role-gated (403 bez roli `:616,642`); beta-guard route; rate-limit share; org-scope (już czysty `:578`); override QA role-gated (już `:672`) |
| 3 | i18n | **4 z 4** `isPolish` w `src/components/DocumentStudio` (grep 2026-06-13 = **4**); realny dług = **EN-only** (`useTranslation` tylko w **2** plikach) → `t()` w View/IntakeForm/Outline/DocumentPanel/TemplateArchitect |
| 4 | Tokeny | **0 hex `#RRGGBB`** (grep = 0); dług = ~40 klas Tailwind sky/emerald/amber/rose → tokeny + `EntityStatusChip` (karta „~150" liczyła szerzej) |
| 5 | §27 | **0** surowych `<table>` (grep = 0); lista szablonów = ad-hoc `<ul>/<li>` → FilterableTable; View → MELS |
| 6 | E2E w PR-gate | S4 (realny DAO+PG cold-start), S6 (route 403 `qa_blocking`) zielone na `Londyn` |

Scenariusze S1–S8: karta §0/§2 (889 PASS/0 FAIL — najlepszy wolumen, ale S4 mockuje DAO → maskuje 6/8 in-memory). Bezpieczeństwo: karta §6.

## H · GOVERNANCE *(dołożone ogniwa)*

### 01 · Rejestr wejść (R1)
| ID | Źródło | Data | Treść (1 zd.) | → Luka |
|----|--------|------|----------------|--------|
| W-01 | Karta audytu §1–§7 | 2026-06-11 | 54/100; org-scope czysty; **sprzeczność persystencji** (re-audit: write-through real vs §1c: fasada) | L-01..L-10 |
| W-02 | **Uwaga żywa #1** (`SPEC_ZADANIE_01`) | 2026-06-13 | kręgosłup czat→panel pęka — „z czatu zrób doc" idzie tędy → M18 dotknięty zależnością | L-11 (zależność) |
| W-03 | INV_E DOKUMENTY poz.1-9 | 2026-06-11 | inwentarz „[DZIAŁA]" dla wersji/komentarzy — do potwierdzenia cold-start | L-01 |
| W-04 | **Weryfikacja kodu grep `INSERT INTO` per-DAO** | 2026-06-13 | 3/8 warstw persystują, 5/8 nadal in-memory (nagłówki DAO „wave5 pending") | L-01 (zaostrzona) |
| W-05 | Feedback prod (kohorta beta) | — | brak własnej uwagi żywej M18 z 2026-06-13 | — (dziedziczy z karty + #1) |

### 02 · Stan obecny (prawda kodu) — **KOREKTA R3 ZAOSTRZONA**
Karta wewnętrznie sprzeczna (§1c „fasada in-memory" vs re-audit „write-through real"). **Weryfikacja `INSERT INTO` per-DAO 2026-06-13 rozstrzyga PRECYZYJNIE (oba ujęcia karty były zgrubne):**
- **PERSYSTUJĄ (✅, `INSERT INTO` w kodzie + migracja):** editor-state (`documentEditorStateRegistryDao`, 3× INSERT, mig.`20260603`), wersje/snapshoty (`documentVersionSnapshotRegistryDao:103`, mig.776 l.6), komentarze (`documentCommentsRegistryDao:114`, mig.776 l.24), szablony (`documentTemplateRegistryDao`, 2× INSERT, mig.769). **Re-audit miał rację dla TYCH 4.**
- **NIE PERSYSTUJĄ (❌, 0× `INSERT INTO`, nagłówek DAO „in-memory only; wave5 migration ships in a follow-up"):** approvals (`documentApprovalRegistryDao` l.21), content-blocks (l.20), brand-voice (l.19), audience-profiles (l.23), source-packs (l.19), share-links (l.26). **Pierwotny finding „fasada" miał rację dla TYCH 6 — znikają po deployu.**

**Wniosek:** P1 „data-loss in-memory" jest **CZĘŚCIOWO STALE**: trzon (wersje/komentarze/editor-state) trwały; 6 warstw governance/brand/source nadal in-memory → realna utrata po deployu, do domknięcia migracją wave5. ⚠️ uboczne: duplikat `server/migrations/776_document_studio_wave5_persistence 2.sql` jest **byte-identyczny** z oryginałem (`diff -q`=IDENTICAL); loader (`DatabaseInitializer.ts:3179`, sort po długości prefixu + `localeCompare`) wykona OBA pliki — `CREATE TABLE IF NOT EXISTS` czyni drugi nieszkodliwym, ale zaśmieca ledger migracji (L-12, D-03; NIE kolizja jak 725/726 w M20, bo identyczny).

### 03 · Rejestr luk
| ID | Opis | Wejście | Dowód `plik:linia` | Klasa | Faza | **Status** | Zweryf. |
|----|------|---------|--------------------|-------|------|-----------|---------|
| L-01 | trwałość 6/8 warstw + lifecycle in-memory → utrata po deployu | W-01,W-03,W-04 | mig. `780`+`781`+`782`; 6 DAO + lifecycle = write-through DAO na Postgres (cache `new Map` jako warstwa write-through, źródło prawdy = PG) | P1 | 1 | **ZAMKNIĘTA (R6) — KOMPLETNA** — (1) approvals/content-blocks/brand-voice/audience/source-packs/share-links: mig.780+781, code `953955bc2b`+`8d2b5d8cf4`; (2) cold-start CI proof (`approval-coldstart.contract.test.ts` 7/7); (3) 12 tabel wave5 EXIST na staging (to_regclass 2026-06-17); (4) LIVE INSERT→REDEPLOY→SELECT PASS 2026-06-18 (`coldstart-proof-1781755353836`); (5) **LIFECYCLE PERSISTENCE**: `documentLifecycleService.ts` — druga „udawana persystencja" `persistedLifecycleStore` usunięta → `documentLifecycleRegistryDao.ts` + mig.782 `document_lifecycle_states`; LIVE PASS 2026-06-18: `lifecycle-coldstart-1781781195534` status=`in_review` przeżył `railway redeploy`; commit `5c141ec3ac`. **(skoryg. 2026-06-19: persystencja PG realna — write-through DAO (`persistLifecycleState`→`daoPersistLifecycleState`) na każdej mutacji + hydracja cold-start `ensureHydrated`; cache `const lifecycleStore = new Map` NADAL istnieje jako warstwa write-through `documentLifecycleService.ts:127` — to NIE „zero Map", lecz „Map jako cache, źródło prawdy = PG".)** | 2026-06-18 |
| L-02 | S4 test mockuje DAO (nie dotyka PG) | W-01 | `evidence/f2_tests_report.md` (S4 `vi.mock`) | P0-test | 1 | **ZAMKNIĘTA** — `approval-coldstart.contract.test.ts` (7/7 PASS) uruchamia REALNY `documentApprovalRegistryDao` przeciw realnemu SQL (in-memory SQLite przez DbPromise seam), NIE `vi.mock`; demaskuje ew. nawrót do in-memory Map | 2026-06-17 |
| L-03 | S6 bramka testowana na serwisie, nie route 403 | W-01 | `document-studio.routes.ts:3386,3394` | P0-test | 1 | **ZAMKNIĘTA** — `export-qa-gate.routes.test.ts` (4/4) montuje REALNY router via supertest, realna `exportDocumentArtifact`+`QaBlockingError`/`canOverrideQa`: blocking QA→403 `qa_blocking`; override nieuprawniony→403 `qa_override_unauthorized`+audit `qa_override_denied`; uprawniony→200+`qa_override_export`; mutation-verified (usunięcie `:744`→fail) | 2026-06-17 |
| L-04 | Mode3 wymusza `useLlm:false` → placeholder | W-01 | `DocumentStudioIntakeForm.tsx:126` | P2 | 2 | **ZAMKNIĘTA** — `useLlm: inTemplateMode ? false : useLlm` → `inTemplateMode ? true : useLlm` (`DocumentStudioIntakeForm.tsx:126`); Mode3 teraz używa LLM (template=struktura, LLM=treść jak Mode1); commit `5660c081f1`; 2/2 contract tests | 2026-06-17 |
| L-05 | template approve/deprecate bez roli serwerowo | W-01 | `document-studio.routes.ts:623,653` | P2 | 3 | **ZAMKNIĘTA (regresja zabezpieczona)** — gate `:623`/`:653` (`['admin','owner','superadmin']→403`) potwierdzony + test regresji `template-approve-deprecate-rolegate.routes.test.ts` (4/4): non-admin→403 approve+deprecate, admin→przechodzi; mutation-verified (usunięcie `:623`→fail) | 2026-06-17 |
| L-06 | beta-lock nawigacyjny + brak rate-limit share + over-disclosure `organizationId` | W-01 | `AppRoutes.tsx:2105`; `document-studio.routes.ts:4225,4251` | P2/P3 | 3 | **ZAMKNIĘTA** — beta-lock (`<BetaGate MODULE_DOCUMENT_STUDIO>` `:2105`) + **rate-limit `publicShareLinkLimiter` 30/min** na `/share-links/resolve` (`:4225,4235`) + **over-disclosure usunięty** (`const { organizationId: _orgId, ...publicResult }` strip `:4251`) + 404 single-surface anty-enumeracja + revoke (`/share-links/:id/revoke`) | 2026-06-17 |
| L-07 | `DocumentStudioView` nie używa MELS (ręczny header) | W-01 | `DocumentStudioView.tsx:193-219` | P2 | 3 | **ZAMKNIĘTA** — `DocumentStudioView.tsx` przebudowany: `ExecutiveModuleShell` TopBar z toggle-chipami tabulacyjnymi; TopBar wygaszony w fazie document (DocumentPanel ma własny MELS) — commit `440d9d2899` | 2026-06-17 |
| L-08 | lista szablonów ad-hoc `<ul>` + silent-fail | W-01 | `DocumentStudioTemplateArchitectView.tsx:302` | P3 | 4 | **ZAMKNIĘTA** — TemplateArchitectView przebudowany na `FilterableTable` (§27 kanon): `EntityStatusChip` status, `RowActionsMenu`, `persistKey="documentStudio.templates"`, filtry; silent-fail naprawiony → `templatesError` state propagowany do `IntakeForm` (`templatesNotice` prop) — commit `440d9d2899` | 2026-06-17 |
| L-09 | i18n EN-only (`useTranslation` w 2 plikach) | W-01 | `DocumentStudio/*` (grep `useTranslation`=2) | P2 | 4 | **CZĘŚCIOWO ZAMKNIĘTA** — `DocumentStudioEditorPanel.tsx`: `formatAuditAction()` 4 klucze `docs.auditAction.*` PL/EN (`972ffea434`). Pozostałe pliki (View/IntakeForm/Outline/DocumentPanel/TemplateArchitect) = ZABLOKOWANE (Fala 4; `public/locales/*` ZAKAZANE) | 2026-06-17 |
| L-10 | ~40 klas koloru Tailwind (sky/emerald/amber/rose) | W-01 | `DocumentStudio/*` (grep 2026-06-13) | P3 | 4 | **ZAMKNIĘTA** — `DocumentStudioDocumentPanel.tsx` + `DocumentStudioQaPanel.tsx`: statusowe bannery/piny → `success-*`/`warning-*` design tokeny (zamiast hardcoded sky/emerald/amber Tailwind); commit `440d9d2899` | 2026-06-17 |
| L-11 | kręgosłup czat→doc (deliverable z czatu) | W-02 | `SPEC_ZADANIE_01` | P0-program | 0 | **NAPRAWIONA-SPEC_01 2026-06-17 `a6aea8d2d5`+`e7bd755b04`** — Tryb A function-calling: Teresa woła `generate_deliverable(type:document)`→`plan/start` (planDoc)→SSE `deliverable`→montaż doc w canvasie. Testy 6/6. Żywe S-A E2E (auth+LLM staging) pending. | |
| L-12 | duplikat migracji `776 … 2.sql` (byte-identyczny) | W-04 | `server/migrations/776…2.sql` (`diff -q`=IDENTICAL) | P3 | 4 | **ZAMKNIĘTA (D-03)** — duplikat był nietrackowany w git (kopia Findera, `git ls-files` count=0); usunięty z working-tree; oryginał `776_…persistence.sql` (tracked) pozostaje | 2026-06-17 |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-02 | Mode3 generate z szablonu | pozwolić `useLlm:true` (proza) / jawnie oznaczyć szkielet w UI | Piotr | 2026-06-17 | **ROZSTRZYGNIĘTE** — `useLlm:true` w Mode3; commit `5660c081f1` |
| D-03 | duplikat migracji `776 … 2.sql` | usunąć duplikat (byte-identyczny, bezpieczne) / zostawić | Piotr | 2026-06-17 | **ROZSTRZYGNIĘTE → usunięto** (nietrackowany w git, byte-identyczny, loader CREATE TABLE IF NOT EXISTS — zero ryzyka) |

### 05 · Flagi / rollout — beta-closed; mount BE bez `v8FeatureGate` (zawsze ON na BE — beta-lock tylko nawigacyjny). Override QA role-gated. Migracje 776/`20260603`/769 zastosować na staging; **migracja wave5 dla 6 warstw in-memory = warunek trwałości**.
### 06 · Ryzyka — cold-start proof to dowód live na trwałość 3/8 warstw (kod = poszlaka mocna); 6/8 warstw (approvals/content-blocks/brand-voice/audience/source-packs/share-links) realnie in-memory → utrata po deployu DO NAPRAWY (mig.wave5); duplikat mig.776 (D-03); 889 zielonych testów MASKUJE S4 (mockują DAO → nie wykryją 6/8 in-memory); dev `.env` → Railway PROD.
### 07 · Log — **2026-06-18 (Harvard Final): OWNER UUID→nazwa ZAMKNIĘTA.** Commit `c549efe515` (M18 dokument list): kolumna Owner w liście dokumentów wyświetlała UUID zamiast nazwy użytkownika — naprawione przez JOIN `user_profiles` na `owner_id`; owner_name teraz widoczny w tabeli. SYS-5 i18n-mix M18 zlikwidowany przez `50a6307391` (klucze PL/EN dla settings/docs/partner). SYS-1 selekcja: `4155d717c3`+`33dfeabced` (settings+docs sweep). Grafika M18: 🟢. Cold-start proof zweryfikowany live `COLD_START_PROOF_2026-06-18.md` (deploy-pending na prod).
### 07 · Log — 2026-06-18 (Harvard 4 Faza 5 — LIFECYCLE PERSISTENCE + L-01 KOMPLETNA): **documentLifecycleService.ts** — `persistedLifecycleStore` (druga in-memory Map UDAJĄCA persistence, bez DAO) usunięta; nowy `documentLifecycleRegistryDao.ts` + mig.782 `document_lifecycle_states` (PK artifact_id+org, history_json JSONB). LIVE PASS 2026-06-18: `lifecycle-coldstart-1781781195534` status=`in_review` przeżył Railway restart. Commit `5c141ec3ac`. Testy beforeEach/afterEach → async (await reset). **(skoryg. 2026-06-19: pierwotne sformułowanie „0 `new Map` w ścieżce prod M18" jest NIEPRECYZYJNE — usunięto JEDYNIE drugą, udającą-persystencję Mapę. Pozostaje `const lifecycleStore = new Map` (`documentLifecycleService.ts:127`) jako write-through cache: każda mutacja `lifecycleStore.set(...)` + `void persistLifecycleState(...)` → DAO/PG (l.248-249, 326-327, 405-406), cold-start `ensureHydrated`→`daoLoadLifecycleStatesForOrg` (l.161-182). Prawda = „Map jako cache write-through, źródło prawdy = PG", NIE „zero Map".)**
### 07 · Log — 2026-06-18 (Harvard 4 Faza 5 — COLD-START LIVE PASS): **L-01 R6 OFICJALNIE ZAMKNIĘTA** — LIVE INSERT→`railway redeploy -s consultify -y`→SELECT: `approval_id='coldstart-proof-1781755353836'`, status=`pending`, `created_at='2026-06-18T04:02:34.475Z'` PRESENT po restarcie. 12/12 tabel wave5 potwierdzone on staging (to_regclass). Dowód: `COLD_START_PROOF_2026-06-18.md`.
### 07 · Log — 2026-06-17 (Harvard 4 Fala 5): i18n sweep M18 — **4 klucze `isPolish` → `t()`** w `DocumentStudioEditorPanel.tsx`: `formatAuditAction()` helper przepisany z `if(!isPolish) return action` + PL switch-case → `t('docs.auditAction.*')` dla proposal_created/approved/rejected/executed; sygnatura `(action, t: TFunction)`; `isPolish` + `i18n` import usunięte z komponentu — commit `972ffea434`. `keys_M18.json` = 4 klucze. Pozostałe 4 pliki DocumentStudio = 0 `isPolish` referencji. L-09 i18n — 4 klucze domknięte w DocumentStudioEditorPanel; pozostałe pliki (View/IntakeForm/Outline/DocumentPanel/TemplateArchitect) = ZABLOKOWANE (locales poza strefą Fali 1). — 2026-06-17 (Runda 4): L-04 ZAMKNIĘTA (`5660c081f1` useLlm:true w Mode3); D-02 ROZSTRZYGNIĘTE. 2026-06-17 (Runda 3): L-11 — śledzona jako SPEC_01, nie lokalna; zależność programowa potwierdzona (SPEC_ZADANIE_01 istnieje w `Harvard/SPEC_ZADANIE_01_chat_controller.md` — Tryb B+C: pęknięcie więzi czat→panel oraz dwa rozłączne systemy artefaktów; do potwierdzenia przy fixie #1: czy standalone Document Studio reużywa WorkCanvasDocumentPanel czy to osobna powierzchnia). L-09 ZABLOKOWANA (Fala 4) — `public/locales/*` ZAKAZANE w Fali 1; wymaga koordynacji z agentem i18n; scope: EN-only surface (useTranslation w 2 plikach) → `t()` w View/IntakeForm/Outline/DocumentPanel/TemplateArchitect. 2026-06-17 (Runda 2 FE): L-07 ZAMKNIĘTA (DocumentStudioView → MELS TopBar+toggle-chipy), L-08 ZAMKNIĘTA (TemplateArchitectView → FilterableTable §27 + silent-fail → templatesError), L-10 ZAMKNIĘTA (DocumentPanel+QaPanel → success-*/warning-* tokeny) — commit `440d9d2899`. 2026-06-13 (egzekucja Fazy 1): L-01 NAPRAWIONA — 6/8 warstw przepisane Map→Postgres (mig.`780` approvals + `781` 5 warstw = 10 tabel; commity `953955bc2b`+`8d2b5d8cf4`; tsc documentStudio czysty). Pozostaje cold-start proof na staging. Re-ocena C/D po cold-start + S4/S6 realnych. 2026-06-13 (teczka pogłębiona): R3 ZAOSTRZONA grepem `INSERT INTO` per-DAO → **3/8 persystują, 6/8 in-memory**; C rozbite na per-warstwowy model + enum 96 endpointów + bramka QA `:672`; L-12 duplikat mig.; F na Gherkin. **2026-06-13 (egzekucja Fazy 1): L-01 NAPRAWIONA — 6/8 warstw przepisane Map→Postgres (mig.`780` approvals + `781` 5 warstw = 10 tabel; commity `953955bc2b`+`8d2b5d8cf4`; tsc documentStudio czysty).** Pozostaje cold-start proof na staging. Re-ocena C/D po cold-start + S4/S6 realnych. **2026-06-17 (Runda 2 FE): L-07 ZAMKNIĘTA (DocumentStudioView → MELS TopBar+toggle-chipy), L-08 ZAMKNIĘTA (TemplateArchitectView → FilterableTable §27 + silent-fail → templatesError), L-10 ZAMKNIĘTA (DocumentPanel+QaPanel → success-*/warning-* tokeny) — commit `440d9d2899`.** **2026-06-17 (Runda 4): L-04 ZAMKNIĘTA (`5660c081f1` useLlm:true w Mode3); D-02 ROZSTRZYGNIĘTE.** **2026-06-17 (Runda 3): L-11 — śledzona jako SPEC_01, nie lokalna; zależność programowa potwierdzona (SPEC_ZADANIE_01 istnieje w `Harvard/SPEC_ZADANIE_01_chat_controller.md` — Tryb B+C: pęknięcie więzi czat→panel oraz dwa rozłączne systemy artefaktów; do potwierdzenia przy fixie #1: czy standalone Document Studio reużywa WorkCanvasDocumentPanel czy to osobna powierzchnia). L-09 ZABLOKOWANA (Fala 4) — `public/locales/*` ZAKAZANE w Fali 1; wymaga koordynacji z agentem i18n; scope: EN-only surface (useTranslation w 2 plikach) → `t()` w View/IntakeForm/Outline/DocumentPanel/TemplateArchitect.**

---

## Bramka teczki: 9/9 dokumentacyjnie ✅
R1 wejścia (karta+INV_E+uwaga #1+weryfikacja per-DAO) · R2 zero sierot · R3 statusy z dowodem (**L-01 zaostrzona: 3/8 warstw `INSERT INTO`+migracja persystują, 6/8 nagłówek DAO „in-memory wave5 pending" — korekta obu zgrubnych ujęć karty**; L-12 z `diff -q`; L-11 zależność) · R4 DoD z liczbami (grep i18n=4, hex=0, `useTranslation`=2, `<table>`=0) · R5 decyzje z właścicielem (D-02/D-03) · A–E docelowy zlinkowany (C per-warstwowy model + 3 tryby + enum API) · F epiki→stories Gherkin↔luki · G DoD+S+sec · R6 sesja żywa = Faza 4 + cold-start. **Teczka kompletna do egzekucji.**

## EKRANY (inwentarz) — 2026-06-19

> Inwentarz powierzchni Document Studio (FE `src/components/DocumentStudio/`). Format: ekran — cel — plik.

- **DocumentStudioView (shell)** — kontener modułu; MELS TopBar z toggle-chipami fazowymi (intake/outline/document); routing faz — `src/components/DocumentStudio/DocumentStudioView.tsx`
- **Intake Form (Mode1/Mode3 ekran startowy)** — formularz job-to-be-done + zakres + flaga `useLlm` (Mode3 = template-mode) → plan/outline — `src/components/DocumentStudio/DocumentStudioIntakeForm.tsx`
- **Outline Panel** — edycja/akceptacja struktury (outline) przed generacją treści — `src/components/DocumentStudio/DocumentStudioOutlinePanel.tsx`
- **Document Panel (edytor 3-szynowy)** — główna powierzchnia dokumentu z własnym MELS (TopBar wygaszony w fazie document); render treści + statusowe bannery (success/warning tokeny) — `src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx`
- **Editor Panel (edytor proposalowy 6 poziomów)** — propozycje AI local/section/global/methodology/source/transformative z approve/reject + audit (`docs.auditAction.*`) — `src/components/DocumentStudio/DocumentStudioEditorPanel.tsx`
- **QA Panel (bramka jakości)** — kontrola QA przed eksportem; override role-gated; bannery success/warning — `src/components/DocumentStudio/DocumentStudioQaPanel.tsx`
- **Template Architect View (Mode2)** — plan/approve/deprecate szablonów firmowych; lista szablonów = FilterableTable (§27) + EntityStatusChip + RowActionsMenu; silent-fail → `templatesError` — `src/components/DocumentStudio/DocumentStudioTemplateArchitectView.tsx`

*(Powierzchnie współdzielone/programowe: deliverable „z czatu zrób doc" montowany w canvasie przez `WorkCanvasDocumentPanel` (SPEC_01, poza katalogiem M18); publiczny share-link viewer = sanitizowany render BE, brak osobnego komponentu FE w tym katalogu.)*

---

## Generatory Deliverable — premium DOC (B3 + content-gen) — 2026-06-23

> **Sekcja NOWA, dołożona obok istniejącej teczki (persystencja/security/kanon, wyżej, 9/9 zamknięte).** Pokrywa warstwę **„Generatory Deliverable"** (fala W4 — mózg premium) dla typu DOC: AI-struktura bloków (B3) + content-gen treści. To NIE jest re-audyt istniejącego Document Studio — to nakładka jakościowa nad nim.
> **SSOT produktowy:** [`docs/product/DELIVERABLES_GENERATORS_SPEC.md`](../../docs/product/DELIVERABLES_GENERATORS_SPEC.md) · pamięć [[project_deliverables_generators]], [[finding_deliverables_ft6_pilot_blocker]], [[finding_deliverables_connection_model]].
> **Rubryka jakości (SSOT):** [`DELIVERABLES_QUALITY_RUBRIC.md`](DELIVERABLES_QUALITY_RUBRIC.md) §3 (RAPORT/doc, benchmark Kimi/Claude) · parametry liczbowe grafiki [`DELIVERABLES_GRAPHIC_PARAMETERS.md`](DELIVERABLES_GRAPHIC_PARAMETERS.md).
> **Plany testów:** [`docs/qa/deliverables/test-plan/B-series.md`](../../docs/qa/deliverables/test-plan/B-series.md) (B3), [`R-series.md`](../../docs/qa/deliverables/test-plan/R-series.md) (R1-R3), [`X-series.md`](../../docs/qa/deliverables/test-plan/X-series.md) (X1/X3) · scenariusze [`scenarios/M18_REPORTS.md`](../../docs/qa/deliverables/scenarios/M18_REPORTS.md) (30 doc-quality), [`scenarios/VTS_GOLDEN.md`](../../docs/qa/deliverables/scenarios/VTS_GOLDEN.md) (head-to-head).

### A' · INTENCJA (premium DOC)
- **Job-to-be-done:** z intentu + outline + (opcjonalnie) źródła zbudować **raport doradczy poziomu Kimi/Claude** — nie ścianę prozy, lecz bogatą strukturę bloków (KPI-strip, callouty, tabele, wykresy, listy) wypełnioną realną treścią, z groundingiem ze źródeł (cytowania) i poprawnym PL/EN.
- **Delta vs Mode1/Mode3 (wyżej):** klasyczny Document Studio (Mode1 `useLlm:true`) generuje sekcje + prozę. Premium DOC dokłada warstwę **B3 (documentStructureGenerator)** = LLM dobiera TYPY bloków per sekcja, oraz **content-gen (documentBlockContentGenerator)** = LLM wypełnia każdy blok treścią. Cel: dorównać Kimi-Claude na bogactwie bloków, nie tylko na prozie.

### B' · UX DOCELOWE (premium DOC)
- **Powierzchnie render bloków (FE, istnieją):** `DocTableBlock` (`.doc-table-block` → `<table>` z ramkami), `DocChartBlock` (recharts `BarChart`/`LineChart`/`PieChart` w `ResponsiveContainer`), `DocKpiStrip` (`.doc-kpi-strip__card` z label/value/delta), callout — w `DocumentTipTapEditor` (`data-testid="document-tiptap-editor"`).
- **Inline-AI (R2):** `DocumentInlineAIMenu` + `useDocumentInlineAI` — 5 akcji (`shorten`/`expand`/`improve`/`formal`/`explain`, `inlineActionPrompts.ts`), trigger „Popraw z Teresa". Brak `data-testid` (do dodania, patrz R-series).
- **STAN UI:** intake żywego Document Studio mówi literalnie **„deterministic first draft"** — premium NIE jest wpięte w żywy pipeline UI. Jakość premium mierzona przez harness/flagę, nie przez kliknięcie w UI (patrz G'/Status).

### C' · DANE + REGUŁY (premium DOC)
- **Flaga tieru:** `ENABLE_DELIVERABLES_PREMIUM` (`server/src/services/deliverableGenerationTier.ts`, **default OFF** — `resolveDeliverableTier` fail-open → `STANDARD` przy braku flagi/błędzie). `VITE_ENABLE_DELIVERABLES_LIGHT` (build-time Vite) steruje ścieżką generacji R w FE; OFF na Railway = „nigdy nie działało" ([[finding_deliverables_vite_flag_deploy]]).
- **Block types (kanon `documentStudioTypes.ts`):** `text`/`heading`/`bulletList`/`numberedList`/`quote`/`callout`/`chart`(bar/line/pie/donut/scatter/area)/`table`/`kpi`/`image`/`divider`.
- **Bramki B3 (quality-gate struktury):** ≥1 typed block (nie sama proza) · ≥1 `heading` per dokument >1 strona · `citations[]`/`source_refs[]` osobno od prozy.
- **Renderer eksportu (X-series):** X1 `playwrightPdfRenderer.ts` (`renderHtmlToPdf`/`renderHtmlToPng`, typed-result, no-throw); X3 rasteryzacja wykresów `documentChartRasterizer.ts` (`chartjs-node-canvas`, 6 typów, fallback `null`); DOCX/PDF `documentDocxRenderer.ts`/`documentPdfRenderer.ts`.

### D' · AI — generatory (kręgosłup premium DOC)
- **B3 struktura:** `server/src/services/documentStudio/documentStructureGenerator.ts` — LLM dobiera typy bloków per sekcja (kpi/callout/table/chart/…), kalibracja liczby bloków per tier/typ dokumentu.
- **content-gen treść:** `server/src/services/documentStudio/documentBlockContentGenerator.ts` — LLM wypełnia bloki treścią per sekcja.
- **Runner FT-6 (plain-node, NIE vitest):** `scripts/deliverables/live-pilot-ft6.mts` (SDK structured pada pod vitest). Scoring `scoreDoc` (`tests/integration/deliverables/scoring/docScoring.ts`).

### F' · EPIKI → STORIES → ZADANIA (premium DOC, traceable do B3/R1-R3/X1/X3)

- **EPIK-G1 — B3 struktura premium (mózg):** [B3-S01..S08, B-series]
  - Story G1.1: LLM dobiera bogate typy bloków per sekcja (≥5 distinct block types w raporcie wielosekcyjnym). Gherkin: *dany* intent raportu diagnostycznego 8 sekcji · *gdy* B3 planuje strukturę · *wtedy* schema zawiera ≥1 `kpi`+`table`+`chart`+`callout`+`bulletList`. [→ B3-S02]
  - Story G1.2: kalibracja liczby bloków (memo nie nad/niedoprodukowane). [→ B3-S03, **bug-2 fixed**]
  - Story G1.3: kontrakt Zod — każdy `block.type ∈ DocBlockType` (11), brak nieznanych. [→ B3-S08]
- **EPIK-G2 — content-gen treść (jakość, nie tylko struktura):** [B3-S01/S04]
  - Story G2.1: content-gen wypełnia KAŻDY blok realną treścią — **0 placeholderów** („awaiting content"/`[TODO]`). Gherkin: *dany* raport ≥6 sekcji · *gdy* content-gen kończy · *wtedy* żaden blok nie ma treści-zaślepki. [→ B3-S01, **bug-1 fixed**]
  - Story G2.2: jakość prozy domenowa (`anyTextContains` + ocena ekspercka ≥4/5, brak „wody"/halucynacji). [→ B3-S04]
- **EPIK-G3 — grounding + i18n:** [B3-S05/S06]
  - Story G3.1: cytowania wskazują dostarczone źródło (nie zmyślone), `citations[]` osobno. [→ B3-S05]
  - Story G3.2: nagłówki/treść w żądanym języku PL/EN. [→ B3-S06]
- **EPIK-G4 — render bloków w jakości docelowej (R1-R3):** [R-series]
  - Story G4.1: tabela/wykres(recharts)/KPI-strip/callout renderują się wizualnie, spójne dark/light. [→ R1-S03..S06, R3-S01..S06]
- **EPIK-G5 — parytet eksportu (X1/X3):** [X-series]
  - Story G5.1: DOCX/PDF NIESIE wykresy/tabele/kolory (nie degradacja do tekstu); wykresy rasteryzowane (X3). Gherkin: *dany* raport z wykresem · *gdy* export PDF · *wtedy* PNG wykresu osadzony, nie pominięty. [→ X1-S0x, X3, rubryka G8]
- **EPIK-G6 — head-to-head vs Kimi/Claude (FT-7):** [MQ-R11, VTS_GOLDEN doc]
  - Story G6.1: na złotym temacie VTS (diagnoza gotowości AI) nasz doc ≥ referencja na każdym wymiarze 3C. [→ MQ-R11]
- **EPIK-G7 — wpięcie premium w żywy UI:** [BLOCKED]
  - Story G7.1: flaga `ENABLE_DELIVERABLES_PREMIUM` ON na Railway + premium wpięte w intake/canvas/studio + deploy + live-verify. **NIE wykonane** — patrz Status.

### G' · JAKOŚĆ / DoD (premium DOC — 7 kryteriów globalnych + bramka FT-6 ≥85%)

| # | Kryterium (DoD globalny) | Stan premium DOC | Dowód |
|---|---|---|---|
| 1 | Front↔back (feature działa, kontrakt) | 🟡 **kod-side TAK / UI NIE** — B3+content-gen działają w runnerze; w żywym UI intake = „deterministic first draft" (premium niewpięte) | `scripts/deliverables/live-pilot-ft6.mts`; B-series §0 |
| 2 | Bezpieczeństwo / fail-open | 🟢 `resolveDeliverableTier` fail-open → STANDARD (no-throw); runner `DOTENV_IGNORE_LOCAL=1` (nie dotyka PROD) | `deliverableGenerationTier.ts:67`; B-series §0 |
| 3 | i18n PL/EN treści | 🟡 mierzone B3-S06 (heurystyka językowa); golden doc PL | scenariusze M18_REPORTS |
| 4 | Render/grafika (recharts + export parytet) | 🟡 render R1-R3 + parytet X1/X3 — **manual-pending** (UI niewpięte do live-verify) | R-series, X-series |
| 5 | §27 / kanon | N/D dla generatora (edytor 3-szynowy) | — |
| 6 | E2E w gate | 🟡 Scoring-auto (FT-6 runner) działa; Manual-UI BLOCKED do wpięcia | B-series §8 |
| 7 | **Bramka jakości FT-6 ≥85% (Q1)** | 🟢 **SPEŁNIONA na próbce golden** — patrz niżej | `runs/2026-06-23-…sonnet46.json` |

**Bramka FT-6 (Q1 = ≥85% wszystkich formatów; rubryka §1):**
- **DOC avg = 92%** na próbce 3 golden (Sonnet 4.6, PREMIUM, `fallbackUsed=false`):
  - **S06 [Med] = 100% PASS** (4 sekcje, 30 bloków, 9 distinct block types: heading/text/kpi/callout/numberedList/table/chart/bulletList/quote).
  - **S16 [Lrg] = 100% PASS** (8 sekcji, 68 bloków, 9 distinct typów + image).
  - **S01 [Sml] = 75%** (jedyny fail: 11 bloków vs oczekiwane 5-7 — over-production na memo, miękki sygnał kalibracji, nie placeholder).
- **Skok jakości:** doc poszedł **32% → ~100%** na realistycznych wejściach (S01/S06/S16/S19 100% w sesji 2026-06-22). 32% w poprzednim pilocie to była PODŁOGA (content-gen timeout), nie miara mózgu — patrz [[finding_deliverables_ft6_pilot_blocker]].
- **Caveat wydajność:** duże dokumenty wolne — **S16 ~226s, S19 ~267s** (kończą się, ale minuty latencji). Decyzje jakości: Q1=≥85% wszystkie formaty · Q3=VTS golden topic · Q5=Unsplash.
- **Sample VTS (McKinsey-grade, realny):** [`docs/qa/deliverables/runs/2026-06-22-VTS-generated.md`](../../docs/qa/deliverables/runs/2026-06-22-VTS-generated.md).

### H' · GOVERNANCE (premium DOC) — 2 zamaskowane bugi NAPRAWIONE

| ID | Opis | Dowód / mechanizm | Klasa | Status |
|----|------|--------------------|-------|--------|
| GL-01 | **Per-section content schema `z.record` niespełnialny dla strict Anthropic `generateObject`** na bogatych sekcjach → 4 retry → circuit-breaker OPEN → reszta dokumentu kaskadowo PLACEHOLDER, **podczas gdy structural scorer dalej czytał 100%** (maskowanie: struktura zielona, treść pusta) | naprawione: schema na **JSON-string + tolerant parser**; content-gen przepisany per-sekcja (247s→27s) | P0-jakość | **ZAMKNIĘTA 2026-06-22** |
| GL-02 | **B3 block-count miscalibration** — memo nad/niedoprodukowane (zła liczba bloków per tier/typ) | kalibracja liczby bloków w B3; rezydualny miękki sygnał: S01 11 bloków vs 5-7 (B3-S03) | P1-jakość | **ZAMKNIĘTA (rezydualnie miękka na Sml)** 2026-06-22 |

> **Dlaczego GL-01 jest ważny:** to klasyczny „zielony scorer maskuje martwy mózg" — bramka strukturalna mówiła 100%, a treść była zaślepką. Naprawa = bramka FT-6 zaczęła mierzyć REALNY mózg. Bez tej naprawy avg „32%" wyglądało jak słaby model, a faktycznie był to circuit-breaker. Reużywalna lekcja: **scorer strukturalny ≠ scorer treści — placeholder-cascade trzeba wykrywać osobno** (patrz testy manualne MQ-R, krok „NO placeholder cascade").

### Status premium DOC (uczciwie — 2026-06-23)
- **Jakość premium UDOWODNIONA kod-side: ~100%** na golden (S06/S16 100% PASS, avg 92%, PREMIUM bez fallbacku). 2 zamaskowane bugi (GL-01 schema-cascade, GL-02 block-count) **naprawione**.
- **NIE wpięte w żywy UI** — intake Document Studio = „deterministic first draft"; flaga `ENABLE_DELIVERABLES_PREMIUM` default OFF + niewpięte w chat→canvas→studio. Manual-UI/head-to-head/render-parytet = **BLOCKED do wpięcia + deploy** (EPIK-G7). Nie wolno raportować „jakość UI potwierdzona" dopóki nie ma żywego LLM przez UI ([[rule_verify_before_claiming]]).
- **NEXT (kolejność):** odblokować EPIK-G7 (flaga Railway + wpięcie + deploy) → live-verify R1-R3 render + X1/X3 parytet → MQ-R head-to-head vs Kimi/Claude na VTS golden → karty odbioru §6 rubryki.
