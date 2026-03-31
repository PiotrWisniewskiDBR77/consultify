# Final Implementation Contract — Assessment (Position 28/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: approved(scope) (P28-A canon frozen; docs-only)

## 1. Executive summary
- **Intent**: Assessment AI‑driven, wykonywalne przez czat.
- **Primary users**: konsultanci prowadzący diagnostykę; odbiorcy wyników.
- **Success metric**: jedna spójna rodzina assessment: choose → run workbench → evidence/scoring → interpret → promote into action/outputs.

## 2. Scope
### 2.1 In-scope
- Shared assessment workbench + state model.
- Evidence/scoring/interpretation governance.
- Promotion wyników do pracy/artefaktów.

### 2.2 Out-of-scope / non-goals
- Parity z każdą metodologią/diagnostic platform w 1 kroku.

### 2.3 P28-A canon (assessment object model + lifecycle + governance)

Poniższy kanon jest **zamrożonym kontraktem** dla Assessment jako jednej spójnej rodziny (workbench + scoring + interpretacja + promotion) i jest podstawą dla P28-B/P28-C.

Wymusza:

- **brak “silent scoring”** (scoring/interpretacja są zawsze jawne jako *propozycje do review*),
- **jedną prawdę o read-only / locked** (definicje i runy mają wyraźne stany edycji),
- **bounded handoffs** do `Results/Outputs` oraz do `Wnioski w Interview` (bez zastępowania tych modułów).

#### 2.3.1 Assessment object model (frozen; minimal nouns)

Assessment jest “workbench‑run artifact family” z rozdzieleniem: **definition** (co to za metodologia) vs **run** (konkretne wykonanie w czasie).

Minimalny model pojęciowy (must-exist w payloadach i UI vocabulary):

1) **AssessmentDefinition** (metodologia / template)
- Identity: `assessment_definition_id`, `methodology_id`, `version`
- Purpose: “co badamy” + “jak interpretujemy” (bez implementacji “survey builder”)
- Governance: publikacja definicji tworzy **read-only** wersję (immutable by default)

2) **AssessmentRun** (sesja / instancja wykonania)
- Identity: `assessment_run_id`, `assessment_definition_id@version`, `org_id`, `started_by`, `started_at`
- State: `run_state` (np. `draft` / `running` / `awaiting_evidence` / `ready_for_review` / `completed` / `failed`)
- Context: bounded “context snapshot” (linki do wejść, nie kopie prawdy)

3) **EvidenceItem / EvidencePointer** (wejścia, które wspierają scoring/interpretację)
- Evidence jest **links-first** (pointers do źródeł); jeśli przechowujemy excerpt, to jako audytowy “captured excerpt”
- Evidence może być niekompletne → wtedy system wchodzi w jawny degraded state (2.3.6)

4) **ScoreProposal** (proponowany wynik + uzasadnienie)
- Pola: `score_value(s)`, `scoring_rationale`, `evidence_pointers[]`, `assumptions[]`, `confidence` (bounded)
- Status: zawsze oznaczony jako `proposal` dopóki user nie wykona review action

5) **InterpretationProposal** (proponowana interpretacja / “AI insights” w assessment)
- Zasada: interpretacja jest propozycją, nie “final truth”; UI musi umożliwiać accept/reject/override (bez overclaim)
- Pola: `summary`, `key_findings (bounded)`, `limits`, `next_actions (bounded)`, `links` do ScoreProposal/Evidence

6) **PromotionTrace** (ślad przekazania downstream)
- Każda promocja tworzy trace: `from_assessment_run_id` → `target_artifact_ref` (Results/Outputs) lub `target_insight_ref` (P10) + timestamp + actor

#### 2.3.2 Lifecycle (definition + run) — states and invariants (frozen)

**AssessmentDefinition lifecycle**:

- `draft` → `published(read-only@version)` → `deprecated` (optional)
- Publish jest punktem, po którym definicja w tej wersji staje się **immutable**; zmiany = nowa wersja.

**AssessmentRun lifecycle** (bounded; minimal):

