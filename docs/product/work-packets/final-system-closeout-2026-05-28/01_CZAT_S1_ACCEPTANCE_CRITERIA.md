# 01 Czat - S1 Acceptance Criteria

Status: `in_progress`

Module: `01 Czat`

---

## Acceptance criteria (must pass)

1. User can open chat and load conversation context without blocking errors.
2. User can send a message and receive a response in the same session.
3. Sent message persists and is visible after refresh/read-back.
4. Core chat workflow has no dead primary action.
5. Error/degraded states are explicit and honest (no fake success).
6. No raw internals are shown in user-facing UI.
7. Proposal/approval/audit behavior is preserved for mutating actions.
8. Gate decision is supported by evidence (UI + API + refresh).

---

## Pass thresholds

- No open P0/P1 in core flow.
- Any residual P2 must have owner and follow-up action.
- Security/tenant checks for core paths pass.

