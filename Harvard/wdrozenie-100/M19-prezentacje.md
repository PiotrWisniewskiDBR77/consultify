# TECZKA M19 — Prezentacje (Presentation Studio P20 / DeckBuilder)

> Teczka = **cienki indeks + reconciliation**, NIE duplikat. Linkuje kartę audytu + INV_E + kod i dokłada brakujące ogniwa. Pogłębiona do poziomu PODŁOGI [`M13-inicjatywy.md`](M13-inicjatywy.md) (2026-06-13): C = **model snapshotów decka / wersji + share + override role-gate (STALE-zweryfikowane)** + enum 71 endpointów; B = DeckBuilder WYSIWYG + Hub §27 wzorcowy; F = epiki→stories Gherkin→L-xx. Wzór: [`_WZORZEC_TECZKI.md`](_WZORZEC_TECZKI.md).

## 00 · Nagłówek
- **Moduł:** M19 Presentation Studio (P20 / DeckBuilder) · **Pula:** beta (kandydat na Beta)
- **Ocena audytu:** 56/100 (najsilniejszy z trójki studiów) · **Tier:** Alpha górny · **Status:** FAZA 3 → FAZA 4 · **Rozmiar:** S-M (1–2 dni)
- **Żywy bloker:** brak P0/P1 (P1 public viewer — naprawione `1b67579d7a`; P2 override — **STALE-zweryfikowane: już role-gated**)
- **Właściciel:** Piotr · **Daty:** karta 2026-06-11 · teczka 2026-06-13 (pogłębiona)
- **Karta:** `Harvard/modules/M19-prezentacje/KARTA_AUDYTU.md` · **Evidence:** `…/evidence/f1_code_truth.md`, `f2_tests_report.md`, `f56_kanon_sec.md` · **INV_E:** `…/INV_E_outputs_studia_meeting.md` (PREZENTACJE poz.1-16)
- **Kod:** FE `src/components/Presentations/` (`PresentationsHub.tsx`, `PresentationWizard.tsx`, `SharedPresentationView.tsx`, `BrandKitSettings.tsx`, `DeckTemplateGallery.tsx` + `DeckBuilder/` ~40 plików: `DeckBuilder.tsx`, `DeckBuilderMelsView.tsx`, `TipTapEditor.tsx`, `CardCanvas/CardRenderer`, `AgentPanel`, `VersionHistoryPanel.tsx`, `ShareModal.tsx`, `PresentMode.tsx`, `CommandPalette.tsx`, `useDeckState.ts`/`useVersionHistory.ts`) · BE `server/src/routes/presentations.routes.ts` (**71 endpointów**) · migracje `752_p20_deck_version_and_history.sql`, `641` (`presentation_ai_operations`), `610` (`presentation_analytics`)

## MAPA POKRYCIA
| Warstwa | Stan | Źródło (istnieje) | Co dokłada teczka |
|---|---|---|---|
| A Intencja | 🟢 | karta §0 + INV_E PREZENTACJE | job-to-be-done + role + zakres |
| B UX docelowe | 🟢 | karta §5 (**PresentationsHub §27 wzorcowy** — najlepszy w audycie) | DeckBuilder WYSIWYG + stany + delta |
| C Dane+API+reguły | 🟢 | karta §1e/§1f + `presentations.routes.ts` | **model snapshotów/wersji + share + override role-gate (R3) + enum 71 endpointów** (niżej) |
| D AI/Teresa | 🟢 | karta §1a (agent accept/reject+revert) | link + kręgosłup #1 |
| E Integracje | 🟢 | karta §1g | M17 reopen + niezależny od M18 (niżej) |
| F Epiki | 🟢 | karta §7 (3 fale) | **epiki→stories Gherkin→L-xx** (niżej) |
| G DoD/jakość | 🟢 | karta §0/§2/§7 | **liczby grep 2026-06-13** (niżej) |
| H Governance | 🟢 (dołożone) | karta §1/§6 | **Rejestr Wejść + Decyzji + korekta R3** |

---

## A · INTENCJA *(link + uzupełnienie)*
- **Job-to-be-done:** wytworzyć i edytować deck doradczy (WYSIWYG) — od generacji pipeline V8 z czatu, przez edycję TipTap z agentem Teresą, wersjonowanie i present mode, po eksport PPTX/PDF/HTML/PNG za bramką jakości i publiczny viewer.
- **Persony/role:** konsultant (autoring/edycja), członek org (edycja w org), admin/owner (override quality-gate — role-gated `ADMIN/OWNER/SUPERADMIN`, patrz R3), publiczny viewer (read sanitizowany). Approval-ticket S5/S7 wiąże org+user+fingerprint.
- **Zakres v1:** Home + pipeline V8 (za `ENABLE_V8_GLOBAL`) · DeckBuilder WYSIWYG (TipTap, undo/redo, autosave, Command Palette, present mode) · MELS shell (default ON) · motywy/brand · agent Teresa accept/reject+revert · wersje (mig.752) · governance (audit-integrity, watchlist, alert-subscriptions) · eksporty z export-parity · Presentation Studio z single-use approval-ticketem. **POZA v1:** collaborate „Invite by email" (obecnie no-op UI — decyzja D-01).
- **Metryka:** snapshoty trwałe po restart; export tylko po quality-gate; 0 cross-org.

