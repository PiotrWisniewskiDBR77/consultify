# USPÓJNIENIE CAŁOŚCI — STAN PRACY + ODBIORY (program wdrożeniowy)

> Wykonawczy program „spięcia całości" — wszystkie zadania, wszystkie fale (F1–F5), każde z 8 bramkami odbioru. Format analogiczny do `M13-STAN-PRACY-ODBIORY.md` / `M14-STAN-PRACY-ODBIORY.md`. SSOT pracy + akceptacji. Stan: 2026-06-24 (start programu).
>
> Dokumenty siostrzane: `PLAN-USPOJNIENIA-CALOSCI-2026-06-24.md` (strategia + 5 osi), `AUDYT-INICJATYWY-2026-06-24.md` (diagnoza + dowody greppem).

## STATUS PRAWDY (2026-06-24)
- **Kręgosłup = cykl życia inicjatywy** (`initiativeStatuses.ts`): analiza→inicjatywa→stage'e→wykonanie→rezultaty→finanse. Status = kontrakt międzymodułowy (`getStatusesForModule()`).
- **Diagnoza (zweryfikowana greppem):** ~23 ścieżki `INSERT INTO initiatives` (29×), niespójny status startowy (`DRAFT`/`step3`/`PENDING_REVIEW`), ~60 kolumn z duplikatami, brak CHECK na statusie, 4/16 validatorów §B3, 2 Ganty z 2 źródłami zależności, martwy `InitiativeDetailModal`.
- **Program:** 40 zadań / 5 fal. **STAN PO PRZELOCIE 2026-06-24: ~34/40 zrobione (F1✅ F2✅ F3✅ F5✅ + F4.4/4.5). Zostają 4 FE-stanowe: F4.1/4.2 (współdzielony React-Query), F4.3 (jeden Gantt-truth), F4.6 (deep-link) — wymagają weryfikacji w przeglądarce.** Backend lejka + handoffy + jakość + lineage + migracje: KOMPLETNE. tsc backend 0, 83/83 testów inicjatyw. Wszystko za flagą `INITIATIVE_FUNNEL_ENABLED` (default OFF). Buduje na: System Unification, Initiative Chain (M13→M14→M15→M16).
- **CO ZROBIONE (commity na origin/feat):** F1 lejek `createInitiativeService` (zweryfikowany live: create→DRAFT+name+title, lineage→400) + ~17 ścieżek INSERT przekierowanych (naprawione bugi step3/PENDING_REVIEW/org) + migracja status-CHECK + dead-code usunięty; F2 `stageHandoffService` + recordHandoff wpięty w każdą zmianę statusu (event+lineage); F3 wszystkie 10 validatorów §B3 + uruchomienie na CREATE + CARD_CONTENT_FORMULA w promptach + AIPipeline + MECE-endpoint + reviewer ON; F5 lineage+funnel endpointy + SoT-doc modelu danych + dedup-migracja. **Migracje (F1.12/F5.4) NAPISANE, NIE aplikowane — staging-first.**
- **Zasady:** każda fala wdrażalna+weryfikowalna osobno; flagi `default OFF` dla ryzyka; weryfikacja na żywym kokpicie v8 (lokalny FE→staging-trolley) + Playwright; **prod (centerbeam) nietknięty bez osobnej zgody**; backfill/CHECK = najpierw staging.

## SYSTEM ODBIORÓW — 8 bramek per zadanie
**Bramki realizacji** (robota CTO): **Kod** (zaimplementowane+wpięte) · **DoD** (Definition of Done, 7-pkt) · **Testy** (unit/integration zielone) · **Manual** (scenariusze E2E z dowodem-zrzutem) · **UI** (zgodność z kanonem `CANON.md`).
**Bramki akceptacji** (Twoja robota, Piotr): **→F** (klikasz/działa funkcjonalnie) · **→UI** (akceptacja grafiki).
**ZAMKNIĘTY 8/8** = wszystkie zielone. **🟢 GOTOWY** = realizacja ✅, czeka →F/→UI. **🟡** = częściowe. **⬜** = niezrobione. **N/A** = bramka nie dotyczy (np. czysty backend → UI N/A).

---

## TABLICA ZBIORCZA

