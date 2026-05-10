---
module_id: MODULE_ADMIN_PANEL
doc_kind: TESTS
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Acceptance & Tests — Panel Administratora

## Scope Of Verification (As-Is)

- Verify sidebar -> AppView -> route -> rendered component chain.
- Verify ownership/alias statements against `menuConfig.ts`, `routeConfig.ts`, `AppRoutes.tsx`.
- Verify role/guard behavior where module is protected.

## Required Checks

- [ ] Route opens documented runtime (`workspace` or `placeholder`) exactly as specified.
- [ ] AppView enum and route mapping are consistent in `src/types/core.ts` and `routeConfig.ts`.
- [ ] No contradiction with global ownership decisions in module docs and global docs.
- [ ] If module is placeholder, UI communicates not-ready state explicitly.

## Current Gate Expectation

- Expected gate result today: `PASS_WITH_P2 pending deep ACL regression evidence in module-local docs.`
- This is As-Is readiness, not target-state implementation readiness.

## Evidence Pointers

- `src/components/navigation/Sidebar/menuConfig.ts`
- `src/routes/routeConfig.ts`
- `src/routes/AppRoutes.tsx`
- `src/types/core.ts`
