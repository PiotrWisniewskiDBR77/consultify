# TECZKA M19 — Prezentacje (Presentation Studio P20 / DeckBuilder)

> Teczka = **cienki indeks + reconciliation**, NIE duplikat. Linkuje kartę audytu + INV_E + kod i dokłada brakujące ogniwa (Rejestr Wejść z uwagami żywymi · Rejestr Decyzji · DoD z liczbami · korekta staleności R3). Wzór: [`_WZORZEC_TECZKI.md`](_WZORZEC_TECZKI.md), referencja: [`M13-inicjatywy.md`](M13-inicjatywy.md).

## 00 · Nagłówek
- **Moduł:** M19 Presentation Studio (P20 / DeckBuilder) · **Pula:** beta (kandydat na Beta)
- **Ocena audytu:** 56/100 (najsilniejszy z trójki studiów) · **Tier:** Alpha górny · **Status:** FAZA 3 → FAZA 4 · **Rozmiar:** S-M (1–2 dni)
- **Żywy bloker:** brak P0/P1 (P1 public viewer — naprawione; P2 override — **STALE-zweryfikowane: już role-gated**)
- **Właściciel:** Piotr · **Daty:** karta 2026-06-11 · teczka 2026-06-13
- **Karta:** `Harvard/modules/M19-prezentacje/KARTA_AUDYTU.md` · **Evidence:** `…/evidence/f1_code_truth.md`, `f2_tests_report.md`, `f56_kanon_sec.md` · **INV_E:** `…/INV_E_outputs_studia_meeting.md` (PREZENTACJE poz.1-16)
- **Kod:** `src/components/Presentations/` (Hub + DeckBuilder/ + ShareModal) · `server/src/routes/presentations.routes.ts` · migracje `752_p20_deck_version_and_history.sql`, 641 (`presentation_ai_operations`), 610 (`presentation_analytics`)

## MAPA POKRYCIA
| Warstwa | Stan | Źródło (istnieje) | Co dokłada teczka |
|---|---|---|---|
| A Intencja | 🟢 | karta §0 + INV_E PREZENTACJE | job-to-be-done + zakres |
| B UX docelowe | 🟢 | karta §5 (**PresentationsHub §27 wzorcowy** — najlepszy w audycie) | link + delta DeckBuilder |
| C Dane+API+reguły | 🟢 | karta §1e/§1f + `presentations.routes.ts` | persystencja realna (niżej) |
| D AI/Teresa | 🟢 | karta §1a (agent accept/reject+revert) | link |
| E Integracje | 🟢 | karta §1g | — |
| F Epiki | 🟢 | karta §7 (3 fale) | epiki (niżej) |
| G DoD/jakość | 🟢 | karta §0/§2/§7 | **liczby grep 2026-06-13** (niżej) |
| H Governance | 🟢 (dołożone) | karta §1/§6 | **Rejestr Wejść + Decyzji + korekta R3** |

---

## A · INTENCJA *(link + uzupełnienie)*
- **Job-to-be-done:** wytworzyć i edytować deck doradczy (WYSIWYG) — od generacji pipeline V8 z czatu, przez edycję TipTap z agentem Teresą, wersjonowanie i present mode, po eksport PPTX/PDF/HTML/PNG za bramką jakości i publiczny viewer.
- **Persony/role:** konsultant (autoring/edycja), członek org (edycja w org), admin/owner (override quality-gate — role-gated, patrz R3), publiczny viewer (read sanitizowany). Approval-ticket S5/S7 wiąże org+user+fingerprint.
- **Zakres v1:** Home + pipeline V8 (za `ENABLE_V8_GLOBAL`) · DeckBuilder WYSIWYG (TipTap, undo/redo, autosave, Command Palette, present mode) · MELS shell (default ON) · motywy/brand · agent Teresa accept/reject+revert · wersje (mig.752) · governance (audit-integrity, watchlist) · eksporty z export-parity · Presentation Studio z single-use approval-ticketem. **POZA v1:** collaborate „Invite by email" (obecnie no-op UI — decyzja D-01).
- **Metryka:** snapshoty trwałe po restart; export tylko po quality-gate; 0 cross-org.

## B · UX DOCELOWE *(SSOT §27 wzorcowy — linkuj)*
- **`PresentationsHub` W PEŁNI ZGODNY z §27** (`TableWithPreviewLayout:608` + `EntityStatusChip:269` + `RowActionsMenu`, jawne odwołanie canon §9.2) — **najlepsza zgodność §27 w audycie, bez akcji.**
- **Wzorzec:** `DeckBuilderMelsView` = adapter `ExecutiveModuleShell` (`melsDeckBuilder` default ON).
- **Delta DeckBuilder:** i18n 25× `isPolish` ternary → `t()` (L-05); hardkody kolorów (L-06); collaborate stub (L-01).

