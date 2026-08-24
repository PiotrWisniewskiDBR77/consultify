# Initiatives exact-SHA browser evidence — 2026-08-24

## Qualification boundary

- Candidate: `8acbb2203a2a210b43b019a82b058a75cf8e2244`.
- Dirty fingerprint at runtime start: empty-tree SHA-256 `e3b0c442...b855` (clean checkout).
- Local owner-review runtime: client `3987`, server `3986`.
- Preserved fixture database: `consultify_w3_initiatives_owner_20260824`.
- Database state: `834` source migrations; application and SQL migration gates `ok`.
- Fixture: `W3-INITIATIVES-OWNER-v1`; FINAL manifest and durable SQL marker verified.
- Auth boundary: no E2E mode and no test auth/gateway/support bypass.
- Railway and production were not touched.

Runtime receipt remains at `/private/tmp/consultify-wave3-runtime-manifest-ini-adopt-r8-20260824.json`. It is intentionally not copied because runtime receipts can include machine-local coordinates. This index records only non-secret qualification facts.

## Captured surfaces

| Evidence | SHA-256 | Result |
|---|---|---|
| `01-initiatives-list.png` | `1989dde74276719e8543c385a63fafd5571ea919fd78034d2769cdfddb7fc6a4` | Canonical-only list renders one persisted initiative; visible footer identifies exact candidate `LOCAL @8acbb2203a2a`. |
| `02-initiatives-row-preview.png` | `31f1865f37ed3f03fca0f3f954b790b89f4956661466c0cb2b4e996981f7e16a` | Row selection opens the standard right preview with lifecycle, readiness, owner, expected effect, source relation and actions. |
| `03-new-initiative-wizard.png` | `c6818992c5adc94e1fc43cfdaa7073583ce9eae2268a7eed1c69b274faa25d3c` | New Initiative opens the AI wizard with explicit premise/problem/result/scope/KPI inputs. No create/write was performed. |
| `04-plan-register.png` | `557a169d8d7755d57b018d7b246725d063617339c9cb38eab4373508afbe869b` | Plan register and published scenario render, but the active scope is empty despite the canonical initiative being in progress. |
| `05-capacity-register.png` | `f5a5e4f882f5f3eda4ce7bb74b7972e4c59a7ea9568ef47e2d0c8ed6d2375021` | Capacity register renders one persisted constraint. It exposes `UNKNOWN` role/team and a raw owner UUID in the expanded data contract. |
| `06-capacity-workbench.png` | `fab8c701ba8aca4130129c01f62da24d640c28de670b2291ae96b29b1917c629` | The workbench open action was exercised. The browser opened a blank target and lost the original tab, so the workbench journey is not accepted. |

## Gate result

`TECHNICAL EXACT-SHA PASS / MODULE NO-GO`

The runtime, database identity, migration chain, fixture marker and exact client/server SHA are proven. The canonical list, preview and premise-first wizard are usable on the current candidate. Owner acceptance is not claimed.

### Blocking defects found by browser replay

1. `INI-C04-A` — Plan scenario contains no initiatives although the canonical list contains one `W realizacji` initiative. The source/filter/scenario membership contract requires reconciliation and deterministic readback.
2. `INI-C04-B` — Capacity data leaks a raw UUID as owner and leaves role/team as `UNKNOWN`; display identity and resource linkage are incomplete.
3. `INI-C04-C` — `Otwórz narzędzia obciążenia` opens a blank target and removes the usable originating page in the in-app browser. Deep-link/new-tab behavior requires repair and cold-open verification.

### Required closure

- Fix the three defects above without adding new scope.
- Re-run list → preview → wizard → Plan register/workbench → Capacity register/workbench on one frozen SHA.
- Prove direct URL and cold reload for both workbenches, persisted scenario membership, resolved display identities and no console/network failures.
- Present the resulting images for owner review; only the owner may advance the module to accepted.