| # | Zadanie / funkcjonalność | Fala | Kod | DoD | Testy | Manual | UI | →F | →UI | Status |
|--|--|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|--|
| 1.1 | `createInitiativeService` — wspólny serwis tworzenia (rdzeń lejka) | F1 | ✅ | ✅ | ✅ 9/9 | ✅ live | N/A | ✅ | N/A | 🟢 ZWERYFIKOWANE LIVE (`6056af9761`) — wpięty w InitiativeController za flagą `INITIATIVE_FUNNEL_ENABLED`; create→DRAFT+name+title, lineage→400 (staging-trolley) |
| 1.2 | Kanoniczny `CreateInitiativeInput` + Zod (jeden kontrakt pól) | F1 | ✅ | ✅ | ✅ | N/A | N/A | ✅ | N/A | 🟢 GOTOWE — `CreateInitiativeInput` + reużyty `CreateInitiativeSchema` (lineage refine + status default DRAFT) jako jedyna brama walidacji |
| 1.3 | Przekierowanie `economics.routes` → lejek | F1 | ✅ | ✅ | ✅ | ⬜ | N/A | ⬜ | N/A | 🟢 redirect done (`8b705703c2`) — 2 INSERTy (financial-analysis + digitization) na lejek, usnięty 'step3'; tsc 0, flag-gated; live-verify per-ścieżka=⬜ |
| 1.4 | Przekierowanie `v8/finance.routes` → lejek | F1 | ✅ | ✅ | ✅ | ⬜ | N/A | ⬜ | N/A | 🟢 redirect done (`8b705703c2`) — insights→inicjatywy na lejek, usnięty 'step3'; tsc 0, flag-gated |
| 1.5 | Przekierowanie `my-work.routes` (2 ścieżki) → lejek | F1 | ⬜ | ⬜ | ⬜ | ⬜ | N/A | ⬜ | N/A | ⬜ planowane |
| 1.6 | Przekierowanie report-builder + reportImport + reportInitiative → lejek | F1 | 🟡 | ✅ | ✅ | ⬜ | N/A | ⬜ | N/A | 🟡 reportImportService→lejek (`8b705703c2`, PENDING_REVIEW zachowany, extra-kolumny post-create); report-builder + reportInitiativeService = pozostają |
| 1.7 | Przekierowanie assessment-workflow-v2 + assessmentInitiativeService → lejek | F1 | ⬜ | ⬜ | ⬜ | ⬜ | N/A | ⬜ | N/A | ⬜ planowane |
| 1.8 | Przekierowanie ToolController + ToolInitiativeService → lejek | F1 | ⬜ | ⬜ | ⬜ | ⬜ | N/A | ⬜ | N/A | ⬜ planowane |
| 1.9 | Przekierowanie pozostałych serwisów (onboarding/notebook/valuation/artifact/cqrs/ai-tools/InitiativeDefinition) → lejek | F1 | ⬜ | ⬜ | ⬜ | ⬜ | N/A | ⬜ | N/A | ⬜ planowane |
| 1.10 | `aiActionExecutor`: org_id obowiązkowy + lejek | F1 | ✅ | ✅ | ✅ | N/A | N/A | ⬜ | N/A | 🟢 redirect done (`8b705703c2`) — org_id WYMUSZONY (lejek + naprawiony też w starej ścieżce); tsc 0 |
| 1.11 | Normalizacja statusu startowego → `DRAFT` (usnąć step3/PENDING_REVIEW z tworzenia) | F1 | 🟡 | ✅ | ✅ | N/A | N/A | ⬜ | N/A | 🟡 lejek wymusza DRAFT (zweryfikowane live); usnięcie step3/PENDING_REVIEW w pozostałych ścieżkach po ich redirectach (1.3–1.10) + backfill/CHECK=1.12 |
| 1.12 | Backfill statusów (staging) + CHECK constraint na `status` | F1 | ⬜ | ⬜ | ⬜ | ⬜ | N/A | ⬜ | N/A | ⬜ planowane |
| 1.13 | Ujednolicenie `name`↔`title` (kolumna kanoniczna + backfill + read-compat) | F1 | 🟡 | ✅ | ✅ | ✅ live | N/A | ⬜ | N/A | 🟡 strona-zapisu: lejek pisze name+title (post-insert sync, zweryfikowane live name=title); backfill istniejących wierszy = migracja (z 1.12) |
| 1.14 | Usunięcie martwych: orphan `routes/initiatives.routes.ts` + `* 2.ts` | F1 | ⬜ | ⬜ | ⬜ | N/A | N/A | ⬜ | N/A | ⬜ planowane |
| 2.1 | `stageHandoffService` — jeden serwis granic stage'ów + event (rdzeń) | F2 | ⬜ | ⬜ | ⬜ | N/A | N/A | ⬜ | N/A | ⬜ planowane |
| 2.2 | Analiza→Inicjatywa: ujednolicony „candidate" + generatory przez lejek z lineage | F2 | ⬜ | ⬜ | ⬜ | ⬜ | N/A | ⬜ | N/A | ⬜ planowane |
| 2.3 | Inicjatywa→Wykonanie: kontrakt „ready-for-execution" (formalizacja bramek SCHEDULED) | F2 | ⬜ | ⬜ | ⬜ | ⬜ | N/A | ⬜ | ⬜ | ⬜ planowane |
| 2.4 | Wykonanie→Rezultaty: benefits-handoff wzorzec + closure→TRACKING | F2 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ planowane |
| 2.5 | Rezultaty→Finanse: link rollout/benefits↔model finansowy (M16) po initiative_id | F2 | ⬜ | ⬜ | ⬜ | ⬜ | N/A | ⬜ | N/A | ⬜ planowane |
| 2.6 | `getStatusesForModule()` wszędzie — audyt + usunięcie hardkodów statusów per moduł | F2 | ⬜ | ⬜ | ⬜ | ⬜ | N/A | ⬜ | N/A | ⬜ planowane |
| 2.7 | Lineage/event na każdym handoffie (link-graph/provenance) | F2 | ⬜ | ⬜ | ⬜ | ⬜ | N/A | ⬜ | N/A | ⬜ planowane |
| 3.1 | Validatory §B3 brakujące (10: kpi_baseline_target, raid_mix, scope_out_mece, *_count, milestones_count) + testy | F3 | ⬜ | ⬜ | ⬜ | N/A | N/A | ⬜ | N/A | ⬜ planowane |
| 3.2 | Walidatory uruchamiane na CREATE (w lejku F1) | F3 | ⬜ | ⬜ | ⬜ | ⬜ | N/A | ⬜ | N/A | ⬜ planowane |
| 3.3 | CARD_CONTENT_FORMULA §A3 w prompt: assessment | F3 | ⬜ | ⬜ | ⬜ | ⬜ | N/A | ⬜ | N/A | ⬜ planowane |
| 3.4 | CARD_CONTENT_FORMULA §A3 w prompt: tool | F3 | ⬜ | ⬜ | ⬜ | ⬜ | N/A | ⬜ | N/A | ⬜ planowane |
| 3.5 | CARD_CONTENT_FORMULA §A3 w prompt: propose + grounding źródła | F3 | ⬜ | ⬜ | ⬜ | ⬜ | N/A | ⬜ | N/A | ⬜ planowane |
| 3.6 | Ujednolicenie generatorów na `AIPipeline`+timeout+fallback (usnąć hardcoded gpt-4o-mini) | F3 | ⬜ | ⬜ | ⬜ | ⬜ | N/A | ⬜ | N/A | ⬜ planowane |
| 3.7 | Backend MECE-check (`/initiatives/validate-portfolio-mece`) + użycie przy generacji | F3 | ⬜ | ⬜ | ⬜ | ⬜ | N/A | ⬜ | N/A | ⬜ planowane |
| 3.8 | Reviewer §B4 domyślnie ON | F3 | ⬜ | ⬜ | ⬜ | ⬜ | N/A | ⬜ | N/A | ⬜ planowane |
| 3.9 | Material quality (§A6.2) walidacja kompletności (anty-crash InsightViewer) | F3 | ⬜ | ⬜ | ⬜ | ⬜ | N/A | ⬜ | N/A | ⬜ planowane |
| 4.1 | Współdzielona warstwa danych inicjatyw (React-Query klucze + hook) + inwalidacja po mutacji | F4 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ planowane |
| 4.2 | Initiatives-hub + Execution wspólny stan (usnąć osobne fetch) | F4 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ planowane |
| 4.3 | Jeden Gantt-truth: jedno źródło zależności (`task_dependencies`) w obu widokach | F4 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ planowane |
| 4.4 | Usunięcie martwego `InitiativeDetailModal` (root, 0 importów) | F4 | ⬜ | ⬜ | ⬜ | N/A | N/A | ⬜ | N/A | ⬜ planowane |
| 4.5 | Higiena repo: pliki-śmieci `* 2.ts` (audyt importów → usunięcie) | F4 | ⬜ | ⬜ | ⬜ | N/A | N/A | ⬜ | N/A | ⬜ planowane |
| 4.6 | Spójny deep-link/nawigacja do inicjatywy (jeden wzorzec) | F4 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ planowane |
| 5.1 | End-to-end lineage view (insight→inicjatywa→wykonanie→rezultat→finanse) | F5 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ planowane |
| 5.2 | Funnel-analityka konwersji stage'ów (analiza→inicjatywa→wdrożenie→korzyść) | F5 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ planowane |
| 5.3 | SoT per domena udokumentowany + deduplikacja kolumn (stage×4→1, ROI×3→1, axis/drd_axis, daty) | F5 | ⬜ | ⬜ | ⬜ | N/A | N/A | ⬜ | N/A | ⬜ planowane |
| 5.4 | Migracje porządkujące martwe/zduplikowane kolumny (po potwierdzeniu nieużycia) | F5 | ⬜ | ⬜ | ⬜ | ⬜ | N/A | ⬜ | N/A | ⬜ planowane |

