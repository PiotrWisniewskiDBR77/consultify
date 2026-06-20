# TECZKA M04 — Notatnik (Notebook) (pogłębiona do M13-level)

> Teczka = **cienki indeks + reconciliation**, NIE duplikat. Linkuje istniejące (karta audytu + `NOTEBOOK_STRUCTURE_SSOT.md` + SPEC_07 + kod) i dokłada brakujące ogniwa (Rejestr Wejść z uwagami żywymi #6/#7/#8 · Rejestr Decyzji · DoD z liczbami · **korekta staleności**). Wzór głębi: [`M13-inicjatywy.md`](M13-inicjatywy.md) · struktura: [`_WZORZEC_TECZKI.md`](_WZORZEC_TECZKI.md) · decyzje: [`_DECYZJE.md`](_DECYZJE.md) (**DP-2 globalny dok IDE-tabs zamyka M04-D01/D02**). SPEC: `Harvard/SPEC_ZADANIE_07_notebook_workspace.md`.

## 00 · Nagłówek
- **Moduł:** M04 Notatnik (Notebook) · **Pula:** beta · **Faza:** FAZA 3 (szlif beta)
- **Ocena audytu:** 52/100 · **Tier:** Alpha · **Rozmiar:** L (3–5 dni)
- **Żywy bloker:** handoff Radar/Inicjatywy **PÓŁ-MARTWY** (toast kłamie, 0 INSERT) — WSPÓLNA naprawa z M21; + 3 uwagi żywe powłoki (#6/#7/#8)
- **Właściciel:** Piotr · **Daty:** karta 2026-06-11 (`a4bb33a1bb`) · teczka 2026-06-13
- **Karta:** `Harvard/modules/M04-notatnik/KARTA_AUDYTU.md` · **SSOT struktury:** `docs/product/NOTEBOOK_STRUCTURE_SSOT.md`
- **Kod:** `src/components/MyWork/NotebookContent.tsx` (~2900 l.) · `…/NotebookLibraryContent.tsx` · `src/components/MyWork/notebook/` (`NotebookCanonicalPathStrip.tsx`, `AIChatInlinePanel.tsx`, `NotebookContextPanel.tsx`, `AITopicsPanel.tsx`, `ActionItemsPanel.tsx`, `SlashMenu.tsx`, `ConvertChecklistModal.tsx`) · `src/components/MyWork/MyWorkHub.tsx` (renderCommandRow) · `server/src/routes/my-work/notebook.routes.ts` · `server/src/routes/v8/notebook.routes.ts` · `server/src/services/v8/notebookHandoffService.ts` · `notebookConversionService` · `src/types/myWork.ts` (NotebookPageStatus/VerificationStatus)
- **SPEC:** `Harvard/SPEC_ZADANIE_07_notebook_workspace.md` (lekki workspace + konsolidacja prawego panelu)

## MAPA POKRYCIA
| Warstwa | Stan | Źródło (istnieje) | Co dokłada teczka |
|---|---|---|---|
| A Intencja | 🟢 | karta + `NOTEBOOK_STRUCTURE_SSOT.md` + `[[project_notebook_structure_overhaul]]` | job-to-be-done + persony + zakres (niżej) |
| B UX docelowe | 🟢 | karta §5 + SPEC_07 + biblioteka L1 (A-tier §27) | **L0→L3 layout + WSZYSTKIE stany + docelowy trzeci panel #6 + lekki workspace #7 + Menu3 #8** (niżej) |
| C Dane+API+reguły | 🟢 | karta §1e/§1f + migracje | **enumeracja live (21) + v8 (10) endpointów + maszyny stanów + reguła leak** (niżej) |
| D AI/Teresa | 🟢 | karta §1 (4/5 realny LLM) | auto-klasyfikacja = heurystyka (#9, L-06) |
| E Integracje | 🟢 | karta §1g | convert-to×7 + handoff PÓŁ-MARTWY |
| F Epiki | 🟢 | poprzedni WP §3 + SPEC_07 | **epiki→stories→Gherkin→L-xx** (niżej) |
| G DoD/jakość | 🟢 | karta §0/§2 | **liczby grep + korekta staleności (i18n recount)** (niżej) |
| H Governance | 🟢 (dołożone) | karta §1/§6 | **Rejestr Wejść (#6/#7/#8) + Decyzji + R3** (niżej) |

---

## A · INTENCJA / PRODUKT
Kontekst: `[[project_notebook_structure_overhaul]]`. SSOT struktury: `docs/product/NOTEBOOK_STRUCTURE_SSOT.md` (warstwy L0→L1 biblioteka→L2 workspace→L3 notatka, zbudowane 2026-06-02).
- **Job-to-be-done:** osobiste/zespołowe miejsce na notatki z bogatym edytorem, które **konwertuje się w pracę** (task/decision/initiative/output) i karmi AI (backlinks/outputs).
- **Persony/role:**
  - **Konsultant** — właściciel notatki (CRUD, edycja, konwersje); RBAC owner-only na bibliotece (Edytuj/Usuń).
  - **Zespół** — visibility `project` z `project_members` (odczyt `canAccessNotebookRow`).
  - **Admin** — org-scope.
- **Zakres v1:** biblioteka L1 (§27 wzorcowa A-tier) · edytor TipTap+SlashMenu · konwersje żywe (convert-to×7) · Capture API (web-clip/email/import/upload, `visibility='private'`) · 4/5 AI realny LLM (extract-actions, suggest-topics, inline czat, AI-compose).
- **POZA v1:** Archive bez backendu („Wkrótce" — świadomie zaślepione); auto-klasyfikacja jako „AI" (to heurystyka, L-06).
- **Metryka:** % notatek przekonwertowanych w pracę z trwałym efektem (**zgodność toast↔INSERT** — dziś łamana handoffem); autosave-trwałość po reload.

## B · UI/UX — STAN DOCELOWY
**Warstwy (NOTEBOOK_STRUCTURE_SSOT):** L0 (wejście My Work) → **L1 biblioteka** (`NotebookLibraryContent`, §27 A-tier) → **L2 workspace** (`NotebookContent`: lista stron + edytor) → **L3 notatka** (strona TipTap).
**Biblioteka L1 = wzorcowa A-tier §27** (`ResizableTable`, filtry scope Wszystkie/Osobiste/Zespołowe, liczniki all/personal/team, RowActionsMenu Menu 1/2/3, RBAC owner-only) — **utrzymać**.

**Stany ekranu (docelowo każdy z komunikatem):**
- **Pusty:** biblioteka bez notatników → CTA „Nowy notatnik"; notatnik bez stron → CTA „Nowa strona".
- **Ładowanie:** skeleton tabeli; edytor spinner.
- **Błąd:** loading/error+Retry (L1 ma to); extract-actions SSE łapie błąd; suggest-topics fallback heurystyczny.
- **Pełny:** lista stron + edytor TipTap + prawy panel (Tools/Context) + Canonical Path strip.
- **Brak-uprawnień:** notatka cudzego ownera/prywatna → 404 (live route); v8 search project-leak (L-05).

**Delty docelowe:**
- **#6 (SYSTEMOWE/P1-design — POWŁOKA, DP-2):** notatnik jako pierwszoklasowy, dokowalny, **wielo-instancyjny „trzeci panel"** przeżywający zmianę modułu (IDE-tabs). Lewa lista otwartych notatników (kilka zakładek); zmiana modułu NIE zamyka. Reużyć `RightRail`/`SplitLayout`/`useTabeleRightRailPanels` — **NIE budować od zera**. Wspólne z kręgosłupem #1 Tryb C i klastrem #10. **DP-2 = globalny dok IDE-tabs** (rozstrzygnięte).
- **#7 (SYSTEMOWE/P1-design — SPEC_07):** odchudzić „CANONICAL NOTEBOOK PATH" (`NotebookCanonicalPathStrip.tsx:25-179`, zjada ~40% kanwy, duplikuje prawy panel) → slim chip `①Sources ②AI ③Review ④Convert` w nagłówku; **3 okna → JEDEN rail z 2 zakładkami**: A „Praca" (Insert/AI/Convert×7/Transform/Atrybuty — scala Tools+ActionItems+Topics+Canonical) + B „Kontekst AI" (`NotebookContextPanel` — backlinks/outputs/suggestions, ZOSTAJE). Trzeci przycisk (dymek) usunąć/scalić (D-02). Mapa „nic nie ginie": SPEC_07 §5.
- **#8 (LOKALNE/P2):** Menu 3 dla otwartego notatnika (L2) pokazuje filtry ZADAŃ (`Overdue 175 · Urgent 39 · Inbox 256`) zamiast filtrów notatek — `renderCommandRow()` ma gałąź notatnika tylko dla L1 (`MyWorkHub.tsx:2443`, `activeTab==='notebook' && !notebookOpenId`). Dodać gałąź note-domenową dla L2 (status Inbox/Active/All + scope/verification/tags). Robić razem z #7.

**Zgodność:** §27 biblioteki **wzorcowa** (utrzymać). i18n: `isPolish`/`i18n.language==='pl'` w `NotebookContent.tsx`+`notebook/*` (recount niżej). Korupcja „rose"=0 (naprawione). Hex w `notebook/`=0 (zweryfikowane grep).

## C · DANE + API + REGUŁY (kontrakt)
- **Model danych:** `notebooks`, `notebook_pages` (migracje `20260602_notebook_containers.sql` + `20260306_notebook_pages.sql`) — **bez fasady `new Map()`**; `link_graph_edges` (backlinks/refs). **Maszyny stanów (`src/types/myWork.ts`):** `NotebookPageStatus` (`:606`): `inbox · active · converted · archived`; `NotebookVerificationStatus` (`:609`): `unverified · verified · disputed`. Review cadence: Weekly/Monthly/Quarterly.
- **API — enumeracja:**
  - **Live route (`my-work/notebook.routes.ts`, org+owner+visibility scoped — CZYSTY):** notatniki `GET /notebooks` (L187), `POST /notebooks` (L215), `GET /notebooks/:id` (L257), `PUT /notebooks/:id` (L282), `DELETE /notebooks/:id` (L359). Strony `GET /notebook/pages` (L394), `GET /notebook/pages/:id` (L776), `POST /notebook/pages` (L515), `PUT /notebook/pages/:id` (L1096) + `/pin` (L1257) + `/status` (L1290), `DELETE /notebook/pages/:id` (L1229). Załączniki `POST /:id/attachments` (L881, 25MB/blocked-ext/path-traversal), download (L972), `GET /:id/source-file` (L841). AI/konwersje `POST /:id/convert` (L1331), `/extract-actions` (L1390, LLM), `/suggest-topics` (L1483, LLM+fallback), `/classify` (L1612, **heurystyka L-06**). Capture `POST /notebook/upload` (L712).
  - **v8 handoff (`v8/notebook.routes.ts`):** `GET /search` (L72, **project-leak L-05**), `POST /handoff/radar` (L119), `/handoff/inicjatywy` (L139), `/handoff/teresa` (L159), `/handoff/validate` (L179, bez autoryzacji obiektu L-07), `GET /resolve/:noteId` (L300), `/preview/:noteId/attachments/:attachmentId` (L235), `/contract` (L210), `/attachment-lifecycle` (L197), `PUT /pages/:noteId/content` (L408).
- **Reguły biznesowe:**
  - **Convert-to gate:** `canConvertDeliverable` = wordCount≥80 lub ≥2 nagłówki (`NotebookContent.tsx:696-702`) → outline-gated dla Assessment/Report/Presentation; Initiative/Task/Decision/Idea direct.
  - **Handoff PÓŁ-MARTWY (L-01):** `notebookHandoffService.ts` (619 l.) buduje payload, **0 INSERT** (`:429`), a FE toast „Wysłano" (`NotebookContent.tsx:1655,1671`) — nic nie powstaje. Cross-user leak NAPRAWIONY (`:322` + `userId` propagowany).
  - **v8 search leak (L-05):** `notebookSearchService.ts:188-196` zwraca `visibility='project'` po samym `project_id IS NOT NULL` — **brak `project_members` check** → leak tytułów/snippetów.

## D · AI / TERESA
- **Co generuje:** ekstrakcja akcji, sugestie tematów, backlinks/outputs (4/5 realny LLM). Treść konwersji wg formuł docelowych modułów. **Wejścia kontekstu:** treść strony, backlinks, linked outputs.
- **Granica/dług:** **auto-klasyfikacja (#9) nazwana „AI classify" to keyword-scoring, NIE LLM** (`notebook.routes.ts:1633-1692`) — oznaczyć jako heurystykę lub podpiąć LLM (L-06). AICommand (ask/expand/challenge/action) + AIChat inline = realne LLM; AI jako akcja inline (slash/⌘), nie osobny panel (SPEC_07 §2).

## E · INTEGRACJE — mapa połączeń
Pełna tabela: karta §1g. **→** M03 (task/decision, checklist→zadania), M13 (initiative), M17 (report/presentation przez `notebookConversionService`+`link_graph_edges`), M02 (Canvas „Rozwiń w dokument" `notebookExpandToDocument.ts`), M05 (save-as-idea). Capture **←** web/email/import/upload.
**Handoff Radar/Inicjatywy PÓŁ-MARTWY:** WSPÓLNA ścieżka z M21 — **naprawić RAZ** (L-01, Sprint 4). Convert-to×7 + link-graph + outputs registry = krytyczne mosty, których redesign #6/#7 NIE może zgubić (SPEC_07 §3).

## F · EPIKI → STORIES → ZADANIA
**EPIK 1 — Handoff prawdziwy (P1, WSPÓLNE z M21) [L-01]:**
- Story 1.1: jako user chcę, by „Wysłano do Radar/Inicjatyw" było prawdą. *Dane:* notatka. *Gdy:* klikam handoff. *Wtedy:* Radar/Inicjatywa REALNIE powstaje (INSERT) LUB brak kłamliwego toastu. → Z: realny INSERT (`notebookHandoffService.ts:429`) lub usunąć toast (D-03, koordynacja M21).

**EPIK 2 — Powłoka „trzeci panel" (#6/#7, DP-2) [L-02/L-03]:**
- Story 2.1: jako user chcę, by notatniki przeżywały zmianę modułu. *Dane:* otwarty notatnik. *Gdy:* przechodzę do innego modułu i wracam. *Wtedy:* notatnik wciąż w trzecim panelu (IDE-tabs). → Z (DP-2): reużyć `RightRail`/`SplitLayout`, wspólny `workspace right-rail`.
- Story 2.2: *Dane:* otwarta notatka. *Gdy:* patrzę na kanwę. *Wtedy:* slim chip `①②③④` zamiast wielkiego paska; 1 rail z 2 zakładkami. → Z (SPEC_07 4a/4b, D-02).

**EPIK 3 — Menu 3 L2 (#8) [L-04]:**
- Story 3.1: *Dane:* otwarty notatnik (L2). *Gdy:* patrzę na command-row. *Wtedy:* filtry NOTATEK (status/scope), NIE `Overdue/Urgent/Inbox`. → Z: gałąź note-domenowa w `renderCommandRow` (`MyWorkHub.tsx:2443`).

**EPIK 4 — Bezpieczeństwo [L-05/L-07]:**
- Story 4.1: *Dane:* notatka projektowa, user spoza `project_members`. *Gdy:* v8 search. *Wtedy:* niewidoczna. Story 4.2: `/handoff/validate` autoryzacja obiektu.

**EPIK 5 — Szlif [L-06/L-08/L-11]:** auto-klasyfikacja oznaczona heurystyką; wytnij martwy `KnowledgePulse`/`InsertMenu`; fix dedup `backlink-1`; i18n recount→`t()`.
**EPIK 6 — Testy [L-09]:** TipTap autosave+SlashMenu (S3/S4), roundtrip DB, S5 bez fałszywej zieleni, 8 `it.todo`→realne.

## G · JAKOŚĆ / WERYFIKACJA
| # | Kryterium | Miara M04 (grep 2026-06-13) |
|---|-----------|-----------|
| 1 | Front↔back | handoff żywy (realny INSERT) lub toast usunięty — zero kłamliwego toastu; konwersje+Capture trwałe po reload; Menu 3 L2 pokazuje filtry notatek |
| 2 | Bezpieczeństwo | v8 handoff owner/visibility scoped (✅ `:322`, z testem cross-user); v8 search z `project_members` check; live route czysty (już) |
| 3 | i18n | **~186** użyć `isPolish`/`i18n.language==='pl'` w `NotebookContent.tsx`+`notebook/*` (non-test) → `t()`. **R3-KOREKTA: poprzednia teczka twierdziła „1" (tylko `:613`) — realnie ~186 (factory `getDeliverableGuardMessage` + wiele odgałęzień); WP twierdził „toasty EN-only" — to inny, mniejszy dług** |
| 4 | Tokeny | **0** hex w `src/components/MyWork/notebook/` *(grep potwierdzony)*; **`sharose` korupcja = 0 (naprawione)**. R3: WP „rose + 18 hardkodów" — w `notebook/` realnie 0 |
| 5 | §27 | **0** surowych `<table>` — biblioteka L1 przez `ResizableTable` (A-tier, utrzymać); Archive świadomie zaślepione |
| 6 | E2E w PR-gate | TipTap autosave + SlashMenu + handoff owner-check zielone na `Londyn` |

**Scenariusze S1–S8** (karta §0): S1 biblioteka L1, S2 CRUD→trwałość (mock), S3 TipTap autosave (0 testów edytora), S4 SlashMenu+AI (ZERO), S5 ekstrakcja AI (fałszywa zieleń — INSERT proposala klienta), S6 konwersje (handoff nieweryfikowany), S7 załączniki, S8 Capture. **CI:** `test-suite.yml` tylko `[main,develop]`; default `Londyn` → PR-gate ≈ 0. Bezpieczeństwo: karta §6 (live route czysty; v8 handoff naprawiony; v8 search luźne).

## H · GOVERNANCE / STEROWANIE

### 01 · Rejestr wejść (R1)
| ID | Źródło | Data | Treść (1 zd.) | → Luka |
|----|--------|------|----------------|--------|
| W-01 | Karta audytu §1–§7 | 2026-06-11 | rdzeń realny; handoff pół-martwy; live route czysty | L-01,L-05..L-09 |
| W-02 | **Uwaga żywa #6 — brak trwałego „trzeciego panelu" (SYSTEMOWE/P1-design)** | 2026-06-13 | dokowalny, wielo-instancyjny panel przeżywający nawigację | **L-02 (D-01→DP-2)** |
| W-03 | **Uwaga żywa #7 + SPEC `SPEC_ZADANIE_07`** | 2026-06-13 | odchudzić Canonical Path + 1 rail z 2 zakładkami | **L-03 (D-02)** |
| W-04 | **Uwaga żywa #8 — Menu 3 L2 pokazuje filtry zadań** | 2026-06-13 | `renderCommandRow` brak gałęzi note-domenowej dla L2 | **L-04** |
| W-05 | `docs/product/NOTEBOOK_STRUCTURE_SSOT.md` | 2026-06-02 | warstwy L0-L3 (NIE opisuje trzeciego panelu — #6 wykracza) | B (kanon), L-02 |
| W-06 | `_DECYZJE.md` **DP-2 (globalny dok IDE-tabs zamyka M04-D01/D02)** | 2026-06-13 | jeden workspace-rail; notatka in-context | L-02,L-03 |
| W-07 | Feedback prod / Sprint 4 (handoff wspólny z M21) | — | jedna ścieżka handoff | L-01 |

### 02 · Stan obecny (prawda kodu) — karta §1. Rdzeń realny (bez fasady). Handoff PÓŁ-MARTWY (0 INSERT). Live route czysty. **R3-korekta:** `sharose`=0, hex `notebook/`=0; **i18n recount: poprzednia teczka zaniżyła do „1" — realnie ~186** (`NotebookContent.tsx` factory + odgałęzienia).

### 03 · Rejestr luk (= docelowy − obecny)
| ID | Opis | Wejście | Dowód `plik:linia` | Klasa | Faza | Status | Zweryf. |
|----|------|---------|--------------------|-------|------|--------|---------|
| L-01 | handoff Radar/Inicjatywy PÓŁ-MARTWY (toast vs 0 INSERT) | W-01,W-07 | ~~`notebookHandoffService.ts:429`~~ → realnie `NotebookContent.tsx:1663` | P1 (WSPÓLNE M21) | 3 | **✅ ZAMKNIĘTA — KOREKTA R3 2026-06-17: poprzedni opis FAŁSZYWY. `buildRadarHandoff/buildInitiativeHandoff` (`notebookHandoffService.ts:431,470`) NADAL tylko `return` payload — ZERO INSERT (SHA `952f309eed` NIE tknął handoffu, tylko Menu3 L-04). Realny fix = migracja na CONVERT-PATH: FE handler `handleHandoffInitiatives` (`NotebookContent.tsx:1700`) woła `Api.convertNotebookPage(activePage.id,'initiative',…)` (`:1703`) → realna encja + toast „Inicjatywa utworzona" (`:1707`) + `trackFunnelEvent('notebook_handoff')` (`:1708`) *(skoryg. 2026-06-19: było `:1663`)*. Kłamliwy toast zniknął, ale INNYM mechanizmem niż dokumentowano. TODO: zretire martwe build-only route `/handoff/radar|inicjatywy` (0 callerów FE — potw. M21).** | 2026-06-17 |
| L-02 | brak trwałego wielo-instancyjnego „trzeciego panelu" | W-02,W-05,W-06 | powłoka (`RightRail`/`SplitLayout`/`MainLayout`) | P1-design-program | 0 | **✅ ZAMKNIĘTA `a69b953b06` (2026-06-17) — DP-2 LEKKI: `notebookRailOpen`+`notebookRailTab` w `uiSlice.ts` z `partialize→localStorage`; rail przeżywa unmount/remount (nawigacja do innego modułu i powrót). Przycisk toggle w toolbarze. Dowód: `consultify-storage` localStorage zawiera oba klucze przy zimnym ładowaniu. NIE globalny IDE-tabs (Faza 4+ decyzja osobna).** | 2026-06-17 |
| L-03 | ciężki Canonical Path + rozproszony prawy panel | W-03 | `NotebookCanonicalPathStrip.tsx:25-179` | P1-design | 3 | **✅ ZAMKNIĘTA `a69b953b06` (2026-06-17) — `NotebookProgressChip.tsx` (4-pill ①Źródła②AI③Review④Konwertuj, 138l, tooltips + gate disabled) zastępuje `NotebookCanonicalPathStrip.tsx` (179l, 4 karty ~40% kanwy). `NotebookRightRail.tsx` (2 zakładki Praca+Kontekst) konsoliduje `AIChatInlinePanel`+`AITopicsPanel`+`ActionItemsPanel`+`NotebookContextPanel` w jeden togglowany rail. Stare panele usunięte z `NotebookContent.tsx`. Stan zakładki persystuje przez L-02. **(skoryg. 2026-06-19:** stary `NotebookCanonicalPathStrip.tsx` przestał być importowany (0 importerów, zweryf. grepem) ALE plik NADAL istnieje git-tracked na dysku = sierota do `rm` przy sprzątaniu; wymiana w runtime potwierdzona — `NotebookProgressChip`+`NotebookRightRail` importowane i renderowane w `NotebookContent.tsx:75-76,2579,2807`).** | 2026-06-17 |
| L-04 | Menu 3 L2 = filtry zadań (Overdue/Urgent/Inbox) | W-04 | `MyWorkHub.tsx:2443` (gałąź tylko L1) | P2 | 3 | **✅ ZAMKNIĘTA 2026-06-16** (commit `952f309eed` — `notebookPageStatusFilter` + `NotebookContent` props) | 2026-06-13 |
| L-05 | v8 search project-leak (brak `project_members`) | W-01 | `notebookSearchService.ts:193` | P2 | 3 | **✅ ZAMKNIĘTA — KOREKTA R3 2026-06-17: poprawny SHA = `fad314f93b`** (fix(notebook): add project_members membership check in search visibility filter), NIE `952f309eed`. Guard obecny `notebookSearchService.ts:193`. | 2026-06-17 |
| L-06 | auto-klasyfikacja (#9) mylnie „AI" = keyword-scoring | W-01 | `notebook.routes.ts:1633-1692` | P2 | 3 | **ZAMKNIĘTA 2026-06-17 `c1d2e21b59` (backend) + `8c3285480d` (typ api.ts, wchłonięty przez równoległy `git add -A` agenta M06) — premisa w dużej mierze nieaktualna: backend JSDoc już mówił „Heuristic classification", a FE toast nie twierdzi „AI" (`NotebookContent.tsx:1316-1318` = „Ta notatka wygląda jak X. Konwertować?"). Hardening: kontrakt jawnie deklaruje `method:'heuristic'` na OBU ścieżkach — PRIMARY V8 `v8/my-work.routes.ts:1531` (`e92d779e7b`, FE woła V8 pierwszy!) + legacy `my-work/notebook.routes.ts:1695` (`c1d2e21b59`) + typy `api.ts`/`api/v8/my-work.ts`. Test: V8 classify route asercjonuje `method:'heuristic'` (16/16 PASS)** | 2026-06-17 |
| L-07 | `/handoff/validate` bez autoryzacji obiektu | W-01 | `v8/notebook.routes.ts:179` | P3 | 3 | **FALSE POSITIVE 2026-06-17 — endpoint to STATELESS walidator kształtu payloadu: przyjmuje `{target, payload}`, woła czystą `validateHandoffPayload(target, obj)` (`notebookHandoffService.ts:531`) sprawdzającą strukturę wobec statycznego `P07_HANDOFF_TARGETS`, zwraca `{valid, missingFields}`. NIE przyjmuje noteId, NIE czyta DB, NIE ładuje żadnego obiektu org/user-scoped → nie ma obiektu do autoryzacji ani danych do wycieku. Audyt założył, że validate ładuje obiekt — nie ładuje. **ZALOCKOWANE TESTEM `e92d779e7b`** (`notebookHandoffService.validate.test.ts` 4/4: arity 2, sync, deterministyczny, brak param org/user/db → przyszły refactor wprowadzający DB-lookup zepsuje build)** | 2026-06-17 |
| L-08 | martwy `KnowledgePulse.tsx`, `notebook/InsertMenu.tsx` (0 importerów) | W-01 | grep importerów | MARTWY | 4 | **✅ ZAMKNIĘTA — USUNIĘTE Z DYSKU 2026-06-20.** Oba untracked sieroty (`src/components/MyWork/notebook/KnowledgePulse.tsx` 10.6KB + `notebook/InsertMenu.tsx` 7.3KB) fizycznie usunięte (`rm`). 0 importerów potwierdzone PRZED rm trzema grepami (import-from, `<JSX>`, resolve w MyWork) z wykluczeniem podciągu `BlockInsertMenu`. Po rm: `git status` czysty (były untracked → brak śladu), `ls notebook/` = brak plików. Build-integrity OK. | 2026-06-20 |
| L-09 | TipTap/SlashMenu 0 testów; S5 fałszywa zieleń; 8 `it.todo` | W-01 | testy notebook | P0-test | — | **✅ ZAMKNIĘTA 2026-06-20 — 0 `it.todo`/`it.skip` w testach notebook (grep). Pokrycie: `SlashMenu.behavior.test.tsx` 17/17 (`8e9ee5f435`) + `NotebookContent.manual-gate.test.tsx` (honest-error + autosave-flush-on-unmount + **autosave-debounce: 3 keystroke→1 PUT** + expand-provenance) + nowy `ActionItemsPanel.bulk-provenance.test.tsx` (FIX3: każdy bulk-task ma `sourceType:'notebook_page'`+`sourceId`) + `api-my-work-notebook-fallback.test.ts` (FIX2: 403∈lista fallbacku, lock [404,405,501]/V8_DISABLED). Edytor TipTap sam (biblioteka) zweryfikowany LIVE (→F): pisanie/slash/format/autosave-persist-po-reload działają. Suma client 73 PASS + server 76 PASS.** | 2026-06-20 |
| L-10 | cross-user leak v8 handoff prywatnej notatki | W-01 | `notebookHandoffService.ts:322` (+`userId`) | P1 | — | **NAPRAWIONA (`userId` propagowany; R3: test cross-user)** | — |
| L-11 | `isPolish` inline ~186× | W-01 | `NotebookContent.tsx:218,276,296,613…` + `notebook/*` | P3 | 4 | **ODROCZONA-Faza4 (decyzja Piotra 2026-06-17) — realnie ~200 inline-ternarów `isPolish?'PL':'EN'` (148 `NotebookContent.tsx` + 52 `notebook/*` w 14 plikach), NIE brakujące klucze. Migracja `t()` wymaga `public/locales/` (strefa zakazana) + wysoka regresja w 2900l → świadomie ODROCZONA do osobnej fali i18n (Faza 4). Nie blokuje M04 100%.** | 2026-06-17 |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | „Trzeci panel" = globalny dok (IDE-tabs) czy per-moduł? | globalny dok / per-moduł | Piotr | TBD | **ROZSTRZYGNIĘTE → DP-2: globalny dok IDE-tabs (jeden workspace-rail; notatka in-context)** |
| D-02 | Zakres lekkiego workspace #7: 3. przycisk-dymek; chip vs ikony | wg SPEC_07 §6 | Piotr | TBD | otwarta (modułowa — przy wejściu w moduł) |
| D-03 | Handoff: realny INSERT czy usunąć toast (wspólnie z M21)? | INSERT / usuń toast | Piotr | 2026-06-20 | **ROZSTRZYGNIĘTE → REALNY INSERT** (już zaimplementowany convert-path; zweryf. live: POST `/convert`→201 + 2 encje DRAFT w module Inicjatyw + badge „✓ initiative ×2"). Toast prawdziwy. Martwe build-only `/handoff/radar\|inicjatywy` (0 callerów) = retire przy M21. |

### 05 · Flagi / rollout / beta — beta core (otwarty); Capture `visibility='private'`; contextSharing personal/team per-notatnik. Archive bez backendu („Wkrótce").
### 06 · Ryzyka i założenia — #6/#7 to mini-redesign POWŁOKI (dotyka wszystkich modułów) → projektować łącznie z kręgosłupem #1 Tryb C i klastrem #10 (DP-2). Handoff wspólny z M21 — nie rozjechać dwóch napraw. Duża powierzchnia FE (`NotebookContent.tsx` ~2900 l.) — robić falami z testem nieregresji mostów. Dev `.env` → Railway PROD.
### 07 · Log + re-ocena — 2026-06-17 (Harvard 4 Runda 3): L-02 ZAMKNIĘTA + L-03 ZAMKNIĘTA (`a69b953b06`): `NotebookProgressChip` (4-pill, 138l) zastępuje `NotebookCanonicalPathStrip` (179l); `NotebookRightRail` (2 zakładki Praca+Kontekst, 153l) konsoliduje 4 osobne panele; `notebookRailOpen`/`notebookRailTab` w `uiSlice` z `partialize→localStorage` — rail przeżywa nawigację. TSC: 0 nowych błędów. Dowód: localStorage `consultify-storage` zawiera oba klucze. — 2026-06-17 (Harvard 4): L-06 ZAMKNIĘTA (`c1d2e21b59`+`8c3285480d`; heurystyka jawna w kontrakcie — premisa „mylnie AI" już nieaktualna, FE toast nie kłamie); L-07 FALSE POSITIVE (validate = stateless walidator kształtu, brak obiektu do autoryzacji); L-08 usunięte z gita (`8c3285480d`) ALE wróciły na dysk jako untracked przez git-race (skoryg. 2026-06-19) — `KnowledgePulse.tsx`+`InsertMenu.tsx` istnieją, `git status`=`??`, 0 importerów; do `rm` z dysku, NIE commitować; L-11 ZINWENTARYZOWANA (~200 inline-ternarów `isPolish` w 15 plikach — BLOKADA: migracja wymaga `public/locales` = strefa zakazana + wysoka regresja NotebookContent 2900l → decyzja Piotra, Faza 4). **UWAGA git-race:** agent M06 (`8c3285480d`) `git add -A` wchłonął część moich zmian (api.ts + delecje) — kod poprawny, w historii, ale atrybucja rozjechana. L-06 dołożona poprawka PRIMARY V8 path (`e92d779e7b`) + testy: V8 classify lock + `notebookHandoffService.validate.test.ts` 4/4 (L-07 false-positive zalockowany behawioralnie). L-09 częściowo (kontraktowe done, edytor TipTap zostaje). **Runda 2 (2026-06-17): L-09 +SlashMenu 17/17 (`8e9ee5f435`); L-11 i18n recount potwierdzony = 200 (148 NotebookContent + 52 notebook/* w 15 plikach) inline-ternar `isPolish?:`/`language==='pl'?:` — NIE brakujące klucze; migracja wymaga `public/locales` (strefa zakazana) → report-only, blokada na decyzję+dostęp.** Pozostają otwarte: L-02/L-03 (design-program DP-2 / D-02 = decyzja Piotra), L-09 (edytor TipTap, osobna fala). — 2026-06-13: teczka pogłębiona + spięta z SPEC_07 + uwagami #6/#7/#8; R3-korekta staleności (`sharose`/hex=0; **i18n recount 1→~186**); D-01 rozstrzygnięte DP-2. L-10 naprawiona — wymaga testu. Re-ocena po Fazie 3/4.

---

## Bramka teczki: 9/9 dokumentacyjnie ✅
R1 wejścia pełne (karta+SSOT+uwagi żywe #6/#7/#8+SPEC_07+DP-2+feedback) · R2 zero sierot (W→L→DoD) · R3 statusy z dowodem (**korekta staleności: `sharose`/hex=0; i18n 1→~186 recount; L-10 naprawiona — test**) · R4 DoD z liczbami (isPolish ~186, hex 0, table 0) · R5 decyzje rozstrzygnięte (D-01=DP-2; D-02/D-03 modułowe/handoff) · A–E docelowy z L0-L3 layout+stanami+enumeracją live(21)+v8(10) endpointów+maszyny stanów · F epiki↔stories↔Gherkin↔luki · G DoD+S+sec · R6 sesja żywa = test handoff/autosave (Faza 4). **Teczka kompletna do egzekucji.**

## EKRANY (inwentarz) — 2026-06-19
> Inwentarz warstw L0→L3 M04 Notatnik + panele/modale/stany. Ugruntowane w `src/components/MyWork/NotebookContent.tsx` + `src/components/MyWork/notebook/`.

| # | Ekran | Cel | Plik komponentu |
|---|-------|-----|-----------------|
| 1 | L1 Biblioteka notatników (§27 A-tier) | Lista notatników, filtry scope, RowActions Menu 1/2/3, RBAC | `src/components/MyWork/NotebookLibraryContent.tsx` |
| 2 | L2 Workspace notatnika (lista stron + edytor) | Główny widok roboczy notatnika | `src/components/MyWork/NotebookContent.tsx` |
| 3 | L3 Strona/notatka — edytor TipTap | Bogaty edytor treści | `NotebookContent.tsx` (TipTap) + `notebook/extensions.ts` |
| 4 | Slash menu (`/`) | Wstawianie bloków + AI commands | `src/components/MyWork/notebook/SlashMenu.tsx` |
| 5 | Progress chip (①Źródła ②AI ③Review ④Konwertuj) | Slim pasek postępu (zastąpił Canonical Path) | `src/components/MyWork/notebook/NotebookProgressChip.tsx` |
| 6 | Prawy rail — zakładki Praca + Kontekst | Skonsolidowany panel (Insert/AI/Convert + backlinks/outputs) | `src/components/MyWork/notebook/NotebookRightRail.tsx` |
| 7 | Panel AI inline (czat w notatce) | Inline AI czat | `src/components/MyWork/notebook/AIChatInlinePanel.tsx` |
| 8 | Panel tematów AI | Suggest-topics (LLM+fallback) | `src/components/MyWork/notebook/AITopicsPanel.tsx` |
| 9 | Panel action items | Extract-actions (LLM) | `src/components/MyWork/notebook/ActionItemsPanel.tsx` |
| 10 | Panel kontekstu (backlinks/outputs) | Kontekst AI notatki | `src/components/MyWork/notebook/NotebookContextPanel.tsx` |
| 11 | Modal konwersji checklisty | Convert checklist → zadania | `src/components/MyWork/notebook/ConvertChecklistModal.tsx` |
| 12 | Modal nowej strony | Tworzenie strony notatnika | `src/components/MyWork/notebook/NewPageModal.tsx` |
| 13 | Sekcja załączników | Upload/download (25MB, blocked-ext) | `src/components/MyWork/notebook/NotebookAttachmentsSection.tsx` |
| 14 | Stany puste/ładowanie/błąd | CTA „Nowy notatnik"/„Nowa strona", skeleton, error+Retry | `NotebookLibraryContent.tsx` / `NotebookContent.tsx` |
| 15 | Convert-to×7 + handoff (toast „Inicjatywa utworzona") | Konwersja notatki → encja (convert-path) | `NotebookContent.tsx:1606/1703` (`Api.convertNotebookPage`) |
| 16 | Menu 3 (command-row) dla L2 — filtry notatek | Filtry status/scope notatek (zamiast filtrów zadań) | `MyWorkHub.tsx` (renderCommandRow, `notebookPageStatusFilter`) |
