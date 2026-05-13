---
module_id: MODULE_EXECUTION
doc_kind: PERMISSIONS
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-10
---

# Permissions & Security — Realizacja / Implementation & PMO

## Purpose

Define security, tenancy, ACL and approval rules for this module.

## Must

- High-impact mutations need explicit approval and audit.
- Managers see scoped workload; tenant/project boundaries are enforced.

Function-level enforcement applies uniformly to: `RL_EXECUTION_PORTFOLIO`, `RL_EXECUTION_REPORTS`, `RL_EXECUTION_MANAGER`, `RL_FULL_EXECUTION_VIEW`, `RL_ROLLOUT_VIEW`.

## Global Security Rules

- MUST enforce tenant and project boundaries.
- MUST use deny-by-default when authorization is uncertain.
- MUST audit high-impact mutations and governance transitions.
- MUST NOT expose secrets, raw internals, stack traces or sensitive payloads to business users.

## Should

- SHOULD show locked/unauthorized states with safe explanation and no sensitive leakage.
- SHOULD separate read permissions from mutation/approval permissions.

## Acceptance Criteria

- [ ] Unauthorized users cannot view or mutate protected objects.
- [ ] High-impact actions require explicit approval and produce audit evidence.
- [ ] Sensitive data remains scoped to allowed tenant/project/user context.

## Contract 2.0 Function Security Matrix

| Function | Read scope | High-impact actions | Approval / audit rule | Gate |
| --- | --- | --- | --- | --- |
| `RL_EXECUTION_PORTFOLIO` | tenant/project-scoped execution initiatives, tasks, decisions, blockers and timeline signals | status movement, task movement, timeline update, blocker/risk updates | explicit user action, visible feedback, read-back/refresh where supported; pilot/role gates apply | runtime `BLOCKED_P1` until approval/read-back evidence is captured |
| `RL_EXECUTION_REPORTS` | tenant/project-scoped execution inputs and report definitions | export, handoff, report publish/final review when implemented | generation is not final approval; source/provenance and data-quality posture must be visible | runtime `BLOCKED_P1` until missing-evidence behavior is proven |
| `RL_EXECUTION_MANAGER` | scoped manager lane problems, source entities, affected entities and workload/capacity signals | execute problem action, apply suggestion, lane decision, plan execute, reassignment, smoothing, replan, escalation | explicit approval with source entity, affected entities, actor, API result and verification/read-back where supported | runtime `BLOCKED_P1` until approval/provenance/read-back evidence is captured |
| `RL_FULL_EXECUTION_VIEW` | same scope as shared `ExecutionHub` runtime | no route-wrapper writes; inherited runtime writes only | route visibility does not imply mutation permission; protected route and production gate must remain explicit | runtime `BLOCKED_P1` until route-shell evidence is captured |
| `RL_ROLLOUT_VIEW` | tenant/project-scoped rollout plan, baseline/current/forecast/conflict signals | auto-schedule apply, optimizer apply, conflict resolution, timeline update, rebaseline | proposal/review required before mutation; AI can recommend but not execute high-impact writes | runtime `BLOCKED_P1` until proposal/review evidence is captured |

Security hard stop: if tenant scope, approval authority, source provenance or impact scope is uncertain, the action must be denied or converted to an open question before runtime implementation.

## `RL_EXECUTION_MANAGER` Registry Sync Security Note — 2026-05-10

Locked rows `RL-MGR-P0-001`, `RL-MGR-P1-001` and `RL-MGR-P2-001` remain docs/test planning rows under `06_realizacja/RL_EXECUTION_MANAGER`. They do not authorize runtime mutation. Future execution must preserve deny-by-default tenancy, explicit approval for high-impact manager actions and dependency-only treatment of `RL_EXECUTION_PORTFOLIO`, `RL_EXECUTION_REPORTS` and `MW_MANAGER`.
