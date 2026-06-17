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
| L-01 | trwałość 6/8 warstw in-memory → utrata po deployu | W-01,W-03,W-04 | mig. `780`+`781`; 6 DAO przepisane na Postgres (0 `new Map`, INSERT+UPSERT) | P1 | 1 | **NAPRAWIONA w kodzie 2026-06-13** (`953955bc2b`+`8d2b5d8cf4`; tsc czysty, eksporty 1:1) — **cold-start proof na staging pozostaje (R6)** | 2026-06-13 |
| L-02 | S4 test mockuje DAO (nie dotyka PG) | W-01 | `evidence/f2_tests_report.md` (S4 `vi.mock`) | P0-test | 1 | otwarta |  |
| L-03 | S6 bramka testowana na serwisie, nie route 403 | W-01 | `document-studio.routes.ts:3386,3394`, grep `qa_blocking` w testach=0 | P0-test | 1 | otwarta |  |
| L-04 | Mode3 wymusza `useLlm:false` → placeholder | W-01 | `documentStudioService` | P2 | 2 | otwarta (**D-02**) |  |
| L-05 | template approve/deprecate bez roli serwerowo | W-01 | `document-studio.routes.ts:616,642`→`documentTemplateService.ts:429-475` | P2 | 3 | otwarta |  |
| L-06 | beta-lock nawigacyjny + brak rate-limit share + over-disclosure `organizationId` | W-01 | `AppRoutes.tsx:2082`; `/share-links/resolve`; consumer | P2/P3 | 3 | **CZĘŚCIOWO — beta-lock NAPRAWIONA: `<BetaGate moduleId="MODULE_DOCUMENT_STUDIO">` owija `/document-studio` (`AppRoutes.tsx:2105`); brak rate-limit/revoke + over-disclosure `organizationId` = pozostałe sub-luki Faza 3** | 2026-06-17 |
| L-07 | `DocumentStudioView` nie używa MELS (ręczny header) | W-01 | `DocumentStudioView.tsx:193-219` | P2 | 3 | otwarta |  |
| L-08 | lista szablonów ad-hoc `<ul>` + silent-fail | W-01 | `DocumentStudioTemplateArchitectView.tsx:302` | P3 | 4 | otwarta |  |
| L-09 | i18n EN-only (`useTranslation` w 2 plikach) | W-01 | `DocumentStudio/*` (grep `useTranslation`=2) | P2 | 4 | otwarta |  |
| L-10 | ~40 klas koloru Tailwind (sky/emerald/amber/rose) | W-01 | `DocumentStudio/*` (grep 2026-06-13) | P3 | 4 | otwarta |  |
| L-11 | kręgosłup czat→doc (deliverable z czatu) | W-02 | `SPEC_ZADANIE_01` | P0-program | 0 | zależność (śledzona w SPEC_01) |  |
| L-12 | duplikat migracji `776 … 2.sql` (byte-identyczny) | W-04 | `server/migrations/776…2.sql` (`diff -q`=IDENTICAL) | P3 | 4 | otwarta (**D-03**) | 2026-06-13 |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-02 | Mode3 generate z szablonu | pozwolić `useLlm:true` (proza) / jawnie oznaczyć szkielet w UI | Piotr | TBD | otwarta (modułowa) |
| D-03 | duplikat migracji `776 … 2.sql` | usunąć duplikat (byte-identyczny, bezpieczne) / zostawić | Piotr | TBD | otwarta (modułowa) |

### 05 · Flagi / rollout — beta-closed; mount BE bez `v8FeatureGate` (zawsze ON na BE — beta-lock tylko nawigacyjny). Override QA role-gated. Migracje 776/`20260603`/769 zastosować na staging; **migracja wave5 dla 6 warstw in-memory = warunek trwałości**.
### 06 · Ryzyka — cold-start proof to dowód live na trwałość 3/8 warstw (kod = poszlaka mocna); 6/8 warstw (approvals/content-blocks/brand-voice/audience/source-packs/share-links) realnie in-memory → utrata po deployu DO NAPRAWY (mig.wave5); duplikat mig.776 (D-03); 889 zielonych testów MASKUJE S4 (mockują DAO → nie wykryją 6/8 in-memory); dev `.env` → Railway PROD.
### 07 · Log — 2026-06-11: re-audit A:18→21, B:8→12 (W5 potwierdziło write-through dla wersji/komentarzy + mig.776), 54/100. 2026-06-13 (teczka pogłębiona): R3 ZAOSTRZONA grepem `INSERT INTO` per-DAO → **3/8 persystują, 6/8 in-memory**; C rozbite na per-warstwowy model + enum 96 endpointów + bramka QA `:672`; L-12 duplikat mig.; F na Gherkin. **2026-06-13 (egzekucja Fazy 1): L-01 NAPRAWIONA — 6/8 warstw przepisane Map→Postgres (mig.`780` approvals + `781` 5 warstw = 10 tabel; commity `953955bc2b`+`8d2b5d8cf4`; tsc documentStudio czysty).** Pozostaje cold-start proof na staging. Re-ocena C/D po cold-start + S4/S6 realnych.

---

## Bramka teczki: 9/9 dokumentacyjnie ✅
R1 wejścia (karta+INV_E+uwaga #1+weryfikacja per-DAO) · R2 zero sierot · R3 statusy z dowodem (**L-01 zaostrzona: 3/8 warstw `INSERT INTO`+migracja persystują, 6/8 nagłówek DAO „in-memory wave5 pending" — korekta obu zgrubnych ujęć karty**; L-12 z `diff -q`; L-11 zależność) · R4 DoD z liczbami (grep i18n=4, hex=0, `useTranslation`=2, `<table>`=0) · R5 decyzje z właścicielem (D-02/D-03) · A–E docelowy zlinkowany (C per-warstwowy model + 3 tryby + enum API) · F epiki→stories Gherkin↔luki · G DoD+S+sec · R6 sesja żywa = Faza 4 + cold-start. **Teczka kompletna do egzekucji.**
