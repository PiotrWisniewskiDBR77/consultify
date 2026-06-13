# TECZKA M04 — Notatnik (Notebook)

> Teczka = **cienki indeks + reconciliation**, NIE duplikat. Linkuje istniejące (karta audytu + `NOTEBOOK_STRUCTURE_SSOT.md` + kod) i dokłada brakujące ogniwa (Rejestr Wejść z uwagami żywymi #6/#7/#8 · Rejestr Decyzji · DoD z liczbami · **korekta staleności** — `sharose`/18 hex/toasty EN już naprawione). Wzór: [`_WZORZEC_TECZKI.md`](_WZORZEC_TECZKI.md) · format: [`M13-inicjatywy.md`](M13-inicjatywy.md).

## 00 · Nagłówek
- **Moduł:** M04 Notatnik (Notebook) · **Pula:** beta · **Faza:** FAZA 3 (szlif beta)
- **Ocena audytu:** 52/100 · **Tier:** Alpha · **Rozmiar:** L (3–5 dni)
- **Żywy bloker:** handoff Radar/Inicjatywy **PÓŁ-MARTWY** (toast kłamie, 0 INSERT) — WSPÓLNA naprawa z M21; + 3 uwagi żywe powłoki (#6/#7/#8)
- **Właściciel:** Piotr · **Daty:** karta 2026-06-XX · teczka 2026-06-13
- **Karta:** `Harvard/modules/M04-notatnik/KARTA_AUDYTU.md` · **SSOT struktury:** `docs/product/NOTEBOOK_STRUCTURE_SSOT.md`
- **Kod:** `src/components/MyWork/NotebookContent.tsx` · `…/NotebookLibraryContent.tsx` · `src/components/MyWork/notebook/` (`NotebookCanonicalPathStrip.tsx`, `AIChatInlinePanel.tsx`, `NotebookContextPanel.tsx`) · `src/components/MyWork/MyWorkHub.tsx` · `server/src/routes/my-work/notebook.routes.ts` · `server/src/services/v8/notebookHandoffService.ts` · `notebookConversionService`
- **SPEC:** `Harvard/SPEC_ZADANIE_07_notebook_workspace.md` (lekki workspace + konsolidacja prawego panelu)

## MAPA POKRYCIA
| Warstwa | Stan | Źródło (istnieje) | Co dokłada teczka |
|---|---|---|---|
| A Intencja | 🟢 | karta + `NOTEBOOK_STRUCTURE_SSOT.md` + `[[project_notebook_structure_overhaul]]` | job-to-be-done + zakres |
| B UX docelowe | 🟢 | karta §5 + SPEC_07 + biblioteka L1 (A-tier §27) | docelowy „trzeci panel" (#6) + lekki workspace (#7) |
| C Dane+API+reguły | 🟢 | karta §1e/§1f + `notebook.routes.ts` + migracje | skrót kontraktu |
| D AI/Teresa | 🟢 | karta §1 (4/5 realny LLM) | auto-klasyfikacja = heurystyka (#9) |
| E Integracje | 🟢 | karta §1g | mosty + handoff PÓŁ-MARTWY |
| F Epiki | 🟢 | poprzedni WP §3 | przeformułowane na epiki |
| G DoD/jakość | 🟢 | karta §0/§2 | **liczby grep + korekta staleności** |
| H Governance | 🟢 (dołożone) | karta §1/§6 | **Rejestr Wejść (#6/#7/#8) + Decyzji + R3** |

---

## A · INTENCJA
Kontekst: `[[project_notebook_structure_overhaul]]`. SSOT struktury: `docs/product/NOTEBOOK_STRUCTURE_SSOT.md` (warstwy L0→L1 biblioteka→L2 workspace→L3 notatka, zbudowane 2026-06-02).
- **Job-to-be-done:** osobiste/zespołowe miejsce na notatki z bogatym edytorem, które konwertuje się w pracę (task/decision/initiative/output) i karmi AI (backlinks/outputs).
- **Persony/role:** konsultant (właściciel notatki), zespół (visibility project z `project_members`), admin (org). RBAC owner-only na bibliotece.
- **Zakres v1:** biblioteka L1 (§27 wzorcowa) · edytor TipTap+SlashMenu · konwersje żywe · Capture API (web-clip/email/import/upload) · 4/5 AI realny LLM. **POZA v1:** Archive bez backendu („Wkrótce" — świadomie zaślepione).
- **Metryka:** % notatek przekonwertowanych w pracę z trwałym efektem (zgodność toast↔INSERT); autosave-trwałość po reload.

## B · UX DOCELOWE
Biblioteka L1 = **wzorcowa A-tier §27** (`ResizableTable`, filtry scope Wszystkie/Osobiste/Zespołowe, liczniki, RowActionsMenu Menu 1/2/3) — utrzymać. Stan obecny + §27: karta §5.
- **Delta docelowa #6 (SYSTEMOWE/P1-design — POWŁOKA):** notatnik jako pierwszoklasowy, dokowalny, **wielo-instancyjny „trzeci panel"** przeżywający zmianę modułu (IDE-tabs). Reużyć `RightRail`/`SplitLayout`/`useTabeleRightRailPanels` — **NIE budować od zera**. Wspólne z kręgosłupem #1 Tryb C i klastrem #10. **Mini-redesign powłoki — wymaga decyzji zakresu (D-01).**
- **Delta docelowa #7 (SYSTEMOWE/P1-design — `SPEC_ZADANIE_07`):** odchudzić „CANONICAL NOTEBOOK PATH" (`NotebookCanonicalPathStrip.tsx:25-179`, zjada ~40% kanwy, duplikuje prawy panel) → slim chip `①Sources ②AI ③Review ④Convert`; 3 okna → JEDEN rail z 2 zakładkami (A „Praca" + B „Kontekst AI"). Mapa „nic nie ginie" w SPEC_07 §5.
- **Delta docelowa #8 (LOKALNE/P2):** Menu 3 dla otwartego notatnika (L2) pokazuje filtry ZADAŃ (`Overdue/Urgent/Inbox`) zamiast filtrów notatek — bo `renderCommandRow()` ma gałąź notatnika tylko dla L1 (`MyWorkHub.tsx:2443`, `activeTab==='notebook' && !notebookOpenId`). Dodać gałąź note-domenową dla L2.

## C · DANE + API + REGUŁY
- **Wiring/flagi:** karta §1e/§1f. Tabele realne: `notebooks`, `notebook_pages` (migracje `20260602_notebook_containers.sql` + `20260306_notebook_pages.sql`) — **bez fasady `new Map()`**.
- **Live route** `my-work/notebook.routes.ts` **czysty** (org+owner+visibility; załączniki guarded 25MB/path-traversal; Capture `visibility='private'`).
- **Reguła:** v8 search `/api/v8/notebook/search` zwraca `visibility='project'` po samym `project_id IS NOT NULL` — **brak `project_members` check** → leak tytułów/snippetów (L-05).

## D · AI / TERESA
- **Co generuje:** ekstrakcja akcji, sugestie, backlinks/outputs (4/5 realny LLM). Treść konwersji wg formuł docelowych modułów.
- **Granica:** auto-klasyfikacja (#9) nazwana „AI classify" to **keyword-scoring**, nie LLM (`notebook.routes.ts:1633-1692`) — oznaczyć jako heurystykę lub podpiąć LLM (L-06).

## E · INTEGRACJE
Pełna tabela: karta §1g. **→** M03 (task/decision), M13 (initiative), M17 (report/presentation przez `notebookConversionService`+`link_graph_edges`), M02 (Canvas). Capture **←** web/email/import/upload. **Handoff Radar/Inicjatywy PÓŁ-MARTWY:** `notebookHandoffService.ts` (619 l.) buduje payload, **0 INSERT** (`:429`), a FE pokazuje toast „Wysłano" (`NotebookContent.tsx:1655,1671`) — nic nie powstaje. **WSPÓLNA ścieżka handoff z M21 — naprawić RAZ** (L-01).

## F · EPIKI *(z poprzedniego WP §3)*
- **EPIK 1 — Handoff prawdziwy (P1, WSPÓLNE z M21):** realny INSERT (Radar/Inicjatywa powstaje) LUB usunąć kłamliwy toast (L-01).
- **EPIK 2 — Powłoka „trzeci panel" (#6/#7):** wielo-instancyjny dokowalny workspace (L-02 design) + lekki rail SPEC_07 (L-03 design); reuse `RightRail`/`SplitLayout`.
- **EPIK 3 — Menu 3 L2 (#8):** gałąź note-domenowa w `renderCommandRow` (L-04).
- **EPIK 4 — Bezpieczeństwo:** `project_members` check w v8 search (L-05); autoryzacja `/handoff/validate` (L-07).
- **EPIK 5 — Szlif:** auto-klasyfikacja oznaczona heurystyką (L-06); wytnij martwy `KnowledgePulse`/`InsertMenu` (L-08); fix dedup `backlink-1`.
- **EPIK 6 — Testy:** TipTap autosave+SlashMenu (S3/S4), roundtrip DB, S5 bez fałszywej zieleni, 8 `it.todo`→realne (L-09).

## G · JAKOŚĆ / DoD *(skwantyfikowane — grep 2026-06-13)*
| # | Kryterium | Miara M04 |
|---|-----------|-----------|
| 1 | Front↔back | handoff żywy (realny INSERT) lub toast usunięty — zero kłamliwego toastu; konwersje+Capture trwałe po reload; Menu 3 L2 pokazuje filtry notatek |
| 2 | Bezpieczeństwo | v8 handoff owner/visibility scoped (już, z testem cross-user); v8 search z `project_members` check; live route czysty (już) |
| 3 | i18n | **1** `isPolish` (`NotebookContent.tsx:613`) → `t()`. **R3: WP twierdził „toasty EN-only/isPl/isPolish inline" — realnie tylko 1 wystąpienie** |
| 4 | Tokeny | **0** hex w plikach notebook; **`sharose` korupcja = 0 (już naprawione)**. **R3: WP twierdził „korupcja rose + 18 hardkodów palety" — realnie 0** |
| 5 | §27 | **0** surowych `<table>` — biblioteka L1 przez `ResizableTable` (A-tier, utrzymać); Archive świadomie zaślepione |
| 6 | E2E w PR-gate | TipTap autosave + SlashMenu + handoff owner-check zielone na `Londyn` |

Scenariusze S1–S8: karta §0. Bezpieczeństwo: karta §6.

## H · GOVERNANCE *(dołożone ogniwa)*

### 01 · Rejestr wejść (R1)
| ID | Źródło | Data | Treść (1 zd.) | → Luka |
|----|--------|------|----------------|--------|
| W-01 | Karta audytu §1–§7 | karta | wiring/sec/plan | L-01,L-05..L-09 |
| W-02 | **Uwaga żywa #6 — notatnik bez trwałego „trzeciego panelu" (SYSTEMOWE/P1-design)** | 2026-06-13 | otwarcie notatnika ma dawać dokowalny, wielo-instancyjny panel przeżywający nawigację | **L-02 (D-01)** |
| W-03 | **Uwaga żywa #7 + SPEC `SPEC_ZADANIE_07_notebook_workspace.md`** | 2026-06-13 | odchudzić Canonical Path + skonsolidować prawy panel do 1 raila z 2 zakładkami | **L-03 (D-02)** |
| W-04 | **Uwaga żywa #8 — Menu 3 L2 pokazuje filtry zadań** | 2026-06-13 | `renderCommandRow` brak gałęzi note-domenowej dla otwartego notatnika | **L-04** |
| W-05 | `docs/product/NOTEBOOK_STRUCTURE_SSOT.md` | 2026-06-02 | warstwy L0-L3 (NIE opisuje trzeciego panelu — #6 wykracza) | B (kanon), L-02 |
| W-06 | Feedback prod / Sprint 4 (handoff wspólny z M21) | — | jedna ścieżka handoff | L-01 |

### 02 · Stan obecny (prawda kodu) — karta §1. Rdzeń realny (bez fasady). Handoff PÓŁ-MARTWY (0 INSERT). Live route czysty. **R3-korekta:** `sharose`=0, hex notebook=0, isPolish=1 (WP zawyżał dług kosmetyczny).

### 03 · Rejestr luk (= docelowy − obecny)
| ID | Opis | Wejście | Dowód `plik:linia` | Klasa | Faza | Status | Zweryf. |
|----|------|---------|--------------------|-------|------|--------|---------|
| L-01 | handoff Radar/Inicjatywy PÓŁ-MARTWY (toast vs 0 INSERT) | W-01,W-06 | `notebookHandoffService.ts:429`; toast `NotebookContent.tsx:1655,1671` | P1 (WSPÓLNE M21) | 3 | otwarta | — |
| L-02 | brak trwałego wielo-instancyjnego „trzeciego panelu" | W-02,W-05 | powłoka (`RightRail`/`SplitLayout`) | P1-design-program | 0 | **D-01** | 2026-06-13 |
| L-03 | ciężki Canonical Path + rozproszony prawy panel | W-03 | `NotebookCanonicalPathStrip.tsx:25-179` | P1-design | 3 | **D-02** | 2026-06-13 |
| L-04 | Menu 3 L2 = filtry zadań (Overdue/Urgent/Inbox) | W-04 | `MyWorkHub.tsx:2443` (gałąź tylko L1) | P2 | 3 | otwarta | 2026-06-13 |
| L-05 | v8 search project-leak (brak `project_members`) | W-01 | `notebookSearchService.ts:188-196` | P2 | 3 | otwarta | — |
| L-06 | auto-klasyfikacja (#9) mylnie „AI" = keyword-scoring | W-01 | `notebook.routes.ts:1633-1692` | P2 | 3 | otwarta | — |
| L-07 | `/handoff/validate` bez autoryzacji obiektu | W-01 | route validate | P3 | 3 | otwarta | — |
| L-08 | martwy `KnowledgePulse.tsx`, `notebook/InsertMenu.tsx` (0 importerów) | W-01 | grep importerów | MARTWY | 4 | otwarta | — |
| L-09 | TipTap/SlashMenu 0 testów; S5 fałszywa zieleń; 8 `it.todo` | W-01 | testy notebook | P0-test | — | otwarta | — |
| L-10 | cross-user leak v8 handoff prywatnej notatki | W-01 | `notebookHandoffService.ts:322` (+`userId`) | P1 | — | **NAPRAWIONA (`userId` propagowany; R3: test cross-user)** | — |
| L-11 | `isPolish` inline | W-01 | `NotebookContent.tsx:613` (1×) | P3 | 4 | otwarta | 2026-06-13 |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | „Trzeci panel" = globalny dok przeżywający nawigację (IDE-tabs) czy kontekstowy per-moduł? | globalny dok / per-moduł | Piotr | TBD (przed budową — dotyka globalnego layoutu) | otwarta |
| D-02 | Zakres lekkiego workspace #7: czym jest 3. przycisk-dymek; chip w nagłówku vs ikony w toolbarze | wg SPEC_07 §6 | Piotr | TBD | otwarta |
| D-03 | Handoff: realny INSERT czy usunąć toast (wspólnie z M21)? | INSERT / usuń toast | Piotr | TBD | otwarta |

### 05 · Flagi/rollout — beta core (otwarty); Capture `visibility='private'`. Archive bez backendu („Wkrótce").
### 06 · Ryzyka — #6/#7 to mini-redesign POWŁOKI (dotyka wszystkich modułów) → projektować łącznie z kręgosłupem #1 Tryb C i klastrem #10. Handoff wspólny z M21 — nie rozjechać dwóch napraw. Dev `.env` → Railway PROD.
### 07 · Log — 2026-06-13: teczka spięta z SPEC_07 + uwagami #6/#7/#8; R3-korekta staleności (`sharose`/18 hex/EN-toasty → realnie 0; isPolish 1). L-10 (cross-user) naprawiona — wymaga testu. Re-ocena po Fazie 3/4.

---

## Bramka teczki: 9/9 dokumentacyjnie ✅
R1 wejścia pełne (karta+SSOT+uwagi żywe #6/#7/#8+SPEC_07+feedback) · R2 zero sierot · R3 statusy z dowodem (**korekta staleności karty: `sharose`/18 hex/EN-toasty już naprawione — grep 0; L-10 cross-user naprawiona, wymaga testu**) · R4 DoD z liczbami (isPolish 1, hex 0, table 0, sharose 0) · R5 decyzje z właścicielem · A–E docelowy zlinkowany · F epiki↔luki · G DoD+S+sec · R6 sesja żywa = test handoff/autosave (Faza 4). **Teczka kompletna do egzekucji.**
