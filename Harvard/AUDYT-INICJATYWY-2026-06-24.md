# AUDYT PRZEKROJOWY: Tworzenie i zarządzanie inicjatywami

> Przekrojowy audyt efektywności tworzenia i zarządzania inicjatywami w całej aplikacji consultify. Stan: 2026-06-24, po domknięciu M13 (planowanie) i M14 (wykonanie). Metoda: 5 równoległych map kodu (ścieżki tworzenia / model danych / logika BE / powierzchnie FE / AI+formuła) + ręczna weryfikacja greppem najcięższych twierdzeń (raporty agentów bywają zawyżone — wszystkie liczby poniżej potwierdzone w kodzie).

---

## 1. WERDYKT (executive summary)

**Paradoks: zarządzamy inicjatywami dojrzale, ale tworzymy je chaotycznie.**

- 🟢 **Zarządzanie (lifecycle/governance) = mocne i skonsolidowane.** Jeden router (`pmo/initiatives.routes.ts` + `InitiativeController`, 70+ endpointów), jeden kanoniczny cykl 13 statusów z macierzą przejść i rolami, bramki AI (M13), naprawiony dubel notyfikacji. To solidny fundament.
- 🔴 **Tworzenie = rozjechane.** **~23 pliki robią `INSERT INTO initiatives` bezpośrednio** (29 wystąpień), w większości omijając kanoniczny `InitiativeController.createInitiative()`. Każda ścieżka ustawia inny zestaw pól, inny status początkowy (`DRAFT` vs `step3` vs `PENDING_REVIEW`) i miesza `name`/`title`. Brak jednego lejka tworzenia.
- 🟠 **Model danych = duży dług.** ~60 kolumn rozsianych po 100+ migracjach, ciężka duplikacja (4× stage/phase, 3× ROI, 2× axis/area, 9 kolumn dat), brak CHECK na statusie (domyślny legacy `'step3'`), JSON-jako-TEXT, brak udokumentowanego SoT per domena.
- 🟠 **Jakość = opisana, nie egzekwowana.** Mocna doktryna (`INITIATIVE_FORMULA.md` + `CARD_CONTENT_FORMULA.md`), ale **tylko 4 z 16 validatorów §B3 zakodowane**; generatory AI nie wymuszają formuły; MECE-check tylko na froncie. Ryzyko „kart-zombi".
- 🟠 **FE = bogate, ale pofragmentowane.** Dwa Ganty z dwoma źródłami zależności, martwy duplikat `InitiativeDetailModal` (~3000 linii, 0 importów), brak inwalidacji React-Query po edycji → nieświeże listy, osobny stan w Execution vs Initiatives.

**Najwyższy priorytet:** ujednolicić tworzenie (jeden lejek + walidacja na wejściu). To jednocześnie spina model danych, jakość i lineage — bo dziś każda z 23 ścieżek psuje je po swojemu.

---

## 2. JAK TWORZYMY — mapa ścieżek (zweryfikowane: 29× INSERT w ~23 plikach)

### Pliki z `INSERT INTO initiatives` (potwierdzone greppem)
`InitiativeController` (kanoniczny) · `ToolController` · `assessment-workflow-v2.routes` · `report-builder.routes` · `economics.routes` · `initiatives.routes` · `my-work.routes` · `v8/finance.routes` · `pmo/initiatives.routes` · `reportImportService` · `aiActionExecutor` · `onboardingService` · `ToolInitiativeService` · `assessmentInitiativeService` · `reportInitiativeService` · `notebookConversionService` · `demoSeedService` · `valuationService` · `ArtifactConversionService` · `cqrs/initiative/CreateInitiative` · `ai/tools/createInitiative` · `InitiativeDefinitionService` · `routes/initiatives.routes 2.ts` (plik-śmieć).

