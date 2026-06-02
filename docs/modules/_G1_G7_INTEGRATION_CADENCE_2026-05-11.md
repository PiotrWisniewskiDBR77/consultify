---
doc_kind: G1_G7_INTEGRATION_CADENCE
owner: user
status: active
last_updated: 2026-05-11
scope: integration-review-cadence
work_type: operations
---

# G1-G7 Integration Cadence

## 1. Purpose

Define a fixed rhythm for integration reviews and release-readiness decisions after each implementation wave.

## 2. Cadence Structure

| Ceremony | Frequency | Owner | Objective |
| --- | --- | --- | --- |
| Daily Integration Sync | daily (workdays) | integration lead | detect cross-module conflicts early |
| Dispatch Review (WIP=2) | daily before new launch | dispatcher | decide if new agent can start |
| Gate Deep Review | 2x per week | integration + security + test leads | review `G1..G7` evidence deltas |
| Wave Exit Review | end of each wave | program owner | approve/deny next wave start |
| Release Readiness Review | after Wave 5 or major milestone | program owner + release owner | final `GO / GO_WITH_P2 / NO_GO` |

## 3. Inputs Required Per Review

1. Program Board status (`_PROGRAM_BOARD_FULL_ROLLOUT_2026-05-11.md`)
2. Gate Board status (`_PROGRAM_GATE_BOARD_G1_G7_2026-05-11.md`)
3. Test queue and latest technical/manual evidence
4. Module boards touched in current wave
5. Security and ownership decision deltas
6. Active agent list with assignment cards (`max=2`)

## 4. Required Output Per Review

Each review must publish:

- gate verdict update (`G1..G7`),
- blocker list (`BLOCKED_P1` / `WAITING_OWNER_DECISION`),
- explicit next-wave entry decision,
- owner assignments for unresolved evidence.
- dispatch decision: `LAUNCH_ALLOWED` / `LAUNCH_BLOCKED`.

## 5. Wave Exit Checklist

| Gate | Exit question | Required decision |
| --- | --- | --- |
| `G1` | Is logic coherent for this wave scope? | `PASS` |
| `G2` | Are handoffs complete and owner-safe? | `PASS` or explicit `NOT_DONE` with owner |
| `G3` | Is lineage intact for changed artifacts? | `PASS` |
| `G4` | Are critical claims evidenced? | `PASS` |
| `G5` | Is Teresa execution behavior truthful and auditable? | `PASS_WITH_RUNTIME_PARTIAL` minimum in early waves |
| `G6` | Are ACL/security boundaries preserved? | `PASS` or owner-approved defer with risk acceptance |
| `G7` | Are UI/UX hard rules preserved? | `PASS_WITH_EVIDENCE_BACKLOG` minimum in early waves |

## 6. Hard-stop Rules

- Any fake runtime claim -> immediate `NO_GO`.
- Any hidden ownership transfer -> immediate `NO_GO`.
- Any high-impact action without approval evidence -> `BLOCKED_P1`.
- Any unresolved security boundary ambiguity at release review -> `NO_GO`.

## 7. Anygravity interface and async policy

Manual tester communication and report loop must follow:

- `DRD/testy_antygravity/_ANYGRAVITY_COMMUNICATION_PROTOCOL_2026-05-12.md`

Wave continuity policy:

- manual Anygravity may run in parallel to next disjoint scope only under `LAUNCH_ALLOWED`,
- wave exit review still requires completed manual evidence and final gate verdict.
