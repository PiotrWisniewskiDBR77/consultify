# Initiatives v3 — Portfolio Analysis (Resources / Feasibility / Logic / Timeline / Completeness) (SSOT)

> **Status:** Draft (v3 SSOT)  
> **Cel:** opisać kanoniczny moduł “Initiatives → Analysis” jako **data-driven quality gate cockpit** dla portfela.  
> Wykrywa problemy na podstawie danych/checklist (nie opinii AI) i prowadzi do naprawy (“Open initiative”, “Fix”).

## 0) Powiązane SSOT (MUST)

- Operating model (Analysis tab w Initiatives): `docs/product/OPERATING_MODEL_V3.md`
- InitiativeLevel/templates + completeness:  
  - `docs/product/INITIATIVE_LEVEL_TEMPLATES_V3.md`  
  - `docs/product/NMODE_MANAGEMENT_V3.md`
- Gates / lifecycle:
  - `docs/product/GATE_DEFINITION_OF_DONE.md`
- UI canon:
  - View modes standard: `docs/ui-standards/03-modules/view-modes-standard.md`
  - App Table Standard: `docs/ui-standards/03-modules/app-table-standard.md`
  - Module Hub standard: `docs/ui-standards/03-modules/module-hub-standard.md`

---

## 1) Intent (dlaczego “Analysis” istnieje)

Portfolio bez analizy to chaos: przeładowane zasoby, konflikty zależności, nierealne terminy i “ładne” inicjatywy bez wymaganych danych.

“Analysis” ma działać jak:

- PMO cockpit do przygotowania steering committee,
- narzędzie do egzekwowania gates i jakości planu,
- lista konkretnych “issues” z deep‑linkiem do poprawy.

**MUST:** issues są deterministyczne (reguły) i audytowalne.

### 1.1 Zasada elastyczności (żeby nie zabetonować małych zespołów)

To jest kluczowe założenie produktowe:

- **Analysis ma pomagać**, a nie zamieniać się w “policjanta dokumentacji”.
- **Blokowanie** jest dozwolone tylko tam, gdzie wynika to wprost z **gate’ów/lifecycle** (DoD) i template’ów.
- Wszystkie inne problemy pokazujemy jako **WARN/INFO** z jasnym “co poprawić”, bez blokowania pracy.

---

## 2) UI — Initiatives Hub → “Analysis” (R1)

### 2.1 5 sub‑widoków (kanon)

- **Resources**
- **Feasibility**
- **Logic**
- **Timeline**
- **Completeness**

Każdy sub‑widok ma:

- summary (liczby: ile issue, ile krytycznych),
- tabelę/listę issue (App Table Standard lub board, zależnie od typu),
- akcje: **Open initiative** oraz **Fix** (gdy fix jest jednoznaczny).

### 2.2 “Fix” = deep link, nie magia

“Fix” oznacza:

- przejście do inicjatywy w N‑mode,
- otwarcie właściwej sekcji/pola,
- opcjonalnie: pre‑fill form (tylko jeśli jest deterministic).

AI (opcjonalnie) może **proponować** rozwiązanie, ale issue detection ≠ AI.

---

## 2.3 Zakres danych (R1) — bez zaskoczeń

R1 scope (default):

- **per‑project portfolio** (czyli Analysis liczy się dla jednego projektu).

R2+ (opcjonalnie):

- **cross‑project / org portfolio** (agregacja na poziomie organizacji).

**MUST:** jeśli wprowadzimy cross‑project, to jest to jawny przełącznik/filtr (user musi wiedzieć “na czym liczę”).

## 3) Canonical Issue Model (MUST)

`PortfolioIssue` (logicznie):

- `id`
- `type` (enum)
- `severity` (`INFO|WARN|BLOCKER`)
- `initiative_id`
- `title`
- `explanation` (z reguły)
- `rule_key` (stabilny)
- `evidence` (np. brak pola X, konflikt dat)
- `fix_action`:
  - `open_initiative` (z parametrem sekcji)
  - `set_field` (tylko dla bezpiecznych autopopraw, zwykle off w R1)

**MUST:** `rule_key` pozwala liczyć trendy (ile razy ta sama reguła łapie portfel).