### Główne ścieżki użytkownika (8)
| Ścieżka | Wejście | Charakter | Status init | Walidacja |
|---|---|---|---|---|
| **Charter wizard** (wzorzec) | Initiatives → „Charter" | manual + AI-assist, lineage obowiązkowy, ≥1 KPI | DRAFT | ✅ karty (4 reguły) + dedup |
| **Portfolio wizard** | Initiatives → „New initiative" | bulk kandydaci + triage | DRAFT | ✅ similarity + evidence gate |
| **Z Assessment** | Assessment → Generate | AI (gpt-4o-mini) | DRAFT | ❌ brak |
| **Z Tool session** | Tool → Generate | AI (AIPipeline, timeout+fallback) | DRAFT | ⚠️ częściowa |
| **Z Interview insight** | Insight → Create | prefill z findingu | DRAFT | ⚠️ similarity |
| **Z Economics/Finance** | Economics → Promote | bulk z insightów | **`step3`** ⚠️ | ❌ brak |
| **Z PDF import** | Report import | ekstrakcja | **`PENDING_REVIEW`** ⚠️ | ⚠️ |
| **Z czatu (AI action)** | Chat → akcja | AI-driven | DRAFT | ❌ brak; **gubi `organization_id`** ⚠️ |

### Potwierdzone defekty tworzenia
- **Niespójny status początkowy** — `economics.routes:2047` i `v8/finance.routes:1967` wstawiają `'step3'`; `reportImportService:1531` wstawia `'PENDING_REVIEW'`; reszta `DRAFT`. → portfel raportuje statusy spoza kanonicznego cyklu.
- **Chaos `name` vs `title`** — część ścieżek pisze tylko `name`, część tylko `title`, część oba. SELECT po jednym czasem zwraca NULL → puste tytuły w UI.
- **Brak walidacji** na ~5 ścieżkach (economics, PDF, AI-action, onboarding, quick-create) → „junk initiatives".
- **`aiActionExecutor` bez `organization_id`** w INSERT → ryzyko sierot poza org-scope.
- **Brak transakcji** — Assessment/Tool batch tworzą inicjatywę + link + audit osobno, bez rollbacku → sieroce linki przy częściowej awarii.

---

## 3. JAK ZARZĄDZAMY — mocna strona (skonsolidowana)

- **Jeden żywy router:** `/api/initiatives` (+ alias `/api/pmo/initiatives`) → `pmo/initiatives.routes.ts` → `InitiativeController`. Orphan `routes/initiatives.routes.ts` niezamontowany (martwy — do usunięcia).
- **Kanoniczny cykl 13 statusów** (`initiativeStatuses.ts`): DRAFT→PENDING_REVIEW→REVIEW→PROMOTED→PLANNING→APPROVED→SCHEDULED→EXECUTING→(BLOCKED)→DONE→TRACKING; terminalne CANCELLED/ARCHIVED. Macierz `VALID_TRANSITIONS` + mapowanie bramka→rola (`GATE_PERMISSIONS`).
- **Bramki AI (M13)** — soft-block (422 + overrideReason) gdy readiness poniżej progu, hard-block na wymaganych decyzjach/datach/milestone/KPI, telemetria zdarzeń bramek.
- **Widoczność modułowa** — statusy filtrują, w którym module inicjatywa się pojawia (Tools/Assessment→Initiatives→Execution→Benefits).
- **Notyfikacje** — jeden kanoniczny emiter (dubel naprawiony 2026-06-22).
- **Usuwanie/archiwizacja** — RBAC owner/admin, tylko DRAFT/CANCELLED kasowalne, kaskady best-effort.

### Luki zarządzania (mniejsze)
- Detekcja cykli zależności **fail-open** (loguje, nie blokuje) — przy timeout/OOM zła zależność przejdzie.
- `task_dependencies` (execution) ≠ `initiative_dependencies` (portfel) — brak autosynchronizacji.
- Notyfikacje async best-effort (eventual consistency — status zmienia się nawet gdy notyfikacja padnie).

---

## 4. MODEL DANYCH — dług (~60 kolumn, brak konwencji SoT)