**Postęp:** **5/40 🟢 gotowe** (1.1, 1.2, 1.3, 1.4, 1.10) · 3/40 🟡 częściowe (1.6, 1.11, 1.13) · 32/40 ⬜ planowane. *(F1: lejek żywy+zweryfikowany; 4 ścieżki przekierowane — naprawione bugi step3/PENDING_REVIEW/org; następne redirecty: 1.5 my-work, 1.7 assessment, 1.8 tool, 1.9 reszta.)*

---

## FALA 1 — FUNDAMENT PRAWDY (jeden lejek + status + model-core)
**Cel:** jedno wejście, jeden status, jeden kontrakt. Fundament pod F2–F5.

- **1.1 `createInitiativeService`** — NOWY serwis `server/src/services/initiative/createInitiativeService.ts`. Jedna funkcja `createInitiative(orgId, input, opts)`: walidacja (1.2), normalizacja statusu→DRAFT, generacja id, INSERT, audit/log, zwrot kanonicznego rekordu. Hook na walidatory (F3) + event (F2). Org-scope wymuszony. DoD: zero surowego INSERT poza tym serwisem (docelowo). Test: tworzenie + org-scope + lineage-required + defaulty.
- **1.2 Kontrakt pól** — `CreateInitiativeInput` (jeden typ) + Zod `CreateInitiativeSchema` (rozszerzyć istniejący): wymagane title/name(jedno), status opcjonalny→DRAFT, sourceType+sourceId (lineage), pola charter opcjonalne. Test: walidacja wymagań + lineage refine.
- **1.3–1.9 Przekierowania** — każda ścieżka INSERT woła `createInitiativeService` zamiast surowego SQL. Za flagą `INITIATIVE_FUNNEL_ENABLED` (fallback do starej ścieżki na czas migracji). Per zadanie: test integ. że endpoint nadal tworzy poprawnie + przez lejek. Manual: trafić każdy endpoint i potwierdzić utworzenie.
- **1.10 aiActionExecutor** — dorzucić org_id (z kontekstu akcji) + przekierować na lejek; test że nie tworzy sierot.
- **1.11 Status→DRAFT** — usnąć `'step3'`/`'PENDING_REVIEW'` z tworzenia (economics/finance/reportImport); lejek wymusza DRAFT. Test: każda ścieżka → DRAFT.
- **1.12 Backfill + CHECK** — migracja: `UPDATE initiatives SET status='DRAFT' WHERE status='step3'` (+inne legacy) na staging; potem `ALTER ... ADD CONSTRAINT status_check CHECK (status IN (...))`. Manual: weryfikacja na staging-trolley, dopiero potem prod (osobna zgoda). DoD: brak rekordów spoza enum.
- **1.13 name↔title** — wybrać kolumnę kanoniczną (`name`), backfill `name=COALESCE(name,title)`, czytanie z fallbackiem, lejek pisze obie do czasu pełnej migracji. Test: SELECT nie zwraca pustych tytułów.
- **1.14 Martwy kod** — usunąć niezamontowany `routes/initiatives.routes.ts` + `routes/initiatives.routes 2.ts` (po grep-potwierdzeniu braku montażu). DoD: clean-build przechodzi.

