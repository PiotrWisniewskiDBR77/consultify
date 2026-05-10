---
module_id: MODULE_TOOLS
doc_kind: STATUS
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Status — Narzędzia / Tools

## Status Tags (As-Is)

- `real`: tools and assessment routes are mounted in `AppRoutes.tsx`.
- `real`: sidebar has tools main entry plus assessment sub-item in `menuConfig.ts`.
- `partial`: feature breadth is large (tools + assessments + megatrends) with no module-local test suite.
- `duplicate`: `/licensed-tools/*` alias redirects to assessment flow.
- `code_gap`: no dedicated automated tests in `src/components/Discovery` and `src/components/assessment`.
- `doc_gap`: previous baseline did not capture real route matrix and alias behavior.

## Function Coverage Status

- `pass`: function contract coverage complete (`6/6` Tools functions documented).
- `real`: all six documented functions are represented in runtime routes/components.
- `partial`: function-level runtime is broad, but automated test depth remains limited.
