# Interview Contradiction And Client Readback Runtime v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: canonical runtime for contradiction handling, clarification loops, targeted re-interviews and client readback of interpreted meaning

---

## 1. Why this document exists

A consulting interview program often reveals conflicting narratives.

One stakeholder says the process works well, another says it is broken.

This is not noise. It is often the most important signal.

The system therefore needs a defined runtime for:

- contradiction detection
- follow-up clarification
- interpretation readback
- controlled confirmation of consulting meaning

---

## 2. Core statement

Interview should not flatten contradictions into one synthetic answer too early.

Canonical path:

`conflicting answers -> contradiction case -> clarification or follow-up -> interpretation draft -> client readback -> confirmed or unresolved consulting output`

---

## 3. Contradiction classes

The runtime should distinguish:

- `role_conflict`
- `process_conflict`
- `metric_conflict`
- `timeline_conflict`
- `ownership_conflict`
- `perception_vs_evidence_conflict`

---

## 4. Allowed contradiction actions

The module should support:

- `clarification_follow_up`
- `targeted_reinterview`
- `evidence_request`
- `reviewer_escalation`
- `decision_needed_flag`
- `keep_as_unresolved_gap`

Rule:

`contradictions should be surfaced as governed work, not hidden in narrative summaries`

---

## 5. Client readback doctrine

Interview should support a `client readback` stage where the system presents:

- what was heard
- what it likely means
- what remains uncertain
- what appears contradicted

The purpose is not only to confirm wording, but to confirm or challenge the interpretation of the organizational situation.

---

## 6. Readback states

Readback should distinguish:

- `draft_interpretation`
- `shared_for_readback`
- `confirmed_by_client`
- `partially_confirmed`
- `challenged_by_client`
- `needs_more_evidence`

---

## 7. Consulting output rule

Client-facing or decision-driving interpretations should preserve:

- source contradictions
- clarification history
- confirmation or challenge state
- unresolved uncertainty where it remains

Rule:

`consulting synthesis should stay honest about disagreement and uncertainty`

---

## 8. Related canonical docs

- `INTERVIEW_ASSIGNMENT_REVIEW_AND_CONFIRMATION_RUNTIME_V8.md`
- `INTERVIEW_EVIDENCE_CONFIDENCE_AND_TRIANGULATION_V8.md`
- `INTERVIEW_REPORTING_AND_DASHBOARDS_V8.md`
- `INTERVIEW_INSIGHT_ANALYTICS_AND_CLOSED_LOOP_ACTIONS_V8.md`
