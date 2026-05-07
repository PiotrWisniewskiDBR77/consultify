# Presentation Pipeline SLI/SLO (Sprint 1)

Status: `ACTIVE`
Owner: Delivery Owner + QA + Backend

## Scope

Applies to Presentation Artifact Engine runtime:

- deck generation,
- AI proposal editing flow,
- export flow (`pdf`, `pptx`, `png`, `html`),
- quality-gate blocking behavior.

## SLI Definitions

- `generation_success_rate` = successful deck generations / all generation attempts.
- `export_success_rate` = successful exports / all export attempts.
- `quality_blocker_rate` = blocked exports (`QUALITY_GATE_BLOCKED`) / all export attempts.
- `proposal_apply_success_rate` = accepted proposals applied / accepted proposals.
- `p95_generation_latency_ms` = p95 latency from generate request to ready state.
- `p95_export_latency_ms` = p95 latency from export request to terminal status.

## SLO Targets (Initial)

- `generation_success_rate` >= 99.0% (7-day rolling).
- `export_success_rate` >= 99.5% (7-day rolling).
- `proposal_apply_success_rate` >= 99.5% (7-day rolling).
- `p95_generation_latency_ms` <= 45000 ms.
- `p95_export_latency_ms` <= 15000 ms.

`quality_blocker_rate` is not a pure reliability SLO; it is monitored as quality signal and should trend down on benchmark runs.

## Alert Conditions

- P1 alert if generation success drops below 98.0% for 30 minutes.
- P1 alert if export success drops below 99.0% for 30 minutes.
- P1 alert if proposal apply success drops below 99.0% for 30 minutes.
- P2 alert if p95 generation latency exceeds 60s for 60 minutes.

## Release Gate Use

A release candidate cannot be promoted when:

- any P1 SLO is in breach at release window,
- blocker payload semantics are broken (`blocked` incorrectly reported as success),
- telemetry is missing for critical counters.
