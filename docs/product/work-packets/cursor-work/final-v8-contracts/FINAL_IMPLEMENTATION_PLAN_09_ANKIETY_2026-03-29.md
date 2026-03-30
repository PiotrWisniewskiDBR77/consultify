# Final Implementation Contract — Ankiety (Position 9/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: approved(scope) — P09-A (governed collection lane canon)

## 1. Executive summary
- **Intent**: Generalnie ok; ewentualnie poprawa UI/UX.
- **Primary users**: operatorzy zbierający dane (survey owners) + respondenci.
- **Success metric**: „credible structured collection lane” z governed submission lifecycle i bridge do downstream insight (bez udawania, że survey = insight).

## 2. Scope
### 2.1 In-scope
- Operator workflow (create/run/review submission state).
- Submission governance + read-only/locked truth.
- Handoff do `Wnioski w Interview`.

### 2.2 Out-of-scope / non-goals
- Full assessment orchestration.
- Full reporting/analytics suite.

### 2.3 Canon (P09-A) — governed collection lane (NOT an insight engine)
**Primary doctrine**: Ankiety is a **collection lane** that produces **governed submissions** and a **handoff payload** into `Wnioski w Interview` (P10). It does **not** compute, rank, or narrate “insights”.

#### 2.3.1 Submission status grammar (canonical)
Statuses apply to **submissions** (responses), not “insights”.

| Status | Meaning (operator truth) | Operator next action | Notes / invariants |
| --- | --- | --- | --- |
| `pending` | submission started but not yet confirmed complete | wait / remind / monitor | may progress to `partial` or `complete` |
| `partial` | captured incomplete response; usable only with explicit “incomplete” flag | continue / request completion / mark invalid | must preserve captured data (no silent discard) |
| `complete` | respondent finished; payload is structurally valid | review / lock when collection closes / export | still may become `duplicate` by idempotency rules |
| `invalid` | structurally unusable (failed validation, tampering, impossible path) | mark invalid (with reason) | invalid must carry a reason code/message |
| `duplicate` | detected duplicate of an existing submission (idempotency violation / re-delivery) | merge/ignore/resolve per policy | duplicates must never create double-counted handoff |
| `locked` | read-only “truth” after collection close / operator lock | none (read/export/handoff only) | once locked: no edits to answers; only annotations |

#### 2.3.2 Operator workflow posture (canonical, bounded)
- **Survey lifecycle**: draft → publish → collect → review queue (state-driven) → close collection → `locked` truth → export → handoff to P10.
- **Review queue** is driven by status: `partial`, `invalid`, `duplicate` require explicit operator resolution or explicit “accept as-is” policy.
- **Lock** is the governance gate: after lock, all downstream consumers treat submissions as immutable evidence.

#### 2.3.3 Branching / skip posture (scope-frozen)
- **Supported (bounded)**: conditional branching / skip logic based on prior answers (single-pass, acyclic). The operator can **preview** the pathing before publish.
- **Not promised in P09-A**: quotas, randomized blocks, complex scoring, loops, multi-language orchestration, “logic map” parity beyond a minimal preview.
- **Validation expectation**: before publish, the system must detect and block obvious dead-ends / unreachable required questions (or explicitly downgrade to warning + publish-with-known-limits).

#### 2.3.4 Handoff payload to P10 (`Wnioski w Interview`) — canonical contract
Handoff is a **structured evidence bundle** (not an insight):
- **Identity**: `surveyId`, `submissionId`, optional `respondentId` / external reference, timestamps (started/submitted/locked).
- **Governance**: submission status (`complete`/`partial`/`invalid`/`duplicate`/`locked`), validation summary, operator resolution notes (if any).
- **Content**: normalized answers (typed), attachments references (if any), consent flags where applicable.
- **Provenance pointers**: export artifact reference (CSV/XLSX/zip if applicable), audit trail pointers, and the upstream survey version published at time of submission.
- **Delivery semantics**: handoff must be **idempotent** (same `submissionId` cannot create multiple P10 items).

#### 2.3.5 Anti-duplicate posture (explicit)
- Assume upstream delivery can be **at-least-once** (retries/re-delivery); design for idempotency.
- Canonical rule: duplicates are detected via **stable idempotency key** (`submissionId` preferred; otherwise composite key policy must be declared).
- Duplicate handling must produce one governed outcome: **no double-counting**, and handoff remains a single truth.

#### 2.3.6 Degraded modes / errors (explicit)
- **Network / save failures**: allow `partial` capture; never silently drop.
- **Validation failures**: force `invalid` with reason; allow operator review.
- **Handoff failures**: preserve retryable job state; do not “lose” a `locked` submission; surface operator-visible failure state.
- **Export failures**: explicit error state with retry; export artifact references must be consistent with locked truth.

