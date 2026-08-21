# Wave 3 — SHA and runtime ledger

| Entry | Module/round | Purpose | Git SHA | Client SHA | Server SHA | Runtime | Database | Migrations | Production contact | Evidence | Status |
|---:|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Wave 3 entry | Wave 2 closure parent | `ec43f3c60b6998012da680380cdc28604dee3bec` | — | — | not mounted for Wave 3 | — | — | `NO` | Wave 2 gate report | `PARENT_VERIFIED` |
| 2 | Organization / preflight | Main journey and governed snapshot | `a36d9d51edc87bb63e7211754e22106d02d2d3d0` | `a36d9d51edc87bb63e7211754e22106d02d2d3d0` | `a36d9d51edc87bb63e7211754e22106d02d2d3d0` | client `127.0.0.1:3940`; server `127.0.0.1:3941` | `consultify-wave2-p4-pg` / `consultinity` | 667 current | `NO` | Organization module ledger; snapshot v1 hash `5bac6e23430d8fa84402fdb36973cf78a835d376de7a895cecad5ebd45dab2f8` | `MOUNTED_PREFLIGHT` |
| 3 | Organization / remediation replay | Verify `ORG-PF-001..003` fixes | `ad0766ac4c1000c6c94934a1af1d53c0b4eed19c` | `ad0766ac4c1000c6c94934a1af1d53c0b4eed19c` | `ad0766ac4c1000c6c94934a1af1d53c0b4eed19c` | client `127.0.0.1:3940`; server `127.0.0.1:3941` | `consultify-wave2-p4-pg` / `consultinity` | 667 current; SQL chain complete | `NO` | `/api/ready`; UI replay; profile DB readback | `MOUNTED_REPLAY_PASS` |
| 4 | Interview / source preflight | Exact-current backend, component/API and owner-fixture preparation without replacing the Organization owner screen | `d3d6de5bfc2470a741474f9fa449025608d47273` | Organization remains mounted on `ad0766ac4c1000c6c94934a1af1d53c0b4eed19c` | Organization remains mounted on `ad0766ac4c1000c6c94934a1af1d53c0b4eed19c` | Interview candidate not mounted | disposable `int_bvp_wave3_20260821`; owner fixture in local `consultinity` | fresh `816`; repeat `0`; dry-run `0` | `NO` | Interview module ledger; real-PG `70/70`; component/API `34/34`; root typecheck PASS; residue `0` | `SOURCE_PREFLIGHT_PASS_MOUNT_PENDING` |

## Rules

- Add one row before any mounted module review.
- Record both browser-visible and backend readiness SHA.
- If client/server/candidate differ unexpectedly, stop the gate.
- A code, dependency, migration, configuration or governed-fixture change must
  record a new row and impacted-module regression set.
- Documentation-only checkpoint SHAs must point back to the exact product SHA
  they evidence.
