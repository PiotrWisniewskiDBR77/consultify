# Wave 2 Brief D — Connectivity And Communication

> Date: 2026-03-29
> Scope owner: Cluster D
> Canonical standard: `docs/product/work-packets/wave-2/WAVE_2_AGENT_STANDARD.md`

## 1. Scope

You own only:

- `Komunikacja`
- broad `Synchronizacja`

You do not own:

- bounded `Integracja` and `Kalendarz` Wave 1 streams,
- `Inbox`,
- `Chat`,
- or `Superadmin` as a whole.

## 2. Why this cluster exists

This cluster owns the connected work layer:

- how communication moves work,
- how channels are governed,
- how providers connect,
- and how real external runtime becomes trustworthy.

The main question is whether Consultify can move from partial connected capability to one believable communication-and-sync platform.

## 3. Source of truth reviewed

Prioritize:

- `COMMUNICATION_V8_SSOT.md`
- `COMMUNICATION_V8_READINESS_AUDIT.md`
- `EXTERNAL_SYNC_READINESS_AUDIT_V8.md`
- `SYNC_PLATFORM_BENCHMARK_V8.md`
- `CONNECTOR_*` implementation and lifecycle docs
- closure ledger and gap analysis
- the two module cards in `wave-2/module-cards/`

## 4. Executive summary

Both modules have meaningful substance already:

- communication has a real doctrine,
- sync has a real operator and connector foundation,

but both still lack a fully coherent product-grade user journey.

## 5. Module-by-module analysis

Use:

- `WAVE_2_MODULE_CARD_COMMUNICATION.md`
- `WAVE_2_MODULE_CARD_SYNCHRONIZATION.md`

## 6. Cross-module dependencies

This cluster depends on:

- `Admin`
- `Superadmin`
- `Chat`
- `Inbox`
- `Execution`
- and provider-specific connected apps

## 7. Recommended execution order

Use this order:

1. `Synchronizacja`
2. `Komunikacja`

Reason:

- communication products cannot be credible if sync/provider/channel truth is still fragmented,
- sync must establish ownership, auth, and delivery health before communication builds on top.

## 8. Final recommendation

The manager should reject any plan that:

- rebrands bounded sync closure as full enterprise connector parity,
- collapses communication into a generic chat clone,
- or ignores the tenant/admin/superadmin ownership split in connected runtime.
