# TECZKA M08 — Ideas · Table (pełna teczka wg wzorca)

> Teczka = **cienki indeks + reconciliation**. Wzór: [`_WZORZEC_TECZKI.md`](_WZORZEC_TECZKI.md) · referencja: [`M13-inicjatywy.md`](M13-inicjatywy.md).
> **Pula Ideas — uwaga R6:** NIE testowana na żywo 2026-06-13 (brak wpisu Ideas w `UWAGI_TESTY_2026-06-13.md`) → wejścia dziedziczone z karty + reconciliation w kodzie.

## 00 · Nagłówek
- **Moduł:** M08 Ideas-Table · **Pula:** ideas (≠ M20 Tabele Studio/table-platform)
- **Ocena audytu:** 54/100 · **Status:** FAZA 3 → FAZA 4 · **Rozmiar:** M-L (i18n **1695**× — największy w puli) · **Żywy bloker:** brak P0 (P1 funkcjonalne — szlif)
- **Właściciel:** Piotr · **Daty:** karta 2026-06-12 · teczka 2026-06-13
- **Karta:** `Harvard/modules/M08-ideas-table/KARTA_AUDYTU.md` (§1e · §1g · §5 · §6 · §7) · **Evidence:** `…/evidence/`
- **Kod:** `src/components/MyWork/IdeaTableTool.tsx` (3692 l.) · `src/components/MyWork/table/` · `src/components/MyWork/hooks/useTablePersistence.ts` · `server/src/routes/my-work.routes.ts`

## MAPA POKRYCIA
| Warstwa | Stan | Źródło | Co dokłada teczka |
|---|---|---|---|
| A Intencja | 🟡 | karta §0 | job-to-be-done (niżej) |
| B UX docelowe | 🟡 | karta §5 | stany + delty (przyciski, streaming) |
| C Dane+API+reguły | 🟢 | karta §1e + blob persistence | kontrakt + org-scope luki (niżej) |
| D AI/Teresa | 🟡 | karta (table-action/ai-fill/copilot) | granice + martwa `generate_table` (niżej) |
| E Integracje | 🟢 | karta §1g | M20 connectors / M19 export (niżej) |
| F Epiki | 🟢 | karta §7 | epiki (niżej) |
| G DoD | 🟢 (dołożone) | karta §0/§2 | **liczby grepem** (niżej) |
| H Governance | 🟢 (dołożone) | karta §1/§6 | **Rejestr Wejść+Decyzji+R3** (niżej) |

---

## A · INTENCJA *(z karty + kodu)*
- **Job-to-be-done:** zarządzać pomysłami w widoku tabelarycznym (25 typów kolumn, 7 widoków legacy, formuły, AI-fill/copilot) jako narzędzie idea-canvas — z eksportem do prezentacji.
- **Persony/role:** konsultant (właściciel). Trwałość blob-JSON w `my_idea_maps.extensions_json` (org+user-scope).
- **Zakres v1:** 25 typów kolumn · FormulaEngineV2 · undo/redo · CSV · widoki · realne AI (table-action/ai-fill/copilot przez `llmService` + kontekst assessmentów org) · ExportToPresentation→realny deck · CrossTableRelations. **POZA v1:** ścieżka platformy metadata-first (flaga OFF — decyzja dual-stack).
- **Metryka:** zero przycisków zawsze-błąd; persystencja+rename trwałe po reload.

## B · UX DOCELOWE *(karta §5 + delty — konkretnie grid)*
**Layout docelowy (`IdeaTableTool.tsx` 3668 l.):**
- **Grid** — 25 typów kolumn (text/number/select/date/formula/AI-classification/risk-score/priority/source-ref…), FormulaEngineV2, undo/redo, sortowanie/filtrowanie, CSV import/export, 7 widoków (legacy).
- **Toolbar** (`TableToolbar.tsx`) — dwa tryby sterowane `usePlatform`: legacy (blob) vs platform (metadata-first/M20). Przyciski platform-only ukryte gdy `!usePlatform`.
- **AI** — Copilot (czat-asystent grid), ai-fill (uzupełnij komórki), ai-table-action (operacje na tabeli).
- **Provenance** (platform) — RowGutter/ConfidenceBar/ValidationBadge/SourcePopover (źródła per-wiersz).

**Stany ekranu:** empty/error/loading OK. **`usePlatform` = runtime-derived** (`IdeaTableTool.tsx:408`: `platformActive && !(platformLooksEmpty && legacyLooksPopulated)`) — NIE czysta flaga env, więc ten sam UI pokazuje legacy lub platform zależnie od danych.

