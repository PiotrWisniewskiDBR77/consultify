# FEATURE GATING RULES

Every feature must declare:

- required UserState
- required Phase
- required Role

If any of the above is missing:
Feature must not ship.

---

## EXAMPLE

Feature: Benchmark Access

Requires:
- UserState: ECOSYSTEM_NODE
- Phase: G
- Role: Admin or Consultant
