# GOTOWOŚĆ M05 — Ideas · Zarządzanie (do odbioru ręcznego Piotra)

> **Cel dokumentu:** zamknąć każde kryterium DoD **OPRÓCZ #3 i18n (świadomie odroczone)** i dać właścicielowi produktu jasny obraz: co jest pokryte automatycznie (Kod/Cases/E2E) a co odhaczyć ręcznie.
> **Źródła:** teczka `M05-ideas-zarzadzanie.md` (sekcja G · DoD), karta `Harvard/modules/M05-ideas-zarzadzanie/KARTA_AUDYTU.md` (§6 bezpieczeństwo), testy manualne `Harvard/Testy manualne/TESTY_M05_IDEAS_ZARZADZANIE.md`, kod (`src/components/MyWork/*`, `server/src/routes/my-work.routes.ts`, `server/src/gateways/ideaCollabWs.gateway.ts`).
> **Data:** 2026-06-23 · **Branch:** feat/deliverables-w1 · **Status modułu:** DO ODBIORU (wszystkie luki P0/P1/P2 zamknięte, R6 sesja żywa wykonana 2026-06-20).
> **Uwaga:** testów NIE uruchamiano w tej sesji (backend/caboose pod obciążeniem) — statusy testów oparte na obecności plików + treści (assertions), nie na świeżym przebiegu.

---

## (a) EPIKI — status 7/7 ✅

| Epik | Zakres | Luka | Status |
|---|---|---|---|
| **EPIK 1** | Conflict 409 bez cichego nadpisania (P0) — rehydracja + banner | L-01 | ✅ ZAMKNIĘTA `0b81310448` — `IdeaMapWorkspace.tsx:451-473` (refresh realny, `conflictRefreshRef.current = graphRuntime.refresh`); test S3 |
| **EPIK 2** | Persystencja snapshots/activity (P0) — 201 nie 503 | L-02 | ✅ ZAMKNIĘTA na STAGING (obie tabele istnieją; graceful `requireTables`). **PROD = checkpoint wdrożeniowy** (migracja `20260611` na centerbeam do potwierdzenia przy deploy Londyn→prod — kod kompletny) |
| **EPIK 3** | Jeden runtime dla 4 narzędzi (P1) — brak fałszywych 409 | L-03 | ✅ ZAMKNIĘTA `ab0eb2fb0c` — `globalIdeaVersions` moduł-level Map; test `tests/components/MyWork/ideaMapSyncPersistence.smoke.test.ts` (14/14, w CI) |
| **EPIK 3b** | Flush przy unmount (<800ms utrata) (P1) | L-04 | ✅ ZAMKNIĘTA `ab0eb2fb0c` — cleanup useEffect → localStorage → primeServerVersion przy mount |
| **EPIK 4** | Eksport serwerowy (D-01) | L-05 | ✅ ZAMKNIĘTA → DP-5: stub zagated za flagą OFF `VITE_ENABLE_IDEA_SERVER_EXPORT`; klient-side eksporty (PNG/SVG/PDF/MD/JSON) działają. Test `IdeaExportMenu.server-export-flag.test.tsx` (4/4) |
| **EPIK 5** | Szlif UX — confirm szablonu, console.log, canvasLocked | L-06 | ✅ ZAMKNIĘTA `1f8be9b961` — confirm-overwrite (`useConfirmDialog` w `handleApply`); 0× console.log (zweryf. 2026-06-23); test `IdeaTemplateGallery.l06.test.tsx` (4/4) |
| **EPIK 6** | Kanon wersjonowania (D-02) — split-brain | L-07 | ✅ ROZSTRZYGNIĘTE → `snapshots` kanon; `versions` martwa (0 callerów runtime); retire-migracja `901_drop_my_idea_map_versions.sql` istnieje (aplikacja = deploy-time prod) |
| **EPIK 7** | Testy BE S2/S3/S5/S6 + E2E w PR-gate | L-08 | ✅ ZAMKNIĘTA — `my-work.map-sync.contract.test.ts` (S2/S3/S6 11/11) + `my-work.convert.contract.test.ts` (S5 6/6); CI Londyn skonfigurowane |

Wszystkie 7 epików (8 wierszy luk) ZAMKNIĘTE lub rozstrzygnięte decyzją; jedyne pozostałości to deploy-time checkpointy na prod (L-02 migracja, L-07 retire-migracja) — **nie braki kodu**.

---

## (b) TABELA DoD — 6/7 zamknięte (#3 i18n odroczone)

