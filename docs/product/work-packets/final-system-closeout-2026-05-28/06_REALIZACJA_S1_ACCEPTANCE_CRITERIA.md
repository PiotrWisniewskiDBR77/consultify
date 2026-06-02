# 06 Realizacja - S1 Acceptance Criteria

Status: `in_progress`

Module: `06 Realizacja`

---

## Acceptance criteria (must pass)

1. User can open execution surface and load core control data.
2. Core operator action path works and returns expected state.
3. Risk/delay/capacity reads required in active lane are available.
4. Core flow survives refresh with consistent read-back.
5. No dead primary action in execution control flow.
6. Error/degraded states are explicit and honest.
7. No raw internals in user-facing UI.
8. Gate decision is supported by UI/API/refresh evidence.

---

## Pass thresholds

- No open P0/P1 in core execution workflow.
- Residual P2 has owner and follow-up.
- Security/tenant checks pass for in-scope execution paths.

