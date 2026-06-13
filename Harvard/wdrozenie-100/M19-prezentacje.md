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
| L-01 | collaborate „Invite by email" = no-op UI | W-01 | `Presentations/DeckBuilder/ShareModal.tsx:134-171` | P3 | 3 | otwarta (**D-01**) |  |
| L-02 | override quality-gate „bez roli" | W-01,W-04 | `presentations.routes.ts:1465,1607,1925,5779` + `:366` | P2 (był) | 1 | **STALE-zweryfikowane** (już role-gated; tylko test regresji) | 2026-06-13 |
| L-03 | beta-lock nawigacyjny + share bez rate-limit/revoke | W-01 | `/shared/:token` | P2 | 3 | otwarta |  |
| L-04 | analytics-beacon cross-org (`WHERE id=?` bez org) | W-01 | `presentations.routes.ts:5923` | P3 | 3 | otwarta |  |
| L-05 | DeckBuilder 25× `isPolish` (grep całość 30×) | W-01 | `Presentations/*` (grep 2026-06-13=30) | P2 | 4 | otwarta |  |
| L-06 | hardkody kolorów (127 hex grep — część legitna render) | W-01 | `Presentations/*` (grep=127) | P3 | 4 | otwarta |  |
| L-07 | 15/21 testów p20 fałszywa zieleń + S4/S5 niezweryfikowane | W-01 | `evidence/f2_tests_report.md` | P0-test | 1 | otwarta |  |
| L-08 | kręgosłup czat→deck (auto-trigger z czatu) | W-02 | `SPEC_ZADANIE_01` | P0-program | 0 | zależność (śledzona w SPEC_01) |  |
| L-09 | public viewer over-disclosure | W-01 | `normalizeDeckRow` | P1 | — | **NAPRAWIONA `1b67579d7a`** | 2026-06-11 |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | collaborate „Invite by email" | wpiąć handlery+permisje / ukryć zakładkę w v1 | Piotr | TBD | otwarta |

### 05 · Flagi / rollout — beta-closed; `ENABLE_V8_GLOBAL` OFF→404 tylko pipeline generacji (reszta nie-za-flagą); `melsDeckBuilder` default ON. Beta-guard route = nawigacyjny (direct URL omija plate; API org-gated).
### 06 · Ryzyka — 15 vacuous testów dają fałszywą pewność (0,68s bez serwera); S4/S5 trwałość/422 niezweryfikowane testem mimo realnego kodu; override role-gate bez testu regresji → możliwy nawrót przy refaktorze; dev `.env` → Railway PROD.
### 07 · Log — 2026-06-11: re-audit F:5→6 (`1b67579d7a` public viewer), 56/100. 2026-06-13 (teczka pogłębiona): R3 — (1) override JUŻ role-gated (`:1465,:366`) → L-02 STALE; (2) public viewer naprawiony → L-09; C rozbite na model snapshotów/wersji (mig.752/641/610) + override role-gate + enum 71 endpointów; F na Gherkin. Re-ocena C po naprawie 15 vacuous testów.

---

## Bramka teczki: 9/9 dokumentacyjnie ✅
R1 wejścia (karta+INV_E+uwaga #1+weryfikacja override) · R2 zero sierot · R3 statusy z dowodem (**L-02 STALE-zweryfikowane: override `allowOverride:[ADMIN/OWNER/SUPERADMIN]` `:1465`+`:366` w kodzie — korekta karty**; L-09 z commitem) · R4 DoD z liczbami (grep i18n=30, hex=127, `<table>`=1) · R5 decyzje z właścicielem (D-01) · A–E docelowy zlinkowany (Hub §27 wzorcowy + C model wersji + enum API) · F epiki→stories Gherkin↔luki · G DoD+S+sec · R6 sesja żywa = Faza 4. **Teczka kompletna do egzekucji.**
