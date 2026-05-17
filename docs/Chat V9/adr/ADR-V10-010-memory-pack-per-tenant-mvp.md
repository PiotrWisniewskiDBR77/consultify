# ADR-V10-010: Memory pack scope is per-tenant at MVP; per-user deferred

- **Status:** Accepted (2026-04-18)
- **Decision-makers:** CTO, product lead
- **Master plan row:** D-10 · [§10](../CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md#sec-10-open-decisions)

## Context

The Feedback & Self-Learning block introduces `MemoryPackV1` — a
structured store of distilled signals (preferences, repeated
corrections, domain-specific lookups) the system uses to personalise
future responses without re-sending the full context each turn
(master plan §1.1 · block 2, Feedback dev plan §4).

The scope granularity of a memory pack is the question: one pack per
tenant (shared across all users of that tenant), or one pack per user
(isolated personalisation).

## Options considered

- **Option A (chosen):** Per-tenant pack at MVP. All users of a
  tenant share one pack. Per-user pack is a deferred post-MVP epic.
- **Option B:** Per-user pack at MVP. Each user has their own pack
  with explicit consent + revocation.
- **Option C:** Both from day one. Tenant pack as a fallback / prior,
  user pack as an override. More expressive but 2× the compliance
  surface.

## Decision

At MVP, memory packs are scoped to the tenant. Per-user packs are
deferred. An eventual per-user capability is tracked as a separate
epic and requires a new ADR when it ships.

## Rationale

- **Compliance surface asymmetry.** A per-tenant pack has one set of
  compliance obligations: tenant residency, tenant-level right-to-
  forget, tenant admin consent. A per-user pack multiplies every one
  of those by the number of users per tenant: per-user residency
  (if a user moves regions), per-user right-to-forget (must purge
  just their signals from a shared feature vector), per-user
  consent (must track + prove at the individual level). MVP cannot
  absorb this multiplication.
- **Learning signal density.** For tenants with ~5–50 users (our
  MVP target segment), a shared tenant pack gets richer signal than
  per-user packs could, because overlap in domain jargon and common
  preferences is high. Per-user uniqueness payoff is small until
  personalisation is the core product loop (not an MVP goal).
- **Reversible in the right direction.** Launching with per-tenant
  and adding per-user later is additive — the per-tenant pack
  becomes the "shared prior" and per-user becomes the "personal
  override". Launching per-user first and collapsing to per-tenant
  later is destructive — we'd have to decide whose signals win.
- **Option C rejected:** shipping both at MVP is the worst of both
  worlds: two compliance surfaces, two schemas, two invalidation
  rules. The "it's just a prior vs override" framing sounds clean
  until the first tenant asks for a user's right-to-forget and we
  need to purge from both the user pack and the tenant pack without
  losing useful signal.

## Consequences

- `MemoryPackV1` schema has `tenantId` as its pack scope; no
  `userId` field at pack scope. Individual `FeedbackSignalV1`
  entries within a pack may carry a `userId` for audit, but the
  aggregation key is `tenantId`.
- Right-to-forget at user level purges that user's `FeedbackSignalV1`
  entries from the tenant pack. Distillation functions must be
  idempotent on the remaining signal set (not "decayed by one
  user"). This is a non-trivial requirement for the distillation
  algorithm — it is called out in the Feedback dev plan §6.
- Consent UX asks "enable learning for your team" (tenant-level,
  admin gesture), not "enable learning for you" (user-level).
  Copy must match.
- A follow-up ADR is required to introduce per-user packs.
  That ADR's compliance section must address:
  (a) per-user residency, (b) per-user purge without corrupting
  the tenant pack, (c) consent capture at the individual level,
  (d) drift-detection segmentation by user.

## Execution notes

- A CI invariant (master plan §6.1 invariant 45) asserts that
  mutations to the memory pack are gated by a recorded consent
  event. The consent event carries `tenantId` + the consenting
  admin's `userId` (for audit), not the mutating user's id.
- When per-user packs land, the schema migration must preserve the
  tenant pack as a readable-only historical record until its TTL
  expires (or be explicitly merged into each user's pack with
  their consent).
