# TECZKA M05 — Ideas · Zarządzanie (pełna teczka wg wzorca)

> Teczka = **cienki indeks + reconciliation**, NIE rewrite. Linkuje kartę audytu + kod i dokłada brakujące ogniwa (Rejestr Wejść · Rejestr Decyzji · DoD z liczbami). Wzór: [`_WZORZEC_TECZKI.md`](_WZORZEC_TECZKI.md) · referencja: [`M13-inicjatywy.md`](M13-inicjatywy.md).
> **Pula Ideas — uwaga R6:** NIE testowana na żywo 2026-06-13 (`UWAGI_TESTY_2026-06-13.md` nie zawiera wpisu Ideas) → brak uwag żywych; wejścia dziedziczone z karty + reconciliation w kodzie. Sesja żywa = warunek R6 do wykonania.

## 00 · Nagłówek
- **Moduł:** M05 Ideas-Zarządzanie · **Pula:** ideas (najdojrzalszy obszar My Work)
- **Ocena audytu:** 60/100 · **Status:** FAZA 1 (blokery) · **Rozmiar:** M-L (i18n **349**×) · **Żywy bloker:** P0-struct (snapshots + conflict — częściowo zweryfikowane jako naprawione)
- **Właściciel:** Piotr · **Daty:** karta 2026-06-12 · teczka 2026-06-13
- **Karta:** `Harvard/modules/M05-ideas-zarzadzanie/KARTA_AUDYTU.md` (§1e wiring · §1g integracje · §5 §27 · §6 sec · §7 fale) · **Evidence:** `…/evidence/`
- **Kod:** `src/components/MyWork/IdeaMapWorkspace.tsx` · `src/components/MyWork/canvas/useIdeaMapSync.ts` · `server/src/routes/my-work.routes.ts` · `server/migrations/20260611_my_idea_map_snapshots_and_activity.sql`

## MAPA POKRYCIA (co już jest vs co dokłada teczka)
| Warstwa | Stan | Źródło (istnieje) | Co dokłada teczka |
|---|---|---|---|
| A Intencja | 🟡 | karta werdykt §0 | job-to-be-done + zakres (niżej, z karty+kodu) |
| B UX docelowe | 🟡 | karta §5 (§27 listy idei) | stany ekranu + delty (niżej) |
| C Dane+API+reguły | 🟢 | karta §1e + `my-work.routes.ts` + `useIdeaMapSync.ts` | kontrakt map-sync/409 (niżej) |
| D AI/Teresa | 🟡 | karta (LLM expand/suggest/gap) | link + granice |
| E Integracje | 🟢 | karta §1g | zależności puli (niżej) |
| F Epiki | 🟢 | karta §7 (fazy) | przeformułowane na epiki (niżej) |
| G DoD/jakość | 🟢 (dołożone) | karta §0/§2/§7 | **liczby grepem** (niżej) |
| H Governance | 🟢 (dołożone) | karta §1/§6 | **Rejestr Wejść + Decyzji + R3** (niżej) |

---

## A · INTENCJA *(z karty + kodu)*
- **Job-to-be-done:** zarządzać pomysłami (idea) jako żywymi dokumentami My Work — od listy/folderów, przez mapę roboczą i AI, po konwersję idea→6 outputów (initiative/report/…) z krawędziami link-graph.
- **Persony/role:** konsultant (właściciel idei, per-user), admin org. Zakres dostępu: per-user **i** per-org (`WHERE user_id=? AND organization_id=?` — bez cross-org IDOR).
- **Zakres v1:** CRUD idei · foldery/ulubione/recents · 3 widoki listy (table/grid/garden, §27) · mapa robocza z optimistic-concurrency (baseVersion/409) · autosave (debounce+flush) · AI (LLM realny) · konwersja idea→6 outputów + krawędzie. **POZA v1:** współdzielony shared-board (to M09), eksport serwerowy do pliku (obecnie stub).
- **Metryka:** % idei skonwertowanych do initiative z zachowaniem grafu; zero utraty zmian przy autosave/konflikcie.

## B · UX DOCELOWE *(karta §5 + delty)*
- **Layout:** lista idei (3 widoki) → otwarcie → `IdeaMapWorkspace` (kanwa + AI panel + context panel).
- **Stany ekranu:** pusty/ładowanie/pełny — OK; **błąd 503 snapshot = cicha pustka** (delta: dodać komunikat); brak-uprawnień N.D. (per-user).
- **§27:** lista idei przez ResizableTable/FilterableTable + Menu 1/2/3 — karta §5.
- **Delty UX:** confirm przed nadpisaniem grafu szablonem (`IdeaTemplateGallery.tsx:1886`); trwałe notatki context-panel (dziś efemeryczne `useState`); sprzątnąć `canvasLocked=false` hardcode + 4× `console.log`.