- `draft` (setup / choose methodology)  
- `running` (capturing evidence)  
- `awaiting_evidence` (jawny brak wymaganych evidence / inputs)  
- `score_proposed` (ScoreProposal istnieje, ale nie jest zatwierdzony)  
- `reviewed` (user action: accept/reject/override scoring + interpretacji)  
- `completed` (run zakończony; results gotowe do promotion)  
- `failed` (error; run zachowuje audyt i “what next”)

Invarianty (must):

- **approve(run) ≠ review(artifact)**: review dotyczy *wyniku i interpretacji* runu; publish/review artefaktów downstream jest osobną osią (Position 18).
- Run nie może przeskoczyć do `completed` bez jawnego “reviewed” albo jawnego “accepted with missing evidence” (degraded, z widocznymi limits).

#### 2.3.3 Governance: no silent scoring + explainability rules (frozen)

Governance jest kontraktem: user zawsze widzi *co system proponuje* i *dlaczego*.

Zasady (must):

- **No silent scoring**: system nie może w tle “ustawić score” bez pokazania ScoreProposal + rationale.
- **Propose → review → accept/reject/override**: zarówno scoring jak i interpretacja przechodzą przez jawny review action.
- **Explainability**: każde ScoreProposal zawiera `scoring_rationale` i listę evidence pointers; brak evidence → jawny degraded state (2.3.6).
- **No overclaim**: interpretacja zawsze zawiera `limits` i jawne assumptions; UI nie renderuje jej jako “facts”.
- **Auditability**: zmiany w score/interpretation (override) zapisują: kto, kiedy, co zmienił, i dlaczego (reason).

#### 2.3.4 Permissions + lock/read-only truth (single truth)

Assessment musi mieć jedną, spójną semantykę edycji i widoczności:

- **Definition publish lock**: `published(read-only@version)` jest read-only dla zwykłych edycji; zmiany wymagają nowej wersji definicji.
- **Run immutability on completion**: `completed` run jest read-only (inputs i evidence pointers nie są “przepisywane”); dozwolone są jedynie audytowe adnotacje/komentarze (bez zmiany historycznej prawdy).
- **Visibility / exposure**: konsumuje kanon Position 18 (`Trust-state`): widoczność i review/publish downstream nie są “assessment-local”.
- **Permission denied** stany są jawne (nie ukrywamy istnienia runu bez komunikatu); UI oferuje “what next” (poproś ownera/admina, export link-only).

#### 2.3.5 Bounded handoffs to `Results/Outputs` and to `Wnioski w Interview` (no parallel truths)

Assessment jest producentem *bounded payload* i traceability, nie właścicielem prawdy downstream.

Handoff 1 — do `Results/Outputs` (Position 19):

- Assessment może promować wynik do **artefaktu** (np. raport/summary) jako `ArtifactRef` z `PromotionTrace`.
- Outputs Library jest jedynym “home” dla artefaktu; assessment przechowuje tylko link + provenance.

Handoff 2 — do `Wnioski w Interview` (Position 10):

- Assessment może promować **kandydaty findingów** jako *proposals* do Insight artifactu (P10), z evidence pointers i limits.
- Insight pozostaje kanonicznym artefaktem wnioskowania (confidence/limits/evidence rules); assessment nie tworzy “insight v2”.

Bounded payload rule (must):

- payload zawsze zawiera: `assessment_run_id`, `assessment_definition_id@version`, `score_proposal`, `interpretation_proposal`, `evidence_pointers[]`, `limits`, `promotion_trace`.

#### 2.3.6 Anti-duplicate gates (assessment ≠ survey; assessment ≠ insight replacement)

Zasady anty-duplikacji (must):

- Assessment **nie jest survey builderem** ani zastępstwem `Ankiety` (Position 09):
  - collection/submissions lifecycle i operator workflow są własnością `Ankiety` (P09),
  - assessment może konsumować zebrane odpowiedzi jako evidence pointers (links-first).
- Assessment **nie jest insight engine** ani zastępstwem `Wnioski` (Position 10):
  - “findings” w assessment są *proposals* powiązanymi z runem,
  - kanoniczna struktura insight (finding/evidence/limits/confidence) i handoff do inicjatyw pozostaje w P10.