## B · UX DOCELOWE *(pogłębione — Hub §27 + DeckBuilder + stany)*
- **`PresentationsHub` W PEŁNI ZGODNY z §27** (`TableWithPreviewLayout:608` + `EntityStatusChip:269` + `RowActionsMenu`, jawne odwołanie canon §9.2 `:303`) — **najlepsza zgodność §27 w audycie, bez akcji.**
- **DeckBuilder WYSIWYG (`DeckBuilder.tsx` + `DeckBuilderMelsView` adapter `ExecutiveModuleShell`, `melsDeckBuilder` default ON):** TipTap edytor (`TipTapEditor.tsx`), karty/bloki (`CardCanvas`/`CardRenderer`/`EditableBlock`), undo/redo + autosave (`useDeckState.ts`), Command Palette, Present Mode, SlideSorter, ThemeSwitcher/brand-kit, AgentPanel (Teresa), VersionHistoryPanel, DeckQualityGatesPanel, DeckGovernanceCardModal, DeckAuditLogModal.
- **Stany ekranu:** pokryte; `GET /decks` bez schematu → `{data:[],unavailable:true}` (nie 500); M19 **NIE za `ENABLE_V8_GLOBAL`** poza pipeline → brak ryzyka niemej pustki.
- **Delta DeckBuilder:** i18n 25× `isPolish` ternary → `t()` (L-05); hardkody kolorów 127 hex (część legitna w render, L-06); collaborate „Invite by email" stub (`ShareModal.tsx:134-171` input bez `onChange`, L-01); 1 surowy `<table>` do sprawdzenia (grep=1).

## C · DANE + API + REGUŁY *(pogłębione — model wersji/snapshotów + share + override role-gate + enum)*
- **Wiring FE↔BE↔DB:** karta §1e. **Flagi:** karta §1f (`ENABLE_V8_GLOBAL` OFF→404 tylko dla pipeline generacji; reszta modułu NIE za flagą → brak ryzyka niemej pustki; `melsDeckBuilder` default ON).
- **MODEL PERSYSTENCJI — REALNY (przeciwieństwo M18 6/8-in-memory):**
  | Warstwa | Endpoint | Tabela / migracja | Trwałość |
  |---|---|---|---|
  | snapshoty wersji decka | `PUT /decks/:deckId/autosave`→`INSERT INTO presentation_deck_versions` (`presentations.routes.ts:2161,2320`) | `752_p20_deck_version_and_history.sql` (FK+indeksy) | ✅ przeżywa restart |
  | restore | `POST /decks/:deckId/versions/:versionId/restore` (realny `dbGet`/`dbAll`) | 752 | ✅ |
  | agent-history (Teresa edits) | `/decks/:deckId/agent-history`(+revert/bulk-revert/accept/reject) | `presentation_ai_operations` (mig.641) | ✅ |
  | analytics (share views) | `/decks/:deckId/analytics`(+view) | `presentation_analytics` (mig.610) | ✅ |
  | lokalne 5-min checkpointy | klient | — | świadomie efemeryczne (`persisted:false`); każdy autosave i tak pisze trwały wiersz |
- **Bramka jakości eksportu (serwerowa):** `enforceQualityGateForExport:358`→422 na 4 ścieżkach (html/pdf/png/download) + legal-hold + confidentiality. **Override role-gated (R3 — STALE-zweryfikowane):** `allowOverride: ['ADMIN','OWNER','SUPERADMIN'].includes(req.user?.role||req.userRole||'') && String(req.query.overrideQualityGate)==='true'` w 4 miejscach (`:1465,1607,1925,5779`); `enforceQualityGateForExport:366` honoruje `allowOverride` tylko gdy rola pasuje (`if (!report.canExport && !params.allowOverride)`) → **nie-admin z paramem NIE omija bramki.** Pierwotny finding „override bez roli" jest STALE — pozostaje tylko TEST regresji role-gate, bez zmiany kodu.
- **Org-scope (czysty):** `getOrgId` z tokena `:184` (44× `AND organization_id=?`, 18/19 endpointów `:deckId`). **WYJĄTEK:** analytics-beacon `POST /decks/:deckId/analytics/view` (`:5923`) `WHERE id=?` bez org (auth-only write telemetrii, nie ujawnia treści — L-04). Approval-ticket S5/S7 wzorcowy (single-use, org+user+fingerprint, `/generate` bez ticketu→403).
- **Enum API (71 endpointów, grupy):** decks CRUD (`GET/POST /decks`, `/decks/:id`, download/share) · autosave/versions/restore · agent-edit (+accept/reject/history/revert/bulk-revert) · export (html/pdf/png/parity) · quality-gates/governance-card/audit-log/runtime-events · generate (deck/outline) · brand-kit/style-profile/templates(+clone/governance/lineage/transition) · governance (watchlist+presets+saved-searches, alert-subscriptions+rotate-secret+dashboard-tokens, alerts playground) · operations (health/SLO/audit-integrity) · `/shared/:token` (public sanitizowany).

