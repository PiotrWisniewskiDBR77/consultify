# TECZKA M18 — Dokumenty (Document Studio)

> Teczka = **cienki indeks + reconciliation**, NIE duplikat. Linkuje kartę audytu + INV_E + kod i dokłada brakujące ogniwa (Rejestr Wejść z uwagami żywymi · Rejestr Decyzji · DoD z liczbami · korekta staleności R3). Wzór: [`_WZORZEC_TECZKI.md`](_WZORZEC_TECZKI.md), referencja: [`M13-inicjatywy.md`](M13-inicjatywy.md).

## 00 · Nagłówek
- **Moduł:** M18 Document Studio · **Pula:** beta (closed; mount BE bez `v8FeatureGate` — zawsze włączony)
- **Ocena audytu:** 54/100 · **Tier:** Alpha · **Status:** FAZA 1 (cold-start proof) → FAZA 3/4 · **Rozmiar:** M-L (2–4 dni)
- **Żywy bloker:** brak P0 (P1 „data-loss in-memory" — **STALE-zweryfikowane**, patrz R3; do cold-start proof)
- **Właściciel:** Piotr · **Daty:** karta 2026-06-11 · teczka 2026-06-13
- **Karta:** `Harvard/modules/M18-dokumenty/KARTA_AUDYTU.md` · **Evidence:** `…/evidence/f1_code_truth.md`, `f2_tests_report.md`, `f56_kanon_sec.md` · **INV_E:** `…/INV_E_outputs_studia_meeting.md` (DOKUMENTY poz.1-9)
- **Kod:** `src/components/DocumentStudio/` (View/IntakeForm/Outline/Editor/QA/DocumentPanel/TemplateArchitect) · `server/src/services/documentStudio/` (`documentVersionSnapshotRegistryDao.ts`, `documentCommentsRegistryDao.ts`, `documentStudioService.ts`) · `server/src/routes/document-studio.routes.ts` · migracje `776_document_studio_wave5_persistence.sql`, `20260603_document_studio_editor_state.sql`, 769 (templates)

## MAPA POKRYCIA
| Warstwa | Stan | Źródło (istnieje) | Co dokłada teczka |
|---|---|---|---|
| A Intencja | 🟢 | karta §0 + INV_E DOKUMENTY | job-to-be-done + zakres (niżej) |
| B UX docelowe | 🟡 | karta §5 (MELS, ale View go nie używa — L-07) | delta MELS + i18n |
| C Dane+API+reguły | 🟢 | karta §1e/§1f + DAO + migracje | model + write-through (niżej, R3) |
| D AI/Teresa | 🟢 | karta §1a (Mode1/2/3 + edytor proposalowy 6 poz.) | Mode3 placeholder (L-04) |
| E Integracje | 🟢 | karta §1g | — |
| F Epiki | 🟢 | karta §7 (3 fale) | epiki (niżej) |
| G DoD/jakość | 🟢 | karta §0/§2/§7 | **liczby grep 2026-06-13** (niżej) |
| H Governance | 🟢 (dołożone) | karta §1/§6 | **Rejestr Wejść + Decyzji + korekta R3** |

---

## A · INTENCJA *(link + uzupełnienie)*
- **Job-to-be-done:** wytworzyć dokument doradczy end-to-end — od intake/outline (Mode1), przez szablon firmowy (Template Architect, Mode2/3), edytor proposalowy z approve/reject, po eksport za bramką QA i publiczny share.
- **Persony/role:** konsultant (autoring), członek org (edycja w obrębie org), admin/owner (approve/deprecate szablonów firmowych — **wymaga gatingu, L-05**), publiczny konsument share-linka (read sanitizowany). Override QA-gate role-gated `SUPERADMIN/OWNER/ADMIN/PM/MANAGER`.
- **Zakres v1:** Mode1 intake→outline→document (LLM) · Mode2 Template Architect (mig.769) · Mode3 generate z szablonu · edytor proposalowy 6 poziomów · editor-state write-through (mig.`20260603`) · wersje/komentarze/approvals (mig.776) · bramka eksportu QA serwerowa · public share (whitelist 5 pól, token 256-bit HMAC, revoke+rotate). **POZA v1:** Mode3 z pełną prozą LLM (obecnie placeholder-szkielet, D-02).
- **Metryka:** wersje/komentarze przeżywają restart (cold-start); export tylko po QA; 0 ścieżek cross-org.

## B · UX DOCELOWE *(link + delta)*
- **Wzorzec:** MELS (`ExecutiveModuleShell`). **Delta L-07:** `DocumentStudioView.tsx:193-219` ma ręczny header+taby; MELS użyty tylko wewnątrz `DocumentStudioDocumentPanel.tsx:1996` → ujednolicić View na MELS.
- **Stany:** loading/error/empty pokryte; drobny silent-fail listy szablonów (`refreshApprovedTemplates` swallow→`[]`, L-08).
- **§27:** głównie N/D (edytor 3-szynowy Outline/Editor/QA); jedyna lista (szablony, `DocumentStudioTemplateArchitectView.tsx:302`) = ad-hoc `<ul>/<li>` → FilterableTable (L-08).

## C · DANE + API + REGUŁY *(link + write-through, R3)*
- **Wiring FE↔BE↔DB:** karta §1e. **Flagi:** karta §1f (mount bez `v8FeatureGate` → zawsze ON na BE; beta-lock tylko nawigacyjny, L-06).
- **Write-through (KOREKTA R3 — patrz H/02):** editor-state (`documentEditorStateRegistryDao`, mig.`20260603`, `INSERT ON CONFLICT`+lazy hydration) **+ wersje/komentarze realnie persystują** — mig.`776` tworzy `document_version_snapshots` + `document_comments`; DAO robią realny `INSERT INTO` (`documentVersionSnapshotRegistryDao.ts:103`, `documentCommentsRegistryDao.ts:114`). `Map` = cache w procesie hydrowany z DB, NIE źródło prawdy.
- **Reguły:** bramka eksportu serwerowa per-format (`QaBlockingError`→403, `documentStudioService.ts:668-686`); override role-gated `canOverrideQa`. Org-scope: `getAuthContext` z tokena → `getWave5Artifact`→`WHERE artifact_id=? AND organization_id=?` (`wave5ArtifactRuntimeService.ts:578`). Template approve/deprecate **bez gatingu roli serwerowo** (L-05).

## D · AI / TERESA *(link)*
- **Co generuje:** Mode1 intake→outline→document (LLM gdy `useLlm=true`); edytor proposalowy 6 poziomów (local/section/global/methodology/source/transformative) z approve/reject.
- **L-04 Mode3:** generate z szablonu wymusza `useLlm:false` → treść = placeholder-szkielet (kontrast z Mode1). Decyzja D-02.
- **Kręgosłup (Uwaga #1):** deliverable „z czatu zrób doc" idzie przez `UnifiedChatPanel`+pipeline→`WorkCanvasDocumentPanel` — pęknięcie więzi opisane w `SPEC_ZADANIE_01` (zależność programowa, nie lokalna luka M18). Niezweryfikowane w specu: czy standalone Document Studio reużywa tego panelu, czy to osobna powierzchnia (do potwierdzenia przy fixie #1).

## E · INTEGRACJE
Karta §1g. **WEJŚCIE ←** M17 Outputs („New AI document"→`/document-studio`). **WYJŚCIE →** M17 (rejestracja artefaktu dokumentu — **M17 approval-gate czyta stan publish/wersji M18**, zależność blokująca), pliki (md/docx/pdf za QA-gate), public (share sanitizowany). **Kręgosłup:** auto-trigger z czatu = Faza 0 (SPEC_01).

## F · EPIKI *(z karty §7, forma epików)*
- **EPIK 1 — Dowieść trwałości (P1→do re-weryfikacji):** cold-start proof S4/S7 dla 8 warstw (snapshots/comments/approvals/access-history/audit/content-blocks/brand-voice) — write-through 2/8 zweryfikowany w kodzie, potwierdzić pozostałe 6 (L-01). [Fala 1]
- **EPIK 2 — Bezpieczeństwo:** gating roli template approve/deprecate ADMIN/OWNER (L-05); beta-guard route; rate-limit public share-resolve; usunąć `organizationId` z payloadu share (L-06). [Fala 1/2]
- **EPIK 3 — Treść:** Mode3 `useLlm:true` LUB jawny szkielet w UI (L-04, D-02). [Fala 2]
- **EPIK 4 — Test prawdy:** S4 realny DAO+PG (nie `vi.mock`) + S6 HTTP route 403 `qa_blocking` (L-02/L-03). [Fala 1]
- **EPIK 5 — Kanony:** View na MELS (L-07); i18n `t()` (L-09); tokeny (L-10); lista szablonów → FilterableTable (L-08); CI `Londyn`. [Fala 3]

## G · JAKOŚĆ / DoD *(skwantyfikowane — grep 2026-06-13)*
| # | Kryterium | Miara M18 |
|---|-----------|-----------|
| 1 | Front↔back | wersje/komentarze/approvals przeżywają restart (**write-through real — kod potwierdza, cold-start proof = dowód live**); Mode3 proza lub jawny szkielet; 0 martwych przepływów |
| 2 | Bezpieczeństwo | template approve/deprecate role-gated (403 bez roli); beta-guard route; rate-limit share; org-scope (już czysty); override QA role-gated (już) |
| 3 | i18n | **4 z 4** `isPolish` w `src/components/DocumentStudio` (grep 2026-06-13 = **4**); realny dług = **EN-only** (`useTranslation` tylko w 2 plikach) → `t()` w View/IntakeForm/Outline/DocumentPanel/TemplateArchitect |
| 4 | Tokeny | **0 hex `#RRGGBB`** w `DocumentStudio` (grep = 0); **~40 klas Tailwind sky/emerald/amber/rose** (grep 2026-06-13) → tokeny + `EntityStatusChip` (karta „~150" liczyła szerzej/inne wzorce) |
| 5 | §27 | **0** surowych `<table>` (grep = 0); lista szablonów = ad-hoc `<ul>/<li>` → FilterableTable; View → MELS |
| 6 | E2E w PR-gate | S4 (realny DAO+PG cold-start), S6 (route 403 `qa_blocking`) zielone na `Londyn` |

Scenariusze S1–S8: karta §0/§2 (889 PASS/0 FAIL — najlepszy wolumen, ale S4 mockuje DAO). Bezpieczeństwo: karta §6.

## H · GOVERNANCE *(dołożone ogniwa)*

### 01 · Rejestr wejść (R1)
| ID | Źródło | Data | Treść (1 zd.) | → Luka |
|----|--------|------|----------------|--------|
| W-01 | Karta audytu §1–§7 | 2026-06-11 | 54/100; org-scope czysty; **sprzeczność persystencji** (re-audit: write-through real vs §1c: fasada) | L-01..L-10 |
| W-02 | **Uwaga żywa #1** (`SPEC_ZADANIE_01`) | 2026-06-13 | kręgosłup czat→panel pęka — „z czatu zrób doc" idzie tędy → M18 dotknięty zależnością | L-11 (zależność) |
| W-03 | INV_E DOKUMENTY poz.1-9 | 2026-06-11 | inwentarz „[DZIAŁA]" dla wersji/komentarzy — do potwierdzenia cold-start | L-01 |
| W-04 | Feedback prod (kohorta beta) | — | brak własnej uwagi żywej M18 z 2026-06-13 | — (dziedziczy z karty + #1) |

### 02 · Stan obecny (prawda kodu) — **KOREKTA R3**
**Karta jest wewnętrznie sprzeczna:** §1c trzyma „P1 fasada-in-memory" (`documentVersionSnapshotService.ts:50` `new Map()`), ale nagłówek re-audytu i wiersze A/B mówią write-through real (mig.776). **Weryfikacja kodu 2026-06-13 rozstrzyga na korzyść re-audytu:** mig.`776_document_studio_wave5_persistence.sql` tworzy `document_version_snapshots` (l.6) + `document_comments` (l.24); `documentVersionSnapshotRegistryDao.ts:103` i `documentCommentsRegistryDao.ts:114` robią realny `INSERT INTO`; serwisy mają write-through `daoPersist*` + idempotentną hydrację z DB. `Map` = cache, nie źródło prawdy. **Wniosek: P1 „data-loss in-memory" jest STALE — wersje/komentarze przeżywają restart.** Pozostaje cold-start proof (live) + potwierdzić 6 z 8 warstw (approvals/access-history/audit/content-blocks/brand-voice) idą tym samym DAO. ⚠️ uboczne: w `server/migrations/` jest duplikat `776_…_wave5_persistence 2.sql` (artefakt kopii — sprawdzić czy nie psuje kolejności `readdirSync`, jak kolizja 725/726 w M20).

### 03 · Rejestr luk
| ID | Opis | Wejście | Dowód `plik:linia` | Klasa | Faza | **Status** | Zweryf. |
|----|------|---------|--------------------|-------|------|-----------|---------|
| L-01 | trwałość wersji/komentarzy/approvals | W-01,W-03 | `documentVersionSnapshotRegistryDao.ts:103` + mig.776 | P1 (był) | 1 | **STALE-zweryfikowane** (write-through real; cold-start proof do live) | 2026-06-13 |
| L-02 | S4 test mockuje DAO (nie dotyka PG) | W-01 | `evidence/f2_tests_report.md` (S4 `vi.mock`) | P0-test | 1 | otwarta |  |
| L-03 | S6 bramka testowana na serwisie, nie route 403 | W-01 | `document-studio.routes.ts:3386,3394`, grep `qa_blocking` w testach=0 | P0-test | 1 | otwarta |  |
| L-04 | Mode3 wymusza `useLlm:false` → placeholder | W-01 | `documentStudioService` | P2 | 2 | otwarta (**D-02**) |  |
| L-05 | template approve/deprecate bez roli serwerowo | W-01 | `document-studio.routes.ts:616,642`→`documentTemplateService.ts:429-475` | P2 | 3 | otwarta |  |
| L-06 | beta-lock nawigacyjny + brak rate-limit share + over-disclosure `organizationId` | W-01 | `AppRoutes.tsx:2082`; `/share-links/resolve`; consumer | P2/P3 | 3 | otwarta |  |
| L-07 | `DocumentStudioView` nie używa MELS (ręczny header) | W-01 | `DocumentStudioView.tsx:193-219` | P2 | 3 | otwarta |  |
| L-08 | lista szablonów ad-hoc `<ul>` + silent-fail | W-01 | `DocumentStudioTemplateArchitectView.tsx:302` | P3 | 4 | otwarta |  |
| L-09 | i18n EN-only (`useTranslation` w 2/N plikach) | W-01 | `DocumentStudio/*` (grep `useTranslation`=2) | P2 | 4 | otwarta |  |
| L-10 | ~40 klas koloru Tailwind (sky/emerald/amber/rose) | W-01 | `DocumentStudio/*` (grep 2026-06-13) | P3 | 4 | otwarta |  |
| L-11 | kręgosłup czat→doc (deliverable z czatu) | W-02 | `SPEC_ZADANIE_01` | P0-program | 0 | zależność (śledzona w SPEC_01) |  |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-02 | Mode3 generate z szablonu | pozwolić `useLlm:true` (proza) / jawnie oznaczyć szkielet w UI | Piotr | TBD | otwarta |
| D-03 | duplikat migracji `776 … 2.sql` | usunąć duplikat / zostawić (sprawdzić kolejność) | Piotr | TBD | otwarta |

### 05 · Flagi / rollout — beta-closed; mount BE bez `v8FeatureGate` (zawsze ON na BE — beta-lock tylko nawigacyjny). Override QA role-gated. Migracje 776/`20260603`/769 zastosować na staging.
### 06 · Ryzyka — cold-start proof to JEDYNY dowód live na trwałość (kod = poszlaka mocna, ale R3: dowód>kod do końca); 6/8 warstw poz.8 niepotwierdzone że idą write-through; duplikat mig.776 (D-03); 889 zielonych testów MASKUJE S4 (mockują DAO); dev `.env` → Railway PROD.
### 07 · Log — 2026-06-11: re-audit A:18→21, B:8→12 (W5 potwierdziło write-through real + mig.776), 54/100. 2026-06-13 (teczka): R3 potwierdziła write-through DAO w kodzie → L-01 STALE-zweryfikowane (nie żywa fasada); cold-start proof pozostaje. Re-ocena C po S4/S6 realnych.

---

## Bramka teczki: 9/9 dokumentacyjnie ✅
R1 wejścia (karta+INV_E+uwaga #1) · R2 zero sierot · R3 statusy z dowodem (**L-01 STALE-zweryfikowane: mig.776 + DAO `INSERT INTO` w kodzie — korekta sprzeczności karty**; L-11 zależność) · R4 DoD z liczbami (grep i18n=4, hex=0, color-class~40, `useTranslation`=2) · R5 decyzje z właścicielem · A–E docelowy zlinkowany · F epiki↔luki · G DoD+S+sec · R6 sesja żywa = Faza 4 + cold-start. **Teczka kompletna do egzekucji.**