---

## 3.1 Severity policy (MUST)

Severity jest pochodną:

- statusu inicjatywy (lifecycle),
- gate’u, który jest “następny”,
- template level (quick_win vs full_charter),
- oraz polityk projektu/organizacji.

Kanon:

- `BLOCKER` tylko wtedy, gdy **dany brak/konflikt realnie blokuje przejście gate’u** lub narusza twardą regułę spójności (np. end < start).
- `WARN` gdy to ryzyko jakości/planowania, ale nie powód do blokady w tym momencie.
- `INFO` dla wskazówek i “dobrych praktyk”.

## 4) Sub‑widoki i reguły (R1 minimum)

### 4.1 Completeness (najważniejsze)

Cel: pokazać braki wymagane przez templates/gates.

Źródła:

- `required_items` / `missing_items` z engine completeness (V3‑K01),
- InitiativeLevel/template.

Przykładowe issues:

- `MISSING_REQUIRED_OWNER` (BLOCKER) — owner nie ustawiony, a gate wymaga.
- `MISSING_KPI_DEFINITION` (WARN/BLOCKER zależnie od statusu) — brak KPI przed APPROVE.
- `MISSING_ECONOMIC_ANALYSIS` (BLOCKER) — wymagana przez `ECONOMIC_ANALYSIS_POLICY.md`.

### 4.2 Logic

Cel: wykryć sprzeczności logiczne na danych.

Reguły R1 (minimal, ale bez przesady):

- dependency conflict: inicjatywa startuje przed zakończeniem dependency (`planned_start < dep.planned_end`)
- circular dependency (prosty wykrywacz pętli)
- status inconsistency (np. `SCHEDULED` bez `planned_start_date`)

**MUST:** brak dat w dependency nie wywala wszystkiego — wtedy issue jest co najwyżej `WARN` (“uzupełnij daty, żeby policzyć logikę”).

### 4.3 Timeline

Cel: racjonalność i spójność osi czasu.

Reguły R1:

- brak dat (wymaganych przez status/gate)
- `planned_end < planned_start` (błąd)
- inicjatywy “SCHEDULED” z startem w przeszłości bez EXECUTING (heurystyka)

### 4.4 Resources

Cel: konflikt obciążenia zasobów (minimalnie).

R1 minimum (bez optymalizacji):

- wykrywanie “owner overloaded”: owner ma >N inicjatyw w statusach aktywnych w tym samym oknie czasu (**konfigurowalne**)
- brak ownera w inicjatywach wymagających ownera (duplikuje completeness, ale tu jako resource risk)

### 4.4.1 Progi i konfiguracja (MUST)

Wszystkie progi są konfigurowalne per org/project (żeby dopasować się do klienta):

- `owner_overload_threshold` (default: 3)
- `owner_overload_statuses` (default: `APPROVED`, `SCHEDULED`, `EXECUTING`)
- `analysis_scope` (default: `PROJECT`)

W małych organizacjach te reguły mogą być ustawione “luźniej” (więcej WARN, mniej BLOCKER).

### 4.5 Feasibility

Cel: wykonalność w oparciu o twarde check‑listy.

R1 minimum:

- brak sponsor/decision artefacts przed APPROVE (jeśli gate wymaga)
- brak podstawowego planu (milestones/tasks) dla wyższych leveli przed SCHEDULE

**MUST:** Feasibility to check‑listy (czy mamy artefakty), nie “czy AI uważa, że się da”.

---

## 5) Lifecycle linkage (MUST)

Issue severity zależy od statusu/gate:

- to samo “brak KPI” może być `WARN` w DRAFT i `BLOCKER` w PLANNING→APPROVE.

Źródło prawdy: `GATE_DEFINITION_OF_DONE.md` + templates.

---

## 6) DoD — V3‑F02 (R1/P1)

- Jest “Analysis” tab w Initiatives hub.
- 5 sub‑widoków istnieje i każdy ma: summary + issues list + open initiative.
- Issues są generowane z reguł na danych/checklistach (nie AI).
- “Fix” prowadzi do właściwej sekcji/pola w inicjatywie.