| # | Kryterium | Status | Dowód `plik:linia` |
|---|---|---|---|
| **1** | Front↔back (brak fasad/mocków/martwych CTA) | ✅ **MET** | Conflict rehydruje realnie (`IdeaMapWorkspace.tsx:451-473`, `:3219` onMapConflictRefresh); snapshoty 201 (`my-work.routes.ts:4515,4563,4626` + graceful requireTables); 4 narzędzia 1 runtime (`globalIdeaVersions` Map, `ab0eb2fb0c`); eksport serwerowy zagated OFF (`IdeaExportMenu.tsx:503-513`) — brak prezentowanej martwej akcji; klient-side eksport działa. 0 martwych CTA potwierdzone w R6 sesji żywej (2026-06-20). |
| **2** | Bezpieczeństwo (brak P0/P1; każda poprawka ma test regresji) | ✅ **MET** | Org+user-scope `WHERE user_id=? AND organization_id=?` na 40+ endpointach (karta §6:256), brak cross-org IDOR. **WS org-scope (flaga teczki "kod OK, dodać test") = TEST JUŻ ISTNIEJE:** `tests/integration/gateways/ideaCollabWs.orgscope.test.ts` — 6 testów: 401 brak/zły token, **403 cross-org (Org B → 403, linia 136-146)**, 101 same-org pass, non-collab ignore. Gate egzekwowany w `ideaCollabWs.gateway.ts:235-244` (`SELECT id FROM my_ideas WHERE id=? AND organization_id=?` → brak = 403). HTTP `/map` cross-org → 404 też testowany: `my-work.map-orgread.contract.test.ts:145-151`. Pozostaje **P2** (nie P0/P1): presence channelId org-scope (`my-work.routes.ts:8901`) — niskie ryzyko (brak danych mapy w presence), nie blokuje odbioru. |
| **3** | i18n | 🟡 **ODROCZONE** (świadomie) | Dług: **349×** `isPolish`/inline (grep `src/components/MyWork/canvas` + Idea*). Poza zakresem tej rundy odbioru; do domknięcia w programie i18n-sweep. |
| **4** | Tokeny kolorów (brak rose/hex; EntityStatusChip/c.*) | ✅ **MET** | 0 surowych rose-/hex inline w `IdeaMapWorkspace.tsx`/`MyIdeasListContent.tsx`/`IdeaContextPanel.tsx` (grep 2026-06-23, wyłączając stałe palety węzłów grafu); 0× `console.log` w `IdeaMapWorkspace.tsx`; `canvasLocked` = świadoma decyzja (komentarz `:375`). Karta DoD: 0 z 68 hex. |
| **5** | §27 (listy przez FilterableTable + Menu 1/2/3) | ✅ **MET** | Lista renderowana przez `TableWithPreviewLayout<MyIdea>` (`MyIdeasListContent.tsx:1790-1905`, import `:50`) + `TableFilters`/`FilterOption` z `ResizableTable` (`:54`); **0 surowych `<table>`** w MyIdeasListContent (grep). Uwaga: jeden raw `<table>` z audytu jest w `IdeasTableContent` = narzędzie M08, **poza zakresem M05** (teczka log 2026-06-20). |
| **6** | E2E w PR-gate (scenariusze S zielone) | ✅ **MET** | Contract testy: `my-work.map-sync.contract.test.ts` (S2 round-trip / S3 409→rehydracja / S6 snapshot 201, 11/11), `my-work.convert.contract.test.ts` (S5 konwersja idea→initiative, 6/6). Live E2E suite `tests/e2e/m05/` (5 specs / 47 testów, wzór API-first m04). CI Londyn skonfigurowane (`test-suite.yml`). |
| **7** | Zgodność z kanonem UI/UX | ✅ **MET** | Lista = canon §8.1 4-zone GridCard, neutral surface, brak border-l accent (`MyIdeasListContent.tsx:~1815` komentarz w kodzie); preview+full-view handoff przez TableWithPreviewLayout (kanon `TABLE_AND_PREVIEW_CANON.md`); toast konfliktu 409 zamiast cichej pustki (`IdeaMapWorkspace.tsx:451-462`); confirm-dialog przed nadpisaniem szablonu (`1f8be9b961`). 11-ekranowy capture R6 (2026-06-20) → `tests/e2e/screenshots/m05/`. |

**Wynik: 6/7 zamknięte + #3 i18n ODROCZONE.**

---

## (c) TESTY MANUALNE — link, liczba, fokus

