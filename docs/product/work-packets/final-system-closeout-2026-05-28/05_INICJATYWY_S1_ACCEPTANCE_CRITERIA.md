# 05 Inicjatywy - S1 Acceptance Criteria

Status: `in_progress`

Module: `05 Inicjatywy`

---

## Acceptance criteria (must pass)

1. User can open initiative list/detail without blocking errors.
2. Core initiative update path works and persists.
3. Planning/governance read flows required by module are available.
4. Core workflow survives refresh with consistent read-back.
5. No dead primary action in active initiative workflow.
6. Error/degraded states are explicit and honest.
7. No raw internals in user-facing UI.
8. Gate decision is supported by UI/API/refresh evidence.

---

## Pass thresholds

- No open P0/P1 in core initiative workflow.
- Residual P2 has owner and follow-up.
- Security/tenant checks pass for in-scope initiative paths.

