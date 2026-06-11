# M04 — Notatnik (Notebook) — Karta audytu (Protokół V1)

**Data:** 2026-06-11 · **Branch:** `feat/deliverables-light` (commit `a4bb33a1bb`) · **Audytor:** Claude + agenci (KOD/TESTY/KANON+SEC)
**Wejścia:** _MODULE_MAP_V2 wpis M04 (NOWY, brak karty 06-02) · inwentarz `Harvard/podzial/inventory/INV_B_my-work.md` (sekcja Notatnik, poz.1-19) · program `[[project_notebook_structure_overhaul]]`
**Evidence:** `Harvard/modules/M04-notatnik/evidence/` (f1_code_truth.md, f2_tests_report.md, f2_tests.log, f56_kanon_sec.md)

## OCENA: 49/100 — Tier: Alpha · status 🟦 NIEPEŁNY (Fazy 3+4 do wykonania)

| Wymiar | Waga | Punkty | Uzasadnienie (1 zdanie) |
|---|---|---|---|
| A. Realność funkcji | 25 | 19 | Rdzeń (CRUD/TipTap/konwersje/Capture) realny na DB, AI 4/5 realny LLM; ale auto-klasyfikacja to heurystyka (mylnie „AI"), handoff Radar/Inicjatywy PÓŁ-MARTWY (toast „wysłano", 0 INSERT). |
| B. Wiring i dane | 15 | 11 | Realne tabele (`notebooks`/`notebook_pages`, migracje), konwersje z `link_graph_edges`; minus: handoff buduje payload bez persystencji (FE kłamie). |
| C. Testy automatyczne | 15 | 7 | 253 PASS/0 FAIL/8 todo, ale persystencja+AI 100% mockowane, **TipTap+SlashMenu ZERO testów**, „ekstrakcja AI" to fałszywa zieleń (INSERT proposala klienta); nic w PR-gate. |
| D. Żywa użyteczność | 15 | 0 | Faza 4 niewykonana. |
| E. Kanony/UI | 10 | 7 | **§27 biblioteki L1 wzorcowa (A-tier)** + hub zgodny z NOTEBOOK_STRUCTURE_SSOT; ale korupcja „rose" (18 hardkodów) + i18n `isPolish`. |
| F. Bezpieczeństwo/dostęp | 10 | 5 | Live route CZYSTY (org+owner+visibility, Capture+załączniki guarded), ale **P1 cross-user wyciek prywatnej notatki przez v8 handoff** + P2 search project-leak. |
| G. Środowiska (Railway) | 10 | 0 | Faza 3 niewykonana. |
| **Hard cap zastosowany?** | — | — | **Faza 4 niewykonana → max 70 + „NIEPEŁNY".** BRAK cap cross-org (live route org+owner scoped; P1 to within-org cross-user leak, nie cross-org). Suma 49 < 70. |

