# INITIATIVE DATA MODEL — Source of Truth (SoT)

> **Status:** kanon zatwierdzony 2026-06-24 (Uspójnienie **F5.3**). **Zakres:** tabela `initiatives` w consultify.
> **Cel:** ustalić JEDNĄ kanoniczną kolumnę per domena znaczeniowa, usunąć niejednoznaczność czytania/zapisu i wyznaczyć ścieżkę deprecacji ~60-kolumnowego długu.
> **Powiązane:** `docs/initiatives/INITIATIVE_FORMULA.md` (doktryna treści), `server/src/constants/initiativeStatuses.ts` (enum statusów), `Harvard/AUDYT-INICJATYWY-2026-06-24.md` (audyt-źródło), **F1.x** (lejek tworzenia), **F5.4** (migracje deprecacyjne).

---

## 0. Dlaczego ten dokument istnieje

Audyt `AUDYT-INICJATYWY-2026-06-24.md` wykazał, że tabela `initiatives` urosła do ~60 kolumn rozsianych po 100+ migracjach, z ciężką duplikacją semantyczną:

- **stage/faza ×4** — `current_stage`, `phase`, `execution_phase`, `stage`
- **ROI ×3** — `expected_roi`, `estimated_roi`, dodatkowo wyliczane na FE
- **axis/area ×2** — `axis`/`drd_axis`, `area`/`drd_area`
- **daty ×9** — `start_date`, `end_date`, `pilot_end_date`, `planned_start_date`, `planned_end_date`, `actual_end_date`, `forecast_start_date`, `forecast_end_date`, `tracking_start_date`/`tracking_end_date`
- **budżet** — `cost_capex`/`cost_opex`, `estimated_budget`, `planned_budget_total`/`actual_budget_total`
- **tożsamość** — `name` vs `title` (różne ścieżki piszą różne pola → puste tytuły w UI)

Brak udokumentowanej konwencji oznaczał, że każda z ~23 ścieżek `INSERT INTO initiatives` ustawiała inny podzbiór pól. Ten dokument jest **autorytetem rozstrzygającym** — gdy kod i kolumna są niezgodne z SoT, to kod jest do naprawy (przez lejek F1.x i migracje F5.4), nie SoT.

**Reguła naczelna:** zapisuje **lejek tworzenia/aktualizacji** (`InitiativeController` + `createInitiativeService`); deprecated kolumny utrzymujemy w trybie **read-compat** do czasu backfill+drop (sekcja 10).

---

## 1. Spis treści

