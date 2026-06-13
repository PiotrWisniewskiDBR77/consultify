# WP M19 — Prezentacje (Presentation Studio P20 / DeckBuilder) · dokończenie do 100%

**Pula:** beta · **Karta:** `Harvard/modules/M19-prezentacje/KARTA_AUDYTU.md` (ocena 56/100 — kandydat na Beta) · **Rozmiar:** S-M (1–2 dni) · **Żywy bloker:** brak P0/P1
**Faza programu:** FAZA 3 (szlif) → FAZA 4 (sweepy) · **Master:** `Harvard/wdrozenie-100/MASTER.md`

## 1. Stan obecny (jednym akapitem)
Najsilniejszy z trójki studiów (56/100, górny Alpha). Piąty moduł z rzędu BEZ cross-org IDOR (`getOrgId` zawsze z tokena `:184`, 44× `AND organization_id=?`, 18/19 endpointów `:deckId` org-scoped) i — w przeciwieństwie do M18 — **z REALNĄ persystencją**: snapshoty wersji `INSERT INTO presentation_deck_versions` (`presentations.routes.ts:2161,2320`, migracja `752`), GET/restore z realnego `dbAll/dbGet`, agent-history (`presentation_ai_operations` migr.641) i analytics (`presentation_analytics` migr.610) w DB — przeżywają restart, brak fasady. 15/16 pozycji REALNE: Home, pipeline V8 (za `ENABLE_V8_GLOBAL`), DeckBuilder WYSIWYG (TipTap, undo/redo, autosave, present mode), MELS shell (default ON), motywy/brand, agent Teresa accept/reject+revert, governance, eksporty PPTX/PDF/HTML/PNG z export-parity, Presentation Studio z wzorcowym single-use approval-ticketem (`/generate` bez ticketu → 403). Quality gate eksportu serwerowy (`enforceQualityGateForExport:358`→422). **Sufit = niewykonane Fazy 3/4 + częściowo iluzoryczna zieleń testów.**

> **UWAGA — karta nieaktualna w 2 punktach (weryfikacja 2026-06-13):** (1) **P1 public viewer over-disclosure — NAPRAWIONE** (`1b67579d7a`, `normalizeDeckRow` whitelist). (2) **P2 `?overrideQualityGate` bez roli — JUŻ ROLE-GATED.** Kod `presentations.routes.ts:1465,1607,1925,5779` ma `allowOverride: ['ADMIN','OWNER','SUPERADMIN'].includes(role) && query.overrideQualityGate==='true'` — nie-admin z paramem NIE omija bramki. Pierwotny finding P2 (override bez roli) jest STALE; pozostawić tylko TEST regresji role-gate (nie-admin → 422/403), bez zmiany kodu.

## 2. Luki do DoD

### (a) FRONTEND / UX — fasada i kanony (FAZA 3)
- **[P3] Collaborate „Invite by email" = no-op UI** — `ShareModal.tsx:134-171` (input bez `value/onChange`, przyciski bez `onClick`, brak API). Jedyny STUB w module. Fix: wpiąć handlery zaproszeń+permisje LUB ukryć zakładkę.
- **[P2] DeckBuilder 25× `isPolish`** — `DeckBuilder.tsx` (ternary zamiast `t()`, gorszy wariant niż M17 ~18×); TopBar/Hub czyste. Fix: `t()` (sweep FAZA 4).
- **[P3] hardkody kolorów** w 10/30 plików DeckBuilder. Fix: tokeny (sweep FAZA 4).
- **[§27]** `PresentationsHub` W PEŁNI ZGODNY (`TableWithPreviewLayout:608` + `EntityStatusChip:269` + `RowActionsMenu`, jawne odwołanie do canon §9.2) — **najlepsza zgodność §27 w audycie**, bez akcji.

### (b) BACKEND / API — bezpieczeństwo (FAZA 3)
- **[P2] beta-lock tylko nawigacyjny** — `/prezentacje`, `/builder`, `/presentation-studio` tylko `ProtectedRoute`/`ProductionModuleGate`; direct URL omija plate (API org-gated). Fix: beta-guard na route.
- **[P2] share bez rate-limit i revoke** — `/shared/:token` bez limitu, brak unshare. Fix: rate-limit + revoke.
- **[P3] analytics-beacon cross-org** — `POST /decks/:deckId/analytics/view` (`:5923`) `WHERE id=?` bez org (auth-only write telemetrii; nie ujawnia treści). Fix: scope org.
- **[override — STALE]** `?overrideQualityGate` już role-gated (patrz UWAGA) — tylko test regresji.