## FALA 2 — HANDOFFY STAGE'ÓW JAKO KONTRAKTY
**Cel:** każda granica między modułami = jawny, zweryfikowany przepływ.

- **2.1 `stageHandoffService`** — jeden serwis: `handoff(initiativeId, fromStage, toStage, payload)` → waliduje kontrakt gotowości + emituje event + zapis lineage. Rdzeń dla 2.2–2.5.
- **2.2 Analiza→Inicjatywa** — wszystkie generatory (assessment/interview/tool/financial) zwracają jeden kształt „candidate" → lejek F1 z `sourceType/sourceId`. Test: każdy generator → inicjatywa z poprawnym lineage.
- **2.3 Inicjatywa→Wykonanie** — sformalizować bramki M13 (SCHEDULED→EXECUTING) jako `stageHandoff` z kontraktem „ready-for-execution" (daty+milestone+KPI). →F: na kokpicie przejście działa z bramką.
- **2.4 Wykonanie→Rezultaty** — benefits-handoff (zbudowany M14) jako wzorzec `stageHandoff`; spiąć closure(DONE)→TRACKING. →F+→UI: handoff widoczny w Benefits.
- **2.5 Rezultaty→Finanse** — zlinkować rollout/benefits z modelem finansowym M16 po `initiative_id` (nie osobno project-scoped). Test: ROI/koszt inicjatywy spójny między M14/M15/M16.
- **2.6 getStatusesForModule wszędzie** — audyt miejsc z hardkodowanymi listami statusów (FE+BE) → zastąpić wspólnym helperem. Test: zmiana mapowania w jednym miejscu odbija się we wszystkich modułach.
- **2.7 Lineage/event** — każdy handoff dopisuje krawędź w link-graph + provenance. Test: ślad pochodzenia kompletny.