## C · DANE + API + REGUŁY *(link + kontrakt sync)*
- **Wiring FE↔BE↔DB:** karta §1e. **Model:** `my_idea_maps` (blob graf, `extensions_json`), `my_idea_map_snapshots`+`my_idea_activity` (mig. `20260611_…sql`), `my_idea_edges` (RESERVED), split-brain z `my_idea_map_versions` (mig. 622).
- **Map-sync (kanon):** `POST /api/.../map/sync` (`my-work.routes.ts:3874`) z `baseVersion` → 409 przy rozjeździe wersji; org+user-scope na każdym zapytaniu (bez IDOR — zweryfikowane w karcie). Autosave FE: debounce + flush na visibility/online/Cmd+S (`useIdeaMapSync.ts:338-373`).
- **Reguły:** optimistic concurrency last-writer; konwersja idea→output = INSERT do tabeli docelowej + `link_graph_edges` (`my-work.routes.ts:5888`).

## D · AI / TERESA *(link)*
- **Co generuje:** expand/suggestions/gap dla mapy (realny LLM). Formuła: w zakresie idea (nie kart inicjatyw — to M13).
- **Granice:** AI sugeruje węzły, użytkownik akceptuje; brak autonomicznego nadpisywania grafu bez akcji.

## E · INTEGRACJE *(karta §1g + zależności puli)*
- **←** lista My Work (hub). **→** M13 (idea→initiative + link-graph), M11/M14/M19 (pozostałe 5 outputów konwersji).
- **Kręgosłup wspólny puli Ideas:** `useIdeaMapSync.ts` (map-sync/409/flush) współdzielony z M06/M07/M08/M09 — **zmiany runtime promieniują na całą pulę.**
- **Zależności blokujące:** migracja `my_idea_map_snapshots`/`my_idea_activity` **WSPÓLNA z M06**; conflict-handler + flush wspólne z M06-M09.

## F · EPIKI *(z karty §7, forma epików)*
- **EPIK 1 — Conflict bez cichego nadpisania (P0):** 409 rehydruje graf z serwera (nie tylko podbija wersję) (L-01).
- **EPIK 2 — Persystencja snapshots/activity (P0):** migracja + smoke 201; koniec cichych 503 (L-02).
- **EPIK 3 — Jeden runtime dla 4 narzędzi (P1):** koniec samowywołanych 409 (L-03) + flush w cleanup (sendBeacon) (L-04).
- **EPIK 4 — Eksport serwerowy:** worker pliku ALBO ukrycie przycisku (L-05).
- **EPIK 5 — Szlif UX:** confirm szablonu, trwałe notatki, sprzątanie martwego kodu/logów/`canvasLocked` (L-06).
- **EPIK 6 — Kanon wersjonowania:** rozstrzygnąć `versions` vs `snapshots` (L-07).
- **EPIK 7 — Testy:** BE S2/S3/S5/S6 + E2E checklist do tier0 + CI `Londyn` (L-08).

## G · JAKOŚĆ / DoD *(skwantyfikowane grepem 2026-06-13)*
| # | Kryterium | Miara M05 |
|---|-----------|-----------|
| 1 | Front↔back | conflict rehydruje (nie nadpisuje); snapshoty 201; 4 narzędzia jeden runtime bez 409; eksport tworzy plik LUB ukryty; 0 martwych CTA |
| 2 | Bezpieczeństwo | org+user-scope utrzymany (bez IDOR — karta §6); presence channelId org-scope (P2) |
| 3 | i18n | **0 z 349** `isPolish`/inline (grep `src/components/MyWork/canvas`+Idea* zarządzania) |
| 4 | Tokeny | **0 z 68** hex inline → Visual Standard; 0 `console.log`/`canvasLocked` vestigial |
| 5 | §27 | **1** surowy `<table>` + lista idei przez ResizableTable/FilterableTable + Menu 1/2/3 |
| 6 | E2E w PR-gate | S2 (round-trip), S3 (409→refresh), S5 (konwersja) zielone na `Londyn` |

Scenariusze S1-S6 + plan + bezpieczeństwo: karta §0/§2/§6.

## H · GOVERNANCE *(dołożone ogniwa)*

### 01 · Rejestr wejść (R1)
| ID | Źródło | Data | → Luka |
|----|--------|------|--------|
| W-01 | Karta audytu §1-§7 | 2026-06-12 | L-01..08 |
| W-02 | **Uwagi żywe 2026-06-13** | 2026-06-13 | **BRAK wpisu Ideas w `UWAGI_TESTY` — pula nietestowana żywo; dziedzicz z karty (R6 do domknięcia)** |
| W-03 | Re-audit karty (`0b81310448`/`0fc53cd9f1`) | 2026-06-12 | L-01/L-02 (status — patrz R3) |
| W-04 | Kod (`useIdeaMapSync.ts`, `my-work.routes.ts`, migracje) | 2026-06-13 | weryfikacja R3 (niżej) |