**Werdykt jednym akapitem:** Moduł dojrzały na powierzchni rdzeniowej — biblioteka L1 i edytor stron TipTap działają na realnych tabelach (`notebooks`, `notebook_pages`, migracje `20260602_notebook_containers.sql` + `20260306_notebook_pages.sql`, **bez fasady `new Map()`**; runtime `my-work/notebook.routes.ts`), konwersje są żywe z realną persystencją (→task/decision/initiative/report/presentation przez `notebookConversionService` z INSERT-ami + `link_graph_edges`, →zadania z checklisty, →Canvas draft do M02), Capture API (web-clip/email/import/upload) realny i zasilany spoza huba, a 4/5 funkcji AI to realny LLM (`extract-actions`, `suggest-topics`, inline czat, AI-compose w slash). **§27 biblioteki L1 jest wzorcowa (A-tier)** — `ResizableTable`, filtry scope Wszystkie/Osobiste/Zespołowe, liczniki, RowActionsMenu Menu 1/2/3, RBAC owner-only w wierszu, pełne stany. **Live route bezpieczny — M04 dołącza do kohorty czystej** w warstwie głównej: każdy handler `my-work/notebook.routes.ts` robi org-match + owner-only (mutacje)/`canAccessNotebookRow` (odczyt z `project_members`), typologia personal/team egzekwowana, załączniki guarded (25MB, blocked-ext exe/sh/ps1, path-traversal), Capture wymusza `visibility='private'`. **Cztery realne długi obniżają zaufanie:** (1) **P1 cross-user wyciek prywatnej notatki przez v8 handoff** — `/handoff/radar|inicjatywy|teresa` (`notebookHandoffService.ts:322`) ładuje notatkę `WHERE id=? AND organization_id=?` **bez owner/visibility check** (selektuje `owner_user_id`, ale nie filtruje), więc dowolny kolega z org podaje `noteId` cudzej **prywatnej** notatki i dostaje 201 z jej treścią (do 5 akapitów `content_text`) + `download_ref` do załączników — omija owner-check live route'a (zweryfikowane osobiście; FE woła z `NotebookContent.tsx:1651,1667`); (2) **handoff PÓŁ-MARTWY** — `notebookHandoffService` (619 l.) NIE MA żadnego INSERT, buduje payload i zwraca, a FE pokazuje toast „Wysłano do Radar/Inicjatyw" mimo że nic nie powstaje (fake feature + powyższy leak); (3) **auto-klasyfikacja (#9) to keyword-scoring, nie LLM** (`notebook.routes.ts:1633-1692`) podpięte pod nazwę „AI classify"; (4) **testy hollow** — 253 zielonych, ale persystencja+AI w 100% mockowane, TipTap+SlashMenu bez testów, „ekstrakcja AI" w teście to INSERT proposala klienta (fałszywa zieleń). Drobne: P2 search `/api/v8/notebook/search` zwraca notatki `visibility='project'` bez `project_members` (wyciek tytułów/snippetów między zespołami); korupcja „rose" (18 hardkodów palety w `AIChatInlinePanel`, kosmetyczna, quick-fix `sharose`→`shared`); martwy `KnowledgePulse.tsx`/`InsertMenu.tsx`. Sufit oceny: niewykonane Fazy 3+4 + hollow testy.

---

## 0. Zakres i scenariusze krytyczne (FAZA 0)
**Checklist:** INV_B sekcja Notatnik, poz.1-19.
**Scenariusze krytyczne (8):**
1. **S1** — Biblioteka L1 (filtry/liczniki).
2. **S2** — CRUD notatnika (rename/archive/delete) → trwałość.
3. **S3** — Strona + edytor TipTap → autosave/trwałość.
4. **S4** — SlashMenu bloki + AI.
5. **S5** — Ekstrakcja akcji AI.
6. **S6** — Konwersje (→output/→zadania/→Canvas).
7. **S7** — Załączniki upload/download.
8. **S8** — Capture API.
**Obowiązujące kanony:** §27 — **TAK** (biblioteka L1) · CARD_CONTENT_FORMULA: **N/D** (dokumenty TipTap) · wzorzec: My Work + NOTEBOOK_STRUCTURE_SSOT (L1→L2, personal/team) · gating: **otwarte**.

## 1. Prawda kodu (FAZA 1)
> Raport: `evidence/f1_code_truth.md`. Werdykty: **REALNE 15 · pół-martwe/mylne 2 (handoff, klasyfikacja) · MARTWE 2 (KnowledgePulse, InsertMenu).**

### 1a. REALNE (zweryfikowane)
- Biblioteka L1, CTA, CRUD (`notebook.routes.ts:188-360`), TipTap edytor, SlashMenu (`:45-242`), extract-actions (LLM), suggest-topics (LLM + fallback), inline czat (LLM), załączniki, pin/status, konwersje →task/decision/initiative/report/presentation (`notebookConversionService` + `link_graph_edges`), →zadania z checklisty, →Canvas (M02), szablony, strip ścieżki, Capture API (`visibility='private'`).

