---
doc_id: mw-012-manager-acceptance-2026-08-02
truth_type: delivery-status
status: accepted-local
owner: codex
business_owner: piotr
last_reviewed: 2026-08-02
---

# MW-12 — Manager action ownership and read-back

## Verdict

`CODE_GO_LOCAL` after corrective implementation and real-Postgres acceptance.

The pre-existing Manager service mutated Tasks, Initiatives, Decisions and
RAID items through real endpoints, but it could return success when the audit
insert failed, suggestion mutations were not audited at all, and an org-scoped
UPDATE changing zero rows was still reported as a changed entity. The mutation
and audit also used independent pooled queries rather than one transaction.

## Corrected contract

- every Manager action/suggestion mutation and its actor-owned audit execute on
  one pinned PostgreSQL transaction;
- an audit failure rolls back the owner-object mutation and propagates failure;
- every expected single-row mutation fails closed when it changes zero rows;
- decision escalation notifications run only after the database commit, so a
  rolled-back escalation cannot notify a sponsor about a change that did not
  land;
- result IDs are verified through fresh database read-back in the acceptance
  suite.

## Evidence

- real PostgreSQL acceptance: 3/3 — durable mutation+audit read-back,
  fault-injected audit rollback, stale/cross-tenant zero-row failure;
- Manager service and decision-escalation tests: 11/11;
- Manager API route tests: 10/10;
- Manager approval UI smoke: 1/1;
- EXE-09 ClosureSection regression: 11/11; an unreachable retry comparison
  inherited from the integration base was narrowed to the truthful `false`;
- full `npm run type-check`: PASS;
- `git diff --check`: PASS.

Railway authenticated UI smoke remains a release-environment gate and does not
reopen the local code acceptance.
