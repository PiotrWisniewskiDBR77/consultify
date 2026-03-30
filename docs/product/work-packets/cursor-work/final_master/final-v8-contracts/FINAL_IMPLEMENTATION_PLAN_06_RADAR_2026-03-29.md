# Final Implementation Contract — Radar (Position 6/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: `approved(scope)` for **P06-A** (Radar canon + prioritization grammar frozen); P06-B / P06-C not started  
Last updated: 2026-03-30 (P06-A scope closure)

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

### 2.3 P06-A canon (Radar ranking truth)

Radar jest triage cockpit. P06-A zamraża **jedną** prawdę o:

- ranking/prioritization grammar (w tym **jak liczymy P0**),
- stabilnych kategoriach sygnałów,
- kontrakcie payloadu “why-now” (rationale + evidence pointers + uncertainty boundary),
- kontrakcie handoff payload do: `Inicjatywy` (P11), `Wdrożenia` (P03), `Notatki` (P07),
- degraded rules (missing/conflict/stale) → uczciwe stany + bezpieczny next action,
- anti-duplicate gate (no second inbox / no parallel ranking truth),
- error posture (HTTP+UI) + acceptance checklist.

#### 2.3.1 Stable categories (enum, frozen)

Radar klasyfikuje każdy sygnał do jednej z kategorii:

- **Execution (Delivery)** — blokery, slip, krytyczna ścieżka
- **Decision / Alignment** — decyzje, eskalacje, brak ownera
- **Finance / KPI** — anomalie KPI/finansowe o decyzjnej wartości (nie “dashboard”)
- **Governance / Compliance** — terminy/polityki/ryzyka formalne
- **External change / Opportunity** — zmiana zewnętrzna wpływająca na aktywne prace

Zakaz: “Misc / Interesting”.

#### 2.3.2 Ranking / prioritization grammar (how we compute P0)

Radar zawsze pokazuje:

- `P-level` (`P0|P1|P2`) + reguły, które zadziałały,
- “why-now” (2–4 zdania) + okno czasu,
- evidence pointers + freshness,
- uncertainty boundary,
- next action (target module + fallback).

**Banding (wspólny język):**

- Impact: `I3 existential/legal` | `I2 material` | `I1 moderate`
- Urgency: `U3 now/24h` | `U2 this week` | `U1 this month+`
- Scope: `S3 program-wide` | `S2 multi-initiative` | `S1 local`
- Confidence: `C3 strong` | `C2 partial` | `C1 weak` | `C0 unknown`
- Freshness: `F3 <24h` | `F2 <7d` | `F1 <30d` | `F0 stale`
- Actionability: `A2 clear next action` | `A1 partial` | `A0 none`

**Hard-gate P0 (nawet przy niskiej pewności, ale z jawnie pokazanym boundary):**

- Governance/Compliance: deadline ≤ 7 dni i `I2+`
- Execution: krytyczny blocker na ścieżce krytycznej, deadline ≤ 7 dni
- Decision: decyzja blokuje execution i okno ≤ 72h
- Finance/KPI: przekroczony próg alarmowy KPI (prog zdefiniowany w KPI/Finance SSOT) i `I2+`

**Score (ranking w ramach P-level):**

\[
\text{score} =
\Big(4\cdot I + 3\cdot U + 2\cdot S + 2\cdot A\Big)\cdot \text{conf}(C) + \text{fresh}(F) - \text{dup}
\]

- `conf(C)`: `C3=1.0`, `C2=0.8`, `C1=0.6`, `C0=0.4`
- `fresh(F)`: `F3=+3`, `F2=+2`, `F1=+1`, `F0=-3`
- `dup`: `0` jeśli unikalny; `+4` jeśli near-duplicate tego samego “problem statement” (scal zamiast duplikować)

**Mapping:**

- `P0`: hard-gate **lub** (`I≥2` i `U≥2` i `F≥1` i `C≥1`) oraz `score ≥ 18`
- `P1`: (`I≥2` i `U≥1`) oraz `score ≥ 12`
- `P2`: reszta