**Delty (zaufanie — koniec zawsze-błędów):**
| Przycisk | Objaw | Docelowo |
|---|---|---|
| Import | 404 `/table-platform/connectors` | mount/auth OK **lub** ukryć za `usePlatform` |
| ActivityFeed | 401 | naprawione (`606c9f2c0e`) [weryf.] |
| AuditTrail | 404 → `/table-platform/tables/:id/audit` (`AuditTrailPanel.tsx:180`) | path+auth (`f35aa8d7c8`) [weryf.] |
| Snapshot | 404 | USUNIĘTY [weryf.] |
- Fałszywy streaming Copilot (`AICopilotMode.tsx:117` `simulateStreaming`) → realny stream; cichy ai-fill „—" → toast; rename tabeli tylko React-state → `PATCH` (znika po reload).

## C · DANE + API + REGUŁY *(link + dual-stack + org-scope luki)*
- **Ścieżka A (legacy, kanoniczna v1):** blob-JSON w `my_idea_maps.extensions_json` przez map-sync (`useTablePersistence.ts:118-264`, `my-work.routes.ts` `/my-ideas/:id/map/sync` `:3949`), org+user-scope. AI: `/my-ideas/:id/ai-suggestions` (`:8786`), `/ai-table-action` (`:8831`), `/ai-fill` (`:8866`), `/export-csv` (`:8905`).
- **Ścieżka B (platform metadata-first, flaga `ENABLE_TABLE_PLATFORM_METADATA_FIRST` OFF, ~40% kodu):** wpina się w **backend M20** — 9 route-plików `server/src/routes/table-platform.*.routes.ts` (`routes`, `ai-editor`, `conversion`, `form-intake`, `form-public`, `record-sources`, `relations-explain`, `source-pack`, `qa`). FE: `usePlatform` derived (`IdeaTableTool.tsx:408`), provenance UI, `/table-platform/tables/:id/audit`, `/table-platform/connectors`.
- **Luki org-scope (P2):** 2 pomocnicze zapytania `my_idea_maps` bez `organization_id` w handlerze `develop` (`my-work.routes.ts:6022,6097`) — id zweryfikowane wcześniej (ryzyko minimalne); AI endpoints bez ownership-check `ideaId` (`ai-table-action`/`ai-fill`/`ai-suggestions`) — koszt LLM na cudzym UUID, nie wyciek danych.
- **Reguły:** map-sync optimistic-lock; `generate_table` promowana w FE ale brak typu w prompcie serwera (`ideaAISuggestionsService.ts:391-402`) → nigdy nie wraca (martwa); fenced JSON crashuje `table-action` (`:425` `JSON.parse` wprost) → strip fences.
- **DP-7 (path-B cut) — UWAGA zakresu:** ścieżka B NIE jest M08-lokalna — to bridge do **żywego backendu M20** (`table-platform.*` = 9 route-plików + testy `table-platform.routes.test.ts` etc.). **Cut path-B w M08 = tylko usunięcie mostu/flagi w narzędziu Ideas; backend M20 zostaje** (osobny moduł). Koordynować z M20, NIE usuwać `table-platform.*` routes.

## D · AI / TERESA *(link + delty)*
- **Co generuje:** table-action/ai-fill/copilot (realny LLM + kontekst assessmentów org).
- **Delty:** `generate_table` martwa (prompt serwera `ideaAISuggestionsService.ts:391-402` nie zawiera typu) → dodać lub usunąć z przykładów; fenced JSON crashuje table-action (`:425` `JSON.parse` wprost) → strip fences; cicha kategoryzacja confidence 0.5 udająca AI.

## E · INTEGRACJE *(karta §1g + zależności)*
- **←** lista idei. **→** M19 Prezentacje (ExportToPresentation `/api/presentations/decks`); M20 Tabele Studio (connector CRUD pod `/api/table-platform/*` — naprawa Import dotyka mountów M20).
- **Kręgosłup:** map-sync/`useIdeaMapSync` wspólny z M05/M06/M07/M09 — zmiany runtime promieniują. CI gate `Londyn` wspólny z pulą.
- **Zależności blokujące:** ścieżka platformy (B) = bridge do M20 — decyzja dual-stack koordynować z M20.

## F · EPIKI → STORIES → ZADANIA *(Gherkin)*

**EPIK 1 — 4 przyciski bez zawsze-błędu (P1, D-02)** *(domyka B/zaufanie)*
- **Story 1.1:** jako użytkownik nie chcę przycisków, które zawsze zwracają 404/401.
  - *Gdy* klikam Import/ActivityFeed/AuditTrail/Snapshot *wtedy* działają (mount/auth) **lub** są ukryte gdy `!usePlatform`.
  - Zadania: Z-01 zweryfikuj które żywe (claim `606c9f2c0e`/`f35aa8d7c8`) → L-01; Z-02 Import `/table-platform/connectors` mount → L-01; Z-03 ukryj platform-only za `usePlatform` → L-01.

