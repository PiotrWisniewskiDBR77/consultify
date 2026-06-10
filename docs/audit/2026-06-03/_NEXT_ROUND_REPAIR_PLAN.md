# Consultify — Plan kolejnej rundy naprawczej (2026-06-03)

Wejście: re‑audyt v2 (śr. 73/100) + 38 screenów właściciela + root‑cause tabel + round‑fixes. Cel: domknąć stabilność runtime, grafikę tabel, bugi danych i spójność UI do poziomu „demo/sprzedaż bez wpadek".

## 0. Diagnoza w jednym zdaniu (uczciwie, ale bez paniki)
**Rdzeń renderuje się dobrze** (Chat ze wszystkimi trybami, Calendar, Decisions, Manager, Interview Sessions/Insights, Tools Sessions/Assessment, Initiatives Portfolio/Analysis, Finance Statements, Document Studio, Presentations, Table Studio — wszystkie LOADED_OK). **„Dramat" pochodzi z KILKU systemowych przyczyn**, które psują wiele ekranów naraz — naprawa tych kilku odblokuje większość:
1. **Burza 429** (rate‑limit × moje retry × StrictMode × polling) — psuła Notebook/Inbox/Tasks/Meeting/Interview‑Initiatives. *(zdławione dev‑flagiem; wymaga właściwego fixu)*
2. **Auth‑loop‑guard / circuit‑breaker** blokuje całe moduły (Tools Library: „Requests blocked by auth loop guard").
3. **Crash runtime** Execution (Implementation: „Coś poszło nie tak").
4. **Grafika tabel** — 8 przyczyn (desync sticky/scroll, brak kanonicznej tabeli).
5. Lokalne bugi danych (double‑encoding, UUID w kolumnach, puste panele).

---

## 1. Inwentarz ze screenów (38) — stan ekranów

**✅ LOADED OK (renderuje się dobrze):** Chat (welcome, Canvas split, attach, AI‑modes, persona), Calendar, Decisions, Manager (empty OK), Interview Sessions/Assigned/Insights, Tools Sessions/Assessment, Initiatives Portfolio/Analysis(Workload), Finance Statements, Document Studio Generate, Presentations, Table Studio, Ideas (lista).

**🔴 NIE ŁADUJE / CRASH:**
| Ekran | Objaw | Przyczyna |
|---|---|---|
| Execution > Implementation | spinner → **hard crash „Coś poszło nie tak"** | runtime exception (P0, osobny bug) |
| Tools > Library | „Requests blocked by **auth loop guard**" | circuit‑breaker false‑trip (P0, osobny bug) |
| Notebook | „Failed to load notebooks" | 429 (powinno zniknąć po fixie storm) |
| Meeting | „Failed to load meetings" ×2 | 429 + double‑fire (StrictMode dedup) |
| My Work > Inbox | stuck „Loading…" | 429 |
| My Work > Tasks | „Something went wrong" | 429 (+ filtr task_type — już poprawiony) |
| Interview > Initiatives | „degraded mode, failed to load" | 429 / odrębny fetch |
| Ideas > Recommendation map | spinner w nieskończoność | 429 lub własny loader bez timeout |

**🟠 REALNE BUGI UI/DANYCH (niezależne od 429):**
| Ekran | Bug |
|---|---|
| Ideas (detal) | tytuł renderuje `&amp;quot;` — **double HTML‑encoding** |
| Documents > Library | kolumna SOURCE pokazuje **surowe UUID**; wszystkie nazwy = „Executive presentation draft" (brak join/lookup) |
| Radar (detal sygnału) | panel po prawej **pusty** (pola bez wartości) |
| Manager + Chat | **kolizja z‑index** — chat nad treścią bez backdropu |
| Inbox/Decisions | **tooltip nie znika** (zawieszony nad wierszem) |
| Chat (historia) | sidebar historii ściśnięty/ucięty |
| Results > Initiatives | pusty bucket „in realization" (mapowanie lifecycle) |

---

## 2. Grafika tabel — 8 przyczyn (szczegóły: `TABLE_GRAPHICS_ROOTCAUSE.md`)
Systemowe: **RC‑1** podwójny scroll‑container → desync sticky thead/body (`TableWithPreviewLayout.tsx:301` × inner `overflow-x-auto`); **RC‑2** szerokość preview‑pane nie propaguje do inner‑scroll → phantom scrollbar; **RC‑3** select‑column 36px(th) vs 40px(width calc) = 4px dryf; **RC‑4** `overflow-hidden` rodzic zabija sticky thead (Portfolio/Results/Gates); **RC‑5** brak kanonicznej tabeli — **230 plików z własnym `<table>`**. Per‑moduł: RC‑6 Interview sticky w złym przodku, RC‑7 hardkodowany `colSpan={7}`, RC‑8 `max-w-[760px]` na tytule.

---

## 3. PLAN — workstreamy i priorytety

### WS‑0 — Zatrzymać krwawienie (runtime stability) — P0, najpierw
- **0.1 Burza 429:** `fetchWithRetry` (api.ts + v8 baseClient) **NIE ponawiać na 429** (tylko sieć/5xx) — *to mój regres ze stability‑pass, priorytet*; scope `apiAuthRateLimiter` per‑user (nie IP) i wykluczyć wewnętrzny ruch SPA GET; zdedupować StrictMode + zbatchować startowy storm My Work + naprawić inbox N+1 (`my-work.routes.ts:1398`). Potem zdjąć dev‑flag `DISABLE_RATE_LIMIT`.
- **0.2 Auth‑loop‑guard:** circuit‑breaker („Requests blocked by auth loop guard") false‑trip blokuje Tools Library (i pewnie inne) — poprawić próg/reset tak, by nie ubijał całych modułów; jawny stan + auto‑recovery.
- **0.3 Execution crash:** znaleźć i naprawić wyjątek na Implementation (Summary) — dodać error‑boundary z retry zamiast białego crasha.
- **0.4 Re‑weryfikacja po 0.1:** Notebook/Inbox/Tasks/Meeting/Interview‑Initiatives/Recommendation‑map — potwierdzić, że ładują po fixie storm; co zostanie = osobny bug.
- **0.5 Meeting double‑fire** + każdy „×2 Failed to load" → dedup fetchy (StrictMode‑safe).

### WS‑1 — Grafika tabel (Twój ból #1) — P0/P1
- **Faza 1 (1–2 dni):** usunąć inner `overflow-x-auto` z Ideas/Tasks; fix 4px select; inline `width` na th+td.
- **Faza 2 (1 dzień):** usunąć `overflow-hidden` z wrapperów Portfolio/Results/Interview; `overflow-x-auto` jako najbardziej zewnętrzny.
- **Faza 3 (3–5 dni):** ustanowić **kanoniczną tabelę** (`ResizableTable`+`TableWithPreviewLayout` dla MyWork; `FilterableTable`/`DataTable` dla hubów); migrować top bespoke; zlikwidować hardkody colSpan/max‑w.

### WS‑2 — Bugi danych/renderu — P1
- Ideas double‑encoding `&amp;quot;` (sanityzacja/escape raz, nie dwa).
- Documents Library: rozwiązać nazwy + join SOURCE (koniec surowych UUID).
- Radar: zasilić panel detalu sygnału.
- Results: mapowanie lifecycle → bucket „in realization".

### WS‑3 — UI/UX spójność (sesja wizualna X1, RAZEM) — P1
- z‑index/overlay (Chat nad Manager → backdrop/portal/z‑layer); tooltipy znikające (dismiss on mouse‑out/blur); sidebar historii czatu (szerokość/truncation).
- **Kanon kolorów:** flip `primary-*`→`crimson-*` w nawigacji+nagłówkach (3 846 użyć primary vs 79 crimson); sweep `slate→navy` (45,7k); **SplitLayout→ModuleHub** dla 8 widoków; prymitywy stanów (Loading/Empty/Error) zamiast 1 680 ręcznych spinnerów.

### WS‑4 — Integralność danych / deploy — P0 (przed świeżym Postgresem)
- Migracja konsolidująca **~138 osieroconych tabel** (draft: `docs/db/DRAFT_schema_bootstrap_consolidation.sql`) — walidacja na staging, potem aktywacja.
- `collab_sessions.duration_seconds` brak kolumny — migracja.
- Dialekt SQL: `NOW()` (477×), `LATERAL` (12×) → portability (działa na PG, pada na SQLite/test).

### WS‑5 — Engineering hygiene — P1
- **CI realnie nie uruchamia testów komponentów** (glob) — naprawić include vitest (inaczej smoke‑testy są martwe w CI).
- Zepsute handoffy: Execution→Results (brak CTA), Finance→Initiative (`/initiatives/:id` — już fix), Results→Outputs, GapAnalysis 404.
- Server type‑safety (~4 543 błędy tsc) → potem zdjęcie `--noCheck` — osobny program.

### WS‑6 — Dokończenie modułów wg v2 (najniższe) — P2
- 08 Finanse (59): billing — Stripe wg D8; 04 Narzędzia (65): seedy is_coming_soon na istniejących DB, ADMA/CMMI/LEAN gating, ToolWizardView martwy; 17 Admin (67): per‑org email, crimson drift, role‑change przez adminP32.

---

## 4. Kolejność (rekomendacja)
1. **WS‑0** (runtime: 429‑retry, auth‑guard, Execution crash) — bo to odblokowuje większość ekranów i Twoje screeny.
2. **WS‑1 Faza 1–2** (tabele systemowo) + **WS‑2** (bugi danych) — szybki, widoczny skok jakości.
3. **WS‑4** (integralność danych — przed jakimkolwiek świeżym deployem).
4. **WS‑3** (RAZEM, sesja wizualna) + **WS‑1 Faza 3** + **WS‑5/6**.

> Większość „nie ładuje" to KILKA przyczyn, nie 30 osobnych awarii. WS‑0 + WS‑1 Faza 1‑2 realnie zmieni odbiór z „dramat" na „działa".
