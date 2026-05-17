# TBL-FU-1 — Relation Explainability Persistence

**Priority:** P2  
**Owner:** Backend  
**Source:** Table Studio Foundation closeout

## Goal

Move relation explanation cache/reasoning from bounded in-memory storage to a persisted, tenant-scoped backing store with TTL and auditability.

## Acceptance Criteria

- Cache entries are tenant-scoped and table/record scoped.
- Expiration and invalidation are explicit.
- No raw sensitive record payload is stored beyond the approved evidence summary.
- Existing relation explainability tests remain green.
