# Chat V10 — Architecture Decision Records

> **Cross-refs:** [`../CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md`](../CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md)
> · [`../README.md`](../README.md)

## Why this folder exists

The Chat V10 master implementation plan records ten resolved
architectural decisions (`D-1..D-10`) in its §10 table. That table is
good for at-a-glance review, but is not durable under refactor — a
future pass of the master plan could renumber, reword, or subsume the
table without leaving a breadcrumb. The decisions themselves would
survive (the code encodes most of them), but the **rationale** — the
reason we did not take the other fork — would evaporate.

This folder exists as the durable backstop. Every `D-n` row in the
master plan has a corresponding `ADR-V10-<nnn>-<slug>.md` here. The
master plan links both ways: the table links to the ADR, and each ADR
points back to the `#sec-10-open-decisions` anchor.

## Filename contract

ADRs follow the pattern:

```
ADR-V10-<nnn>-<kebab-slug>.md
```

- `<nnn>` is a zero-padded 3-digit sequence. `000` is reserved for this
  index file (itself). `001..010` map to `D-1..D-10`. New decisions get
  the next unused number.
- `<kebab-slug>` is a 2–5 word summary of the decision. Lowercase,
  hyphen-separated, no stopwords.
- The file must have a top-level `# ADR-V10-<nnn>: <Title>` heading on
  line 1 so the CI bijection invariant (below) can parse it.

## Status lifecycle

Each ADR carries a `Status:` field with one of four values:

| Status | Meaning |
|---|---|
| `Accepted` | The decision is in force. Default for D-1..D-10. |
| `Superseded by ADR-V10-<mmm>` | A later ADR replaced this one. The superseding ADR must explicitly reference the superseded. |
| `Deprecated` | The decision no longer applies but was not replaced (e.g. the underlying constraint disappeared). |
| `Proposed` | Draft, under review. Must not ship without a CTO + product-lead sign-off. |

`Accepted` → `Superseded` is the common path. `Accepted` → `Deprecated`
needs a documented reason in the `## Consequences` section because it
retires a decision without a replacement — rare, and suspicious.

## Index (`D-n` ↔ ADR bijection)

Every row in master plan §10 must appear here, and every ADR file here
must correspond to either a `D-n` row or an explicit successor ADR.
The `chatV10FeatureFlags.test.ts` invariants enforce the bijection.

| ID | Decision | ADR | Status |
|---|---|---|---|
| D-1 | `ChatV10Block` vs extending `ChatV9Block` | [`ADR-V10-001-chatv10block-union.md`](./ADR-V10-001-chatv10block-union.md) | Accepted |
| D-2 | Flag registry split | [`ADR-V10-002-flag-registry-split.md`](./ADR-V10-002-flag-registry-split.md) | Accepted |
| D-3 | Telemetry contract rename | [`ADR-V10-003-telemetry-contract-rename.md`](./ADR-V10-003-telemetry-contract-rename.md) | Accepted |
| D-4 | CRDT vendor | [`ADR-V10-004-crdt-vendor-deferral.md`](./ADR-V10-004-crdt-vendor-deferral.md) | Accepted |
| D-5 | Initiative storage | [`ADR-V10-005-initiative-postgres.md`](./ADR-V10-005-initiative-postgres.md) | Accepted |
| D-6 | Run Ledger backing store | [`ADR-V10-006-run-ledger-postgres.md`](./ADR-V10-006-run-ledger-postgres.md) | Accepted |
| D-7 | Onboarding telemetry residency | [`ADR-V10-007-onboarding-telemetry-residency.md`](./ADR-V10-007-onboarding-telemetry-residency.md) | Accepted |
| D-8 | CFO variance memo default tone | [`ADR-V10-008-cfo-variance-tone.md`](./ADR-V10-008-cfo-variance-tone.md) | Accepted |
| D-9 | Write-scope connectors wave | [`ADR-V10-009-connector-write-scope-wave-c.md`](./ADR-V10-009-connector-write-scope-wave-c.md) | Accepted |
| D-10 | Memory pack scope granularity | [`ADR-V10-010-memory-pack-per-tenant-mvp.md`](./ADR-V10-010-memory-pack-per-tenant-mvp.md) | Accepted |

## How to add a new ADR

1. Allocate the next free `<nnn>` from the index.
2. Copy the skeleton below and fill in the sections.
3. If the ADR supersedes or deprecates an earlier one, update the old
   ADR's `Status:` line and cross-link.
4. Add / update the row in the master plan §10 table (and, if it
   reverses a prior decision, add a row to §10's reversal log).
5. Re-run `npx vitest run src/utils/__tests__/chatV10FeatureFlags.test.ts`
   to confirm the bijection invariant stays green.

### Skeleton

```markdown
# ADR-V10-<nnn>: <Title>

- **Status:** Accepted (YYYY-MM-DD)
- **Decision-makers:** CTO, product lead
- **Master plan row:** D-<n> · [§10](../CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md#sec-10-open-decisions)

## Context

What problem are we deciding about? Include the pre-existing constraints.

## Options considered

- Option A (chosen): <one sentence>
- Option B: <one sentence + reason rejected>
- (…)

## Decision

The single sentence every engineer should remember.

## Rationale

2–5 bullets explaining why the chosen option wins. Include
asymmetries of cost (what's cheap to reverse vs. what isn't).

## Consequences

What changes in code / ops / process as a result. Include both the
positive consequences and the new risks this ADR accepts.

## Execution notes (optional)

Ordering and timing guidance if the decision cannot be executed in
one PR. Include the tripwire that tells future readers "the decision
has taken effect" (e.g. "rename occurs when first V10 event lands").
```

## What this folder is NOT

- **Not a design doc.** ADRs record *what* we decided and *why we
  didn't take the other fork*; they do not specify *how* to implement.
  Implementation lives in the per-block `*_DEVELOPMENT_PLAN_*.md` files.
- **Not a changelog.** The changelog is the git history + the
  per-release release notes. ADRs are static snapshots of a
  decision at the moment it was made.
- **Not an SSOT for defaults.** The flag registry
  (`chatV10FeatureFlags.ts`) owns runtime defaults. An ADR can *mandate*
  a default, but the enforcement is the CI invariant, not the ADR text.
