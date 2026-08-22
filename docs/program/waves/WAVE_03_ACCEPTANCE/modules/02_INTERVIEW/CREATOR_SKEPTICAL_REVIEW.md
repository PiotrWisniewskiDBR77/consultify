# Interview creators — independent skeptical review

Date: 2026-08-22
Scope: Assign Interview, AI Insight Creator, AI Initiative Wizard
Change type: recommendation-system artifact only; no product implementation.

## Verdict

Two independent reviewers reached the same boundary from different angles:

- **Usability:** the prior document was sufficient to start prototyping but not
  to guarantee an acceptable next release. A visually cleaner modal could still
  hide decisions, lose work and fail under realistic data density.
- **Platform/scalability:** reject the prior document as a platform standard;
  accept it conditionally as a UX brief. It risked creating another shell and
  lacked a component, state, integration, migration and governance contract.

Disposition: `MATERIAL_REVISION_REQUIRED / DIRECT_IMPLEMENTATION_BLOCKED /
CLICKABLE_PROTOTYPE_ALLOWED`.

## Confirmed SSOT resolution

The platform already has three relevant layers:

1. `UI-CREATE-01` is the normative behavior family and requires durable drafts,
   resume, idempotency, partial-failure recovery and telemetry.
2. `src/components/shared/WizardModal` explicitly identifies Survey, Insight and
   Initiative as the three modal consumers that should share chrome.
3. `ToolWizardShell` is the route-backed consulting-tool workspace shell.

Therefore the recommendation does **not** create `ConsultingCreatorShell`.
It defines a versioned profile/extension of `WizardModal`, aligned to
`UI-CREATE-01`; full workspace tools continue to use `ToolWizardShell`.

## Usability objections accepted into the requirements

- Arbitrary modal dimensions are replaced by per-screen first-viewport
  contracts accepted in a clickable prototype.
- One scrollbar is necessary but insufficient; continuation and completeness
  must be explicit.
- Scope summary is a bounded collapsed strip, not another large nested card.
- Basic/AI-suggested/advanced fields require an explicit inventory.
- Mobile is full-screen.
- Realistic density and failure fixtures are mandatory.
- Versioned draft recovery covers refresh, network loss and browser return.
- Opaque baseline is accepted before optional Liquid Glass.
- Usability threshold is `5/5` per journey with zero data loss or missed
  mandatory decisions.
- Initiative Candidates, Governance and Result must be prototyped and reviewed;
  their evidence remains missing today.

## Platform objections accepted into the requirements

- One canonical component API and state machine, not shared CSS only.
- Variants: compact transactional, stepped creator, and full workspace with an
  explicit rule for choosing among them.
- Typed async adapter contract for search/pagination, eligibility, permissions,
  job progress, cancellation, retry, timeout, idempotency, audit and lineage.
- Explicit AI `propose → accept` boundary and partial-result recovery.
- Contract, state-machine, integration, a11y, visual, persistence and
  performance tests.
- Version owner, changelog, no-local-fork rule, consumer inventory, sequential
  feature-flagged pilot and rollback.

## Acceptable-v1 release decision

The next version is **not acceptable** merely because it is larger, prettier or
uses Liquid Glass. It is acceptable only when all gates in
`CONSULTING_CREATOR_GUIDELINES.md` §10 pass and Piotr separately accepts the
complete Assign, Insight and five-step Initiative journeys on one frozen SHA.

Until then:

- recommendation status: `READY_FOR_PROTOTYPE_SPEC`;
- platform standard status: `NOT_APPROVED`;
- implementation status: `NOT_STARTED`;
- reuse outside Interview: `BLOCKED`.