- Zakaz “parallel truth”: nie wolno tworzyć alternatywnego “Results/Insights home” w assessment; downstream homes są kanoniczne.

#### 2.3.7 Error / degraded posture (explicit) + acceptance checklist (10+)

Degraded stany muszą być jawne, spokojne i prowadzić do bezpiecznego następnego kroku — bez udawania kompletności.

Minimum scenarios (must):

1) **Missing required evidence** → `awaiting_evidence` + lista braków + “what next” (co dodać / skąd wziąć).  
2) **Evidence pointer broken / permission loss** → pointer zostaje, oznaczony `unavailable`; UI nie ukrywa luki.  
3) **Score cannot be computed** (missing inputs / validation fail) → brak ScoreProposal + jasny komunikat + retry guidance.  
4) **Interpretation blocked** (brak score lub brak evidence) → interpretacja disabled; UI mówi dlaczego (no silent fallback).  
5) **Review action denied** (brak uprawnień) → read-only view + “request access”.  
6) **Promotion denied** (brak uprawnień do Outputs/Insights) → link-only/export suggestion; brak “ghost artifacts”.  
7) **Downstream error** (promotion failure) → zachowany draft payload + retry; brak duplikatów promocji.  
8) **Run failed** (tool/runtime error) → `failed` state z audytem + “resume/retry” posture.  

Acceptance checklist (P28-A scope approval; must-pass dla P28-B/P28-C):

1) Assessment ma rozdzielony model: Definition vs Run (2.3.1).  
2) Publish definicji tworzy read-only version; zmiany = nowa wersja (2.3.2).  
3) Run lifecycle ma jawne `awaiting_evidence` i nie “przeskakuje” bez review (2.3.2).  
4) Scoring jest zawsze jawny jako ScoreProposal; brak silent scoring (2.3.3).  
5) Interpretacja jest proposal; UI wspiera review: accept/reject/override (2.3.3).  
6) Explainability: ScoreProposal ma rationale + evidence pointers; brak evidence → degraded (2.3.3, 2.3.7).  
7) Locked/read-only truth: completed run jest read-only; definicja published jest immutable (2.3.4).  
8) Handoff do Outputs/Results jest bounded i ma PromotionTrace; Outputs jest jedynym home (2.3.5).  
9) Handoff do Insights jest bounded i tworzy proposals; Insight canon pozostaje w P10 (2.3.5).  
10) Anti-duplicate: assessment ≠ survey builder; assessment ≠ insight replacement (2.3.6).  
11) Permission denied i broken evidence pointers są jawne, z “what next” (2.3.4, 2.3.7).  
12) Degraded/error posture obejmuje min. 8 scenariuszy i nie tworzy ghost artifacts (2.3.7).  

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_ASSESSMENT_2026-03-29.md`

## 4. Softs inspirations (benchmark apps)
### 4.1 Primary benchmark family (SSOT)
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_ASSESSMENT_2026-03-29.md`

### 4.2 Local Softs evidence (concrete artifacts)
- **Typeform (reporting + branching logic + export + AI insights posture)**:
  - `Softs/0 Ankiety/typerform 1/www.typeform.com/reporting.html` (reporting surface posture).
  - `Softs/0 Ankiety/Qualtrics 2/help.typeform.com/hc/en-us/articles/360029116392-What-is-branching-logic.html` (branching logic).
  - `Softs/0 Ankiety/Qualtrics 2/help.typeform.com/hc/en-us/articles/360057591531-Logic-Map.html` (logic map as an explainable structure).
  - `Softs/0 Ankiety/Qualtrics 2/help.typeform.com/hc/en-us/articles/360029251552-Create-and-share-your-responses-report.html` (responses report).
  - `Softs/0 Ankiety/Qualtrics 2/help.typeform.com/hc/en-us/articles/360029253572-Export-your-responses.html` + `.../41990885069716-Export-Results-Summary-to-a-CSV.html` (export posture).
  - `Softs/0 Ankiety/Qualtrics 2/help.typeform.com/hc/en-us/articles/23542072977172-Get-AI-analysis-of-your-results-with-Smart-Insights.html` (AI insights posture).