- **Dokument:** [`Harvard/Testy manualne/TESTY_M05_IDEAS_ZARZADZANIE.md`](../Testy%20manualne/TESTY_M05_IDEAS_ZARZADZANIE.md) — **AKTUALNY** (data 2026-06-16, kod zweryfikowany bezpośrednio, mapa komponent↔plik↔stan zgodna z bieżącym kodem).
- **Liczba scenariuszy: 54 numerowanych (§N.N)** w **14 grupach funkcyjnych** (§1 gating · §2 lista/CRUD/widoki · §3 workspace/sync · §4 AI · §5 snapshoty · §6 komentarze · §7 aktywność · §8 eksport · §9 konwersja×6 · §10 search · §11 cross-module · §12 presence · §13 przekrojowe · §14 regresja).
- **Uwaga porządkowa:** istnieje identyczny duplikat `TESTY_M05_IDEAS_ZARZADZANIE 2.md` (artefakt macOS, `diff` = identyczny) — do usunięcia przy okazji, nie wpływa na odbiór.

### Co JEST pokryte automatycznie (właściciel może przejść skrótem)
- **Sync/conflict (§3.1–§3.3):** contract test S2/S3 (round-trip + 409→rehydracja) — 11/11.
- **Konwersja idea→output (§9.1):** contract test S5 link-graph edge — 6/6.
- **Snapshoty 201 (§5.1):** contract test S6.
- **Cross-org IDOR (§1.3):** integration test (HTTP /map → 404; WS → 403).
- **Eksport serwerowy flaga OFF (§8.3):** test flagi (4/4).
- **Szablon confirm-overwrite (§3.6):** test L-06 (4/4).
- **Runtime jeden writer (§3.5):** smoke test (14/14).

### Na czym właściciel powinien skupić się RĘCZNIE (nie da się/nie jest auto-pokryte)
1. **§2.4 Trzy widoki listy (table/grid/garden)** [MANUAL] — wizualna spójność, przełączanie.
2. **§3.4 Flush przy zdarzeniach** (visibilitychange/online/Cmd+S, unmount) [MANUAL] — czy nic nie ginie przy szybkim zamknięciu karty.
3. **§4.1–§4.4 AI** (suggestions/expand/gap/generate) — realny LLM, jakość wyjścia, akceptacja węzłów przez usera.
4. **§8.1 Eksport klientowy** (PNG/SVG/PDF/MD/JSON) [MANUAL] — realny plik się pobiera i otwiera.
5. **§9.2–§9.6 Konwersja do pozostałych 5 outputów** (Task Set/Decision/Report/Presentation/Team Chat) — auto-pokryta tylko Inicjatywa (S5); resztę zweryfikować w Network+DB.
6. **§11 Ścieżki cross-module** (Czat→Idea, Notatnik→Idea, Idea→Inicjatywy, Idea→Canvas, Idea→Outputs) [MANUAL/DB] — handoffy między modułami.
7. **§13.6 Dark mode** [MANUAL] — wszystkie ekrany light+dark.
8. **§13.5 i18n PL/EN** [MANUAL] — **ŚWIADOMIE ODROCZONE (DoD #3)** — można pominąć w tej rundzie odbioru, ale jest to znany dług 349×.

---

## (d) TESTY DODANE W TEJ SESJI

**Brak — nie było potrzeby.** Zadanie #2 prosiło o napisanie testu regresji cross-org **jeśli go nie ma**. Po grepie i odczycie okazało się, że obie warstwy są już pokryte:
- **WS org-scope (Org B → 403):** `tests/integration/gateways/ideaCollabWs.orgscope.test.ts` — pełny harness (real HTTP server + raw TCP, mock `getDatabase`), 6 testów w tym `403 when idea belongs to a different org` (linia 136). To dokładnie test, którego teczka wymagała ("kod OK, dodać test") — **już istnieje** (M07 L-02, dziedziczony przez wspólny kręgosłup puli).
- **HTTP /map cross-org → 404:** `tests/integration/mywork/my-work.map-orgread.contract.test.ts:145` (`idea outside the org → 404 (no cross-org leak)`).

Pisanie nowego testu byłoby duplikacją istniejącej, działającej regresji. Flaga teczki "dodać test" jest **nieaktualna** — należy zaktualizować notatkę w karcie §6 / teczce, że test WS org-scope został dostarczony.

---

## REZYDUALNE GAPY (uczciwie)
1. **L-02 / L-07 deploy-time na PROD:** migracja `20260611` (snapshots/activity) i retire-migracja `901` (drop versions) wymagają potwierdzenia/aplikacji na centerbeam przy deploy Londyn→prod (jawna zgoda Piotra — [[feedback_prod_caution]]). **To checkpoint wdrożeniowy, nie brak kodu** — staging zweryfikowany.
2. **Presence channelId org-scope = P2** (`my-work.routes.ts:8901`) — niskie ryzyko, nie blokuje odbioru; nie ma w nim danych mapy.
3. **i18n #3 = 349× dług** — świadomie odroczone, poza zakresem.
