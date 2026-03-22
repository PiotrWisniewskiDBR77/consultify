# Initiative Skill Gap And Capability Development v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: canonical capability-requirements, skills-gap, staffing and capability-development layer for initiatives

---

## 1. Why this document exists

An initiative can be strategically right and still fail because the organization does not yet have the right capabilities to execute it.

`consultify` needs one explicit contract for:

- defining competency requirements
- detecting skills gaps
- deciding whether to hire, train, outsource or resequence
- turning capability gaps into governed work

---

## 2. Core statement

Capability planning should be treated as a first-class part of initiative feasibility and execution readiness.

Canonical path:

`initiative goal -> competency requirements -> actual team capability map -> gap analysis -> capability response plan -> execution and reassessment`

Rule:

`skills-gap analysis should not stay a passive diagnostic; it should produce actionable capability-development decisions`

---

## 3. Relationship to current runtime

This doctrine should build on the real initiative surfaces already present in runtime:

- `Competency Requirements`
- `Skills Gap Analysis`
- `Team`
- `Resources -> Team / FTE Allocation`

These surfaces should become one connected capability-management layer, not isolated widgets.

---

## 4. What this layer owns

The initiative package should explicitly support:

- required competencies
- minimum proficiency levels
- required headcount by competency
- current team capability coverage
- unknown coverage where profiles are incomplete
- recommended response path

Recommended response paths may include:

- `hire`
- `train`
- `outsource`
- `resequence`
- `reduce_scope`

---

## 5. Canonical capability objects

An initiative should preserve:

- `InitiativeCompetencyRequirement`
- `InitiativeSkillsGapSummary`
- `CapabilityCoverageByRequirement`
- `CapabilityCoverageByPerson`
- `CapabilityResponsePlan`

Each requirement should preserve:

- capability
- category
- minimum level
- required or nice-to-have priority
- target headcount
- justification

---

## 6. Skills-gap doctrine

The system should distinguish:

- fully covered requirement
- partially covered requirement
- missing requirement
- unknown coverage because team profiles are incomplete

Important:

`unknown` must remain distinct from `missing`

This avoids false confidence when team competency profiles are incomplete.

---

## 7. Capability-development doctrine

Gap analysis should not stop at color coding.

It should produce one or more governed next steps:

- recruit or contract missing skills
- train the current team
- borrow shared capability from elsewhere
- outsource specific work
- resequence the initiative until capability is available
- reduce scope or split delivery waves

The point is not only to identify the gap, but to choose the right response path.

---

## 8. Planning and execution linkage

Capability gaps must influence:

- initiative feasibility
- timeline confidence
- workload realism
- budget and resource planning
- task decomposition
- execution risk

If the required capability is missing, the system should remain honest that the initiative may need:

- different sequencing
- different staffing
- different scope
- explicit risk acceptance

---

## 9. AI support doctrine

AI may help:

- infer likely competency requirements from initiative type
- suggest missing capabilities
- explain the impact of a gap
- suggest response paths
- draft a capability-development plan
- connect capability gaps to tasks, hiring, training or outsourcing suggestions

AI may not:

- fabricate competency coverage
- silently assign people as qualified
- decide workforce strategy without review

All durable capability responses should stay:

- reviewable
- traceable
- linked to initiative context

---

## 10. Main implementation-facing risks

- skills-gap analysis remains disconnected from actual initiative planning
- requirements are defined, but team profiles stay incomplete so the output is misleading
- recommendations do not materialize into hiring, training, staffing or sequencing actions
- AI produces capability suggestions without grounding in the initiative and real team data

---

## 11. Related canonical docs

- `INITIATIVE_ANALYSIS_QUALITY_LOGIC_AND_CAPACITY_RUNTIME_V8.md`
- `INITIATIVE_TIMELINE_CAPACITY_AND_CRITICAL_PATH_V8.md`
- `INITIATIVE_AI_COPILOT_AND_EXECUTION_SUPPORT_V8.md`
- `DELIVERY_REPORTING_AND_EXECUTION_RISK_V8.md`
- `TASK_AND_DECISION_RUNTIME_CONTRACT_V8.md`