**EPIK 2 — Uczciwe AI** *(domyka D)*
- **Story 2.1:** jako użytkownik chcę, by Copilot streamował realnie, a operacje AI nie crashowały.
  - *Gdy* AI zwraca fenced ```json *wtedy* serwer stripuje fences przed `JSON.parse` (`:425`) **i** Copilot streamuje realny token-flow (nie `simulateStreaming`).
  - Zadania: Z-04 strip fenced JSON → L-02; Z-05 `generate_table` E2E lub usuń z przykładów → L-02; Z-06 toast przy ai-fill „—"/kategoryzacji 0.5 → L-02; Z-07 rename→`PATCH` (trwałe) → L-02; Z-08 between/in operatory aktywne → L-02; Z-09 realny stream Copilot → L-02.

**EPIK 3 — org-scope domknięty (P2)** *(domyka C/bezpieczeństwo)*
- **Story 3.1:** jako platforma chcę, by każde zapytanie i AI-call były scope'owane do org+właściciela.
  - Zadania: Z-10 `organization_id` w 2 zapytaniach develop (`:6022,6097`) → L-03; Z-11 ownership-check `ideaId` w `ai-table-action`/`ai-fill`/`ai-suggestions` → L-03.

**EPIK 4 — Martwy kod + dual-stack (D-01/DP-7)** *(domyka C/path-B)*
- **Story 4.1:** jako utrzymujący chcę zakończyć podwójne utrzymanie ścieżki B w narzędziu Ideas.
  - *Decyzja DP-7:* wytnij most path-B z M08 (`usePlatform`/flaga/provenance-bridge ~40% kodu **w narzędziu**) — **backend M20 `table-platform.*` ZOSTAJE.** Albo dokończ metadata-first.
  - Zadania: Z-12 decyzja D-01 → L-04; Z-13 sprzątanie `LegacyViewRouter`, `offline/`, `PublicFormView` martwe (`:2641-2682`, `table/views/*`) → L-04.

**EPIK 5 — Testy do CI** — **163 testy** (14 plików `table/__tests__`, `cells/`, `provenance/`, `forms/`) do CI + S1-S5 + CI gate `Londyn`. → L-05.

## G · JAKOŚĆ / DoD *(skwantyfikowane grepem 2026-06-13)*
| # | Kryterium | Miara M08 |
|---|-----------|-----------|
| 1 | Front↔back | 0 przycisków 404/401 (naprawione/ukryte); rename trwały; persist→reload trwały |
| 2 | Bezpieczeństwo | `organization_id` w 2 zapytaniach develop; ownership-check `ideaId` w AI; org+user-scope OK |
| 3 | i18n | **0 z ~1695** inline (wzorzec `isPl = i18n.language?.startsWith('pl')` + ternary `isPl ? 'pl' : 'en'`; zweryfikowane grepem 2026-06-13: **1869** ref. `isPl` / **1288** ternaries `isPl ?` w `table/`+`IdeaTableTool` — największy dług puli) |
| 4 | Tokeny | **0 z 355** hex inline → Visual Standard (zweryf. grepem) |
| 5 | §27 | N.D. (canvas); **5** surowych `<table>` (`table/`+`IdeaTableTool`, zweryf.) — sprawdzić czy renderery danych czy legacy do migracji |
| 6 | E2E w PR-gate | **163 test-case'y** (14 plików `table/__tests__`+`cells/`+`provenance/`+`forms/`, zweryf. grepem) + S1-S5 zielone na `Londyn` |

## H · GOVERNANCE *(dołożone ogniwa)*

### 01 · Rejestr wejść (R1)
| ID | Źródło | Data | → Luka |
|----|--------|------|--------|
| W-01 | Karta audytu §1-§7 | 2026-06-12 | L-01..05 |
| W-02 | **Uwagi żywe 2026-06-13** | 2026-06-13 | **BRAK wpisu Ideas — pula nietestowana żywo; dziedzicz z karty (R6 do domknięcia)** |
| W-03 | Re-audit karty (`606c9f2c0e`/`f35aa8d7c8`/`99bda16792`) | 2026-06-12 | L-01/L-05 (status — R3) |
| W-04 | Kod (`my-work.routes.ts`, `table/`) | 2026-06-13 | weryfikacja R3 |

### 02 · Stan obecny (prawda kodu)
- **Brak żywego P0** (jedyny w puli Ideas) — same P1/P2 funkcjonalne + 137 testów poza CI.
- **4 przyciski:** karta twierdzi ActivityFeed naprawione (`606c9f2c0e`), AuditTrail path+auth OK (`f35aa8d7c8`), SnapshotManager USUNIĘTY — [do weryfikacji w kodzie: które żywe; Import→`/table-platform/connectors` mount pozostaje].
- **CI gate:** karta W15 (`99bda16792`) — [do weryfikacji: czy 137 testów `table` faktycznie w zakresie `test-suite.yml` l.314/509, które uruchamiają tylko `tests/unit`+`tests/integration`].

### 03 · Rejestr luk
| ID | Opis | Wejście | Dowód `plik:linia` | Klasa | Faza | Status |
|----|------|---------|--------------------|-------|------|--------|
| L-01 | 4 przyciski zawsze-błąd (Import/ActivityFeed/AuditTrail/Snapshot) | W-01,W-03 | `TableToolbar.tsx:1058`, `ActivityFeed.tsx:148`, `AuditTrailPanel.tsx:177`, `SnapshotManager.tsx:117` | P1 | 3 | część claim naprawiona `606c9f2c0e`/`f35aa8d7c8` **[do weryfikacji]**; Import otwarty |
| L-02 | Fałszywy stream Copilot; cichy ai-fill „—"; `generate_table` martwa; fenced JSON crash; rename React-only; between/in nieaktywne | W-01 | `AICopilotMode.tsx:117`, `ideaAISuggestionsService.ts:425,488`, `AITableAssistant.tsx:39`, `IdeaTableTool.tsx:791`, `useTableRows.ts:86` | P1/P2 | 3 | otwarta |
| L-03 | 2 zapytania develop bez org_id; AI endpoints bez ownership-check ideaId | W-01 | `my-work.routes.ts:6022,6097` | P2 | 3 | otwarta |
| L-04 | Martwy kod (LegacyViewRouter, offline/, PublicFormView…); dual-stack ścieżka B (flaga OFF) | W-01 | `IdeaTableTool.tsx:2641-2682`, `table/views/*` | P2 | 3 | **D-01** (dual-stack) |
| L-05 | **163 test-case'y poza CI** (14 plików, zweryf. grepem 2026-06-13) + brak S1-S5 + CI bez `Londyn` | W-01,W-03 | `.github/workflows/test-suite.yml:314,509` | P0-test | 4 | otwarta [zakres CI do weryfikacji] |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | Ścieżka platformy (B, flaga `ENABLE_TABLE_PLATFORM_METADATA_FIRST`) | dokończyć metadata-first / **wyciąć most path-B w narzędziu (~40% kodu)** | Piotr | 2026-06-13 | **ROZSTRZYGNIĘTE → DP-7: wytnij most path-B w narzędziu (NIE backend M20)** — backend M20 `table-platform.*` (9 route-plików + testy) ZOSTAJE; cut dotyczy tylko bridge'a w IdeaTableTool, koordynować z M20 |
| D-02 | 4 przyciski | naprawić mount/auth / ukryć za `usePlatform` | Piotr | 2026-06-13 | **ROZSTRZYGNIĘTE → DP-5: ukryj stuby za flagą + label** (jeśli nie v1-critical) |
| D-03 | Kontrakt `my_idea_maps` per-resource (DP-3) | single-player / shared+membership | Piotr | 2026-06-13 | **ROZSTRZYGNIĘTE → DP-3: per-resource multiplayer** — M09 zmienia dla puli; M08 trzyma blob w `extensions_json`, scope `user_id`→membership |

### 05 · Flagi/rollout — beta Ideas; `ENABLE_TABLE_PLATFORM_METADATA_FIRST: false` (~40% kodu mostu za flagą). **DP-7:** wycięcie dotyczy mostu w narzędziu, nie backendu M20.
### 06 · Ryzyka — dual-stack (ścieżka B) = podwójne utrzymanie co tydzień; naprawa Import dotyka mountów M20; dev backend uderza w PROD DB. i18n 1695× = największy dług całej puli (FAZA 4 sweep).
### 07 · Log — 2026-06-12: audyt 54/100; claim ActivityFeed/AuditTrail/SnapshotManager naprawione (do weryfikacji). Re-ocena po FAZA 3 + sesji żywej (R6).

---

## Bramka teczki: 8/9 dokumentacyjnie
R1 ✅ · R2 ✅ · R3 (statusy z dowodem; claim 4-przyciski oznaczone „do weryfikacji" zgodnie z R3) ✅ · R4 DoD z liczbami (1695/355/5/137) ✅ · R5 decyzje z właścicielem (**D-01 ROZSTRZYGNIĘTE → DP-7; D-02 → DP-5; D-03 → DP-3**) ✅ · A-E ✅ · F epiki↔luki ✅ · G DoD+S+sec ✅ · **R6 sesja żywa NIEZALICZONA (pula nietestowana żywo) — W-02 puste.** **8/9 (decyzje rozstrzygnięte; R6 pozostaje).**
