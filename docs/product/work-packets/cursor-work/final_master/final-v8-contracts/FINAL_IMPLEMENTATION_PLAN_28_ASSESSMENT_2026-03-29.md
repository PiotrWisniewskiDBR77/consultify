# Final Implementation Contract — Assessment (Position 28/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: verified(evidence) — P28-A/B/C complete

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

### 4.5 DRD uplift gap ledger vs application canon (post P28 closeout analysis)
Ta sekcja nie zmienia zamrożonego zakresu `P28-A/B/C`. Jest addendum po closeoucie i stanowi **oficjalny backlog domknięcia DRD do poziomu application canon**.

| Capability cluster | Current truth | Target truth | Closure task | Priority |
| --- | --- | --- | --- | --- |
| DRD product canon | Kod i runtime trzymają 7 osi / 34 obszary, ale część materiałów i narracji produktowej nadal używa innych struktur | Jedno SSOT DRD: 7 osi / 34 obszary / jeden słownik pojęć w UI, help, video, prompts i deckach | Zamrozić `DRD canon pack` i usunąć rozjazdy 7 vs 8/10 dimensions | P0 |
| Runtime truth | DRD ma mocny runtime, ale nadal współistnieją legacy lane i V8/P28 workbench | Jeden kanoniczny entry/run path: definition -> run -> evidence -> review -> promote | Zwinąć split-brain i ustawić V8/P28 jako domyślną ścieżkę DRD | P0 |
| Menu 3 AI actions canon | W `Wdrożenia / KPI` istnieje kanoniczny standard prawych przycisków Menu 3; Assessment/DRD nie używa go jeszcze konsekwentnie | Assessment/DRD używa tego samego slotu Menu 3, tych samych stylów i tej samej semantyki aktywnego panelu | Wprowadzić kanon przycisków AI Menu 3 do kart / widoków DRD | P0 |
| Report convergence | Istnieje kilka ścieżek raportowych i nie wszystkie są spięte z nawigacją sesji | Jeden report lane powiązany z runem, navigation, promotion trace i Outputs | Skonsolidować report builder / report templates / audit exports wokół runu DRD | P1 |
| Workbench usability | Workbench działa, ale jest operator-centric i techniczny | Workbench business-friendly: mniej pól roboczych, jaśniejszy `what next`, prostszy review/promotion | Uprościć UI workbencha dla konsultanta i sponsora biznesowego | P1 |
| Integration hub posture | DRD przekazuje do Outputs/P10, ale nie jest jeszcze hubem dla KPI, benchmarków, inicjatyw i execution | DRD jako źródło inicjacji kolejnych artefaktów i planów bez tworzenia parallel truth | Dopiąć bounded handoff do KPI/Initiatives/Execution/Reports z provenance | P1 |
| Chat orchestration | Jest attach do chat context, ale nie jest to w pełni kanoniczna ścieżka pracy z DRD | Chat działa jako naturalny copiloting lane tego samego runu i nie tworzy alternatywnej sesji prawdy | Uporządkować prompts, context package i handoff readback dla DRD chat lane | P1 |
| Staging proof | P28 ma dowody dla workbencha, ale nie ma pełnego proof dla DRD jako application canon | Jedna demonstracja end-to-end: choose -> run -> AI assist -> review -> report -> initiative/KPI/output | Przygotować staging proof i rollout ledger dla `DRD uplift` | P1 |

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

### 8.4 DRD uplift backlog to finish after P28-A/B/C
Poniższa lista jest **kompletną listą zadań do domknięcia** na podstawie bieżącej analizy DRD. To jest plan przejścia z “działającego assessment runtime” do **kanonicznego narzędzia aplikacji**.

1. **Freeze DRD application canon (SSOT)**
   - Uzgodnić i zamrozić jeden opis DRD: `7 axes / 34 areas / methodology vocabulary / scoring vocabulary / report vocabulary`.
   - Zsynchronizować runtime, help, video tutorials, marketing copy, prompt packs i template’y raportowe.
   - Wprowadzić jawny `DRD canon pack` jako referencję dla przyszłych metodologii.

2. **Close split-brain runtime**
   - Ustawić V8/P28 workbench jako domyślną i preferowaną ścieżkę dla DRD.
   - Ograniczyć legacy update paths do kompatybilności read/write only tam, gdzie są jeszcze potrzebne.
   - Ujednolicić deep-linki, create flow, duplicate flow, report start flow i promotion flow wokół jednego `assessment_run_id`.

3. **Apply the canonical Menu 3 AI buttons standard in Assessment / DRD**
   - Assessment/DRD musi używać tego samego kanonu co `Wdrożenia / KPI`: **prawa strona Menu 3**, przyciski `h-8 rounded-full`, wspólny styl z `docs/ui-standards/03-modules/module-hub-standard.md` §3.4 oraz `src/components/shared/ModuleHub/menu3ActionButtonStyles.ts`.
   - Ten slot ma zawierać **kontekstowe przyciski funkcyjne**, a nie lokalne przełączniki czasu / widoku / nawigacji.
   - Aktywny przycisk otwierający panel ma stan `cyan`; klik drugi raz zamyka panel; panel pozostaje w content area i nie przykrywa Menu 2 / Menu 3.
   - **Domyślny mapping dla DRD:**
     - `AI Triage` -> pokazuje co domknąć najpierw: missing evidence, luki scoringowe, osie z najwyższą niepewnością.
     - `Action Plan` -> zamienia zaakceptowane findings w bounded next steps, initiative seeds, KPI follow-up albo execution requests.
     - `Trzeci przycisk kontekstowy` zależny od aktywnego taba:
       - `Assessment` -> `Interpretation Draft`
       - `Reports` -> `Generate Report`
       - `Initiatives` -> `Initiative Pack`
   - **MUST NOT:** dodawać przycisku AI do silent scoring; AI może proponować interpretację, triage i action packaging, ale nie obchodzi review gates.