1. [Dlaczego](#0-dlaczego-ten-dokument-istnieje)
2. [Tożsamość / nazwa](#2-tożsamość--nazwa)
3. [Status](#3-status)
4. [Stage / faza](#4-stage--faza)
5. [ROI / finanse](#5-roi--finanse)
6. [Daty](#6-daty)
7. [Axis / area](#7-axis--area)
8. [Owner / role](#8-owner--role)
9. [Lineage / pochodzenie](#9-lineage--pochodzenie)
10. [Plan deprecacji](#10-plan-deprecacji)
11. [Tabela zbiorcza kanonu](#11-tabela-zbiorcza-kanonu)

---

## 2. Tożsamość / nazwa

**Kanon: `name`.** `title` = alias zgodności (read-compat).

`name` jest `NOT NULL` w bazowej definicji (`000_initdb_core_tables.sql:476`). `title` to kolumna dołożona później przez runtime ensure (`server/src/database/PostgresDatabase.ts:2025` — `ensureColumn('title', 'title TEXT')`), nullable. Audyt potwierdził „chaos `name` vs `title`": część ścieżek pisała tylko `name`, część tylko `title`, część oba — przez co SELECT po jednym polu zwracał NULL i UI pokazywało puste tytuły.

| Kanon | Deprecated / alias | Uwaga migracji |
|---|---|---|
| `name` (NOT NULL) | `title` (alias) | Lejek pisze **OBA** (`name = title = wartość`) na czas okresu przejściowego, by stary kod czytający `title` nie pokazywał NULL. Read-compat: każdy SELECT używa `COALESCE(name, title)`. Po backfill `name := COALESCE(name, title)` → `title` deprecated, drop w F5.4. |

**Reguła zapisu:** lejek ustawia `name` (autorytet) i lustrzanie `title`. **Reguła czytania:** `COALESCE(name, title)`.

---

## 3. Status

**Kanon: `status`** — wartości UPPERCASE z enuma w `server/src/constants/initiativeStatuses.ts` (`InitiativeStatus`), egzekwowane CHECK-em wprowadzonym w **F1.12**.

Kanoniczny cykl 13 statusów (z macierzą przejść `VALID_TRANSITIONS` i bramkami ról):

```
DRAFT → PENDING_REVIEW → REVIEW → PROMOTED → PLANNING → APPROVED → SCHEDULED → EXECUTING → DONE → TRACKING
                                                                         ↓                      ↘ ARCHIVED
                                                                      BLOCKED
   (uniwersalne) CANCELLED → ARCHIVED
```

Default w starej definicji to legacy `'step3'` (`000_initdb_core_tables.sql:481`) — **poza kanonem**. Ścieżki `economics.routes` i `v8/finance.routes` wstawiały `'step3'`, a `reportImportService` `'PENDING_REVIEW'`. F1.12 ustanawia CHECK + normalizuje legacy.

| Kanon | Deprecated | Uwaga migracji |
|---|---|---|
| `status` (UPPERCASE, enum z `initiativeStatuses.ts`) | wartości `'step3'`, lowercase, dowolny string spoza enuma | Backfill: `'step3'`→`'DRAFT'` (lub mapowanie wg fazy), `UPPER(status)`. CHECK constraint = F1.12. Porównania zawsze `UPPER(status)` aż do pełnego backfill. |

**Reguła:** żaden zapis nie pomija enuma; CHECK odrzuca wartości spoza listy.

---

## 4. Stage / faza

**Kanon: `phase`** o domenie `PLAN | PILOT | SCALE`. Pozostałe trzy — `current_stage`, `execution_phase`, `stage` — **deprecated**.

Cztery kolumny opisują „gdzie w cyklu życia merytorycznego" jest inicjatywa, niezależnie od `status` (który opisuje stan governance/workflow). To dwie różne osie — `status` = gdzie w bramkach, `phase` = jaki etap wdrożenia. Wybieramy `phase` jako kanon, bo:

- nazwa jest najbardziej neutralna i czytelna (nie sugeruje modułu jak `execution_phase`),
- domena `PLAN/PILOT/SCALE` mapuje się 1:1 na model wdrożeniowy DRD (planowanie → pilotaż → skalowanie),
- spójna z kolumną `pilot_end_date` (granica PILOT→SCALE).

| Kanon | Deprecated | Uwaga migracji |
|---|---|---|
| `phase` ∈ {`PLAN`,`PILOT`,`SCALE`} | `current_stage`, `execution_phase`, `stage` | Backfill `phase` z najlepszego dostępnego źródła wg priorytetu: `execution_phase` → `current_stage` → `stage`, znormalizowane do `PLAN/PILOT/SCALE`. Read-compat: konsumenci `current_stage`/`stage` czytają `COALESCE(phase, current_stage, execution_phase, stage)` do czasu migracji. Drop trzech deprecated = F5.4. CHECK na domenę po backfill. |

**Uwaga:** `status` ≠ `phase`. Nie wolno „zreconcilować" jednego w drugie — `status` pozostaje osią workflow (sekcja 3), `phase` osią wdrożenia.

---

## 5. ROI / finanse

**Kanon ROI: `expected_roi`** (REAL). **Kanon koszt: `cost_capex` + `cost_opex`** (REAL, bazowe). **Kanon budżet całkowity: `planned_budget_total` (plan) + `actual_budget_total` (rzeczywisty)** (NUMERIC).

Deprecated: `estimated_roi` (duplikat ROI) oraz `estimated_budget` (pojedyncza, nietypowana sumarycznie, mylona z planned/actual). ROI liczone ad-hoc na FE nie jest kolumną — jeśli potrzebny zapis, idzie do `expected_roi`.

| Domena | Kanon | Deprecated | Uwaga migracji |
|---|---|---|---|
| ROI | `expected_roi` | `estimated_roi` | Backfill `expected_roi := COALESCE(expected_roi, estimated_roi)`. Read-compat `COALESCE(expected_roi, estimated_roi)`. Drop `estimated_roi` = F5.4. |
| Koszt (składowe) | `cost_capex`, `cost_opex` | — | Bez zmian; to bazowy rozkład CAPEX/OPEX. |
| Budżet (sumy) | `planned_budget_total`, `actual_budget_total` | `estimated_budget` | `estimated_budget` było dwuznaczne (plan czy estymata?). Backfill `planned_budget_total := COALESCE(planned_budget_total, estimated_budget, cost_capex+cost_opex)`. Drop `estimated_budget` = F5.4. |

**Reguła:** plan vs rzeczywistość są **dwiema** kolumnami (`planned_*` / `actual_*`), nigdy jedną nadpisywaną.

---

## 6. Daty

Dziewięć kolumn dat rozpada się na **trzy semantyki** (plan / rzeczywistość / prognoza) + tracking korzyści. Każda kolumna ma jedno jasne znaczenie:

| Kolumna (kanon) | Semantyka | Opis |
|---|---|---|
| `planned_start_date` | **PLAN** | Zaplanowany start wdrożenia (z roadmapy/charteru). Niezmienny baseline. |
| `planned_end_date` | **PLAN** | Zaplanowany koniec wdrożenia. Baseline. |
| `start_date` | **RZECZYWISTE** | Faktyczna data rozpoczęcia (kiedy weszło w EXECUTING). |
| `actual_end_date` | **RZECZYWISTE** | Faktyczna data zakończenia (kiedy weszło w DONE). |
| `forecast_start_date` | **PROGNOZA** | Bieżąca prognoza startu (aktualizowana w trakcie, gdy plan się ślizga). |
| `forecast_end_date` | **PROGNOZA** | Bieżąca prognoza końca. |
| `pilot_end_date` | **GRANICA FAZY** | Koniec pilotażu = granica `phase` PILOT→SCALE (sekcja 4). |
| `tracking_start_date` | **KORZYŚCI** | Start śledzenia korzyści (faza TRACKING). |
| `tracking_end_date` | **KORZYŚCI** | Koniec okna śledzenia korzyści. |

**Zasada porządkująca:** `planned_*` to baseline (zamrożony), `forecast_*` to żywa prognoza, „gołe" `start_date`/`actual_end_date` to fakty. Odchylenie planu liczy się jako `actual − planned`; ślizg jako `forecast − planned`.

| Kanon | Deprecated | Uwaga migracji |
|---|---|---|
| wszystkie 9 wg tabeli wyżej | `end_date` (gołe) — **deprecated na rzecz `actual_end_date`** | Historycznie `end_date` mieszało plan i fakt. Backfill: jeśli `status` ∈ {DONE,TRACKING,ARCHIVED} → `actual_end_date := COALESCE(actual_end_date, end_date)`; w przeciwnym razie `planned_end_date := COALESCE(planned_end_date, end_date)`. Read-compat `COALESCE(actual_end_date, end_date)` dla widoków „kiedy skończono". Drop `end_date` = F5.4. `start_date` zostaje jako kanon „rzeczywisty start". |

---

## 7. Axis / area

**Kanon: `axis` + `area`** (TEXT, w bazowej definicji `000_initdb_core_tables.sql:477-478`). Deprecated: `drd_axis`, `drd_area` (dołożone później jako duplikaty z prefiksem brandowym).

| Kanon | Deprecated | Uwaga migracji |
|---|---|---|
| `axis` | `drd_axis` | Backfill `axis := COALESCE(axis, drd_axis)`. Read-compat `COALESCE(axis, drd_axis)`. Drop = F5.4. |
| `area` | `drd_area` | Backfill `area := COALESCE(area, drd_area)`. Read-compat `COALESCE(area, drd_area)`. Drop = F5.4. |

---

## 8. Owner / role

**Kanon: trzy rozłączne kolumny FK do `users(id)`** — bez duplikatów, nic do deprecacji. Definicja bazowa (`000_initdb_core_tables.sql:492-494,506-508`).

| Kolumna (kanon) | Rola | FK |
|---|---|---|
| `owner_business_id` | Właściciel biznesowy (odpowiada za korzyści/cel) | `users(id)` ON DELETE SET NULL |
| `owner_execution_id` | Właściciel wykonawczy (odpowiada za realizację) | `users(id)` ON DELETE SET NULL |
| `sponsor_id` | Sponsor / decydent (bramki Go/No-Go) | `users(id)` ON DELETE SET NULL |

**Uwaga:** generyczne `owner_id` spotykane w seedach/niektórych ścieżkach **nie jest kanonem** — lejek mapuje je na `owner_business_id`. (Rozjazd do uprzątnięcia w F5.4 razem z lejkiem.)

---

## 9. Lineage / pochodzenie

**Kanon: `source_type` + `source_id`** (skąd inicjatywa pochodzi) **+ `evidence_refs_json`** (dowody/odnośniki). Wszystkie dołożone runtime ensure (`PostgresDatabase.ts:2025-2046`).

| Kolumna (kanon) | Znaczenie |
|---|---|
| `source_type` | Typ źródła: `tool` / `assessment` / `interview` / `report` / `economics` / `chat` / `manual` … |
| `source_id` | ID konkretnego rekordu źródłowego (sesji narzędzia, assessmentu, insightu, raportu). |
| `evidence_refs_json` | JSON-array referencji do dowodów (findingi, KPI, cytaty) — wymagany przez formułę (≥1 evidence gate w Charter/Portfolio). |

| Kanon | Deprecated | Uwaga migracji |
|---|---|---|
| `source_type`, `source_id` | `source_assessment_id`, `source_report_id`, `created_from` (typowo-specyficzne, częściowe) | Backfill do pary generycznej: `source_assessment_id` → (`source_type='assessment'`, `source_id`), `source_report_id` → (`source_type='report'`, `source_id`). `created_from` → `source_type` gdy puste. Read-compat utrzymuje stare kolumny do czasu migracji konsumentów. Drop = F5.4. |
| `evidence_refs_json` | — | Kanon; lejek waliduje ≥1 wpis dla ścieżek wymagających lineage. |

**Uwaga jakości:** `source_id` bywa NULL na ścieżkach AI (chat). Lejek (F1.x) ma wymuszać `source_type`/`source_id` na wejściu — to warunek poprawnego lineage i deduplikacji.

---

## 10. Plan deprecacji

Trójstopniowy, bezpieczny (zero downtime), wykonywany w migracjach **F5.4**. Każda domena z sekcji 2–9 przechodzi te same trzy kroki:

### Krok 1 — READ-COMPAT (najpierw, nieblokujące)
- Wszystkie SELECT-y/serializatory czytają **kanon z fallbackiem**: `COALESCE(kanon, deprecated…)`.
- Lejek tworzenia/aktualizacji pisze **kanon ORAZ lustrzanie deprecated alias** tam, gdzie stary kod jeszcze czyta alias (dotyczy zwł. `name`/`title`).
- Cel: od tego momentu żaden odczyt nie zależy wyłącznie od kolumny deprecated; nowe zapisy są kanoniczne.

### Krok 2 — BACKFILL (po wdrożeniu read-compat)
- Migracja danych: `UPDATE initiatives SET kanon = COALESCE(kanon, deprecated…)` wg reguł z tabel sekcji 2–9.
- Normalizacja wartości: `UPPER(status)`, `'step3'`→kanon, `phase`→`PLAN/PILOT/SCALE`.
- Po backfill: dodanie CHECK-ów (status — F1.12; `phase` — domena; budżet — nieujemny).
- Wycofanie lustrzanego zapisu aliasów z lejka (lejek pisze już tylko kanon).

### Krok 3 — DROP (na końcu, po weryfikacji zero-czytelników)
- Grep potwierdza brak czytelników kolumny deprecated w `server/src` i `src` (FE) — dopiero wtedy `ALTER TABLE initiatives DROP COLUMN`.
- Kolejność drop: dopiero po usunięciu fallbacków read-compat z kodu.
- Kolumny do drop: `title`, `estimated_roi`, `estimated_budget`, `end_date`, `current_stage`, `execution_phase`, `stage`, `drd_axis`, `drd_area`, `source_assessment_id`, `source_report_id`, `created_from`.

> **Bramka bezpieczeństwa:** nigdy nie wykonujemy Kroku 2 przed pełnym wdrożeniem Kroku 1, ani Kroku 3 przed greppem potwierdzającym 0 czytelników. Migracje idą najpierw na staging (caboose), prod (centerbeam) za osobną zgodą.

---

## 11. Tabela zbiorcza kanonu

| Domena | KANON | DEPRECATED → drop w F5.4 |
|---|---|---|
| Tożsamość | `name` | `title` (alias, read-compat) |
| Status | `status` (UPPERCASE enum + CHECK F1.12) | `'step3'`/lowercase/spoza-enuma |
| Stage/faza | `phase` (`PLAN`/`PILOT`/`SCALE`) | `current_stage`, `execution_phase`, `stage` |
| ROI | `expected_roi` | `estimated_roi` |
| Koszt | `cost_capex`, `cost_opex` | — |
| Budżet (sumy) | `planned_budget_total`, `actual_budget_total` | `estimated_budget` |
| Daty (plan) | `planned_start_date`, `planned_end_date` | — |
| Daty (fakt) | `start_date`, `actual_end_date` | `end_date` |
| Daty (prognoza) | `forecast_start_date`, `forecast_end_date` | — |
| Data (granica fazy) | `pilot_end_date` | — |
| Daty (korzyści) | `tracking_start_date`, `tracking_end_date` | — |
| Axis | `axis` | `drd_axis` |
| Area | `area` | `drd_area` |
| Owner biznesowy | `owner_business_id` | (`owner_id` → mapuj) |
| Owner wykonawczy | `owner_execution_id` | — |
| Sponsor | `sponsor_id` | — |
| Lineage typ/ID | `source_type`, `source_id` | `source_assessment_id`, `source_report_id`, `created_from` |
| Lineage dowody | `evidence_refs_json` | — |

---

*Egzekucja kanonu: lejek tworzenia (**F1.x**, `InitiativeController` + `createInitiativeService`) jest jedynym dozwolonym zapisem; ~23 ścieżki `INSERT INTO initiatives` są migrowane do niego. Migracje deprecacyjne: **F5.4**. CHECK statusu: **F1.12**.*
