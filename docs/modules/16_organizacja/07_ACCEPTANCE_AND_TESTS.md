---
module_id: MODULE_ORGANIZATION
doc_kind: TESTS
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Acceptance & Tests — Organizacja

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

- Expected gate result today: `PASS_WITH_P2 (legacy/transitional overlap still present).`
- This is As-Is readiness, not target-state implementation readiness.

## Function-Level Acceptance Matrix

| Function | Acceptance focus | Runtime/code evidence | Status |
| --- | --- | --- | --- |
| `ORG_CONTEXT_WORKSPACE` | Canonical organization runtime is mounted | `AppRoutes.tsx` + `OrganizationView.tsx` | pass |
| `ORG_LEGACY_CONTEXT_BUILDER` | Transitional `/context/*` runtime remains mounted | `AppRoutes.tsx` + `ContextBuilderView` mapping | pass (`partial`) |

## Evidence Pointers

- `src/components/navigation/Sidebar/menuConfig.ts`
- `src/routes/routeConfig.ts`
- `src/routes/AppRoutes.tsx`
- `src/types/core.ts`
