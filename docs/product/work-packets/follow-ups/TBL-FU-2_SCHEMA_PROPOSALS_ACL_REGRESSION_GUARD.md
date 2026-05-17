# TBL-FU-2 — Schema Proposals ACL Regression Guard

**Priority:** P1  
**Owner:** Backend / Security  
**Source:** P0 `TBL-SEC-1` follow-up completed in Table Studio Foundation

## Goal

Promote the schema proposal ACL audit from focused Table Studio evidence into a permanent security regression suite.

## Acceptance Criteria

- Cross-tenant 403 cases cover every `/schema/propose` and `/schema/proposals/*` route.
- Tests run in the standard backend security/test pipeline.
- The audit findings doc remains linked from security closeout.
- No route accepts tenant/workspace/base ids from request body without server-side ownership resolution.