### (c) INTEGRACJA / TESTY E2E — fałszywa zieleń (FAZA 1/4)
- **[P0 testowy] 15/21 testów integracyjnych = fałszywa zieleń.** Grupa D przeszła 21/21 w 0,68 s BEZ serwera; 15/21 (p20-lifecycle, export-resilience, confidentiality) to `fetch(localhost:3001)` z bramkami `if(status!==201)return` → bez serwera asercje się nie wykonują, test przechodzi pusto. Tylko 6/21 realne. Fix: realny webServer/supertest LUB skreślić.
- **[P0 testowy] trwałość snapshotów (S4) niezweryfikowana** — rewert testuje tylko `evaluateRevertEligibility`, nie dotyka DB. Dodać round-trip sqlite autosave→snapshot→restore.
- **[P0 testowy] brak testu route 422** (S5) — quality gate testowany na logice (DB mock), nie route. Dodać export `canExport=false`→422 + test role-gate override.
- **[P1 testowy]** autosave 409, share token+viewer, pętla Teresa na DB — bez testów.
- CI: `test-suite.yml` tylko `[main,develop]`; joby „Deferred" + testy `server/` poza shardami → PR-gate M19 ≈ 0. Dodać `pull_request:[Londyn]` (sweep FAZA 4).

## 3. Kroki realizacji
1. **(FAZA 3)** Collaborate: wpiąć handlery „Invite by email"+permisje LUB ukryć zakładkę (decyzja). Weryfikacja: zaproszenie działa albo znika.
2. **(FAZA 3)** beta-guard na route (`/prezentacje`/`/builder`/`/presentation-studio`); rate-limit+revoke na share; org-scope na analytics-beacon.
3. **(FAZA 1/4)** Naprawa 15 vacuous testów p20 (realny webServer/supertest lub skreślić); round-trip snapshotów na DB (S4); route 422 (S5); test regresji role-gate override (nie-admin → 422/403).
4. **(FAZA 4)** i18n DeckBuilder (`t()` zamiast 25× `isPolish`); tokeny kolorów (10/30 plików); CI `Londyn` + testy server/ + E2E prezentacji.

## 4. DoD (6 kryteriów — bramka 6/6)
1. **Front↔back:** collaborate działa lub ukryte; zero martwych przycisków; snapshoty trwałe po reload+restart (już realne — udowodnić testem).
2. **Bezpieczeństwo:** beta-guard na route; share rate-limit+revoke; analytics org-scoped; override role-gated (już w kodzie — test regresji); org-scope (czysty); public viewer sanitizowany (zrobione).
3. **i18n:** `t()` pełne (koniec 25× `isPolish`).
4. **Tokeny:** Visual Standard (10/30 plików DeckBuilder).
5. **§27:** już wzorcowy (PresentationsHub) — utrzymać.
6. **E2E w PR-gate:** S4 (realny DB round-trip), S5 (route 422), bez fałszywej zieleni — zielone na `Londyn`.

## 5. Weryfikacja
- Snapshoty: autosave→snapshot→restore po reload+restart → trwałe (real DB, migr.752).
- Override: nie-admin z `?overrideQualityGate=true` → 422/403 (test regresji; kod już gated).
- export: `canExport=false` przez route → 422.
- Collaborate: zaproszenie wysyłane albo zakładka niewidoczna.
- beta-lock: direct URL → plate; share revoke unieważnia link.
- 15 testów p20 realnie asertują (nie 0,68 s bez serwera).
- Migracje 752/641/610 zastosowane; `ENABLE_V8_GLOBAL` udokumentowane (tylko pipeline generacji za flagą — reszta modułu nie-za-flagą, brak ryzyka niemej pustki).
- Uwaga DB: dev `.env` może wskazywać Railway PROD.

## 6. Zależności
- Public-viewer sanityzacja współdzielona z M17 (`1b67579d7a`) — wspólny endpoint `/presentations/shared/:token`, zrobione raz.
- WYJŚCIE → M17 Outputs (rejestracja decka + reopen `?artifactId=`); przekrój M01/Teresa (agent-edit + auto-trigger z czatu — przez kręgosłup Fazy 0).
- Niezależny od M18 (persystencja własna, realna) — można szlifować równolegle.