### 1b. MOCK / STUB / mylnie nazwane
- **[P2] Auto-klasyfikacja (#9) = heurystyka keyword-scoring, NIE LLM** (`notebook.routes.ts:1633-1692`) — podpięte pod „AI classify".
- **[mylne] WorkspacePanelStrip (#10)** — Notebook używa `AIChatInlinePanel`; Strip żyje w Ideas (inwentarz mylny).

### 1c. ZEPSUTE / WIDOCZNE-ALE-ZEPSUTE
- **[P1] Handoff Radar/Inicjatywy PÓŁ-MARTWY** — `notebookHandoffService` (619 l.) buduje payload, **0 INSERT**, a FE toast „Wysłano do Radar/Inicjatyw" (`NotebookContent.tsx:1655,1671`) — nic nie powstaje. (+ leak treści, sekcja 6.)
- **[P3] Korupcja „rose"** — codemod `shared`→`sharose` w komentarzu+etykietach `AIChatInlinePanel.tsx:3,449,497,500` + 18 hardkodów palety; quick-fix `sharose`→`shared`.

### 1d. UKRYTE / MARTWY KOD
- **[MARTWY] `KnowledgePulse.tsx`, `notebook/InsertMenu.tsx`** — 0 importerów (Reports używa `BlockInsertMenu`) → wytnij.

### 1e. Wiring FE↔BE↔DB
| Funkcja | Endpoint/serwis | Tabela DB | Status |
|---|---|---|---|
| Notatniki/strony CRUD | `my-work/notebook.routes.ts` | notebooks, notebook_pages | DZIAŁA (org+owner-scoped) |
| Konwersje | `notebookConversionService` | tool_sessions/initiatives/tasks + link_graph_edges | DZIAŁA (real persist) |
| Capture | `notebook.routes.ts` (connectors) | notebook_pages (`visibility='private'`) | DZIAŁA |
| Załączniki | upload/download | org+page-scoped storage | DZIAŁA (guarded) |
| Handoff Radar/Inicjatywy | `v8/notebook.routes.ts:119`→`notebookHandoffService` | — (brak INSERT) | **PÓŁ-MARTWY + leak (P1)** |

### 1f. Flagi
| Flaga | Default | Wpływ |
|---|---|---|
| moduł otwarty | — | dostępny dla zalogowanych (My Work) |
| contextSharing (personal/team) | per-notatnik | typologia widoczności |

### 1g. Połączenia międzymodułowe
| Kierunek | Moduł | Mechanizm | Status |
|---|---|---|---|
| WYJŚCIE → | M17 Outputs | convert → report/presentation | DZIAŁA |
| WYJŚCIE → | M03 My Work | convert → task/decision, checklist→zadania | DZIAŁA |
| WYJŚCIE → | M02 Canvas | expand → draft | DZIAŁA |
| WYJŚCIE → | M05 Ideas | save-as-idea | DZIAŁA |
| WYJŚCIE → | M13/Radar | handoff Radar/Inicjatywy | **PÓŁ-MARTWY (toast kłamie) + leak** |
| WEJŚCIE ← | spoza huba | Capture API (web-clip/email/import) | DZIAŁA |

## 2. Testy automatyczne (FAZA 2)
> Raport: `evidence/f2_tests_report.md` · log: `f2_tests.log`.
**Uruchomienie (lokalnie @ `a4bb33a1bb`):** **253 PASS / 0 FAIL / 8 todo** (22 pliki).
**Root-cause „0 FAIL":** żaden test nie dotyka realnej DB/LLM — `queryHelpers`/`Database`/`fetch`/`fs`/serwisy AI mockowane → schema-drift/rola-iris nie ujawnią się. 1 React warning (duplikat klucza `backlink-1`) — realny, test zielony.
**Pokrycie scenariuszy:**
| Scenariusz | FE | BE | E2E | PR-gate | Luka |
|---|---|---|---|---|---|
| S1 biblioteka L1 | ✓ | ✓ | ✗ | ✗ | filtry/liczniki płytko |
| S2 CRUD→trwałość | ✓ mock | ✓ mock | ✗ | ✗ | trwałość=0 (mock) |
| S3 TipTap autosave | ⚠️ | todo | ✗ | ✗ | **0 testów edytora** |
| S4 SlashMenu+AI | ✗ | ✗ | ✗ | ✗ | **ZERO** |
| S5 ekstrakcja AI | ⚠️ | mock | ✗ | ✗ | **fałszywa zieleń** (INSERT proposala klienta) |
| S6 konwersje | ✓ | payload | ✗ | ✗ | realny handoff nieweryfikowany |
| S7 załączniki | ⚠️ | ✓ mock fs | ✗ | ✗ | — |
| S8 Capture | — | ✓ mock | ✗ | ✗ | kontrakt OK, brak ingestu |

**CI:** `test-suite.yml` tylko `[main,develop]`; default `Londyn` → PR-gate ≈ 0; zero E2E.
**Backlog testowy:** [P0] B1 SlashMenu, B2 TipTap autosave, B3 realny roundtrip DB (schema-drift); [P1] B4 8 `it.todo`→realne, B5 realny handoff konwersji, B6 E2E core-flow; [P2] B7 fix dedup kluczy, B8 ingest capture, B9 AI prompty.

## 3. Środowiska / Railway (FAZA 3)
**Status: NIEWYKONANE (PENDING).** Smoke: CRUD notatnika/strony, autosave, extract-actions (LLM), Capture, **próba handoff cudzej prywatnej notatki (P1 read-only proof)**, konwersje. Migracje `notebooks`/`notebook_pages` zastosowane?. **Uwaga DB:** dev `.env` może wskazywać Railway PROD.
| Aspekt | Staging | Prod | Werdykt |
|---|---|---|---|
| Wdrożony commit / migracje / flagi / smoke / logi | — | — | PENDING |

## 4. Żywa weryfikacja frontu (FAZA 4 — Claude osobiście)
**Status: NIEWYKONANE (PENDING).** 8 scenariuszy; szczególnie: S3 TipTap autosave→reload trwałość, S6 konwersje (realny handoff vs toast), **P1 handoff prywatnej notatki kolegi (read-only proof)**, handoff Radar (czy toast kłamie — nic nie powstaje), auto-klasyfikacja (czy to AI czy heurystyka).
| # | Scenariusz | Wynik | Dowód |
|---|---|---|---|
| S1–S8 | — | PENDING | evidence/f4_* |

## 5. Kanony i standardy (FAZA 5)
> Raport: `evidence/f56_kanon_sec.md`.
**§27 (NotebookLibraryContent.tsx): WZORCOWA, A-tier** — `ResizableTable`, filtry scope (Wszystkie/Osobiste/Zespołowe) w Menu 3 + header-filter Kontekst, liczniki all/personal/team, RowActionsMenu Menu 1/2/3, RBAC owner-only (Edytuj/Usuń), stany loading/error+Retry/empty. Jedyny dług: Archive bez backendu (slot „Wkrótce", świadomie zaślepiony — nie milczący).
**Wzorzec hubowy:** zgodny z My Work + NOTEBOOK_STRUCTURE_SSOT (L1→L2, CTA Menu 2, typologia personal/team + flaga contextSharing).
**i18n:** `isPl`/`isPolish` (jak M19/M21), pełne PL/EN; mikro-braki — toasty EN-only `NotebookContent.tsx:903,912` (P3).
**Korupcja „rose":** **POTWIERDZONA** — 18 hardkodów palety w `AIChatInlinePanel.tsx` (`:97-99,392,442,565,614`) + dalsze w `NotebookContent.tsx`. Dług tokenizacji (P3).
**Stany / degradacja AI:** solidna — suggest-topics fallback heurystyczny, extract-actions SSE łapie błąd.
**CARD_CONTENT_FORMULA:** N/D potwierdzone.

## 6. Bezpieczeństwo i dostęp (FAZA 6)
> Raport: `evidence/f56_kanon_sec.md`. **Live route czysty; wycieki w warstwie v8.**
| Warstwa | Stan | Dowód |
|---|---|---|
| Live route (`my-work/notebook`) | CZYSTY | org-match + owner-only/`canAccessNotebookRow` (`notebookContainerService.ts:74-99`) |
| Załączniki | guarded | 25MB, blocked-ext, path-traversal, owner-only, org+page-scoped |
| Capture API | czyste | `verifyToken`, org-header walidowany membership, `visibility='private'` |
| v8 handoff | **DZIURAWE (owner/visibility skip)** | `notebookHandoffService.ts:322` |
| v8 search | **luźne (project bez membership)** | `notebookSearchService.ts:188-196` |

**Findingi:**
- **[P1] cross-user wyciek prywatnej notatki przez v8 handoff** — `/handoff/radar|inicjatywy|teresa` (`v8/notebook.routes.ts:119-174`, `notebookHandoffService.ts:322`) `SELECT ... WHERE id=? AND organization_id=?` **bez owner/visibility** → dowolny user org podaje `noteId` cudzej prywatnej notatki → 201 z treścią (do 5 akapitów) + `download_ref` załączników. **Zweryfikowane osobiście.** Within-org cross-user leak (nie cross-org → nie hard cap, ale defeat modelu „private"). Fix: dodać owner/visibility check jak live route.
- **[P2] search project-leak** — `/api/v8/notebook/search` (`notebookSearchService.ts:188`) zwraca `visibility='project'` bez `project_members` (warunek tylko `project_id IS NOT NULL`) → wyciek tytułów/snippetów notatek projektowych między zespołami w org.
- **[P3]** `/handoff/validate` bez autoryzacji obiektu (czysta walidacja kształtu); prompt-injection przez treść w extract-actions (bounded — propozycje za zgodą).

**OK/czyste:** live route org+owner+visibility scoped; Capture API; załączniki guarded; sekrety/PII w logach czyste (treść notatki nie logowana).

## 7. PLAN DOKOŃCZENIA (FAZA 8)
### Fala 1 — Integralność (P1)
1. **Owner/visibility check na v8 handoff** — `loadNote` w `notebookHandoffService` musi respektować owner/visibility/`canAccessNotebookRow` jak live route — Weryfikacja: handoff cudzej prywatnej notatki → 403/404; test cross-user.
2. **`[INTEGRACJA — INTEGRACJE.md §C poz.2 / Sprint 4 / W6]`** Naprawa handoff PÓŁ-MARTWEGO — albo realny INSERT (Radar/Inicjatywy faktycznie powstają), albo usunąć kłamliwy toast „Wysłano" (`notebookHandoffService.ts:429` — 0 INSERT). Koordynacja z M21 (wspólna ścieżka) — naprawić RAZ — Weryfikacja: toast zgodny z efektem.
3. **project_members check w v8 search** — Weryfikacja: notatka projektowa bez membership → niewidoczna w search.

### Fala 2 — Domknięcie wartości (P2)
1. **Oznaczyć auto-klasyfikację jako heurystykę** (nie „AI") lub podpiąć realny LLM — Weryfikacja: nazwa zgodna z mechanizmem.
2. **Testy realnej persystencji + edytora** — TipTap autosave, SlashMenu, roundtrip DB (8 `it.todo`→realne) — Weryfikacja: testy dotykają DB, nie mocka.
3. **Capture ingest test** + realny handoff konwersji — Weryfikacja: pełna pętla zielona.

### Fala 3 — Jakość i kanony (P3)
1. **Korupcja „rose"** — `sharose`→`shared` + 18 hardkodów palety → tokeny (`AIChatInlinePanel`) — Weryfikacja: 0 hardkodów.
2. **Wytnij martwy kod** `KnowledgePulse.tsx`/`InsertMenu.tsx` + fix dedup klucza `backlink-1` + toasty EN-only — Weryfikacja: 0 referencji, brak warningów.
3. **CI** — `Londyn` w PR-gate + E2E core-flow (systemowe) — Weryfikacja: biegnie na PR.

### Definition of Done (odhaczane przy realizacji)
- [ ] 1. Testy auto FE+BE scenariuszy krytycznych (zwł. TipTap/SlashMenu + handoff owner-check) zielone w CI
- [ ] 2. Żywa weryfikacja Claude'a: pełny skrypt Fazy 4 PASS z dowodami
- [ ] 3. Railway: migracje + smoke 200 + czyste logi
- [ ] 4. Kanony: korupcja rose, tokeny kolorów
- [ ] 5. Zero WIDOCZNE-ALE-ZEPSUTE (handoff toast kłamie, martwy kod)
- [ ] 6. Handoff/search owner+visibility scoped (P1/P2 zamknięte)

---
**Pozostałe do domknięcia audytu M04:** Faza 3 (Railway) + Faza 4 (żywe 8 scenariuszy). **Blocker P1: cross-user wyciek prywatnej notatki przez v8 handoff** (defeat „private", napraw owner-check) + handoff pół-martwy (toast kłamie). Live route + §27 biblioteki + Capture czyste/wzorcowe. Po naprawie P1 + testach realnych + Fazach 3/4 realnie Beta. **Karta zamyka pełną pulę beta (M02/M17/M18/M19/M20/M16/M15/M21/M12/M04).**
