# Wave 3 — SHA and runtime ledger

| Entry | Module/round | Purpose | Git SHA | Client SHA | Server SHA | Runtime | Database | Migrations | Production contact | Evidence | Status |
|---:|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Wave 3 entry | Wave 2 closure parent | `ec43f3c60b6998012da680380cdc28604dee3bec` | — | — | not mounted for Wave 3 | — | — | `NO` | Wave 2 gate report | `PARENT_VERIFIED` |

## Rules

- Add one row before any mounted module review.
- Record both browser-visible and backend readiness SHA.
- If client/server/candidate differ unexpectedly, stop the gate.
- A code, dependency, migration, configuration or governed-fixture change must
  record a new row and impacted-module regression set.
- Documentation-only checkpoint SHAs must point back to the exact product SHA
  they evidence.
