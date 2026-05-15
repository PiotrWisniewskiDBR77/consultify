# ADR-V10-008: CFO variance memo defaults to investor-grade auditor tone

- **Status:** Accepted (2026-04-18)
- **Decision-makers:** CTO, product lead
- **Master plan row:** D-8 · [§10](../CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md#sec-10-open-decisions)

## Context

The Outcome / ROI Lifecycle block generates CFO-facing variance
memos: monthly or quarterly documents reconciling initiative
performance against the investment thesis, including KPI variances,
reasons, and remediation recommendations. These memos are quoted into
board materials and audit packages.

Tone has two plausible defaults:

- **Investor-grade auditor.** Precise, conservative, includes
  reconciliation traces and risk caveats. Reads like an S-1 footnote.
- **Friendlier executive summary.** Shorter, narrative, emphasises
  direction of travel over precise numbers. Reads like a product
  update.

## Options considered

- **Option A (chosen):** Investor-grade auditor is the shipped default;
  "friendlier" is opt-in at the tenant level via an admin setting.
- **Option B:** Friendlier is the default; investor-grade is opt-in.
- **Option C:** Per-tenant prompt for tone on first use with no
  shipped default.

## Decision

Investor-grade auditor tone is the default for all CFO variance memos.
A tenant can opt into a softer tone via an admin toggle
(`outcome.variance_memo_tone`), gated by an acknowledgement that the
softer tone removes some reconciliation detail.

## Rationale

- **Asymmetric reversal cost.** Scaling tone *down* from
  investor-grade (remove a caveat, soften a risk flag) is a cosmetic
  prompt adjustment. Scaling tone *up* from friendlier requires
  reconstructing the reconciliation evidence that the softer tone
  omitted — which, in the audit case, means re-running the
  calculations and back-filling provenance. The two directions are
  not symmetric.
- **Regulatory & fiduciary safety.** Any memo quoted into a board or
  investor pack must meet audit standards out of the box. Shipping a
  softer default and relying on the tenant to "turn on the rigorous
  mode" guarantees that some tenant forgets, some board meeting
  quotes the softer version, and we own the fallout.
- **Opt-in friction is small.** The tenant who genuinely wants a
  softer tone is a sophisticated admin who can handle a toggle with
  an acknowledgement modal. The tenant who forgets to toggle gets
  the safer default. This is the correct asymmetry.
- **Option C rejected:** a first-use prompt forces a decision before
  the user knows what the defaults mean, and the modal fatigue
  pushes users to click through without reading — which would
  *silently* pick an outcome we cannot defend.

## Consequences

- The Outcome dev plan's memo-generator specifies the
  investor-grade tone in its prompt template; the softer tone is a
  prompt variant applied only when the tenant setting is on.
- `outcome.variance_memo_tone` is a tenant-level admin setting
  (not per-user; not per-memo). Changing it requires tenant-admin
  privilege and emits a telemetry event for audit.
- The opt-in toggle ships with a copy-anchored acknowledgement:
  "Softer tone removes reconciliation traces and risk caveats. We
  recommend investor-grade tone for any memo that will be quoted
  into board materials." Acknowledgement is logged.
- A sampling invariant (not yet in §6.1; proposed for §6.1.11
  addition in a future pass) asserts that `investor-grade` stays
  the built default in the prompt registry and cannot be changed
  without this ADR being superseded.

## Execution notes

- Implementation lands with the first variance memo generator PR.
- Copy for the acknowledgement modal must be reviewed by the
  compliance / legal partner before shipping to tenants who have a
  signed SOX attestation.
