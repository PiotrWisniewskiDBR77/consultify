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
| L-01 | 4 przyciski zawsze-błąd (Import/ActivityFeed/AuditTrail/Snapshot) | W-01,W-03 | `TableToolbar.tsx:1058`, `ActivityFeed.tsx:148`, `AuditTrailPanel.tsx:177`, `SnapshotManager.tsx:117` | P1 | 3 | **ZAMKNIĘTA `676e620993` (2026-06-17)** — ActivityFeed (`Api.get`) + AuditTrail (`getHeaders()`) mają auth i degradują do cichego empty-state (brak always-error toast); Import CSV = działający file-input; connectors bramkowane `length>0`; SnapshotManager = osierocony (0 ref) → USUNIĘTY |
| L-02 | Fałszywy stream Copilot; cichy ai-fill „—"; `generate_table` martwa; fenced JSON crash; rename React-only; between/in nieaktywne | W-01 | `AICopilotMode.tsx:117`, `ideaAISuggestionsService.ts:425,488`, `AITableAssistant.tsx:39`, `IdeaTableTool.tsx:791`, `useTableRows.ts:86` | P1/P2 | 3 | **ZAMKNIĘTA `99cda117a5` (2026-06-17)** — between/in + cały słownik operatorów FilterBuilder (startsWith/notEquals/isEmpty/gte/isAnyOf/daty) cicho no-op w obu ewaluatorach → wspólny `filterEval.evaluateFilterRule` (test 11/11). FALSE POSITIVE: `generate_table` (0 ref w FE), fenced-JSON crash (już stripowany `:425`), simulateStreaming (typewriter nad REALNYM tekstem API, nie fabrykacja). Rename tabeli = cross-zone (brak endpointu M20, flag dla Harvard 5 + komentarz `IdeaTableTool.tsx:789`) |
| L-03 | 2 zapytania develop bez org_id; AI endpoints bez ownership-check ideaId | W-01 | `my-work.routes.ts:6022,6097` | P2 | 3 | **ZAMKNIĘTA `0ae8a6cd15` (2026-06-17)** — 4 zapisy `develop` → pełny id+user+org scope; ai-suggestions/ai-table-action/ai-fill = ownership SELECT przed LLM (404 gdy nie-własny, blokuje koszt na cudzym UUID); test `my-work.ai-ownership.contract.test.ts` (9/9, CI-gated tests/integration) |
| L-04 | Martwy kod (LegacyViewRouter, offline/, PublicFormView…); dual-stack ścieżka B (flaga OFF) | W-01 | `IdeaTableTool.tsx:2641-2682`, `table/views/*` | P2 | 3 | **CZĘŚCIOWO ZAMKNIĘTA — WYMAGA DROBNEGO CLEANUPU (skoryg. 2026-06-19)** — martwy kod `PublicFormView.tsx` + `offline/` USUNIĘTY z gita (`f7fada6924` — zgarnięte do commita M02 przez wyścig współdzielonego indeksu). **ALE `src/components/MyWork/table/PublicFormView.tsx` (540 l., 0 importerów) WRÓCIŁ na dysk jako UNTRACKED (git-race, zweryf. `git status` 2026-06-19: `?? …PublicFormView.tsx`)** — usunięty z gita, sierota untracked na dysku → do sprzątnięcia (`rm`), ryzyko clean-build/build-integrity (por. [[finding_build_integrity_untracked]]). LegacyViewRouter = FALSE POSITIVE (żywy render `:2629`). **Cut mostu path-B (DP-7) = D-01 ODROCZONA**: refaktor ~40% kodu narzędzia, koordynacja z M20 (backend zostaje), nie correctness-bug → osobny pass po R6 |
| L-05 | **163 test-case'y poza CI** (14 plików, zweryf. grepem 2026-06-13) + brak S1-S5 + CI bez `Londyn` | W-01,W-03 | `.github/workflows/test-suite.yml` (job `component`) | P0-test | 4 | **ZAMKNIĘTA (R3 2026-06-17, H2)** — wpięte: nowy step „Run My Work co-located tests (M08 L-05)" w jobie `component` → `npx vitest run src/components/MyWork` (15 plików tabeli + 5 innych co-located = **20 plików / 195 testów**, zweryf. lokalnie 195/195 PASS przed wpięciem; junit uploadowany). Triggery: Londyn JUŻ jest w `on.push/pull_request.branches` — ALE wszystkie joby testowe (unit/integration/**component**) mają `if: ref_name==main/develop||workflow_dispatch` → **deferred na Londyn z założenia** (program-wide polityka kosztowa, NIE M08). 15 testów teraz gate'uje merge do main/develop + workflow_dispatch. Flip całego defer na Londyn = osobna decyzja kosztowa Piotra (nie unilateralna). |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | Ścieżka platformy (B, flaga `ENABLE_TABLE_PLATFORM_METADATA_FIRST`) | dokończyć metadata-first / **wyciąć most path-B w narzędziu (~40% kodu)** | Piotr | 2026-06-13 | **ROZSTRZYGNIĘTE → DP-7: wytnij most path-B w narzędziu (NIE backend M20)** — backend M20 `table-platform.*` (9 route-plików + testy) ZOSTAJE; cut dotyczy tylko bridge'a w IdeaTableTool, koordynować z M20 |
| D-02 | 4 przyciski | naprawić mount/auth / ukryć za `usePlatform` | Piotr | 2026-06-13 | **ROZSTRZYGNIĘTE → DP-5: ukryj stuby za flagą + label** (jeśli nie v1-critical) |
| D-03 | Kontrakt `my_idea_maps` per-resource (DP-3) | single-player / shared+membership | Piotr | 2026-06-13 | **ROZSTRZYGNIĘTE → DP-3: per-resource multiplayer** — M09 zmienia dla puli; M08 trzyma blob w `extensions_json`, scope `user_id`→membership |