- **Brak CHECK na `status`**, domyślny legacy `'step3'`; normalizacja przez `UPPER()` w routach.
- **Duplikaty pól:** stage/phase/execution_phase/current_stage (4×), expected_roi/estimated_roi/roi (3×), axis/drd_axis + area/drd_area (2×), 9 kolumn dat (start/end/pilot/planned/forecast/actual/tracking), kilka kolumn budżetu bez mapowania.
- **JSON-jako-TEXT** (deliverables, success_criteria, scope_in/out, key_risks, *_json) — ręczny parse/stringify, brak walidacji DB, niespójne NULL vs `'[]'` vs `'{}'`.
- **Rozjazd model↔typy FE:** `FullInitiative` ma pola bez odpowiednika w DB (`ownerTechnicalId`, `roi`/`capex`/`annualBenefit` dublujące costCapex/opex/expectedRoi); API-response używa innego, małymi literami podzbioru statusów niż enum FE.
- **FK miękkie/brak:** `tasks.initiative_id` ma tylko INDEX (FK niepewny); `raid_items.initiative_id` ON DELETE SET NULL; rollout_* są **project-scoped, nie initiative-scoped**.

---

## 5. FE / UX — bogate, ale pofragmentowane

- **Powierzchnie:** Initiatives (hub: kanban/tabela/timeline/grid + szczegół 19 sekcji + 2 wizardy), Execution (ExecutionHub Portfolio + własny kanban), Results/Benefits, Executive Dashboard, Portfolio (legacy panel), Economics (linking finansów), Assessment/Discovery (generatory).
- **🔴 Martwy duplikat:** `src/components/InitiativeDetailModal.tsx` (~3000 linii) — **0 importów** (tylko w refactoring-guide). Kandydat do usunięcia.
- **🔴 Dwa Ganty, dwa źródła zależności:** `InitiativeGantt` (prop `dependencies[]`) vs `TimelinePlanner` (`row.dependsOnId` derywowany z `task_dependencies`) — renderowane w tej samej sekcji; edycja w jednym może nie odbić się w drugim (ryzyko „split-brain"). Dane prawdziwe = `task_dependencies`.
- **🟠 Nieświeży stan:** brak inwalidacji React-Query po `PUT /initiatives/:id` → lista w hubie pokazuje stare dane po edycji w modalu szczegółu. Execution trzyma osobny stan (brak synchronizacji z Initiatives).
- **🟡 Friction tworzenia:** Charter-lite = 8 kroków / 5 pól wymaganych (rozsądnie, progresywny), ale zmiana statusu/ownera bywa przez modale, nie inline.

---

## 6. AI + JAKOŚĆ — doktryna mocna, egzekucja słaba

- **Doktryna SSOT** (`INITIATIVE_FORMULA.md` + `CARD_CONTENT_FORMULA.md` v1.1): MECE/Kerzner/Kaplan-Norton/McKinsey, pełna anatomia karty (teza falsyfikowalna, baseline→target KPI, RAID mix, scope_out MECE, kill-criteria, RACI, lineage).
- **🔴 Validatory §B3: 4 z 16 zakodowane** (potwierdzone: `lang_pl`, `no_filler`, `problem_len`, `hypothesis_format` w `initiativeCardValidators.ts`). Brakuje m.in. `kpi_baseline_target`, `raid_mix`, `scope_out_mece`, `*_count`, `milestones_count`. → karty mogą wejść bez KPI/RAID/deliverables bez ostrzeżenia.
- **🔴 Generatory AI nie znają formuły:** prompty Assessment/Tool/Propose są generyczne (nie odwołują §A3), nie generują KPI baseline→target ani RAID. Charter-wizard ma doktrynę w system-prompt (wzorzec).
- **⚠️ Niespójność modeli AI:** `assessmentInitiativeService` ma **hardcoded `gpt-4o-mini`** bez timeoutu/fallbacku (omija `llmService`/`AIPipeline`); Tool używa AIPipeline + timeout+fallback (poprawnie).
- **⚠️ Grounding asymetryczny:** Assessment/Tool czytają `boundedInsightPayload` (interview findings), ale `proposeEngineService` nie mapuje źródła na evidence — może halucynować.
- **⚠️ Reviewer §B4 opcjonalny** (`withReview`, advisory) — nie domyślny, nie blokuje.
- ✅ **Lineage egzekwowany** na CREATE (`CreateInitiativeSchema` wymaga `sourceId` gdy `sourceType≠manual`).

---

## 7. OCENA EFEKTYWNOŚCI (per wymiar)

| Wymiar | Ocena | Uzasadnienie |
|---|:--:|---|
| Zarządzanie (lifecycle/governance) | 🟢 4/5 | jeden router, kanoniczny cykl, bramki, RBAC, dubel naprawiony |
| Tworzenie (spójność) | 🔴 2/5 | ~23 lejki, niespójny status/pola, brak walidacji na ~5 ścieżkach |
| Model danych | 🟠 2/5 | ~60 kolumn, duplikacja, brak CHECK/konwencji SoT, JSON-TEXT |
| Jakość treści (formuła) | 🟠 2/5 | doktryna 5/5, egzekucja 4/16 validatorów, generatory bez compliance |
| FE/UX | 🟠 3/5 | bogate, ale 2 Ganty, martwy duplikat, stale-state |
| Lineage/traceability | 🟢 4/5 | source_type+id wymuszony, evidence refs, link-graph |

**Dług dotyczy WEJŚCIA i DANYCH, nie sterowania.** Inicjatywa raz utworzona jest dobrze zarządzana; problem w tym, że powstaje 23 niespójnymi drogami na pofragmentowanym schemacie.

---

## 8. REKOMENDACJE (priorytetyzowane)

### P1 — Integralność wejścia (największa redukcja ryzyka)
1. **Jeden lejek tworzenia.** Wszystkie ~23 ścieżki → wspólny `createInitiativeService`/`InitiativeController.createInitiative` (lub cienki shared helper), zamiast surowych `INSERT` w routach/serwisach. Jeden kontrakt pól + jedno miejsce walidacji.
2. **Normalizacja statusu init → `DRAFT`** wszędzie (usnąć `step3`, `PENDING_REVIEW` z tworzenia). Dodać CHECK constraint na `status` po wyczyszczeniu danych.
3. **Ujednolicić `name`/`title`** (jedna kolumna kanoniczna + backfill).
4. **Domknąć `aiActionExecutor`** — org_id obowiązkowy.
5. **Zakodować brakujące validatory §B3** (kpi_baseline_target, raid_mix, scope_out_mece, *_count) i uruchamiać na CREATE (twardo lub jako blokujące ostrzeżenie).

### P2 — Jakość AI
6. **Wstrzyknąć CARD_CONTENT_FORMULA §A3 do promptów** Assessment/Tool/Propose (jak w Charter-wizard `DOCTRINE_SYSTEM_PROMPT_PL`).
7. **Ujednolicić generatory na `AIPipeline`/`llmService`** (usunąć hardcoded gpt-4o-mini + dodać timeout/fallback w Assessment).
8. **Backend MECE-check** (`POST /initiatives/validate-portfolio-mece`) używany przy generacji.
9. **Reviewer §B4 domyślnie** (withReview=true).

### P3 — Model danych + FE/higiena
10. **Udokumentować SoT per domena** (ROI, timeline, budżet, stage) + deduplikacja kolumn (4×stage→1, 3×ROI→1, axis/drd_axis→1).
11. **Ujednolicić źródło zależności Gantta** — jedno (`task_dependencies`), oba widoki czytają to samo.
12. **Usunąć martwy kod:** `InitiativeDetailModal.tsx` (root, 0 importów), orphan `routes/initiatives.routes.ts`, pliki-śmieci `* 2.ts` (higiena całego repo).
13. **React-Query invalidation** po edycji inicjatywy (hub + Execution współdzielą świeżość).
14. **FK na `tasks.initiative_id`** (lub świadomie udokumentować miękki link).

**Kolejność:** P1.1–P1.2 (jeden lejek + status) eliminują największą część ryzyka integralności; P1.5 + P2.6 podnoszą jakość treści; P3 to dług techniczny do spłaty w tle.
