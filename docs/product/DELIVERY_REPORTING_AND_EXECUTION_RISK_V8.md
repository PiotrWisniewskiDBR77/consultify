# Delivery Reporting And Execution Risk v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: canonical reporting, accountability, blocker, risk and recovery model for initiative execution

---

## 1. Why this document exists

Execution should not end at task movement and status badges.

Leaders in project management keep delivery healthy by making reporting, accountability, risk and recovery one operating system.

---

## 2. Core statement

Execution reporting in `consultify` should answer:

- what is progressing
- what is late
- what is blocked
- what decision is missing
- who needs to act
- whether delivery is still on a credible path

---

## 3. Delivery reporting doctrine

The package should support reporting on:

- milestone health
- task progress and overdue work
- blocked work
- pending decisions
- owner accountability
- baseline drift
- closure readiness

Rule:

`reporting should stay honest when data is missing or planning quality is weak`

### 3.1 Reporting surface boundary inside Execution

Inside the `Execution` module, the `Raporty` tab owns:

- pre-defined reporting packs,
- execution snapshots,
- audience-specific summaries,
- export/share-ready outputs.

It does **not** own:

- the main live initiative portfolio,
- the PMO intervention cockpit,
- a second runtime for changing initiative truth.

Boundary rule:

- `Portfolio` shows live execution objects,
- `Raporty` shows reporting outputs built from those objects,
- `Manager` shows intervention and workload control.

---

## 4. Execution risk doctrine

The system should distinguish:

- blocker
- operational risk
- dependency risk
- timeline risk
- owner or resource risk
- decision-latency risk

Risks should support:

- severity
- age
- owner
- mitigation plan
- escalation state

---

## 5. Recovery doctrine

When execution health degrades, the system should support:

- recovery plan proposals
- unblock suggestions
- escalation paths
- timeline alternatives
- decision-needed flags

Recovery should not be hidden in comments only.

## 5a. Canonical execution report catalog

The execution reporting surface should provide a fixed catalog of pre-defined reports:

- Weekly execution pack
- Monthly PMO review
- Program health summary
- Blockers and recovery report
- Milestone slippage report
- Capacity utilization report
- Budget variance report
- Decision backlog and approval aging report
- Cross-initiative dependency report
- Delivery confidence report
- Sponsor-ready one-pager

Every report should declare:

- audience,
- cadence,
- scope,
- sections,
- data sources,
- follow-up expectations after reading.

---

## 6. Accountability doctrine

The package should preserve:

- accountable owner
- last meaningful update
- unresolved blockers
- missed commitments
- closure confirmation

This is necessary both for team operations and executive trust.

---

## 7. Related canonical docs

- `EXECUTION_SURFACES_PORTFOLIO_REPORTS_MANAGER_V8.md`
- `EXECUTION_MANAGEMENT_BENCHMARK_V8.md`
- `EXECUTION_CONTROL_TOWER_AND_OPERATOR_RUNTIME_V8.md`
- `EXECUTION_READINESS_AUDIT_V8.md`
- `TASK_AND_DECISION_RUNTIME_CONTRACT_V8.md`
- `TASK_AUTOMATION_AND_EVENTING_V8.md`
- `INITIATIVE_TIMELINE_CAPACITY_AND_CRITICAL_PATH_V8.md`
- `INITIATIVE_AI_COPILOT_AND_EXECUTION_SUPPORT_V8.md`
- `EXECUTION_V3.md`
