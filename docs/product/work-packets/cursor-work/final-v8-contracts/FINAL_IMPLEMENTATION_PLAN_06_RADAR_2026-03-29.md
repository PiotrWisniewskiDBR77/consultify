# Final Implementation Contract — Radar (Position 6/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: draft (contract wrapper over existing plan)

## 1. Executive summary
- **Intent**: Radar ma być czytelny + „sexy” i działać jak decyzyjny cockpit (nie nieczytelny wykres).
- **Primary users**: management/PMO; użytkownicy startujący dzień w `MyWork`.
- **Success metric**: Radar mówi: co jest najważniejsze teraz, dlaczego, i co zrobić dalej — z explainability i uczciwym trust boundary.

## 2. Scope
### 2.1 In-scope
- Priorytetyzacja sygnałów + rekomendacje z uzasadnieniem.
- Handoff do downstream modułów (`Inicjatywy`, `Wdrożenia`, `Notatki`).

### 2.2 Out-of-scope / non-goals
- Zastąpienie BI suite; autonomiczne „always correct” rekomendacje.

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_RADAR_2026-03-29.md`
- SSOT stack: `docs/product/MYWORK_RADAR_V8_SSOT.md` (+ powiązane runtime docs wymienione w planie)

## 4. Softs inspirations (benchmark apps)
### 4.1 Primary benchmark family (SSOT)
- Plan modułu wskazuje `Softs/0 Projekty` i `Softs/0 KPI` jako benchmark family (`WAVE1_FINAL_IMPLEMENTATION_PLAN_RADAR_2026-03-29.md`).

### 4.2 Local Softs evidence (concrete artifacts)
- **Linear (triage + notifications discipline)**:
  - `Softs/0 Projekty/Linear.zip :: Linear/linear.appx/docs/triage.html` (triage jako “special inbox”: review/update/prioritize zanim trafi do workflow).
  - `Softs/0 Projekty/Linear.zip :: Linear/linear.appx/docs/notifications.html` (inbox notifications + konfiguracja kanałów alertów).
  - `Softs/0 Projekty/Linear.zip :: Linear/linear.appx/developers/agent-signals.html` (“Signals” jako metadane intencji dla aktywności agentów; downstream ma rozumieć jak interpretować/obsłużyć).
- **ClickUp (dashboard operator surface)**:
  - `Softs/0 Projekty/Clickup help.zip :: Clickup help/help.clickup.com/hc/en-us/articles/6312197753239-Intro-to-Dashboards.html` (dashboards jako warstwa operacyjna).
- **monday.com (dashboard/widget surfaces / API)**:
  - `Softs/0 Projekty/Monday dev.zip :: Monday dev/developer.monday.com/api-reference/reference/dashboards-and-widgets.html` (dashboards & widgets jako first-class API surface).
- **Palantir Foundry (cockpit pattern: steps + status + actions)**:
  - `Softs/Palantir/www.palantir.com/docs/foundry/hyperauto/v1-cockpit.html` (Cockpit: central place; left panel = steps+status; main area = actions per step).
  - `Softs/Palantir/www.palantir.com/docs/foundry/sap/sap-cockpit.html` (Cockpit jako admin surface + monitor, wejście przez transaction code; w dokumencie wprost pojawia się “Data transfer monitor”).

### 4.3 Parity checklist vs Softs (approval-grade)
**Parity oznacza “decyzyjny cockpit z uczciwą gramatyką sygnałów”, nie “BI dashboard”.**

- **Triage / inbox discipline (Linear)**:
  - Radar ma działać jak “inbox dla rzeczy ważnych”: review → update context → prioritize → handoff do workflow.
  - Powinna istnieć ścieżka ownership (“kto ma to przejąć”) i unikanie “nobody’s queue”.
- **Alerting/notifications posture (Linear)**:
  - Użytkownik ma jasne, konfigurowalne kanały “co jest alertem”, a co jest tylko informacją.
- **Signals + intent metadata (Linear Developers)**:
  - Rekomendacje/sygnały mają jawne metadane intencji i “how to handle”, żeby downstream moduły mogły utrzymać spójność.
- **Cockpit anatomy: steps + status + action (Palantir)**:
  - UI ma wyraźną oś: “co jest krokiem / stanem / następną akcją” (nie wykres bez decyzji).
  - Stany muszą być czytelne (ready/degraded/blocked) i mieć “next action” (kto jest ownerem akcji).
- **Dashboard as operator surface (ClickUp/monday)**:
  - Filtry, ranking, i “co jest P0” muszą być jednoznaczne; user nie czyta całej strony, żeby zrozumieć priorytety.
  - Drill-down → link-out do właściwego modułu z zachowanym kontekstem.

### 4.4 Gap ledger vs Softs (what we are missing — derived from current plans)
Źródło prawdy “co mamy / czego brakuje” to: `WAVE1_FINAL_IMPLEMENTATION_PLAN_RADAR_2026-03-29.md` + SSOT stack Radar (sekcja 3 planu).

| Capability cluster (Softs parity target) | What Softs implies | Current truth (per plan) | Gap statement (contract requirement) | Priority |
| --- | --- | --- | --- | --- |
| Ranking / prioritization grammar | directive inbox, not “pretty page” | “prioritization quality is uneven” | Ustalić i dowieźć stabilną gramatykę rankingową + “why-now” | P0 |
| Explainability | user can trust why it surfaced | “explainability not deep enough” | Każdy sygnał ma rationale + evidence pointers + uncertainty boundary | P0 |
| Signal→action continuity | triage → handoff | “downstream continuity partial” | Domknąć handoff z zachowanym kontekstem do `Inicjatywy`/`Wdrożenia`/`Notatki` | P0 |
| Ownership / queue hygiene | no orphaned items | (nieudowodnione jako zamknięte) | Jawny owner/queue semantics dla najważniejszych sygnałów | P1 |

## 5. Evidence plan (DoD)
### 5.1 Acceptance criteria
- Ranking + explainability + handoff działają; user nie musi „czytać całej strony”, żeby zrozumieć co jest P0.
- Każda rekomendacja ma: dlaczego (rationale), na jakich danych (evidence pointers), oraz granicę pewności (uncertainty/degraded).
- “Next action” jest jednoznaczne i prowadzi do właściwego modułu z zachowanym kontekstem.

### 5.2 Tests
- Testy kontraktowe: sygnał/rekomendacja → payload (why/evidence/uncertainty) → UI render.
- Testy integracyjne: click “next action” → lądowanie w module docelowym z zachowanymi parametrami/kontekstem.
- Regression: degraded/missing-data → Radar jest uczciwy (nie overclaim) i wskazuje “co brakuje”.

### 5.3 Staging proof checklist
- Demo: „signal → why → next action → landing w module docelowym” (3 różne typy sygnałów).
- Demo: “uncertainty boundary”: brak danych / conflict → Radar pokazuje ograniczenie i bezpieczną akcję.

## 8. Delivery plan
### 8.0 Context pack (read first)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Execution playbook: `docs/product/work-packets/cursor-work/final_master/PROGRAM_EXECUTION_PLAYBOOK.md`
- Authority chain (detailed plan/SSOT): see section 3.
- Softs parity + gaps: see section 4.
- Evidence plan: see section 5.

### 8.1 Bounded delivery packets
#### P06-A — Radar canon + prioritization grammar (scope approval)
- **Goal**: Radar jako decyzyjny cockpit (triage), nie wykres.
- **Inputs required**: ranking grammar + “why-now” payload contract; handoff targets.
- **Acceptance**: zatwierdzony zakres; non-goals jawne; degraded/uncertainty zasady spisane.
- **Evidence**: scope approval + linkowane SSOT.

#### P06-B — Signal→action continuity (handoff closure)
- **Goal**: domknąć triage→handoff z zachowaniem kontekstu.
- **Acceptance**: 3 typy sygnałów mają “next action” i prawidłowy landing w module docelowym.
- **Evidence**: integracyjne testy handoff + staging demo.

#### P06-C — Verification + rollout
- **Goal**: telemetry + regresje + staging proof; bezpieczny rollout/rollback.
- **Acceptance**: bar `verified(evidence)` spełniony.
- **Evidence**: wypełniony evidence ledger (sekcja 10).

### 8.2 Rollout strategy
- Włączaj inkrementalnie: najpierw read-only ranking + explainability, potem write/handoff hardening.

### 8.3 Rollback plan
- Wyłącz Radar routing/handoff; pozostaw fallback do “neutral view”; bez destrukcji danych.

## 9. Risks / open questions / decisions
- Ryzyko: UI “sexy” bez prawdy rankingowej (decyzyjnie bezużyteczne).
- Ryzyko: brak explainability → brak zaufania.
- Decyzje: minimalny zestaw sygnałów P0 i ich owners.

## 10. Evidence ledger (fill after delivery)
| Packet ID | Status | PR / commit | Tests (what + result) | Staging proof | Notes / known limits |
| --- | --- | --- | --- | --- | --- |
| P06-A |  |  |  |  |  |
| P06-B |  |  |  |  |  |
| P06-C |  |  |  |  |  |