### 05 · Flagi/rollout — beta Ideas; `ENABLE_TABLE_PLATFORM_METADATA_FIRST: false` (~40% kodu mostu za flagą). **DP-7:** wycięcie dotyczy mostu w narzędziu, nie backendu M20.
### 06 · Ryzyka — dual-stack (ścieżka B) = podwójne utrzymanie co tydzień; naprawa Import dotyka mountów M20; dev backend uderza w PROD DB. i18n 1695× = największy dług całej puli (FAZA 4 sweep).

### 06b · RECONCILIATION 2026-06-20 (weryfikacja W KODZIE, 5 agentów — NIE z dokumentów)
Wcześniejsze wpisy L-01..L-05 (2026-06-17) **przeszacowywały domknięcie** (zgodnie z regułą „gap reports overstate"). Realny stan + naprawy:
- **L-01 — re-domknięta.** Przyciski (ActivityFeed `Api.get`/Audit `getHeaders`/Import file-input) realnie OK, degradują cicho. ALE `table/SnapshotManager.tsx` (martwy, 0 importerów) **zmartwychwstał** przez `ff5120cb21` (konsolidacja drzewa) po usunięciu w `676e620993` → **re-USUNIĘTY** (`git rm`).
- **L-02 — Z-06 BYŁ OTWARTY, teraz domknięty.** filter-ops (filterEval) realnie naprawione; copilot-stream/fenced-JSON/`generate_table` = realne FALSE-POSITIVE (potwierdzone w kodzie). ALE **cichy ai-fill „—" (Z-06) został po cichu pominięty w rationale 2026-06-17** — `InlineAIFill.tsx` połykał błąd/null bez toasta. Naprawa: `react-hot-toast` na ścieżce single (`AI nie zwróciło wartości`/`Nie udało się`) + batch (summary `Wypełniono N`/`failed`).
- **L-03 — scoped OK + NOWA luka tej samej klasy.** 4 zapisy develop + 3 AI-endpointy realnie scoped (test 9/9). **`POST /my-ideas/:id/ai-generate` NIE miało ownership-guarda** (LLM odpalany na dowolnym/cudzym UUID = cost-vector, NIE wyciek — kontekst z body) → dodany guard (`my-work.routes.ts:5103`, mirror `:8861`) + contract test rozszerzony o `ai-generate` (12/12, `tests/integration`). Uwaga: `ai-generate` jest współdzielony z pulą Ideas (M06/M07/M09) ale M08 też go woła (`table_columns`/`table_views`/`table_rows`); guard bezpieczny bo legit-flow zawsze na trwałej własnej idei (jak 3 siblingi).
- **L-04 — sierota usunięta.** `table/PublicFormView.tsx` (540 l., 0 importerów, untracked git-race) **USUNIĘTY** (`rm`). `offline/` już nieobecny. LegacyViewRouter = żywy (FP potwierdzony, `IdeaTableTool.tsx:2629`). Dual-stack cut (DP-7) = D-01 ODROCZONA (refaktor ~40%, koordynacja M20).
- **L-05 — testy zielone.** CI wiring realnie wpięte (`test-suite.yml:367-369` `vitest run src/components/MyWork`), ALE suite był **193/195** (2 stale color-token asserty rose→danger w `cells/__tests__/PriorityCell`+`RiskScoreCell` — komponenty zmigrowane przez Visual Quality, testy nie) → naprawione, **195/195 PASS**. Defer na Londyn = polityka kosztowa program-wide (nie M08).
- **i18n** — bare-missing gate=0 (PASS, hard gate), funkcjonalnie dwujęzyczny PL/EN; ~1288 ternary `isPl?` = canonical-debt Faza 4 (precedens M03: zamknięty 6/7 z i18n→Faza4). NIE blokuje „działa dwujęzycznie".
### 07 · Log — 2026-06-12: audyt 54/100; claim ActivityFeed/AuditTrail/SnapshotManager naprawione (do weryfikacji). 2026-06-17 (Harvard 2): L-01 ZAMKNIĘTA (`676e620993`); L-02 ZAMKNIĘTA (`99cda117a5` filterEval — naprawiony cichy no-op filtrów); L-03 ZAMKNIĘTA (`0ae8a6cd15` org-scope + AI ownership, 9/9 test); L-04 częściowo (martwy kod usunięty z gita `f7fada6924`, dual-stack cut = D-01 odroczona); L-05 = gap repo-wide CI (infra owner). 3 luki z testem (L-02/L-03 + L-01 cleanup); rename tabeli flagowany dla M20. Re-ocena po sesji żywej (R6). **(skoryg. 2026-06-19: `PublicFormView.tsx` (540 l.) wrócił na dysk jako UNTRACKED po `f7fada6924` (git-race) — moduł WYMAGA drobnego cleanupu (`rm` sieroty, 0 importerów) przed egzekucją; ryzyko clean-build. Szczegóły w L-04.)**

---

## Bramka teczki: 8/9 dokumentacyjnie
R1 ✅ · R2 ✅ · R3 (statusy z dowodem; claim 4-przyciski oznaczone „do weryfikacji" zgodnie z R3) ✅ · R4 DoD z liczbami (1695/355/5/137) ✅ · R5 decyzje z właścicielem (**D-01 ROZSTRZYGNIĘTE → DP-7; D-02 → DP-5; D-03 → DP-3**) ✅ · A-E ✅ · F epiki↔luki ✅ · G DoD+S+sec ✅ · **R6 sesja żywa NIEZALICZONA (pula nietestowana żywo) — W-02 puste.** **8/9 (decyzje rozstrzygnięte; R6 pozostaje).**

## EKRANY (inwentarz) — 2026-06-19
Ugruntowane w realnych ścieżkach. Grid (`IdeaTableTool.tsx`) + `table/` (~50 plików). Dual-stack: legacy blob (`my_idea_maps.extensions_json`, kanon v1) vs platform metadata-first (most do M20, flaga OFF). `usePlatform` runtime-derived (`IdeaTableTool.tsx:408`).

| # | Ekran / widok | Cel | Plik komponentu |
|---|---|---|---|
| 1 | Grid (główny) | 25 typów kolumn, FormulaEngineV2, undo/redo, sort/filtr, CSV | `src/components/MyWork/IdeaTableTool.tsx`, `table/GridView.tsx` |
| 2 | Toolbar tabeli | tryby legacy/platform sterowane `usePlatform` | `src/components/MyWork/table/TableToolbar.tsx` |
| 3 | Widoki legacy (7) | Kanban / Calendar / Matrix | `table/KanbanView.tsx`, `CalendarView.tsx`, `MatrixView.tsx` |
| 4 | Empty-state | pusta tabela | `src/components/MyWork/table/EmptyStateView.tsx` |
| 5 | Builder filtrów | operatory (between/in/startsWith… — L-02 `filterEval.ts` naprawiony) | `table/FilterBuilder.tsx`, `FilterPanel.tsx`, `filterEval.ts` |
| 6 | Edytor komórki / popover | edycja + ekspansja komórki | `table/CellEditor.tsx`, `CellExpandPopover.tsx`, `CellRenderer.tsx` |
| 7 | Dodaj kolumnę (modal) | konfiguracja typu kolumny | `table/AddColumnDialog.tsx`, `FieldManager.tsx` |
| 8 | Edytor formuł | FormulaEngineV2 | `table/FormulaEditor.tsx` |
| 9 | AI Copilot (panel) | czat-asystent grid; typewriter nad realnym tekstem API (L-02 false-positive) | `table/AICopilotMode.tsx` |
| 10 | AI Fill / Table Assistant / Categorize | uzupełnianie/operacje AI (ownership-check L-03 `0ae8a6cd15`) | `table/InlineAIFill.tsx`, `AITableAssistant.tsx`, `AICategorizeTool.tsx` |
| 11 | Activity Feed (panel) | historia; auth + ciche empty (L-01 `676e620993`) | `table/ActivityFeed.tsx` |
| 12 | Audit Trail (panel) | ścieżka audytu platform (`/table-platform/tables/:id/audit`) | `table/AuditTrailPanel.tsx` |
| 13 | Eksport do prezentacji (modal) | realny deck `/api/presentations/decks` (M19) | `table/ExportToPresentation.tsx` |
| 14 | Cross-table relations | relacje między tabelami | `table/CrossTableRelations.tsx`, `LinkedRecordPicker.tsx` |
| 15 | Provenance (platform) | RowGutter/ConfidenceBar/ValidationBadge/SourcePopover (per-wiersz źródła) | `src/components/MyWork/table/provenance/` |
| 16 | Form Builder / intake | formularze tabeli | `table/FormBuilder.tsx`, `forms/` |
| 17 | Widok publiczny formularza (route) | publiczny render — `PublicViewPage` żywy (route `AppRoutes.tsx`) | `table/PublicViewPage.tsx` |

**Stany przekrojowe:** empty / loading / error OK; `usePlatform` przełącza legacy↔platform wg danych (nie czysta flaga). §27: 5 surowych `<table>` (renderery danych). **Uwaga:** `table/PublicFormView.tsx` (540 l.) usunięty z HEAD w `f7fada6924`, ale obecny jako UNTRACKED na dysku (git-race) — martwy, 0 referencji.
