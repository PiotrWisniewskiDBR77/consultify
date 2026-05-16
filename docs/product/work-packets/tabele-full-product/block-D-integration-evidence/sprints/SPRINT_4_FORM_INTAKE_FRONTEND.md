# Sprint 4 — Form Intake Frontend (Block D)

**Sprint ID:** `D-S4`
**Owner:** Agent B
**Status:** `EXECUTED — GO`
**Estimate:** ~1.5 days
**Epic:** EPIC-T14
**Closed:** 2026-05-08

## Goal

Surface the JWT-based form-intake workflow shipped in D-S2 to the operator
(admin) and recipient (public) audiences.

- Admin: a `KeyRound` action on each form card in `FormsIndex` opens
  `IntakeJwtPanel`. The panel hosts the field allow-list editor, JWT link
  issuance (subject + TTL), and a "copy URL / copy token" affordance.
- Recipient: a new public route `/public/forms/jwt/:token` mounts
  `PublicJwtFormPage`, which verifies the JWT, filters fields against the
  allow-list, and submits via the JWT endpoint.

The whole surface is dark by default behind both kill switches:
backend `ENABLE_TABLE_FORM_INTAKE_JWT` and client-side
`isTabeleFormIntakeEnabled()` (URL query, localStorage, or env override).

## Pre-sprint risk check

- D-P3 (unbranded form): the public JWT page reuses the slug page's chrome
  and rendering; both surfaces show "Powered by Consultify Table Platform".
- D-P4 (allow-list UX): the editor surfaces a clear "Empty allow-list falls
  back to the form's configured fields" hint and exposes Select-all / Clear
  shortcuts so the operator never gets stuck.
- D-S5 (XSS on rendered submissions): no untrusted strings flow into
  `dangerouslySetInnerHTML`; all rendering goes through React's escaped text
  paths and the existing `PublicFormFieldInput` (extracted in this sprint).

## CTO decisions applied

- **Q15** (right-rail share panel): unchanged for D-S4 — the form-intake
  surface lives inside the existing forms admin (`FormsIndex`), not the
  Tabele right rail. The rail's `share` slot remains the home for
  conversions only.
- **Q17** (parallel JWT public route): the recipient page consumes the new
  `/api/table-platform/public/forms/jwt/:token` endpoint and the legacy
  `/forms/:slug` route stays untouched. Both render through the same
  `PublicFormFieldInput` component for visual parity.

## Deliverables

### Created

- `consultify/src/components/MyWork/table/forms/IntakeJwtPanel.tsx`
  — admin modal panel with summary, allow-list editor, and JWT issuance.
- `consultify/src/components/MyWork/table/forms/PublicJwtFormPage.tsx`
  — recipient-facing page mounted at `/public/forms/jwt/:token`.
- `consultify/src/components/MyWork/table/forms/PublicFormFieldInput.tsx`
  — shared field renderer extracted from `PublicFormPage`.
- `consultify/src/utils/tabeleFormIntakeFlag.ts`
  — `isTabeleFormIntakeEnabled()` kill switch mirroring the backend flag.
- `consultify/src/components/MyWork/table/forms/__tests__/IntakeJwtPanel.test.tsx`
  — 6 component tests covering summary rendering, allow-list save,
  null-clear path, JWT issuance happy path, unpublished gate, and the
  close affordance.
- `consultify/src/components/MyWork/table/forms/__tests__/PublicJwtFormPage.test.tsx`
  — 4 component tests covering allow-list filtering, expiry warning,
  submission payload, and required-field validation.

### Updated

- `consultify/src/components/MyWork/table/forms/FormsIndex.tsx`
  — adds the `KeyRound` action, mounts `IntakeJwtPanel`, and gates the
  whole surface behind `isTabeleFormIntakeEnabled()`.
- `consultify/src/components/MyWork/table/forms/PublicFormPage.tsx`
  — refactored to consume the shared `PublicFormFieldInput` (no behaviour
  change; identical rendering).
- `consultify/src/routes/AppRoutes.tsx`
  — registers `/public/forms/jwt/:token` (lazy-loaded, no auth required).
- `consultify/src/services/api/tablePlatform.api.ts`
  — adds `FormIntakeContext`, `IssueFormIntakeJwtInput`, `IssuedFormIntakeJwt`,
  and 5 client functions (`getFormIntakeContext`, `issueFormIntakeJwt`,
  `setFormIntakeAllowList`, `getPublicFormByJwt`, `submitPublicFormByJwt`).

### Intentionally not changed

- `KimiWorkspaceShell.tsx` — no "Create intake form" button needed: the
  forms admin already has create + edit + share UX. Adding a duplicate
  launcher would violate `.cursor/rules/ai-actions-menu3.mdc`.
- `public/locales/{en,pl}/translation.json` — English copy only this sprint;
  `TBL-FU-D-1` already covers the en/pl sweep before D-S5.

## Sprint Exit Gate

- [x] Frontend lint clean on all D-S4 files (zero new errors / warnings).
- [x] DBR77 hex scan clean on `IntakeJwtPanel.tsx`, `PublicJwtFormPage.tsx`,
      and `PublicFormFieldInput.tsx` (no raw `#[0-9a-fA-F]{3,6}` literals).
- [x] Component tests green: `IntakeJwtPanel.test.tsx` (6/6) +
      `PublicJwtFormPage.test.tsx` (4/4).
- [x] Forms + Tabele lane regression green: 11 files / 67 tests.
- [x] Manual review: the public JWT page reuses the slug page's chrome and
      DBR77 palette; the admin panel is a focused modal with no overflow into
      adjacent UI; the only new admin action on the form card is a single
      `KeyRound` icon button.
- [x] XSS audit clean: no `dangerouslySetInnerHTML`; all submission data
      flows through React's escaped text rendering and the typed `data`
      payload accepted by the JWT route.
- [x] Recommendation: `GO` to D-S5.

## Outcome

`GO` to D-S5. See `evidence/sprint-4/validation-matrix-run.md`.