## C · DANE + API + REGUŁY *(link + persystencja realna)*
- **Wiring FE↔BE↔DB:** karta §1e. **Flagi:** karta §1f (`ENABLE_V8_GLOBAL` OFF→404 tylko dla pipeline generacji; reszta modułu NIE za flagą → brak ryzyka niemej pustki).
- **Persystencja REALNA (przeciwieństwo M18-fasady):** snapshoty wersji `INSERT INTO presentation_deck_versions` (`presentations.routes.ts:2161,2320`, mig.752 z FK+indeksami), GET/restore z realnego `dbAll/dbGet`; agent-history (`presentation_ai_operations` mig.641); analytics (`presentation_analytics` mig.610) — przeżywają restart, brak fasady. Lokalne 5-min checkpointy świadomie efemeryczne (`persisted:false`), ale każdy autosave pisze trwały wiersz.
- **Reguły:** quality gate eksportu serwerowy (`enforceQualityGateForExport:358`→422, 4 ścieżki + legal-hold + confidentiality); org-scope `getOrgId` z tokena `:184` (44× `AND organization_id=?`, 18/19 endpointów `:deckId`).

## D · AI / TERESA *(link)*
- **Co generuje:** deck przez pipeline V8 (za flagą); agent-edit accept/reject + revert/bulk-revert (`presentation_ai_operations` real).
- **Kręgosłup (Uwaga #1):** auto-trigger „z czatu zrób deck" idzie przez `UnifiedChatPanel`+pipeline→`WorkCanvasDocumentPanel` — pęknięcie więzi w `SPEC_ZADANIE_01` (zależność programowa). Do potwierdzenia przy fixie #1: czy standalone Presentation Studio reużywa tego panelu.

## E · INTEGRACJE
Karta §1g. **WYJŚCIE →** M17 Outputs (rejestracja decka + reopen `?artifactId=`), pliki (PPTX/PDF/HTML/PNG za quality-gate), public (`/presentations/shared/:token`). **Przekrój** M01/Teresa (agent-edit + auto-trigger z czatu — Faza 0 kręgosłup). **Niezależny od M18** (persystencja własna, realna) — szlif równolegle. Public-viewer fix współdzielony z M17 (`1b67579d7a`, wspólny endpoint).

## F · EPIKI *(z karty §7, forma epików)*
- **EPIK 1 — Domknąć stub:** collaborate „Invite by email" — wpiąć handlery+permisje LUB ukryć zakładkę (L-01, D-01). [Fala 2]
- **EPIK 2 — Bezpieczeństwo:** beta-guard route; rate-limit+revoke share (L-03); org-scope analytics-beacon (L-04); **override role-gate = TEST regresji (kod już gated, R3)** (L-02). [Fala 1/2]
- **EPIK 3 — Test prawdy:** naprawa 15 vacuous testów p20 (realny webServer/supertest lub skreślić); round-trip snapshotów na DB S4; route 422 S5 (L-07). [Fala 1]
- **EPIK 4 — Kanony:** i18n DeckBuilder `t()` (L-05); tokeny (L-06); CI `Londyn`. [Fala 3]

## G · JAKOŚĆ / DoD *(skwantyfikowane — grep 2026-06-13)*
| # | Kryterium | Miara M19 |
|---|-----------|-----------|
| 1 | Front↔back | collaborate działa lub ukryte; snapshoty trwałe po reload+restart (**już real — udowodnić testem S4**); 0 martwych przycisków |
| 2 | Bezpieczeństwo | beta-guard route; share rate-limit+revoke; analytics org-scoped; **override role-gated (już w kodzie `:1465,1607,1925,5779` — test regresji)**; org-scope czysty; public viewer sanitizowany (zrobione) |
| 3 | i18n | **30 z 30** `isPolish` w `src/components/Presentations` (grep 2026-06-13 = **30**; karta podawała 25× w samym DeckBuilder) → `t()` |
| 4 | Tokeny | **127 hex `#RRGGBB`** w `Presentations` (grep 2026-06-13; karta „10/30 plików") → tokeny (część legitna w DeckBuilder render — potwierdzić przy sweepie) |
| 5 | §27 | **1** `<table>` (grep 2026-06-13); Hub wzorcowy `TableWithPreviewLayout` → utrzymać, sprawdzić ten 1 surowy `<table>` |
| 6 | E2E w PR-gate | S4 (realny DB round-trip), S5 (route 422), bez fałszywej zieleni — zielone na `Londyn` |

Scenariusze S1–S8: karta §0/§2 (293 PASS/0 FAIL, ale **15/21 integracyjnych = fałszywa zieleń** `fetch localhost:3001` bez serwera). Bezpieczeństwo: karta §6.

## H · GOVERNANCE *(dołożone ogniwa)*

### 01 · Rejestr wejść (R1)
| ID | Źródło | Data | Treść (1 zd.) | → Luka |
|----|--------|------|----------------|--------|
| W-01 | Karta audytu §1–§7 | 2026-06-11 | 56/100; persystencja realna; jedyny stub collaborate; P2 override (wg karty bez roli) | L-01..L-07 |
| W-02 | **Uwaga żywa #1** (`SPEC_ZADANIE_01`) | 2026-06-13 | kręgosłup czat→panel pęka — „z czatu zrób deck" idzie tędy → M19 dotknięty zależnością | L-08 (zależność) |
| W-03 | INV_E PREZENTACJE poz.1-16 | 2026-06-11 | 15/16 REALNE; brak STALE „[DZIAŁA]" (persystencja realna) | — |
| W-04 | Feedback prod (kohorta beta) | — | brak własnej uwagi żywej M19 z 2026-06-13 | — (dziedziczy z karty + #1) |

### 02 · Stan obecny (prawda kodu) — **KOREKTA R3 (2 punkty)**
**(1) P1 public viewer over-disclosure — NAPRAWIONE** (`1b67579d7a`, `normalizeDeckRow` whitelist; wspólny fix z M17). **(2) P2 `?overrideQualityGate` bez roli — STALE.** Weryfikacja kodu 2026-06-13: `presentations.routes.ts:1465,1607,1925,5779` ma `allowOverride: ['ADMIN','OWNER','SUPERADMIN'].includes(req.user?.role||req.userRole||'') && String(req.query.overrideQualityGate)==='true'`, a `enforceQualityGateForExport:366` honoruje `allowOverride` tylko gdy rola pasuje → **nie-admin z paramem NIE omija bramki.** Pierwotny finding „override bez roli" jest STALE-zweryfikowane; pozostawić tylko TEST regresji role-gate, bez zmiany kodu. Reszta: persystencja realna (mig.752/641/610 — przeżywa restart), §27 Hub wzorcowy.

### 03 · Rejestr luk
| ID | Opis | Wejście | Dowód `plik:linia` | Klasa | Faza | **Status** | Zweryf. |
|----|------|---------|--------------------|-------|------|-----------|---------|
| L-01 | collaborate „Invite by email" = no-op UI | W-01 | `Presentations/DeckBuilder/ShareModal.tsx:134-171` | P3 | 3 | otwarta (**D-01**) |  |
| L-02 | override quality-gate „bez roli" | W-01 | `presentations.routes.ts:1465,1607,1925,5779` | P2 (był) | 1 | **STALE-zweryfikowane** (już role-gated; tylko test regresji) | 2026-06-13 |
| L-03 | beta-lock nawigacyjny + share bez rate-limit/revoke | W-01 | `/shared/:token` | P2 | 3 | otwarta |  |
| L-04 | analytics-beacon cross-org (`WHERE id=?` bez org) | W-01 | `presentations.routes.ts:5923` | P3 | 3 | otwarta |  |
| L-05 | DeckBuilder 25× `isPolish` (grep całość 30×) | W-01 | `Presentations/*` (grep 2026-06-13=30) | P2 | 4 | otwarta |  |
| L-06 | hardkody kolorów (127 hex grep) | W-01 | `Presentations/*` | P3 | 4 | otwarta |  |
| L-07 | 15/21 testów p20 fałszywa zieleń + S4/S5 niezweryfikowane | W-01 | `evidence/f2_tests_report.md` | P0-test | 1 | otwarta |  |
| L-08 | kręgosłup czat→deck (auto-trigger z czatu) | W-02 | `SPEC_ZADANIE_01` | P0-program | 0 | zależność (śledzona w SPEC_01) |  |
| L-09 | public viewer over-disclosure | W-01 | `normalizeDeckRow` | P1 | — | **NAPRAWIONA `1b67579d7a`** | 2026-06-11 |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | collaborate „Invite by email" | wpiąć handlery+permisje / ukryć zakładkę w v1 | Piotr | TBD | otwarta |

### 05 · Flagi / rollout — beta-closed; `ENABLE_V8_GLOBAL` OFF→404 tylko pipeline generacji (reszta nie-za-flagą); `melsDeckBuilder` default ON. Beta-guard route = nawigacyjny (direct URL omija plate; API org-gated).
### 06 · Ryzyka — 15 vacuous testów dają fałszywą pewność (0,68s bez serwera); S4/S5 trwałość/422 niezweryfikowane testem mimo realnego kodu; override role-gate bez testu regresji → możliwy nawrót przy refaktorze; dev `.env` → Railway PROD.
### 07 · Log — 2026-06-11: re-audit F:5→6 (`1b67579d7a` public viewer), 56/100. 2026-06-13 (teczka): R3 — (1) override JUŻ role-gated (`:1465` i in.) → L-02 STALE; (2) public viewer naprawiony → L-09. Re-ocena C po naprawie 15 vacuous testów.

---

## Bramka teczki: 9/9 dokumentacyjnie ✅
R1 wejścia (karta+INV_E+uwaga #1) · R2 zero sierot · R3 statusy z dowodem (**L-02 STALE-zweryfikowane: override `allowOverride:[ADMIN/OWNER/SUPERADMIN]` w kodzie — korekta karty**; L-09 z commitem) · R4 DoD z liczbami (grep i18n=30, hex=127, `<table>`=1) · R5 decyzje z właścicielem · A–E docelowy zlinkowany (Hub §27 wzorcowy) · F epiki↔luki · G DoD+S+sec · R6 sesja żywa = Faza 4. **Teczka kompletna do egzekucji.**
