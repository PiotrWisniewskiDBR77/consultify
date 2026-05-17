---
doc_id: RAW_INTERVIEW_DISCOVERY_ENGINE_2026_05_11
doc_kind: RAW_AUTHOR_SOURCE
owner: user
status: active
last_updated: 2026-05-11
---

# RAW — Interview Discovery Engine (Wywiad)

## Context

This RAW source captures interview/discovery intent for module `03_wywiad` as dedicated source material for Contract 2.0 deepening and certification.

It supplements:

- `docs/modules/03_wywiad/RAW_INPUT.md` (module-local raw baseline),
- impact context from `docs/RAW/teresa-chat/104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md`,
- downstream governance context from `docs/RAW/implementation-pmo/107_RAW_IMPLEMENTATION_PMO_ENGINE_2026-05-09.md`.

## Must

1. Interview is a governed discovery engine, not a loose notes table.
2. Findings, insights and initiative candidates require source provenance (`session`, `finding`, `template`) or explicit `MISSING_EVIDENCE`.
3. AI suggestions are proposals; user review is required before high-impact claims/handoffs.
4. Handoff from Interview to Initiatives is candidate-based, explicit and read-back aware.
5. Interview must never silently create canonical initiative truth in downstream modules.
6. Route aliases may exist, but they must not imply multiple owners of Interview truth.

## Should

1. Multi-candidate generation (`0..N`) may be used when quality gates are explicit.
2. Interview journey should show honest degraded states (missing source, missing read-back, ACL block).
3. Assignment/review surfaces should have explicit next actions and role-aware visibility.

## Out

1. Runtime implementation, backend refactors and test suite creation in this docs-only cycle.
2. New ownership edges in module graph without explicit owner approval.
3. Declaring runtime `DONE` without route/component/API/test evidence.

## World-Class Inspirations (for target calibration)

1. Research interview systems with strong evidence lineage and synthesis traceability.
2. Consulting discovery OS where insight-to-initiative handoff is governed and auditable.
3. AI-assisted analysis products that separate draft proposal from approved business truth.

## Anti-Patterns

1. Insight/candidate without source context.
2. Hidden candidate-to-initiative mutation.
3. Duplicate route identity treated as duplicate business truth.
4. High-confidence claim with no evidence and no uncertainty marker.
5. Runtime-go claim with missing journey proof.

## Evidence Needs (to close runtime readiness later)

1. Route/component/API/test chain for `InterviewHub` journey.
2. Proof for `insight -> candidate -> review -> handoff -> read-back`.
3. Degraded-state proof for source/ACL/read-back failures.
