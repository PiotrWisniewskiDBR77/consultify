# Presentation Quality Governance Scorecard

Status: `ACTIVE`
Owner: Product + QA + Delivery

## Decision Contract

All presentation mutations and release actions follow:

`proposal -> approval -> execution -> audit`

No silent mutation is allowed for AI-assisted edits.

## Priority Model

- `P0` Critical content integrity defect (raw internals, placeholder content, encoding artefacts).
- `P1` Decision-traceability defect that blocks trust and release.
- `P2` Non-blocking quality issue that can ship only with explicit visibility.

## PASS Vocabulary

- `PASS` no open `P0/P1`, no open warnings that degrade decision quality.
- `PASS_WITH_P2` no open `P0/P1`, but at least one `P2`.
- `BLOCKED_P1` any open `P0` or `P1`.
- `INCONCLUSIVE` execution could not be verified with reliable evidence.

## Release Policy

- Export/share is allowed only when result is `PASS` or `PASS_WITH_P2`.
- Result `BLOCKED_P1` blocks release candidate immediately.
- `PASS_WITH_P2` requires explicit acknowledgment in release notes.

## Hard Requirements For Decision Slides

Every decision-grade slide must include:

- thesis (`key_message`) clear enough for executive read-through,
- `source_refs` with traceability,
- evidence confidence (`>= 0.6` recommended),
- freshness signal (captured timestamp or freshness days).

## Operational Scorecard Fields

Each quality report must include:

- aggregate `score`,
- counts: `p0`, `p1`, `p2`,
- release result in PASS vocabulary,
- full gate list with category, severity, priority, and optional slide pointer.
