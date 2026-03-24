# Interview Evidence Confidence And Triangulation v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: canonical model for classifying interview evidence, assigning confidence, and triangulating interview findings with other sources

---

## 1. Why this document exists

Consulting interviews produce many valuable statements, but not all statements are equally reliable.

The system needs an explicit doctrine to distinguish:

- fact
- perception
- assumption
- unsupported claim
- evidence-backed finding

Without this, Interview risks turning raw opinions into misleading organizational truth.

---

## 2. Core statement

Interview findings should carry explicit evidence class and confidence, and important conclusions should be triangulated before they become trusted consulting output.

Canonical path:

`answer -> evidence classification -> confidence assessment -> triangulation where needed -> consulting finding`

---

## 3. Evidence classes

The system should distinguish:

- `reported_fact`
- `personal_perception`
- `team_belief`
- `claim_needing_evidence`
- `document_supported_statement`
- `system_data_supported_statement`
- `contradicted_claim`

---

## 4. Confidence model

Each meaningful finding should support:

- `confidence_level`: `low | medium | high`
- `confidence_reason`
- `source_count`
- `evidence_type_mix`
- `contradiction_present`

Confidence should rise when:

- multiple relevant respondents converge
- evidence references exist
- external or system data supports the statement

Confidence should fall when:

- the statement is opinion-only
- the role has low proximity to the process discussed
- answers materially conflict
- required evidence is missing

---

## 5. Triangulation doctrine

Important findings should be triangulated against allowed sources such as:

- other interview sessions
- evidence attachments
- org documents
- process descriptions
- tasks and decisions
- synced external systems

Triangulation outcomes should include:

- `confirmed`
- `partially_confirmed`
- `not_confirmed`
- `contradicted`
- `pending_more_evidence`

---

## 6. Consulting-safe promotion rule

Only findings that meet policy and confidence expectations should be promoted as:

- reusable insight
- client-facing interpretation
- decision candidate
- organization-shared knowledge

Rule:

`raw interview opinions should not be promoted as consulting truth without evidence class and confidence context`

---

## 7. Related canonical docs

- `INTERVIEW_INSIGHT_ANALYTICS_AND_CLOSED_LOOP_ACTIONS_V8.md`
- `INTERVIEW_INTEGRATION_AND_EXPORT_CONTRACT_V8.md`
- `INTERVIEW_AGENT_AND_ORG_CONTEXT_MEMORY_V8.md`
- `AI_CONNECTORS_ENTERPRISE_SEARCH_ARCHITECTURE_V8.md`