## D · AI / TERESA *(link + kręgosłup)*
- **Co generuje:** deck przez pipeline V8 (za flagą, `/generate/deck`+`/generate/outline`); agent-edit accept/reject + revert/bulk-revert (`presentation_ai_operations` real, mig.641).
- **Kręgosłup (Uwaga #1):** auto-trigger „z czatu zrób deck" idzie przez `UnifiedChatPanel`+pipeline→`WorkCanvasDocumentPanel` — pęknięcie więzi w `SPEC_ZADANIE_01` (zależność programowa). Do potwierdzenia przy fixie #1: czy standalone Presentation Studio reużywa tego panelu.

## E · INTEGRACJE
Karta §1g. **WYJŚCIE →** M17 Outputs (rejestracja decka + reopen `?artifactId=`), pliki (PPTX/PDF/HTML/PNG za quality-gate), public (`/presentations/shared/:token`). **Przekrój** M01/Teresa (agent-edit + auto-trigger z czatu — Faza 0 kręgosłup). **NIEZALEŻNY od M18** (persystencja własna, realna mig.752/641/610 — szlif równolegle, nie czeka na trwałość M18). Public-viewer fix współdzielony z M17 (`1b67579d7a`, wspólny endpoint `normalizeDeckRow` whitelist).

## F · EPIKI → STORIES → ZADANIA *(pogłębione, Gherkin → L-xx)*
- **EPIK 1 — Domknąć stub:**
  - Story 1.1: jako użytkownik chcę zaprosić współpracownika emailem LUB nie widzieć martwej kontrolki.
    - Gherkin: *gdy* wpiszę email i kliknę „Invite" · *wtedy* zaproszenie wysłane (handler+permisje); *ALBO* zakładka ukryta w v1. [Z → **L-01**, D-01]
- **EPIK 2 — Bezpieczeństwo:**
  - Story 2.1: beta-guard route; rate-limit+revoke share. Gherkin: *gdy* direct URL · *wtedy* plate; *gdy* revoke · *wtedy* link martwy. [Z → **L-03**]
  - Story 2.2: org-scope analytics-beacon. Gherkin: *gdy* beacon na deck innej org · *wtedy* odrzucony/scoped. [Z → **L-04**]
  - Story 2.3: **TEST regresji override role-gate (kod już gated `:1465`, R3 — bez zmiany kodu).** Gherkin: *dany* user nie-admin · *gdy* `?overrideQualityGate=true` na decku `canExport=false` · *wtedy* 422 (nie omija). [Z → **L-02**]
- **EPIK 3 — Test prawdy:**
  - Story 3.1: naprawa 15 vacuous testów p20 (realny webServer/supertest lub skreślić); round-trip snapshotów na DB S4; route 422 S5. Gherkin: *gdy* autosave→snapshot→restore na realnym DB · *wtedy* wiersz w `presentation_deck_versions` odtworzony. [Z → **L-07**]
- **EPIK 4 — Kanony:**
  - Story 4.1: i18n DeckBuilder `t()` [Z → **L-05**]; tokeny (127 hex, część legitna render) [Z → **L-06**]; sprawdzić 1 surowy `<table>`; CI `Londyn`.

## G · JAKOŚĆ / DoD *(skwantyfikowane — grep 2026-06-13)*
| # | Kryterium | Miara M19 |
|---|-----------|-----------|
| 1 | Front↔back | collaborate działa lub ukryte (`ShareModal.tsx:134-171`); snapshoty trwałe po reload+restart (**już real `:2161,2320` mig.752 — udowodnić testem S4**); 0 martwych przycisków |
| 2 | Bezpieczeństwo | beta-guard route; share rate-limit+revoke; analytics org-scoped (`:5923`); **override role-gated (już w kodzie `:1465,1607,1925,5779` — test regresji)**; org-scope czysty (`:184`); public viewer sanitizowany (zrobione `1b67579d7a`) |
| 3 | i18n | **30 z 30** `isPolish` w `src/components/Presentations` (grep 2026-06-13 = **30**; karta podawała 25× w samym DeckBuilder) → `t()` |
| 4 | Tokeny | **127 hex `#RRGGBB`** w `Presentations` (grep 2026-06-13; karta „10/30 plików") → tokeny (część legitna w DeckBuilder render — potwierdzić przy sweepie) |
| 5 | §27 | **1** `<table>` (grep 2026-06-13); Hub wzorcowy `TableWithPreviewLayout` → utrzymać, sprawdzić ten 1 surowy `<table>` |
| 6 | E2E w PR-gate | S4 (realny DB round-trip), S5 (route 422), bez fałszywej zieleni — zielone na `Londyn` |

Scenariusze S1–S8: karta §0/§2 (293 PASS/0 FAIL, ale **15/21 integracyjnych = fałszywa zieleń** `fetch localhost:3001` z `if(status!==201)return` bez serwera). Bezpieczeństwo: karta §6.

## H · GOVERNANCE *(dołożone ogniwa)*

### 01 · Rejestr wejść (R1)
| ID | Źródło | Data | Treść (1 zd.) | → Luka |
|----|--------|------|----------------|--------|
| W-01 | Karta audytu §1–§7 | 2026-06-11 | 56/100; persystencja realna; jedyny stub collaborate; P2 override (wg karty bez roli) | L-01..L-07 |
| W-02 | **Uwaga żywa #1** (`SPEC_ZADANIE_01`) | 2026-06-13 | kręgosłup czat→panel pęka — „z czatu zrób deck" idzie tędy → M19 dotknięty zależnością | L-08 (zależność) |
| W-03 | INV_E PREZENTACJE poz.1-16 | 2026-06-11 | 15/16 REALNE; brak STALE „[DZIAŁA]" (persystencja realna) | — |
| W-04 | **Weryfikacja kodu override `:1465`** | 2026-06-13 | `allowOverride:[ADMIN/OWNER/SUPERADMIN]` w 4 miejscach — finding „bez roli" STALE | L-02 |
| W-05 | Feedback prod (kohorta beta) | — | brak własnej uwagi żywej M19 z 2026-06-13 | — (dziedziczy z karty + #1) |

### 02 · Stan obecny (prawda kodu) — **KOREKTA R3 (2 punkty)**
**(1) P1 public viewer over-disclosure — NAPRAWIONE** (`1b67579d7a`, `normalizeDeckRow` whitelist; wspólny fix z M17). **(2) P2 `?overrideQualityGate` bez roli — STALE.** Weryfikacja kodu 2026-06-13: `presentations.routes.ts:1465,1607,1925,5779` ma `allowOverride: ['ADMIN','OWNER','SUPERADMIN'].includes(req.user?.role||req.userRole||'') && String(req.query.overrideQualityGate)==='true'`, a `enforceQualityGateForExport:366` (`if (!report.canExport && !params.allowOverride)`) honoruje `allowOverride` tylko gdy rola pasuje → **nie-admin z paramem NIE omija bramki.** Pierwotny finding „override bez roli" jest STALE-zweryfikowane; pozostawić tylko TEST regresji role-gate, bez zmiany kodu. Reszta: persystencja realna (mig.752/641/610 — przeżywa restart, `INSERT INTO presentation_deck_versions:2161`), §27 Hub wzorcowy. Collaborate „Invite by email" = czysty no-op UI (`ShareModal.tsx:134-171`).

### 03 · Rejestr luk
| ID | Opis | Wejście | Dowód `plik:linia` | Klasa | Faza | **Status** | Zweryf. |
|----|------|---------|--------------------|-------|------|-----------|---------|
| L-01 | collaborate „Invite by email" = no-op UI | W-01 | `Presentations/DeckBuilder/ShareModal.tsx:95-107` | P3 | 3 | **ZAMKNIĘTA (DP-5)** — zakładka „Collaborate" ukryta za `VITE_ENABLE_DECK_COLLABORATE` (default OFF); martwa kontrolka nie renderuje się; re-enable flagą gdy powstaną handlery invite | 2026-06-17 |
| L-02 | override quality-gate „bez roli" | W-01,W-04 | `presentationExportGate.ts` (`canOverrideQualityGate`) | P2 (był) | 1 | **ZAMKNIĘTA** — predykat role-gate wydzielony (behaviour-identyczny, 4 call-site DRY) + test regresji: nie-admin+param → 422 nie omija; `export-quality-gate.regression.test.ts` (10/10 PASS) | 2026-06-17 |
| L-03 | beta-lock nawigacyjny + share bez rate-limit/revoke | W-01 | `presentations.routes.ts` (share POST/DELETE) | P2 | 3 | **ZAMKNIĘTA** — beta-lock (`<BetaGate MODULE_PRESENTATIONS>` `AppRoutes.tsx:1989`) + **rate-limit 30/min** na share + **`DELETE /decks/:id/share` revoke** (nuluje `share_token` → viewer `WHERE share_token=?` martwy, org-scoped+audited) | 2026-06-17 |
| L-04 | analytics-beacon cross-org (`WHERE id=?` bez org) | W-01 | `presentations.routes.ts:5980-5981` | P3 | 3 | **ZAMKNIĘTA** — beacon org-scoped: `WHERE id=? AND organization_id=?` (linia 5980-5981); nieznany deck innej org → 404; komentarz w kodzie „SEC (M17 wave-5): org-scope the deck lookup"; false positive | 2026-06-17 |
| L-05 | DeckBuilder 25× `isPolish` (grep całość 30×) | W-01 | `Presentations/*` | P2 | 4 | **NAPRAWIONA (kod) — NIE ZAMKNIĘTA** `091064b8f9` — `src/components/Presentations/` ma **0 `isPolish`** (zweryfikowane grepem) + 0 bare-missing kluczy (skrypt `check-bare-missing.cjs`). **(skoryg. 2026-06-19: status TRZYMANY jako PENDING, nie ZAMKNIĘTA — żywy preview PL/EN wymaga auth i czeka na sesję żywą Piotra; flip do ZAMKNIĘTA dopiero po wizualnym potwierdzeniu PL/EN.)** |  |
| L-06 | hardkody kolorów (127 hex grep — część legitna render) | W-01 | `Presentations/*` (grep 2026-06-17=139) | P3 | 4 | **ZAMKNIĘTA jako LEGALNE** — pomiar 139 hex; 100% data-viz/deck-theme/brand-palette wg DP-8 (wizard/types.ts 117 motywy+chartPalette, useCollaboration 12 kursory, DeckThemeContext 5 + ThemeSwitcher 4 model DeckTheme, DeckBuilder 1 gradient cover); 0 chrome; 0 zamienione — przekraczają granicę app→eksport (PPTX/PDF nie rozwiąże `var(--)`), muszą być literalne. Audit confirmed: Fala 5 sweep. | 2026-06-17 |
| L-07 | 15/21 testów p20 fałszywa zieleń + S4/S5 niezweryfikowane | W-01 | `evidence/f2_tests_report.md` | P0-test | 1 | **ZAMKNIĘTA `e33bd8fe56` (2026-06-17)** — S4 round-trip `deck-version-roundtrip.contract.test.ts` (6/6 PASS) + S5 422-gate `export-quality-gate.regression.test.ts` (10/10 PASS) + **15 vacuous network-testów → `it.skip([caboose])` z komentarzem** (`p20-lifecycle.test.ts` 10×, `p20-export-resilience.test.ts` 2×, `confidentiality-controls.test.ts` 3×); usunięto `expect(true).toBe(true)` safety-nety; etykieta `[caboose]` umożliwia grep re-enable; 0 testów always-pass, 0 fake-FAIL | 2026-06-17 |
| L-08 | kręgosłup czat→deck (auto-trigger z czatu) | W-02 | `SPEC_ZADANIE_01` | P0-program | 0 | **NAPRAWIONA-SPEC_01 2026-06-17 `a6aea8d2d5`+`e7bd755b04`** — Tryb A function-calling: Teresa woła `generate_deliverable(type:presentation)`→`plan/start` (generateOutline/generateDeck, domyślny DeckSetup)→SSE `deliverable`→montaż deck w canvasie. Wymaga `ENABLE_V8_GLOBAL=true` (staging ON; prod centerbeam do ustawienia). Testy 6/6. Żywe S-A E2E (auth+LLM staging) pending. | |
| L-09 | public viewer over-disclosure | W-01 | `normalizeDeckRow` | P1 | — | **NAPRAWIONA `1b67579d7a`** | 2026-06-11 |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | collaborate „Invite by email" | wpiąć handlery+permisje / ukryć zakładkę w v1 | Piotr | TBD | **ROZSTRZYGNIĘTE → DP-5: ukryj Invite-by-email** (stub za flagą + label, nie półbuduj) |

### 05 · Flagi / rollout — beta-closed; **`ENABLE_V8_GLOBAL` default=false (OFF) w `FeatureFlags.ts:31`** → pipeline generacji „z czatu zrób deck" martwy bez ustawienia env var na Railway (bloker programowy = L-08 kręgosłup; reszta modułu NIE za flagą, działa); `melsDeckBuilder` default ON; `VITE_ENABLE_DECK_COLLABORATE` default OFF (L-01 DP-5). Beta-guard route = nawigacyjny (direct URL omija plate; API org-gated).
### 06 · Ryzyka — ~~15 vacuous testów~~ ZAMKNIĘTE (`e33bd8fe56`); S4/S5 zielone; override role-gate test regresji → OK (L-02). Ryzyka: dev `.env` → Railway PROD.
### 07 · Log — 2026-06-17 (Harvard 4 Fala 5): i18n sweep M19 — **0 string literal ternaries zamienionych** (DeckBuilder.tsx wcześniej przerobiony; `const isPolish = i18n.language?.startsWith('pl')` martwa deklaracja usunięta + 8 dead `isPolish` wpisów z `useCallback`/`useMemo` dependency arrays wyczyszczone; 1 legalne `i18n.language === 'pl'` boolean prop przy `getSourceDisplayLabel` pozostawione). `keys_M19.json` = `{}`. Hex tokens M19: **0 hex zamienionych** — 139 hex = 100% data-viz/deck-theme/brand-palette (wizard/types.ts 117 motywy, useCollaboration 12 kursory, ThemeSwitcher/DeckThemeContext model, gradient cover) = DP-8 legalne (eksport PPTX/PDF nie rozwiąże `var(--)`). L-06 ZAMKNIĘTA jako LEGALNE. L-05 i18n — ZABLOKOWANA (locales poza strefą Fali 1). Commit: `d6fa2fa721` (razem z M20). — 2026-06-17 (Runda 3): L-04 ZAMKNIĘTA (false positive — beacon już org-scoped WHERE id=? AND organization_id=? :5980-5981). L-08 — śledzona jako SPEC_01, nie lokalna; zależność programowa potwierdzona (SPEC_ZADANIE_01 istnieje w `Harvard/SPEC_ZADANIE_01_chat_controller.md` — Tryb A+B: wykrywanie intencji + pęknięcie więzi czat→panel; dodatkowy bloker: `ENABLE_V8_GLOBAL` OFF → pipeline generacji marty bez env var na Railway). L-05 ZABLOKOWANA (Fala 4) — `public/locales/*` ZAKAZANE w Fali 1; wymaga koordynacji z agentem i18n; scope: 30× `isPolish` w `src/components/Presentations/`. 2026-06-13 (teczka pogłębiona): R3 — (1) override JUŻ role-gated (`:1465,:366`) → L-02 STALE; (2) public viewer naprawiony → L-09; C rozbite na model snapshotów/wersji (mig.752/641/610) + override role-gate + enum 71 endpointów; F na Gherkin. Re-ocena C po naprawie 15 vacuous testów. 2026-06-17 (Runda 3): L-04 ZAMKNIĘTA (false positive — beacon już org-scoped WHERE id=? AND organization_id=? :5980-5981). **L-08 — śledzona jako SPEC_01, nie lokalna; zależność programowa potwierdzona (SPEC_ZADANIE_01 istnieje w `Harvard/SPEC_ZADANIE_01_chat_controller.md` — Tryb A+B: wykrywanie intencji + pęknięcie więzi czat→panel; dodatkowy bloker: `ENABLE_V8_GLOBAL` OFF → pipeline generacji marty bez env var na Railway). L-05 ZABLOKOWANA (Fala 4) — `public/locales/*` ZAKAZANE w Fali 1; wymaga koordynacji z agentem i18n; scope: 30× `isPolish` w `src/components/Presentations/`.** rose→danger sweep: 34 zmiany w 13 plikach Presentations/ (chart hex DP-8 exempt) — commit `0958115c3e` (merge `7fc5a7e7f0`).

---

## Bramka teczki: 9/9 dokumentacyjnie ✅
R1 wejścia (karta+INV_E+uwaga #1+weryfikacja override) · R2 zero sierot · R3 statusy z dowodem (**L-02 STALE-zweryfikowane: override `allowOverride:[ADMIN/OWNER/SUPERADMIN]` `:1465`+`:366` w kodzie — korekta karty**; L-09 z commitem) · R4 DoD z liczbami (grep i18n=30, hex=127, `<table>`=1) · R5 **decyzja rozstrzygnięta (D-01→DP-5: ukryj Invite-by-email)** · A–E docelowy zlinkowany (Hub §27 wzorcowy + C model wersji + enum API) · F epiki→stories Gherkin↔luki · G DoD+S+sec · R6 sesja żywa = Faza 4 (pozostaje). **9/9; teczka kompletna do egzekucji.**

## EKRANY (inwentarz) — 2026-06-19

> Inwentarz powierzchni Presentation Studio (FE `src/components/Presentations/`). Format: ekran — cel — plik.

### Powierzchnie top-level
- **Presentations Hub** — lista decków = `TableWithPreviewLayout` + `EntityStatusChip` + `RowActionsMenu` (§27 wzorcowy); preview pane — `src/components/Presentations/PresentationsHub.tsx`
- **Presentation Wizard** — kreator generacji decka (pipeline V8 / DeckSetup); motywy/chartPalette — `src/components/Presentations/PresentationWizard.tsx` (+ `wizard/`)
- **Shared Presentation View (public viewer)** — publiczny, sanitizowany viewer `/presentations/shared/:token` (`normalizeDeckRow` whitelist) — `src/components/Presentations/SharedPresentationView.tsx`
- **Brand Kit Settings** — konfiguracja brand-kit/motywów — `src/components/Presentations/BrandKitSettings.tsx`
- **Deck Template Gallery** — galeria szablonów decków — `src/components/Presentations/DeckTemplateGallery.tsx`

### DeckBuilder (edytor WYSIWYG, `src/components/Presentations/DeckBuilder/`)
- **DeckBuilder (root) / MELS View** — kontener edytora; adapter `ExecutiveModuleShell` (`melsDeckBuilder` ON) — `DeckBuilder.tsx`, `DeckBuilderMelsView.tsx`, `DeckBuilderTopBar.tsx`, `DeckBuilderBottomBar.tsx`, `DeckBuilderMelsChips.tsx`, `DeckBuilderMelsRightRail.tsx`
- **Card Canvas / Card Renderer** — render i edycja kart/slajdów; TipTap edytor — `CardCanvas.tsx`, `CardRenderer.tsx`, `EditableBlock.tsx`, `TipTapEditor.tsx`, `EditCardPopup.tsx`, `BlockToolbar.tsx`, `CardFloatingToolbar.tsx`
- **Slide Sorter** — reorganizacja kolejności slajdów — `SlideSorter.tsx`
- **Present Mode** — tryb prezentacji pełnoekranowej — `PresentMode.tsx`
- **Command Palette** — szybkie akcje klawiaturowe — `CommandPalette.tsx`
- **Agent Panel (Teresa)** — agent-edit accept/reject + historia — `AgentPanel.tsx`, `AgentActivityPanel.tsx`
- **Version History Panel** — snapshoty/restore (mig.752) — `VersionHistoryPanel.tsx`
- **Theme Switcher** — zmiana motywu/brand-kit — `ThemeSwitcher.tsx`, `DeckThemeContext.tsx`
- **Share Modal** — share + (zakładka Collaborate ukryta za `VITE_ENABLE_DECK_COLLABORATE`) — `ShareModal.tsx`
- **Share Analytics Panel** — analityka wyświetleń share (mig.610) — `ShareAnalyticsPanel.tsx`
- **Deck Quality Gates Panel** — bramka jakości eksportu (override role-gated) — `DeckQualityGatesPanel.tsx`
- **Deck Governance Card Modal** — karta governance decka — `DeckGovernanceCardModal.tsx`
- **Deck Audit Log Modal** — log audytu — `DeckAuditLogModal.tsx`
- **Media Library Browser** — przeglądarka mediów — `MediaLibraryBrowser.tsx`
- **Source Traceability** — śledzenie źródeł — `SourceTraceability.tsx`
- **Presence Indicators** — wskaźniki obecności (collaboration) — `PresenceIndicators.tsx`

---

## Generatory Deliverable — premium DECK (B1 Layout Director + warianty)

> **APPEND 2026-06-23.** Sekcja NOWA i ROZŁĄCZNA z resztą teczki. Powyżej = istniejący DeckBuilder (pipeline V8, wersjonowanie, share, eksport, quality-gates). Tutaj = **premium warstwa generatora prezentacji** z programu „Generatory Deliverable" (fale W2/W4/W5), która do tej teczki nie wchodziła.
> **SSOT:** `docs/product/DELIVERABLES_GENERATORS_SPEC.md` (wiersze R4/B1/B2/X1) · plany testów `docs/qa/deliverables/test-plan/{R,B,X}-series.md` · scenariusze `docs/qa/deliverables/scenarios/M19_DECKS.md` (30 deck quality) · run dowodowy `docs/qa/deliverables/runs/2026-06-22-VTS-generated.md` + `…-live-pilot-sonnet46.json`.
> **Testy manualne:** `Harvard/Testy manualne/TESTY_M19_PREZENTACJE.md` → sekcja „Testy manualne — Generatory Deliverable (premium DECK quality)".

### A* · INTENCJA (premium deck)
- **Job-to-be-done:** z intentu + listy slajdów wytworzyć deck **klasy Gamma** — bez ręcznego doboru layoutu/palety/obrazów. Mózg premium (LLM) sam dobiera **layout intent** z 17-katalogu na każdy slajd, **jedną paletę** z 13-katalogu na cały deck oraz **image-brief + reasoning** per slajd. Mniej kontrolek = wyższa jakość („fewer controls, AI-driven").
- **Persony:** konsultant generujący deck zarządczy z czatu/Studio; odbiorca = zarząd / klient (board-grade).
- **Zakres warstwy:** R4 (Deck Gamma-flow: regenerateSlide AI, mniej kontrolek) · B1 (AI Layout Director) · B2 (warianty/remix slajdu) · X1 (parytet eksportu HTML→PDF/PNG). **POZA:** wpięcie w żywe UI deck-buildera (dziś za flagą OFF — patrz status).

### B* · UX docelowe (premium deck)
- **R4 Gamma-flow:** `DeckBuilderMelsView` (root `data-testid="deck-builder-mels-root"`) z odchudzonym setem kontrolek; regeneracja slajdu przez pole „Przerób ten slajd…" (`presentations.builder.regenerateSlide`); zmiana motywu, present mode, branding, undo.
- **B1 efekt na ekranie:** każdy slajd ma rozpoznawalny layout (cover / executive_summary / key_messages / comparison / root_cause / recommendation_portfolio / roadmap / risk_management / next_steps / …), spójną paletę i miejsce na obraz wg briefu.
- **B2 remix:** regeneracja 1 slajdu w N wariantach (różne layouty/ujęcia) z zachowaniem treści; wybór wariantu persystuje; undo wraca do poprzedniego.

### C* · DANE + KONTRAKT (premium deck)
- **Generator:** `server/src/services/.../presentationLayoutDirectorService.ts` (B1) — `planDeckLayout`. Katalog 17 `SlideIntent` (`:37`), katalog 13 palet `CURATED_COLOR_SETS` (harvard/ocean/slate/forest/ember/midnight/arctic/sand/indigo/graphite/olive/burgundy/teal).
- **Tier/flaga:** `server/src/services/deliverableGenerationTier.ts` — `ENABLE_DELIVERABLES_PREMIUM` (default **OFF** `:13`, fail-open → STANDARD). ON → `tierUsed='PREMIUM'`, `source='llm'`, `fallbackUsed=false`. D1 = mózg premium Anthropic Sonnet.
- **Kontrakt (Zod):** layouty ∈ 17-katalog, palety ∈ 13-katalog (enum nie przepuszcza śmieci); `plans.length ∈ [minSlides,maxSlides]`. Każdy plan niesie realny `title`/`key_message` (fix pomiaru 2026-06-22 — patrz Log) + `imageBrief` + `reasoning`.
- **Eksport (X1):** `server/src/services/playwrightPdfRenderer.ts` (`renderHtmlToPdf`/`renderHtmlToPng`, NIGDY nie rzucają; typed-result; PNG viewport default 1920×1080). Parytet = wyeksportowany plik zawiera realnie obrazy/kolory/ramki, nie sam tekst (FT-4).

### D* · AI / mózg premium
- B1 = LLM-driven layout director (premium tier). Runner pomiarowy: `scripts/deliverables/live-pilot-ft6.mts` (plain-node, klucz ze stagingu Railway, `DOTENV_IGNORE_LOCAL=1` → nie dotyka PROD centerbeam, bez DB). Scoring: `scoreDeck` (`tests/integration/deliverables/scoring/deckScoring.ts`).

### E* · INTEGRACJE
- Wejście: czat→canvas→Studio (SPEC_01 Tryb A `generate_deliverable(type:presentation)`). **Dziś nie wpięte w żywy pipeline UI dla premium** (warstwa 2 / Manual-UI = BLOCKED do wpięcia+deployu). Wyjście: eksport PPTX/PDF/PNG/HTML; rejestr Outputs (X6).

### F* · EPIKI → STORIES (traceable do R4/B1/B2/X1)

- **EPIK G-1 — AI Layout Director (B1):** deck premium klasy Gamma z mózgu LLM.
  - Story G-1.1: jako konsultant chcę, by generator sam dobrał **różnorodne layouty** — deck ≥8 slajdów → **≥8 distinct layout intents**. *Gherkin: dany intent „pełna diagnoza ~12 slajdów" · gdy premium ON · wtedy `distinctLayouts ≥ 8` ORAZ `noTripleRun = 0`.* [→ B1-S01, scenariusz M19_DECKS S16; test manualny MD-01]
  - Story G-1.2: **jedna paleta na cały deck** z 13-katalogu. *Gherkin: gdy deck wygenerowany · wtedy `distinct paletteId = 1` ∈ catalog13.* [→ B1-S02; MD-01]
  - Story G-1.3: **image-brief na każdym slajdzie** (≥10 znaków). *Gherkin: gdy deck wygenerowany · wtedy każdy slajd ma nonempty `imageBrief` + `reasoning`.* [→ B1-S03; MD-01]
  - Story G-1.4: **brak >2 identycznych layoutów pod rząd** (no triple-run). [→ B1-S01, M19_DECKS S07/S21; MD-01]
  - Story G-1.5: layout dopasowany do tematu (KPI→performance_overview, harmonogram→roadmap, ryzyko→risk_management). [→ B1-S04/S05; MD-02]
  - Story G-1.6: **fallback gdy AI OFF** = podłoga deterministyczna (`fallbackUsed=true`, `tierUsed='STANDARD'`, schema nadal waliduje, brak crasha). [→ B1-S06; MD-06]
- **EPIK G-2 — Gamma-flow editor (R4):** odchudzony builder z AI-regeneracją.
  - Story G-2.1: regeneracja slajdu AI (`regenerateSlide`) zmienia treść slajdu; status „Regenerating…". [→ R4-S02; MD-03]
  - Story G-2.2: zmiana motywu / present mode / branding / undo działają w Gamma-flow. [→ R4-S03..S06; MD-03]
- **EPIK G-3 — Warianty / remix (B2):** N wariantów slajdu, treść zachowana, wybór persystuje, undo cofa.
  - Story G-3.1: remix slajdu → ≥2 distinct layout intents, każdy waliduje schema. [→ B2-S01; MD-04]
  - Story G-3.2: `key_message` zachowany w wariantach; paleta deck nie dryfuje. [→ B2-S02/S03; MD-04]
  - Story G-3.3: wybór wariantu persystuje po reload; undo wraca do poprzedniego. [→ B2-S04/S05; MD-04, Manual-UI ⚠ po wpięciu]
- **EPIK G-4 — Parytet eksportu (X1):** PDF/PNG = realnie obrazy/kolory/ramki.
  - Story G-4.1: deck→PDF wierny ekranowi (układ, fonty, kolory marki). [→ X1-M01/M06; MD-05]
  - Story G-4.2: PNG slajdu ostry (deviceScaleFactor, viewport 1920×1080). [→ X1-M03; MD-05]
- **EPIK G-5 — Head-to-head vs Gamma:** ocena ekspercka jakości.
  - Story G-5.1: ten sam intent (VTS golden) nasz vs Gamma, ocena 1–5 w 4 osiach (layout-fit / hierarchia / motyw / „gotowe do klienta"); mediana ≥4/5, brak osi <3. [→ B1-S08; MD-07]

### G* · DoD / jakość (premium deck)

**7 globalnych kryteriów programu (FT) — stan dla premium DECK:**

| # | Kryterium (FT) | Stan premium DECK | Dowód |
|---|---|---|---|
| 1 | FT-1 feature działa / kontrakt schema (Zod) | ✅ MET (code-side) | layouty/palety ∈ catalog; `plans.length` w zakresie; pilot S01–S16 |
| 2 | FT-2 golden output stabilny | ✅ MET (code-side) | golden S01/S06/S16; VTS deck 11 slajdów `…/runs/2026-06-22-VTS-generated.md` |
| 3 | FT-3 dark/light spójny | ⏳ PENDING | Manual-UI ⚠ — wymaga wpięcia premium do UI + dark render (B1-S09) |
| 4 | FT-6 jakość vs rubric (scoring + head-to-head) | ✅ MET code-side (~100% FT-6 Sonnet 4.6: S01/S06/S16=100%) / ⏳ head-to-head ekspercki PENDING | pilot + VTS golden; ocena ekspercka 4-osiowa do wykonania (MD-07) |
| 5 | FT-7 manualne przejście przez UI | ⏳ PENDING (BLOCKED) | premium niewpięty w żywy pipeline UI — Manual-UI po deployu |
| 6 | FT-8 fallback / fail-open (AI OFF = podłoga) | ✅ MET (code-side) | `deliverableGenerationTier.ts:13` default OFF=STANDARD, fail-open; B1-S06 |
| 7 | FT-4 parytet wyeksportowanego pliku | ✅ MET deterministycznie (X-series) / ⏳ real-chromium + manual PENDING | `playwrightHtmlToPng.test.ts` (PNG magic, viewport); X1-M manual po wpięciu |

**Bramka jakości deck FT-6 (Q1 = ≥85%) — co MET / co PENDING:**

| Reguła FT-6 (deck) | Próg | Stan | Dowód |
|---|---|---|---|
| Avg `scorePct` deck | Q1 ≥85% (cel); gate fali ≥75% + żaden golden <65% | ✅ MET — FT-6 Sonnet 4.6 **~100%** (S01/S06/S16 wszystkie 100%, PREMIUM, brak fallbacku) | `…/runs/2026-06-22-live-pilot-sonnet46.json` (re-run po fix pomiaru) |
| ≥8 distinct layouts (gdy ≥8 slajdów) | hard | ✅ MET | VTS golden = 11 slajdów / **11 distinct layoutów** |
| Single palette / deck | hard | ✅ MET | VTS golden = paleta `midnight` na całym decku |
| Image brief per slide | hard | ✅ MET | VTS golden = brief + reasoning na KAŻDYM z 11 slajdów |
| No >2 consecutive identical (no triple-run) | hard | ✅ MET | `noTripleRun=0` w golden; VTS = 11 różnych = brak runów |
| `source='llm'` + `fallbackUsed=false` gdy premium ON | hard | ✅ MET | `tierUsed='PREMIUM'`, `source='llm'` w runie |
| Jakość vs Gamma (head-to-head, ekspercka) | mediana ≥4/5, brak osi <3 | ⏳ PENDING | wymaga oceny ręcznej (MD-07) — render artefaktu do PNG/PDF + porównanie |

**Uwaga pomiarowa (NIE zmiana jakości):** 2026-06-22 `planDeckLayout` zaczął nieść realny `title`/`key_message` slajdu do planu, więc scoring sprawdza **prawdziwy tytuł**, a nie proxy z `reasoning`. To **korekta wierności pomiaru**, nie podniesienie jakości decka.

### Status premium DECK (uczciwie)
- **Jakość premium UDOWODNIONA code-side ~100%** (FT-6 Sonnet 4.6: S01/S06/S16 = 100%, PREMIUM, bez fallbacku; VTS golden 11/11 distinct layoutów, jedna paleta, brief+reasoning na każdym slajdzie). Gamma-class potwierdzony na próbce golden.
- **NIE wpięte w żywe UI** (`ENABLE_DELIVERABLES_PREMIUM` default OFF, generatory premium niewpięte w pipeline chat→canvas→studio). Jakość mierzona przez **harness/flagę** (warstwa 1 Scoring-auto), NIE przez żywy deck builder.
- **Decyzje jakości:** Q1 = ≥85% deck quality · Q3 = golden VTS · Q5 = Unsplash (stock images).
- **PENDING do domknięcia:** (a) wpięcie premium do UI + flaga na Railway + deploy → odblokowuje FT-3/FT-5/FT-7 Manual-UI; (b) head-to-head ekspercki vs Gamma (FT-6 G-5.1); (c) B2 remix przez UI (persystencja/undo).

### H* · GOVERNANCE (premium deck) — Rejestr luk warstwy
| ID | Opis | Klasa | Faza | Status | Dowód |
|----|------|-------|------|--------|-------|
| GL-01 | Premium deck quality (B1) | jakość | W4 | **UDOWODNIONA code-side ~100%** (FT-6 Sonnet 4.6) | `…/runs/2026-06-22-live-pilot-sonnet46.json`, VTS golden |
| GL-02 | Premium niewpięty w żywe UI (flaga OFF) | wpięcie | — | **OTWARTA** — wymaga flagi Railway + wiring + deploy | `deliverableGenerationTier.ts:13` |
| GL-03 | Head-to-head vs Gamma (ekspercki) | jakość | W4 | **OTWARTA** — ocena ręczna do wykonania | B1-S08, MD-07 |
| GL-04 | B2 remix przez UI (persyst/undo) | feature | W4 | **OTWARTA** — Manual-UI po wpięciu | B2-S04/S05 |
| GL-05 | Parytet eksportu real-chromium + manual | eksport | W5 | **CZĘŚCIOWO** (deterministyczny MET; real+manual PENDING) | X1-S07, X1-M |

### Log (premium deck) — 2026-06-23
APPEND warstwy „Generatory Deliverable — premium DECK". Źródła: SSOT DELIVERABLES_GENERATORS_SPEC.md (R4/B1/B2/X1), test-plan R/B/X-series, scenariusze M19_DECKS (30), run VTS golden + pilot Sonnet 4.6. Stan: premium quality UDOWODNIONA code-side (~100% FT-6, VTS 11/11 distinct), NIE wpięta w żywe UI (flaga OFF). Korekta pomiaru `planDeckLayout` (real title/keyMessage) = wierność, nie jakość. PENDING: wpięcie UI + deploy, head-to-head Gamma, B2 remix UI.