#### 2.3.7 Acceptance checklist (P09-A = approved(scope))
- [ ] Ankiety is explicitly framed as **collection lane**, not insight engine (non-goal is explicit).
- [ ] Canonical submission statuses are defined and mapped to operator next actions.
- [ ] Branching posture is explicit: what’s supported vs not promised, and validation/preview expectation is stated.
- [ ] Handoff payload to P10 is explicit (identity + governance + content + provenance + idempotency).
- [ ] Anti-duplicate and degraded/error posture is explicit and does not create double truth.

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_ANKIETY_2026-03-29.md`
- Flow: `docs/flows/core/ASSESSMENT_EXECUTION_FLOW.md`

## 4. Softs inspirations (benchmark apps)
### 4.1 Primary benchmark family (SSOT)
- Plan modułu wskazuje `Softs/0 Ankiety` jako primary benchmark family (`WAVE1_FINAL_IMPLEMENTATION_PLAN_ANKIETY_2026-03-29.md`).

### 4.2 Local Softs evidence (concrete artifacts)
- **Typeform (logic + webhooks + export/reporting posture)**:
  - `Softs/0 Ankiety/Qualtrics 2/help.typeform.com/hc/en-us/articles/360029116392-What-is-branching-logic.html` (branching logic: conditional paths; “respondents never have to skip irrelevant questions”).
  - `Softs/0 Ankiety/Qualtrics 2/help.typeform.com/hc/en-us/articles/360057591531-Logic-Map.html` (Logic Map: wizualizacja ścieżek + troubleshooting; limity mapy przy dużej liczbie reguł).
  - `Softs/0 Ankiety/Qualtrics 2/help.typeform.com/hc/en-us/articles/12978390412692-Webhooks-Troubleshooting-and-FAQ.html` (webhooks delivery posture; duplikaty “at least once” i retry gdy brak HTTP 200).
  - `Softs/0 Ankiety/Qualtrics 2/help.typeform.com/hc/en-us/articles/360029253572-Export-your-responses.html` (export CSV/XLSX, tylko filtrowane/wybrane; export file uploads jako zip).
- **SurveyMonkey (skip logic / quotas / operator-ready collecting + API)**:
  - `Softs/0 Ankiety/Surveymonkey 2/help.surveymonkey.com/en/surveymonkey/create/skip-logic/index.html` (skip logic: różne ścieżki na podstawie strony lub answer choice; zastosowania: consent/disqualification/multilingual).
  - `Softs/0 Ankiety/Surveymonkey 2/help.surveymonkey.com/en/surveymonkey/create/quotas/index.html` (quotas: auto-close po osiągnięciu ratio qualified responses; balans próbki).
  - `Softs/0 Ankiety/Surveymonkey 1/developer.surveymonkey.com/api/v3/index.html` (SurveyMonkey API portal; docs hostowane jako osobna powierzchnia).
- **Qualtrics (enterprise survey/API family evidence)**:
  - `Softs/0 Ankiety/Qualtrics 1/api.qualtrics.com/index.html` (Qualtrics public API docs entry surface).

### 4.3 Parity checklist vs Softs (approval-grade)
**Parity oznacza “operator-safe collection lane + governed submission lifecycle”, nie “pełna platforma assessment + analytics”.**

- **Logic/branching as first-class (Typeform + SurveyMonkey)**:
  - Branched flows (branching/skip logic) muszą być jawne, testowalne, i weryfikowalne przed publikacją.
  - Dla złożonych ankiet: potrzebna jest “mapa logiki” (wizualizacja ścieżek) oraz narzędzia do troubleshooting.
- **Quotas / sampling governance (SurveyMonkey)**:
  - Quoty i ograniczenia zbierania (auto-close przy osiągnięciu warunku) jako element operator workflow, nie “ręczne pilnowanie”.
- **Submission delivery posture + retries (Typeform webhooks doctrine)**:
  - System ma jasno opisać semantykę dostarczeń (np. at-least-once) i mieć bezpieczne retry/recovery bez utraty danych.
- **Export posture (Typeform)**:
  - Eksport jest częścią workflow (filtry/wybór → export) oraz wspiera załączniki (download uploads).
- **Bridge: collection ≠ insight (Wave1 doctrine)**:
  - Kontrakt wymaga jawnego handoff do `Wnioski w Interview` (przygotowanie do przeglądu i syntezy), bez obietnic “insight generator” w module Ankiet.

### 4.4 Gap ledger vs Softs (what we are missing — derived from current plans)
Źródło prawdy “co mamy / czego brakuje” to: `WAVE1_FINAL_IMPLEMENTATION_PLAN_ANKIETY_2026-03-29.md` + flow `ASSESSMENT_EXECUTION_FLOW.md`.

| Capability cluster (Softs parity target) | What Softs implies | Current truth (per plan) | Gap statement (contract requirement) | Priority |
| --- | --- | --- | --- | --- |
| Operator workflow depth | create/run/review w jednym lane | “operator workflow shallow” | Pogłębić operator lifecycle: statusy, next actions, review queue | P0 |
| Submission governance follow-through | recoverable outcomes + locked truth | “governance not deep enough” | Domknąć submission lifecycle (pending/partial/complete/invalid) + recovery | P0 |
| Collection→insight bridge | structured handoff | “bridge still weak” | Ustalić i dowieźć handoff pakietu odpowiedzi do `Wnioski w Interview` | P0 |
| Logic troubleshooting posture | visualize + validate | (nieudowodnione jako zamknięte) | Wprowadzić mechanikę walidacji/preview logiki (lub jawnie ograniczyć) | P1

## 5. Evidence plan (DoD)
### 5.1 Acceptance criteria
- Operator rozumie stan submissions i next actions; istnieje widoczny bridge do insight lane.
- Submissions mają governed lifecycle (w tym partial/duplicate/invalid tam gdzie dotyczy) + locked/read-only truth po zamknięciu.
- Logika ankiety (jeśli wspierana w deklarowanym zakresie) jest testowalna przed publikacją i nie generuje “martwych ścieżek”.

### 5.2 Tests
- Integracyjne: create → collect → state transitions → lock → export → handoff do `Wnioski w Interview`.
- Regression: duplicate submission / partial submission (jeśli wspierane) → czytelny stan + rekomendowana akcja operatora.
- Contract tests: status grammar dla submission (pending/complete/locked/disputed) jest spójna w UI i API.

### 5.3 Staging proof checklist
- Staging run „create → collect → review state → export → handoff”.
- Demo logic: przynajmniej 1 ankieta z branching/skip (albo jawny non-goal w implementacji) + proof walidacji.

## 8. Delivery plan
### 8.0 Context pack (read first)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Execution playbook: `docs/product/work-packets/cursor-work/final_master/PROGRAM_EXECUTION_PLAYBOOK.md`
- Authority chain (detailed plan/flow): see section 3.
- Softs parity + gaps: see section 4.
- Evidence plan: see section 5.

### 8.1 Bounded delivery packets
#### P09-A — Collection lane canon + scope approval
- **Goal**: ankiety jako governed collection lane (nie insight engine).
- **Inputs required**: submission status grammar + handoff do `Wnioski w Interview`.
- **Acceptance**: scope zatwierdzony; non-goals jawne; operator workflow opisany.
- **Evidence**: scope approval + linkowane źródła.
- **Tasks** (see library: `docs/product/work-packets/cursor-work/final_master/PACKET_TASKS_AND_DOD_LIBRARY.md`):
  - Freeze submission status grammar (pending/partial/complete/invalid/locked) and operator next actions.
  - Freeze branching/skip posture (supported vs non-goal) + validation/preview expectations.
  - Freeze handoff payload to `Wnioski w Interview` (what evidence travels).
- **DoD**:
  - Approved(scope): collection lane boundaries and governance are explicit and testable.

#### P09-B — Operator workflow + submission governance closure
- **Goal**: create/run/review submissions + locked truth + export.
- **Acceptance**: lifecycle działa E2E; logika (jeśli w zakresie) jest walidowalna przed publikacją.
- **Evidence**: integracyjne testy + staging run.
- **Tasks**:
  - Implement operator workflow create→collect→review→lock→export (bounded).
  - Implement logic validation/preview (if in scope) or enforce explicit non-goal in UI.
  - Add integration/regression tests (5.2) and run staging flow (5.3).
- **Staging proof script (click-by-click)**:
  1. Create a new survey (bounded template) and publish it.
  2. Submit 2–3 responses (include one partial/duplicate if in scope) and open the operator review view.
  3. Verify submission states are explicit + next actions exist (resolve/mark invalid/continue).
  4. Lock/close the collection and confirm submissions become read-only truth.
  5. Export results and verify export artifact/state is visible (bounded).
  6. Trigger handoff to `Wnioski w Interview` and verify the insight lane receives evidence pointers.
- **DoD**:
  - Lifecycle is governed; locked truth is real; export/handoff works end-to-end.

#### P09-C — Verification + rollout
- **Goal**: regresje, telemetry, staging proof; bezpieczny rollout/rollback.
- **Acceptance**: bar `verified(evidence)` spełniony.
- **Evidence**: wypełniony evidence ledger (sekcja 10).
- **Tasks**:
  - Capture staging proof and fill ledger rows P09-A/B/C.
  - Validate rollback: disable publishing; preserve submissions read+export.
- **DoD**:
  - Status `verified(evidence)` with complete ledger entries and known limits.

### 8.2 Rollout strategy
- Inkrementalnie: najpierw operator workflow + governance, potem logika advanced (jeśli P1).

### 8.3 Rollback plan
- Wyłącz publikację nowych ankiet/flows; zachowaj odczyt submissions + export; bez destrukcji danych.

## 9. Risks / open questions / decisions
- Ryzyko: survey udaje insight (scope drift).
- Ryzyko: brak jasnej semantyki submission states → chaos operatora.
- Decyzje: minimalny zakres branching/quotas (albo jawny non-goal).

## 10. Evidence ledger (fill after delivery)
| Packet ID | Status | PR / commit | Tests (what + result) | Staging proof | Notes / known limits |
| --- | --- | --- | --- | --- | --- |
| P09-A | approved(scope) | 75bda211fc | docs-only (canon freeze) | n/a | scope canon + execution index flip |
| P09-B |  |  |  |  |  |
| P09-C |  |  |  |  |  |