4. **Rebuild DRD session shell around one canonical operator/business layout**
   - Zachować istniejący mocny edytor DRD, ale osadzić go w spójnym shellu `Assessment / Reports / Initiatives`.
   - Wyraźnie oddzielić: methodology navigation, run progress, workbench review, downstream handoff.
   - Zredukować liczbę lokalnych header actions, które dziś są rozproszone poza kanonicznym Menu 3.

5. **Converge reporting into one DRD report lane**
   - Powiązać generowanie raportu z aktywnym runem i jego review state.
   - Zmapować canonical outputs: audit report, executive summary, deck input, KPI follow-up pack.
   - Usunąć lub zdegradować alternatywne flow raportowe, które nie czytają kanonicznego runu.

6. **Turn DRD into a bounded integration hub**
   - Handoff do `Outputs` i `P10` utrzymać jako bounded truth.
   - Dodać jawne bounded handoffs do `Initiatives`, `Execution` i `KPI`, bez tworzenia nowego home dla tych artefaktów.
   - Każdy handoff ma zachować `assessment_run_id`, `assessment_definition_id@version`, `promotion_trace` i `limits`.

7. **Standardize DRD chat/copilot posture**
   - Chat otwierany z DRD ma pracować na tym samym workspace context i tym samym runie.
   - Wprowadzić kanoniczne prompty dla: triage, interpretation draft, report shaping, initiative pack.
   - Zapewnić readback: user widzi co zostało zaproponowane przez AI i gdzie to wróciło do runu / reportu / inicjatywy.

8. **Simplify review and degraded UX**
   - Workbench ma pokazywać krótkie ścieżki: `what is missing`, `what can be reviewed now`, `what can be promoted now`.
   - Degraded states muszą mieć wersję business-readable, a nie tylko operatorską.
   - Missing evidence, permission denied, promotion failed i unavailable pointers muszą być widoczne na poziomie sesji, nie tylko panelu technicznego.

9. **Close application-level proof**
   - Przygotować staging proof dla DRD jako kanonu aplikacji:
     1. Start DRD from framework selection.
     2. Complete several axes with evidence.
     3. Use Menu 3 AI actions in Assessment.
     4. Review score + interpretation.
     5. Generate report from the same run.
     6. Promote to initiative / output / insight and optionally prepare KPI follow-up.
   - Udokumentować wynik w osobnym evidence closeout dla `DRD uplift`.

## 9. Risks / open questions / decisions
- Ryzyko: scoring jako black box (brak zaufania).
- Ryzyko: brak jednego workbench → rodzina niespójna.
- Decyzje: minimalny scoring grammar i format evidence pointers.
- Open question (post-closeout): czy DRD ma stać się jedynym pilotem `application canon` dla Assessment family przed rozszerzeniem na SIRI/ADMA, czy równolegle prowadzimy drugi pilot metodologii.
- Decyzja do zamrożenia: który tab / widok jest właścicielem trzeciego przycisku Menu 3, gdy user pracuje jednocześnie na workbenchu i panelu downstream.
- Ryzyko: pozostawienie obecnego header/action layout w sesji DRD spowolni adopcję kanonu Menu 3 i utrwali lokalne wyjątki UI.

## 10. Evidence ledger (fill after delivery)
| Packet ID | Status | PR / commit | Tests (what + result) | Staging proof | Notes / known limits |
| --- | --- | --- | --- | --- | --- |
| P28-A | approved(scope) | `f95bbf5de1` | N/A — docs/scope only | N/A | Canon §2.3 (object model/lifecycle/governance + no silent scoring + bounded handoffs); EXECUTION_INDEX #28 updated; SSOT copy synced; lock P28-A released. |
| P28-B | verified(evidence) | `abf2a8d9d1` | `AssessmentWorkbenchService` + `/api/v8/assessment/:id/workbench/*`; contract + **E2E** `assessmentWorkbench.p28b-e2e.test.ts`; łącznie z plikiem kontraktu **8** testów P28 | `final_master/evidence/P28_B_ROLLOUT_2026-03-31.md`; `npx tsx server/scripts/smoke-p28-workbench-b.ts` | **whatNext** na GET workbench i 409; preset DRD; E2E do promotion |
| P28-C | verified(evidence) | `bf39affbd1` | P28-B + `assessmentWorkbench.p28c-regression.test.ts` (read-only, promotion guard, **P19 handoff via `registerArtifactOrigin`**); smoke `smoke-p28-workbench-c.ts` | `final_master/evidence/P28_C_VERIFICATION_ROLLOUT_2026-03-31.md`; `npx tsx server/scripts/smoke-p28-workbench-c.ts` | Rollback: disable client calls; `p28_workbench_v1` read-only; artifacts in `v8_output_artifacts` remain |