**Tie-breakers:**

1) hard-gate > non hard-gate  
2) wyższe `U`, potem `I`, potem `A`  
3) near-duplicate → scal w jeden card (nie twórz “więcej itemów”)  

#### 2.3.3 “Why-now” payload contract (rationale + evidence + uncertainty)

Minimalny payload (obowiązkowy niezależnie od UI):

- `signal_id` (stable)
- `category` (2.3.1)
- `priority_level` (`P0|P1|P2`)
- `rank`:
  - bands: `impact/urgency/scope/confidence/freshness/actionability`
  - `triggered_rules[]` (np. `HARD_GATE_EXECUTION_BLOCKER_D7`)
- `why_now`:
  - `rationale_text` (2–4 zdania)
  - `time_window` (np. `next_24h`, `this_week`)
  - `primary_driver` (`deadline|blocker|variance|escalation|opportunity`)
- `evidence`:
  - `evidence_pointers[]` (typ+ref; mogą wskazywać na Softs parity z §4.2)
  - `last_observed_at`
  - `source_coverage` (`complete|partial`)
- `uncertainty_boundary`:
  - `missing_inputs[]`
  - `conflicts[]`
  - `what_would_change_ranking[]`
- `ownership`:
  - `owner_role` (np. PMO / Delivery Lead / Finance Lead)
  - `queue_hint` (`execution|decision|governance`)
- `next_action`:
  - `target_module` (`Inicjatywy|Wdrożenia|Notatki`)
  - `handoff_intent` (`open|create|append`)
  - `handoff_payload` (2.3.5)
  - `safe_fallback`

#### 2.3.4 P0 signal archetypes (frozen, 5) — owners + next-action

Każdy archetyp ma: inputs, rank rule, rationale text, evidence list, uncertainty, next-action target.

**A) Critical path blocker (Execution)**

- **Owner**: Delivery Lead / PMO
- **Inputs**: milestones, blockers, zależności, terminy
- **Rank rule**: P0 jeśli blocker na ścieżce krytycznej i deadline ≤ 7 dni (hard-gate) lub `I2+` + `U2+`
- **Rationale (template)**: “To blokuje krytyczny krok w oknie {time_window}. Jeśli nie zdejmiesz blokera teraz, ryzykujesz {impact}.”
- **Evidence (min)**: wdrożenie/milestone (workspace), blocker thread (workspace), Softs posture: Linear triage + Palantir cockpit (§4.2)
- **Uncertainty**: brak dat milestone → `degraded(missing_data)` + lista braków
- **Next-action target**: `Wdrożenia` (open) → fallback: `Notatki` (capture blockers checklist)

**B) Decision needed now (Decision / Alignment)**

- **Owner**: PMO / Initiative Owner
- **Inputs**: decision items, owner, termin, zależności wdrożeń
- **Rank rule**: P0 jeśli decyzja blokuje execution i okno ≤ 72h (hard-gate)
- **Rationale**: “Bez tej decyzji praca stoi. Okno decyzyjne to {time_window}; ryzyko to {impact}.”
- **Evidence**: initiative context (workspace), blockers (workspace), Softs posture: Palantir cockpit steps/status/actions (§4.2)
- **Uncertainty**: owner nieustalony → `degraded(conflict)` + safe action “assign owner”
- **Next-action target**: `Inicjatywy` (append decision) → fallback: `Notatki`

**C) Stakeholder escalation / unanswered ping (Decision / Alignment)**

- **Owner**: Program Lead / PMO
- **Inputs**: notifications/mentions, SLA odpowiedzi, link do initiative/deployment
- **Rank rule**: P0 jeśli ping od kluczowego stakeholdera bez odpowiedzi > 24h i dotyczy aktywnej pracy (`I2+`)
- **Rationale**: “To jest eskalacja dotycząca aktywnej pracy. Brak reakcji w oknie {time_window} zwiększa ryzyko {impact}.”
- **Evidence**: thread/mention (workspace), link do initiative/deployment, Softs posture: Linear notifications (§4.2)
- **Uncertainty**: brak kontekstu → `degraded(missing_data)` + safe action “capture context”
- **Next-action target**: `Notatki` (create escalation brief) → fallback: `Inicjatywy` (jeśli wymaga decyzji)