- **SurveyMonkey (survey templates as a packaged starting point)**:
  - `Softs/0 Ankiety/typerform 1/www.typeform.com/templates-sub-category/evaluation-surveys.html` (template categories: evaluation posture as “choose starting frame”).

### 4.3 Parity checklist vs Softs (approval-grade)
**Parity oznacza “one assessment family + shared workbench + action loop”, nie “kolejny survey builder”.**

- **Choose → run → interpret in one workbench (Wave2 doctrine)**:
  - Wybór metodologii prowadzi do jednej spójnej sesji (shared workbench), nie do rozproszonych flow.
- **Explainable logic and scoring (Typeform logic map posture)**:
  - Logika (branching/scoring) jest zrozumiała, debugowalna i nie jest “black box”.
- **Evidence-first and honest scoring (plan)**:
  - Scoring/interpretacja wymagają evidence pointers albo jawnych assumptions (bounded honesty).
- **Export/reporting posture (Typeform reporting/export)**:
  - Wynik ma report view + export; brak “export-only claims”.
- **AI insights under governance (Typeform smart insights posture + Wave2)**:
  - AI proponuje interpretację i next steps jako propozycje; user zatwierdza; brak overclaim.
- **Promotion into action (Wave2)**:
  - Wyniki kończą się akcją: inicjatywy/tasks/reports/decks, z traceability.

### 4.4 Gap ledger vs Softs (what we are missing — derived from Wave2 plan)
Źródło prawdy: `WAVE2_FINAL_IMPLEMENTATION_PLAN_ASSESSMENT_2026-03-29.md`.

| Capability cluster (parity target) | What Softs implies | Current truth (per plan) | Gap statement (contract requirement) | Priority |
| --- | --- | --- | --- | --- |
| Shared family packaging | one coherent product | “family packaging weak” | Zbudować jeden shell i język rodziny Assessment | P0 |
| Shared workbench | unified runtime | “workbench not explicit enough” | Ujednolicić state model + evidence/scoring grammar | P0 |
| Governance visibility | AI + scoring honest | “needs stronger final contract” | Ujawnić governance scoring/AI/interpretation w UI i payloadach | P0 |
| Action loop continuity | results → action | “downstream continuity needs closure” | Dopiąć promotion do work/outputs z traceability | P1

## 5. Evidence plan (DoD)
### 5.1 Acceptance criteria
- Workbench jest spójny; scoring/interpretation ma governance; wyniki stają się akcją.
- Logika (branching/scoring) jest explainable i nie degraduje się do “black box”.
- AI interpretacja ma tryb propose→review→accept oraz evidence pointers tam gdzie dotyczy.

### 5.2 Tests
- Integracyjne: choose methodology → run workbench → evidence capture → scoring → interpretation → promote to initiatives/report.
- Regression: brak danych/evidence → czytelny degraded state + “what to do next”.
- Contract tests: assessment payload zawiera state + scoring rationale + evidence pointers + promotion trace.

### 5.3 Staging proof checklist
- Demo: 1 metodologia end-to-end (z branching/scoring) + promotion do inicjatyw.
- Demo: AI insights proposal → review → accept/reject + widoczna różnica w final report.

## 8. Delivery plan
### 8.0 Context pack (read first)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Execution playbook: `docs/product/work-packets/cursor-work/final_master/PROGRAM_EXECUTION_PLAYBOOK.md`
- Authority chain (Assessment SSOT): see section 3.
- Softs parity + gaps: see section 4.
- Evidence plan: see section 5.

### 8.1 Bounded delivery packets
#### P28-A — Assessment family canon + workbench grammar (scope approval)
- **Goal**: jeden shell i język Assessment (workbench + scoring/evidence) z jawnej governance.
- **Inputs required**: scoring rationale + evidence pointers contract; promotion target (initiatives/reports).
- **Acceptance**: scope zatwierdzony; non-goals jawne; AI interpretacja = propose→review→accept.
- **Evidence**: scope approval + linkowane SSOT.
- **Tasks** (see library: `docs/product/work-packets/cursor-work/final_master/PACKET_TASKS_AND_DOD_LIBRARY.md`):
  - Freeze assessment shell/workbench grammar (state model + evidence capture + scoring).
  - Freeze scoring rationale and explainability rules (no black box).
  - Freeze promotion contract to initiatives/reports with traceability (bounded).
