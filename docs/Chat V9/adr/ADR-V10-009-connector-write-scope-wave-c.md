# ADR-V10-009: All connector write scopes deferred to Wave C

- **Status:** Accepted (2026-04-18)
- **Decision-makers:** CTO, product lead
- **Master plan row:** D-9 · [§10](../CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md#sec-10-open-decisions)

## Context

The Connectors / Enterprise Integrations block (master plan §1.1 ·
block 6) ships MVP with five read-only connectors: Google Drive,
Slack, Notion, Email, Calendar. The OAuth scopes, token vault, ACL
propagation, and federated-search surface are all designed to support
read + write. The question is whether any write scope (post-message,
create-ticket, send-email, create-calendar-event, etc.) enters Wave
A or Wave B, or whether the write surface as a whole is gated to
Wave C.

The write surface is the largest blast-radius in the product. A
single mis-issued `chat.postMessage` can misinform a team channel;
a wrong `send-email` can send to the wrong list; a rogue
`create-ticket` can flood the on-call queue. The defensive controls
required (ExecutionProposal envelope, tool approval ladder, severity
S0..S4 gates, full audit via Run Ledger) are in scope for Wave A +
B, but not guaranteed battle-tested until Wave C.

## Options considered

- **Option A (chosen):** All write scopes deferred to Wave C. Wave A +
  B connector OAuth flows request read scopes only. The Connector
  contract already models write-capable connectors; write toggles
  stay flipped off at the framework level.
- **Option B:** Ship post-message and send-email in Wave B behind a
  tight approval gate (ExecutionProposal + explicit user approval per
  call).
- **Option C:** Per-connector, per-scope call. Calendar
  create-event ships Wave A (low blast), Slack post-message ships
  Wave B (medium), GitHub write ships Wave C (high).

## Decision

The entire write surface — every connector, every write scope —
ships in Wave C. No write connector ships in Wave A or B. The
Connector framework (token vault, ACL propagation, OAuth) is
architected with writes in mind from day one so Wave C is additive,
not a rewrite.

## Rationale

- **Blast radius asymmetry.** A read error shows a user the wrong
  document; a write error sends a wrong message, creates a wrong
  ticket, or updates the wrong file. Rollback cost is asymmetric:
  reads are stateless; writes persist externally.
- **Approval maturity gate.** The ExecutionProposal + severity
  ladder + Run Ledger audit are all Wave A + B deliverables. They
  need time in production (Wave A + B runtime) to surface edge
  cases before they carry write responsibility. Shipping write
  without the approval layer mature is "fast but wrong".
- **Regulatory posture.** A write action is a legal action under
  principal-agent theory. A misdirected email can trigger a breach
  notification; a wrong post to a customer Slack can breach NDA.
  The compliance review at Wave C covers this explicitly;
  compressing it into Wave B means shipping without the review.
- **Option C rejected:** per-connector ladder is attractive but
  creates "the one connector that forgot approval" failure mode.
  Either the framework enforces write-approval at the framework
  level for every connector, or no connector writes. Wave C aligns
  with "framework-level enforcement, then every connector at once".

## Consequences

- OAuth scopes requested at connector-connection time are read-only
  for Wave A + B. A scope upgrade happens at Wave C with user
  consent (OAuth re-consent flow).
- The Connector TypeScript contract already declares optional
  `WriteOp` variants; their implementations stub to
  `throw new Error('write-scope not enabled; Wave C gate')` until
  Wave C. The invariant in master plan §6.1 (invariant 38) asserts
  that every connector has the write stub.
- The onboarding flow's "connect your tools" step does not ask for
  write scopes in Wave A + B. Copy: "Teresa needs read access to
  help you; we'll request write access later if you opt in."
- Wave C opening requires: ExecutionProposal ≥ 30d in production
  without P0 incident, severity ladder audit review signed off,
  Run Ledger event integrity ≥ 99.9% (no event drops), and a
  compliance sign-off per region.

## Execution notes

- A CI invariant (planned for §6.1 at Wave C start) will assert that
  no connector file imports the `WriteOp` implementation module in
  Wave A + B — mechanical enforcement of the decision, not just
  documentation.
- The decision is reversible per-connector if Wave C reveals an
  unforeseen blocker for one specific provider; any such carve-out
  needs its own ADR that explicitly supersedes a subset of this one.