**D) Compliance deadline (Governance / Compliance)**

- **Owner**: Governance Owner / PMO
- **Inputs**: deadline, requirement/policy, owner, readiness
- **Rank rule**: P0 jeśli deadline ≤ 7 dni i `I2+` (hard-gate)
- **Rationale**: “Termin compliance jest blisko. Radar pokazuje to jako P0 (hard-gate) i jawnie pokazuje braki danych.”
- **Evidence**: requirement/policy (workspace/internal ref), Softs posture: cockpit readiness states (§4.2)
- **Uncertainty**: brak owner/checklisty → `degraded(missing_data)`
- **Next-action target**: `Wdrożenia` (execution steps) lub `Inicjatywy` (decision) → fallback: `Notatki`

**E) KPI / finance anomaly (Finance / KPI)**

- **Owner**: Finance Lead / PMO
- **Inputs**: KPI variance/trend, threshold, powiązane inicjatywy
- **Rank rule**: P0 jeśli przekroczony threshold + `I2+` (hard-gate), inaczej wg score
- **Rationale**: “To odchylenie KPI ma decyzjny wpływ na {scope}. Jeśli to trend, koszt opóźnienia rośnie.”
- **Evidence**: KPI/metric (workspace), powiązania do initiatives/deployments, Softs posture: dashboards as operator surface (ClickUp/monday) (§4.2)
- **Uncertainty**: opóźnione dane → `degraded(stale)` + refresh/confirm source
- **Next-action target**: `Inicjatywy` (jeśli wymaga zmiany planu) lub `Notatki` (analiza) → fallback: `Notatki`

#### 2.3.5 Handoff payload contract (Radar → downstream)

**Common (`radar_handoff_context`) — wymagane zawsze:**

- `origin=radar`
- `signal_id`, `category`, `priority_level`
- `why_now` (rationale + time_window)
- `evidence_pointers[]` + `last_observed_at`
- `uncertainty_boundary`
- `ownership.owner_role`
- `rank.triggered_rules[]`
- `radar_deeplink`

**To `Inicjatywy` (P11) — wymagane dodatkowo:**

- `initiative_suggestion`: `problem_statement`, `proposed_outcome`, `time_window`, `suggested_owner_role`, `open_questions[]`

**To `Wdrożenia` (P03) — wymagane dodatkowo:**

- `deployment_suggestion`: `affected_milestone/area`, `blocker_summary`, `next_step`, `expected_unblock`

**To `Notatki` (P07) — wymagane dodatkowo:**

- `note_suggestion`: `summary` (≤ 6 bullets), `assumptions[]`, `decision_needed?`, `links[]`

#### 2.3.6 Degraded rules (missing / conflict / stale)

Radar musi renderować uczciwe stany:

- `ready`
- `degraded(missing_data)` — pokazuje `missing_inputs[]` i safe next action
- `degraded(conflict)` — pokazuje `conflicts[]` i safe next action
- `degraded(stale)` — pokazuje `last_observed_at` i safe next action
- `blocked(permission)` — pokazuje co jest ukryte i safe next action

Zakaz: “P0” bez jawnego uncertainty boundary.

#### 2.3.7 Anti-duplicate gate (no second inbox, no parallel ranking truth)

- Radar jest **jedyną** prawdą o `P-level` i “why-now”.
- Radar nie implementuje workflow egzekwowania (Inbox ≠ Radar).
- Downstream może przejąć kontekst, ale nie tworzy własnego rankingu; jeśli pokazuje P0, robi to jako **projekcję** pochodzącą z Radar `signal_id`.

#### 2.3.8 Error posture (HTTP + UI guidance)

HTTP guideline:

- `200` full payload
- `206` partial sources → UI: jawny banner “partial data” + lista braków
- `400` bad params → UI: inline error
- `401/403` permission → UI: `blocked(permission)` + safe action
- `409/412` conflict/stale write → UI: pokaż konflikt + refresh
- `429` rate limit → UI: retry + degraded
- `503/504` upstream timeout → UI: degraded + last known state jeśli istnieje