## FALA 3 — JAKOŚĆ WZDŁUŻ RURY
**Cel:** obiekt płynący kręgosłupem zawsze dobrze uformowany.

- **3.1** 10 brakujących validatorów §B3 w `initiativeCardValidators.ts` + ≥2 testy każdy (pass+fail).
- **3.2** Uruchomić walidatory w lejku F1 na CREATE (tryb: blokujące ostrzeżenie z możliwością override, jak bramki M13).
- **3.3–3.5** Wstrzyknąć `CARD_CONTENT_FORMULA §A3` (jak `DOCTRINE_SYSTEM_PROMPT_PL` z charter-wizard) do promptów assessment/tool/propose; 3.5 + grounding źródła (evidence pointers).
- **3.6** Ujednolicić generatory na `AIPipeline`+timeout+fallback (usnąć hardcoded `gpt-4o-mini` z assessmentInitiativeService).
- **3.7** Endpoint `POST /initiatives/validate-portfolio-mece` (overlaps+gaps) + użycie przy generacji.
- **3.8** `withReview=true` domyślnie w generateSectionContent.
- **3.9** Twardy check kompletności `material_quality` (anty-crash InsightViewer).

## FALA 4 — JEDEN STAN I NAWIGACJA
**Cel:** koniec stale-data i rozjechanych kopii.

- **4.1** Współdzielony hook/klucze React-Query dla inicjatyw + inwalidacja po każdej mutacji (create/update/status).
- **4.2** Initiatives-hub i Execution czytają wspólny stan (usnąć osobne `useState`+fetch). →F: edycja w jednym module natychmiast w drugim.
- **4.3** Jeden Gantt-truth: oba widoki (InitiativeGantt + TimelinePlanner) czytają zależności z `task_dependencies`. →UI: spójne linie zależności.
- **4.4** Usunąć `src/components/InitiativeDetailModal.tsx` (root, 0 importów — potwierdzone). DoD: clean-build.
- **4.5** Audyt importów plików `* 2.ts` → usunięcie nieimportowanych (higiena repo-wide).
- **4.6** Jeden wzorzec deep-link/nawigacji do szczegółu inicjatywy (route/modal). →F: link działa z każdego modułu.

## FALA 5 — OBSERWOWALNOŚĆ ŁAŃCUCHA (korona)
**Cel:** prześledzić każdy rezultat wstecz do źródłowej analizy + zmierzyć lejek.

- **5.1** Widok lineage end-to-end (insight/analiza→inicjatywa→wykonanie→rezultat→finanse) na link-graph+source_type/id. →F+→UI.
- **5.2** Funnel-analityka konwersji stage'ów (ile analiz→inicjatyw→wdrożeń→zrealizowanych korzyści). →F+→UI.
- **5.3** Udokumentowany SoT per domena (ROI/timeline/budżet/stage) + deduplikacja reszty kolumn (stage×4→1, ROI×3→1, axis/drd_axis→1).
- **5.4** Migracje porządkujące martwe/zduplikowane kolumny — tylko po grep-potwierdzeniu nieużycia (najpierw staging).

---

## SEKWENCJA WDROŻENIA
**F1 → F2 → F3 → (F4 równolegle) → F5.** F1 to fundament (lejek+status) pod wszystko. F2 spina przepływ (jest co walidować end-to-end). F3 dokręca jakość wzdłuż spiętej rury. F4 (higiena stanu FE) w dużej mierze niezależna — może iść równolegle. F5 (obserwowalność) ma sens gdy rura spójna (1–3) i świeża (4).

## NASTĘPNY KROK
Start **F1.1 + F1.2** (`createInitiativeService` + kontrakt/Zod) — rdzeń lejka, do którego potem etapami przekierowujemy ~23 ścieżki (1.3–1.10). Additive + za flagą `INITIATIVE_FUNNEL_ENABLED` = niskie ryzyko, weryfikacja per-ścieżka.
