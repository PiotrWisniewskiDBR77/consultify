---
doc_kind: MODEL_ROUTING_MATRIX
owner: user
status: active
last_updated: 2026-05-12
scope: model-selection-by-task-difficulty
work_type: execution-governance
---

# Model Routing Matrix

## 1. Purpose

Select the right model per task complexity to reduce failure loops and improve first-pass delivery.

## 2. Default Model Policy

- default execution model: `codex 5.3`
- escalate only for high-complexity or high-risk tasks
- after escalation, keep strict scope card and evidence requirements unchanged

## 3. Difficulty Classes

| Class | Description | Recommended model |
| --- | --- | --- |
| `L1_STANDARD` | Single-module, low ambiguity, narrow file scope, low risk | `codex 5.3` |
| `L2_COMPLEX` | Multi-file/module coupling, moderate ambiguity, integration-sensitive | `gpt 5.5` |
| `L3_CRITICAL` | High ambiguity + architecture-level tradeoffs + security/tenant impact + high blast radius | `opus 4.7` |

## 4. Task-to-Model Mapping

| Task type | Difficulty | Model |
| --- | --- | --- |
| Contract/doc synchronization with clear scope | `L1_STANDARD` | `codex 5.3` |
| Focused runtime bugfix in one module | `L1_STANDARD` | `codex 5.3` |
| Gate evidence collection and test packaging | `L1_STANDARD` | `codex 5.3` |
| Cross-module handoff refactor (`MODULE_HANDOFFS`, lineage, traces + runtime touch) | `L2_COMPLEX` | `gpt 5.5` |
| Teresa execution flow spanning multiple lanes (`09/10/11/12` + chat paths) | `L2_COMPLEX` | `gpt 5.5` |
| Large wave integration stitching (`G1..G7` evidence convergence) | `L2_COMPLEX` | `gpt 5.5` |
| Security/tenancy boundary redesign (`admin/superadmin`, deny paths, policy locks) | `L3_CRITICAL` | `opus 4.7` |
| Release/no-go decision synthesis with conflicting evidence and ownership disputes | `L3_CRITICAL` | `opus 4.7` |
| High-stakes architecture decisions with irreversible rollout impact | `L3_CRITICAL` | `opus 4.7` |

## 5. Hard Escalation Triggers

Escalate from `codex 5.3` to higher model when any trigger is true:

1. more than 2 unresolved blockers after one full fix/retest cycle,
2. ownership boundary conflict across modules,
3. security/tenant uncertainty,
4. handoff/lineage contradictions affecting multiple modules,
5. repeated `INCONCLUSIVE` gate outcomes.

Escalation order:

`codex 5.3 -> gpt 5.5 -> opus 4.7`

## 6. De-escalation Rule

After critical decision is closed, execution returns to `codex 5.3` for implementation chunks where:

- scope is narrow,
- acceptance criteria are stable,
- risk class drops to `L1_STANDARD`.

## 7. Dispatcher Enforcement

Every assignment card must include:

1. selected model,
2. difficulty class (`L1/L2/L3`),
3. reason for escalation (if not `codex 5.3`).
