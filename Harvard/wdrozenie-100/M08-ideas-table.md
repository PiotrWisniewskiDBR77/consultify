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

## B · UX DOCELOWE *(karta §5 + delty)*
- **§27 N.D.** (canvas, nie lista) — empty/error/loading states OK.
- **Delty (zaufanie):** 4 przyciski zawsze-błąd (Import 404, ActivityFeed 401, AuditTrail 404, Snapshot 404) → naprawić mount/auth ALBO ukryć za flagą `usePlatform`; fałszywy streaming Copilot (`simulateStreaming`); cichy fallback ai-fill „—" → toast; rename tabeli tylko React-state (znika po reload).

## C · DANE + API + REGUŁY *(link + org-scope luki)*
- **Persystencja:** blob-JSON w `my_idea_maps.extensions_json` przez map-sync (`useTablePersistence.ts:118-264`, `my-work.routes.ts:3677`), org+user-scope.
- **Luki org-scope (P2):** 2 pomocnicze zapytania `my_idea_maps` bez `organization_id` w handlerze develop (`my-work.routes.ts:6022,6097`) — id zweryfikowane wcześniej (ryzyko minimalne); AI endpoints bez ownership-check `ideaId` (`ai-table-action`/`ai-fill`/`ai-suggestions`) — koszt LLM na cudzym UUID, nie wyciek.
- **Reguły:** map-sync optimistic; `generate_table` promowana w FE ale brak w prompcie serwera → nigdy nie wraca.

## D · AI / TERESA *(link + delty)*
- **Co generuje:** table-action/ai-fill/copilot (realny LLM + kontekst assessmentów org).
- **Delty:** `generate_table` martwa (prompt serwera `ideaAISuggestionsService.ts:391-402` nie zawiera typu) → dodać lub usunąć z przykładów; fenced JSON crashuje table-action (`:425` `JSON.parse` wprost) → strip fences; cicha kategoryzacja confidence 0.5 udająca AI.

## E · INTEGRACJE *(karta §1g + zależności)*
- **←** lista idei. **→** M19 Prezentacje (ExportToPresentation `/api/presentations/decks`); M20 Tabele Studio (connector CRUD pod `/api/table-platform/*` — naprawa Import dotyka mountów M20).
- **Kręgosłup:** map-sync/`useIdeaMapSync` wspólny z M05/M06/M07/M09 — zmiany runtime promieniują. CI gate `Londyn` wspólny z pulą.
- **Zależności blokujące:** ścieżka platformy (B) = bridge do M20 — decyzja dual-stack koordynować z M20.

## F · EPIKI *(z karty §7)*
- **EPIK 1 — 4 przyciski (P1):** zweryfikować stan; naprawić mount/auth ALBO ukryć (L-01).
- **EPIK 2 — Uczciwe AI:** strip fenced JSON; `generate_table` E2E lub usunięcie; toast ai-fill/kategoryzacja; rename→PATCH; saveStatusLabel realny; between/in operatory; realny stream Copilot (L-02).
- **EPIK 3 — org-scope:** `organization_id` w 2 zapytaniach develop + ownership-check `ideaId` w AI (L-03).
- **EPIK 4 — Martwy kod + dual-stack:** sprzątanie; decyzja ścieżka B (L-04).
- **EPIK 5 — Testy do CI:** 137 testów `table` do CI + S1-S5 + CI gate `Londyn` (L-05).

## G · JAKOŚĆ / DoD *(skwantyfikowane grepem 2026-06-13)*
| # | Kryterium | Miara M08 |
|---|-----------|-----------|
| 1 | Front↔back | 0 przycisków 404/401 (naprawione/ukryte); rename trwały; persist→reload trwały |
| 2 | Bezpieczeństwo | `organization_id` w 2 zapytaniach develop; ownership-check `ideaId` w AI; org+user-scope OK |
| 3 | i18n | **0 z 1695** `isPolish`/inline (grep `table/`+`IdeaTableTool` — największy dług puli) |
| 4 | Tokeny | **0 z 355** hex inline → Visual Standard |
| 5 | §27 | N.D. (canvas); **5** surowych `<table>` (`table/`+`IdeaTableTool`) — sprawdzić czy renderery danych czy legacy do migracji |
| 6 | E2E w PR-gate | **137 testów** `src/components/MyWork/table` + S1-S5 zielone na `Londyn` |

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
| L-05 | **137 testów poza CI** + brak S1-S5 + CI bez `Londyn` | W-01,W-03 | `.github/workflows/test-suite.yml:314,509` | P0-test | 4 | otwarta [zakres CI do weryfikacji] |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | Ścieżka platformy (B, flaga `ENABLE_TABLE_PLATFORM_METADATA_FIRST`) | dokończyć metadata-first / **wyciąć ścieżkę B (~40% kodu, koniec dual-utrzymania)** | Piotr | TBD | otwarta |
| D-02 | 4 przyciski | naprawić mount/auth / ukryć za `usePlatform` | Piotr | TBD | otwarta |

### 05 · Flagi/rollout — beta Ideas; `ENABLE_TABLE_PLATFORM_METADATA_FIRST: false` (~40% kodu martwego za flagą).
### 06 · Ryzyka — dual-stack (ścieżka B) = podwójne utrzymanie co tydzień; naprawa Import dotyka mountów M20; dev backend uderza w PROD DB. i18n 1695× = największy dług całej puli (FAZA 4 sweep).
### 07 · Log — 2026-06-12: audyt 54/100; claim ActivityFeed/AuditTrail/SnapshotManager naprawione (do weryfikacji). Re-ocena po FAZA 3 + sesji żywej (R6).

---

## Bramka teczki: 8/9 dokumentacyjnie
R1 ✅ · R2 ✅ · R3 (statusy z dowodem; claim 4-przyciski oznaczone „do weryfikacji" zgodnie z R3) ✅ · R4 DoD z liczbami (1695/355/5/137) ✅ · R5 decyzje z właścicielem ✅ · A-E ✅ · F epiki↔luki ✅ · G DoD+S+sec ✅ · **R6 sesja żywa NIEZALICZONA (pula nietestowana żywo) — W-02 puste.** **8/9.**
