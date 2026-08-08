# U03 Initiative lifecycle and clean closure — canonical RealDB evidence

Date: 2026-08-08
Scope: canonical local T01 native-PostgreSQL run; no commit, push or deployment claim

## Canonical outcome

The Initiative lifecycle is now driven through the owning transition contract rather than proof-only raw status mutation. Schedule Lock establishes the canonical baseline; subsequent material transitions require exact governed decisions and leave owner history. A generic decision record, an incomplete closure request or a direct status update cannot unlock or impersonate lifecycle completion.

## Clean T01 proof facts

- full clean T01 flow completed with exit code `0`;
- migration/runtime log contained zero PostgreSQL `42P01` missing-relation errors and zero `42703` missing-column errors;
- Results reached `DELIVERED` with `benefitIds=1`;
- Finance truth remained `NEEDS_DECISION`, reason `NO_MONETARY_MEASUREMENT`, with `autoBooked=false`;
- Initiative lifecycle reached `DONE` through the owner transition contract;
- exactly `3` canonical gate decisions;
- exactly `3` owner lifecycle history entries;
- exactly `1` Schedule Lock baseline;
- exactly `3` A05 approval scopes;
- exactly `3` A06 execution receipts;
- incomplete closure was rejected;
- a generic decision could not unlock the lifecycle transition;
- raw Initiative status updates in the proof were `0`;
- U05 receipt-enforced decision flow and final outputs completed at Transformation Case version `v24`.

These facts supersede the earlier local caveat that Schedule Lock and `SCHEDULED → EXECUTING → DONE` owner transitions were still absent. The earlier mobilization evidence remains valid for RAID, calendar projection and monitoring; this evidence closes its Initiative lifecycle residual.

## Status boundary

`PARTIAL`: the clean native-PostgreSQL lifecycle and closure path is locally GREEN. Remaining acceptance is limited to the same canonical SHA exercised through authenticated multi-role browser flows and deployed runtime evidence. No production transition is claimed.