- **DoD**:
  - Approved(scope): workbench and scoring governance are explicit and testable.

#### P28-B — Methodology run→evidence→score→interpret→promote closure
- **Goal**: domknąć E2E metodologię na jednym workbench.
- **Acceptance**: branching/scoring jest explainable; degraded (missing evidence) daje “what next”.
- **Evidence**: integracyjne testy + staging demo 1 metodologii.
- **Tasks**:
  - Implement 1 methodology end-to-end on the unified workbench (bounded).
  - Implement degraded states for missing evidence with explicit “what next”.
  - Add integration/regression + contract tests and run staging demo (5.3).
- **Staging proof script (click-by-click)**:
  1. Choose one methodology and start an assessment run in the workbench.
  2. Capture evidence inputs (bounded) and observe scoring with explainable rationale.
  3. Trigger a missing-evidence case and verify degraded state + “what next” guidance.
  4. Generate AI interpretation as proposal → review → accept/reject; verify differences are visible.
  5. Promote results to an initiative/report and verify traceability (run→artifact→promotion).
- **DoD**:
  - Methodology run is explainable; results can be promoted with traceability; demos recorded.

#### P28-C — Verification + rollout
- **Goal**: regresje, staging proof, rollout/rollback.
- **Acceptance**: bar `verified(evidence)` spełniony.
- **Evidence**: wypełniony evidence ledger (sekcja 10).
- **Tasks**:
  - Capture staging proof and fill ledger rows P28-A/B/C.
  - Validate rollback: disable AI interpretations/promotions; preserve workbench read-only.
- **DoD**:
  - Status `verified(evidence)` with complete ledger entries and known limits.

### 8.2 Rollout strategy
- Najpierw 1 metodologia P0, potem rozszerzenia family packaging (P1).

### 8.3 Rollback plan
- Wyłącz AI interpretacje/promotions; zachowaj workbench read-only; bez destrukcji danych.

## 9. Risks / open questions / decisions
- Ryzyko: scoring jako black box (brak zaufania).
- Ryzyko: brak jednego workbench → rodzina niespójna.
- Decyzje: minimalny scoring grammar i format evidence pointers.

## 10. Evidence ledger (fill after delivery)
| Packet ID | Status | PR / commit | Tests (what + result) | Staging proof | Notes / known limits |
| --- | --- | --- | --- | --- | --- |
| P28-A | approved(scope) | `f95bbf5de1` | N/A — docs/scope only | N/A | Canon §2.3 (object model/lifecycle/governance + no silent scoring + bounded handoffs); EXECUTION_INDEX #28 updated; SSOT copy synced; lock P28-A released. |
| P28-B | verified(evidence) | `abf2a8d9d1` | `AssessmentWorkbenchService` + `/api/v8/assessment/:id/workbench/*`; contract + **E2E** `assessmentWorkbench.p28b-e2e.test.ts`; łącznie z plikiem kontraktu **8** testów P28 | `final_master/evidence/P28_B_ROLLOUT_2026-03-31.md`; `npx tsx server/scripts/smoke-p28-workbench-b.ts` | **whatNext** na GET workbench i 409; preset DRD; E2E do promotion |
| P28-C | verified(evidence) | `bf39affbd1` | P28-B + `assessmentWorkbench.p28c-regression.test.ts` (read-only, promotion guard, **P19 handoff via `registerArtifactOrigin`**); smoke `smoke-p28-workbench-c.ts` | `final_master/evidence/P28_C_VERIFICATION_ROLLOUT_2026-03-31.md`; `npx tsx server/scripts/smoke-p28-workbench-c.ts` | Rollback: disable client calls; `p28_workbench_v1` read-only; artifacts in `v8_output_artifacts` remain |