UI guideline:

- zawsze renderuj stan (`ready|degraded|blocked`) + “co dalej”
- “why-now” + “uncertainty boundary” są widoczne w panelu interpretacji (cockpit doctrine z §4.3)

#### 2.3.9 Acceptance checklist (10+ testable points)

- [ ] Radar ma dokładnie 5 stabilnych kategorii (2.3.1); brak “Misc”.
- [ ] P0 jest deterministyczne (hard-gate + score + tie-breakers) (2.3.2).
- [ ] Każdy P0/P1 ma `why_now.rationale_text` (2–4 zdania) + `time_window` (2.3.3).
- [ ] Każdy P0/P1 ma `evidence_pointers[]` + `last_observed_at` (2.3.3).
- [ ] Każdy sygnał ma jawny `uncertainty_boundary` (missing/conflict/stale + what-would-change) (2.3.3).
- [ ] Degraded rules są wdrożalne: missing/conflict/stale/permission mają safe next action (2.3.6).
- [ ] Zamrożone archetypy P0 (A–E) mają owner + next-action target module (2.3.4).
- [ ] Handoff do P11/P03/P07 przenosi `radar_handoff_context` + payload per-target (2.3.5).
- [ ] Anti-duplicate: downstream nie tworzy własnego “P0”; to projekcja z Radar `signal_id` (2.3.7).
- [ ] `206`/permission/timeout mają jawny UI posture (2.3.8), bez “white screen”.
- [ ] Radar nie staje się “second inbox” (2.3.7 + SSOT §9.1).

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
- **Tasks** (see library: `docs/product/work-packets/cursor-work/final_master/PACKET_TASKS_AND_DOD_LIBRARY.md`):
  - Freeze ranking grammar + “why-now” payload (rationale/evidence/uncertainty).
  - Freeze handoff targets and required context payload for each target module.
  - Freeze degraded rules (missing data/conflict) and non-goals.
- **DoD**:
  - Approved(scope): triage contract is explicit and handoff payload is testable.

#### P06-B — Signal→action continuity (handoff closure)
- **Goal**: domknąć triage→handoff z zachowaniem kontekstu.
- **Acceptance**: 3 typy sygnałów mają “next action” i prawidłowy landing w module docelowym.
- **Evidence**: integracyjne testy handoff + staging demo.
- **Tasks**:
  - Implement 3 signal archetypes with explainability + next action.
  - Implement landing with preserved context in target modules (bounded).
  - Add contract tests for payload + integration tests for handoff clicks (5.2).
- **Staging proof script (click-by-click)**:
  1. Open `Radar` and pick 3 different signal types (P0 archetypes).
  2. For each signal: open detail and verify rationale + evidence pointers + uncertainty boundary.
  3. Click “next action” and verify landing in the target module preserves context (filters/selection).
  4. Return to Radar and verify the signal’s state updates appropriately (bounded).
  5. Trigger a missing-data/conflict case and verify honest degraded messaging (no overclaim).
- **DoD**:
  - Staging demo passes; uncertainty boundaries are visible; no overclaim.

#### P06-C — Verification + rollout
- **Goal**: telemetry + regresje + staging proof; bezpieczny rollout/rollback.
- **Acceptance**: bar `verified(evidence)` spełniony.
- **Evidence**: wypełniony evidence ledger (sekcja 10).
- **Tasks**:
  - Capture staging proofs (5.3) and fill ledger rows P06-A/B/C.
  - Validate rollback: disable routing/handoff; preserve neutral view.
- **DoD**:
  - Status `verified(evidence)` with complete ledger entries and known limits.

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
| P06-A | approved(scope) | 90c7b4973b | n/a (docs-only) | n/a | Canon frozen: ranking grammar + why-now payload + handoff + degraded/error posture |
| P06-B |  |  |  |  |  |
| P06-C |  |  |  |  |  |