### 02 · Stan obecny (prawda kodu, R3 zweryfikowane 2026-06-13)
- **Conflict refresh = REALNY:** `conflictRefreshRef.current = graphRuntime.refresh` (`IdeaMapWorkspace.tsx:473`), wołany po 409 @ `:459` + `onMapConflictRefresh={graphRuntime.refresh}` (`:3219`). Karta claim `0b81310448` **POTWIERDZONY** — to realna rehydracja grafu, nie samo podbicie wersji.
- **Migracja snapshots/activity = ISTNIEJE:** `server/migrations/20260611_my_idea_map_snapshots_and_activity.sql` obecny. Claim `0fc53cd9f1` **POTWIERDZONY plik-present**. [DO WERYFIKACJI W DB: czy zaaplikowana na staging/prod — prod ~commit 2026-05-18, migracja 20260611 może nie być wdrożona.]
- **Split-brain wersjonowania = ŻYWY:** `622_my_idea_map_versions.sql` ORAZ `20260611_…snapshots…sql` współistnieją — kanon nierozstrzygnięty (L-07 otwarte).

### 03 · Rejestr luk
| ID | Opis | Wejście | Dowód `plik:linia` | Klasa | Faza | Status |
|----|------|---------|--------------------|-------|------|--------|
| L-01 | Conflict 409 silent-overwrite | W-01,W-03 | `IdeaMapWorkspace.tsx:449-473` | P0 | 1 | **NAPRAWIONA `0b81310448` (zweryf. w kodzie 2026-06-13)** — domknąć testem S3 |
| L-02 | `my_idea_map_snapshots`/`activity` brak migracji→503 | W-01,W-03 | `my-work.routes.ts:4515,4563,4626` + mig. `20260611_…sql` | P0 | 1 | **migracja ISTNIEJE (plik); status DB do weryfikacji** [do weryfikacji w DB] |
| L-03 | Wielu writerów / samowywołane 409 (4 narzędzia) | W-01 | `useTablePersistence.ts:111`, `IdeaProcessFlowTool.tsx:531`, `IdeaWhiteboardTool.tsx:645` | P1 | 3 | otwarta |
| L-04 | Brak flusha przy unmount (<800ms utrata) | W-01 | `useIdeaMapSync.ts:375-381` | P1 | 3 | otwarta |
| L-05 | Eksport serwerowy = rejestr bez pliku (STUB) | W-01 | `final-batch.routes.ts:32`, `IdeaExportMenu.tsx:498-509` | INTEGRACJA | 3 | **D-01** |
| L-06 | Szablon nadpisuje graf bez confirm; notatki efemeryczne; `canvasLocked` hardcode; 4× console.log | W-01 | `IdeaTemplateGallery.tsx:1886`, `IdeaContextPanel.tsx:141`, `IdeaMapWorkspace.tsx:373,433` | P2 | 3 | otwarta |
| L-07 | Split-brain `versions` vs `snapshots` | W-01,W-04 | mig. 622 vs 20260611 | P2 | 3 | **D-02** |
| L-08 | Brak testów S2/S3/S5/S6 + E2E poza tier0 + CI bez `Londyn` | W-01 | `tests/integration/ideas/*` (brak) | P0-test | 1+4 | otwarta |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | Eksport serwerowy idei | worker generujący plik / ukryć przycisk | Piotr | TBD | otwarta |
| D-02 | Kanon wersjonowania | `snapshots` (wepnij, wytnij versions) / `versions` | Piotr | TBD | otwarta |

### 05 · Flagi/rollout — beta Ideas (per-user); brak gating-rola dla zarządzania.
### 06 · Ryzyka — migracja 20260611 może nie być na prod (centerbeam ~2026-05-18) → snapshoty 503 mimo poprawnego pliku; dev `.env` → Railway PROD (ostrożnie z zapisami). Split-brain wersjonowania może mylić użytkownika.
### 07 · Log — 2026-06-13: zweryfikowano L-01 (conflict refresh realny), L-02 (migracja plik-present). Audyt 2026-06-12: ocena 60/100. Re-ocena po FAZA 1 + sesji żywej (R6).

---

## Bramka teczki: 8/9 dokumentacyjnie
R1 wejścia pełne (karta+kod) ✅ · R2 zero sierot ✅ · R3 statusy z dowodem (L-01/L-02 zweryfikowane w kodzie/plikach) ✅ · R4 DoD z liczbami (349/68/1) ✅ · R5 decyzje z właścicielem (terminy TBD) ✅ · A-E docelowy ✅ · F epiki↔luki ✅ · G DoD+S+sec ✅ · **R6 sesja żywa = NIEZALICZONA: pula Ideas nietestowana żywo 2026-06-13 → wejście W-02 puste, do domknięcia.** **8/9 — brakuje sesji żywej (R6).**
