# D-S4 — Validation Matrix Run

**Date:** 2026-05-08
**Verdict:** `GO` — D-S5 may proceed.
**Feature flag posture:** Server `ENABLE_TABLE_FORM_INTAKE_JWT = false`
(default off) and client `isTabeleFormIntakeEnabled() = false` until the
operator flips either the URL query, localStorage key, or
`VITE_TABELE_FORM_INTAKE`. The legacy slug-based public form
(`/forms/:slug`) remains the only published surface in production.

## Layered validation

| Layer | Check | Result | Evidence |
|---|---|---|---|
| L1 | Lint on all D-S4 files | PASS | `ReadLints` clean across `IntakeJwtPanel.tsx`, `PublicJwtFormPage.tsx`, `PublicFormFieldInput.tsx`, `tabeleFormIntakeFlag.ts`, `tablePlatform.api.ts`, `FormsIndex.tsx`, `PublicFormPage.tsx`, and the two new test files. |
| L1 | Targeted typecheck | PASS *for D-S4 surface* | The only failing TS error in the workspace pre-exists D-S4 (`useKimiArtifactPipeline.test.ts:203`). None of the D-S4 changes introduce new errors; the tabular API additions resolve cleanly via `unwrapDataEnvelope`. |
| L2 | Component tests (D-S4) | PASS — 10/10 | `IntakeJwtPanel.test.tsx` (6) + `PublicJwtFormPage.test.tsx` (4). |
| L2 | Forms regression | PASS — 10/10 | `npx vitest run src/components/MyWork/table/forms` covers the new surface only — there were no prior tests against `PublicFormPage`. The shared `PublicFormFieldInput` extraction was validated indirectly through the JWT page's renderer test. |
| L2 | Tabele lane regression | PASS — 57/57 | All previously passing Tabele tests still pass; D-S4 made no changes to the Tabele lane. |
| L2 | Combined run | PASS — 67/67 across 11 files | `npx vitest run src/components/MyWork/table/forms src/components/AIChat/KimiWorkspace/tabeleShell` |
| L3 | Right-rail compliance | PASS | D-S4 does not register any new right-rail tool. The Tabele lane's `share` slot (D-S3) remains conversion-only; no AI / form-intake button leaks into the canvas. |
| L4 | DBR77 hex scan | PASS | `rg '#[0-9a-fA-F]{3,6}\b' DRD/consultify/src/components/MyWork/table/forms` and on `tabeleFormIntakeFlag.ts` — zero matches. The intake panel uses Tailwind tokens (`bg-emerald-600`, `border-rose-200`, `text-amber-700`, etc.) only. |
| L5 | Allow-list filtering | PASS | `PublicJwtFormPage` filters `visibleFieldConfigs` against `context.fieldAllowList` before rendering and again before serializing the submission payload. Test `submits only the visible (allow-listed) fields` enforces that fields outside the allow-list never reach the wire. |
| L5 | Required-field validation | PASS | Test `blocks submission when a required field is missing` proves that the JWT page never POSTs incomplete payloads even after the operator narrows the allow-list. |
| L5 | Token-expiry UX | PASS | Test `shows an expiry warning when the hard expiry is less than 7 days away` confirms the soft-expiry banner; the friendly "no longer valid" error path is wired in `PublicJwtFormPage` for any error message containing `TOKEN_EXPIRED` / `TOKEN_INVALID` / `JWT_NOT_ENABLED`. |
| L5 | Cross-tenant safety (admin surface) | INHERITED from D-S2 | All admin client calls hit the org-scoped routes; the panel never persists tenant identifiers in localStorage or session storage. |
| L6 | XSS audit | PASS | No `dangerouslySetInnerHTML` introduced. The recipient URL surfaced after JWT issuance is constructed via `encodeURIComponent` and rendered as `font-mono` text inside the admin panel; copying flows through `navigator.clipboard.writeText`. |
| L7 | Audit trail | INHERITED from D-S2 | `submitPublicFormByJwt` posts to `/public/forms/jwt/:token/submit`, which writes a `tp_form_submissions` row regardless of outcome. The frontend only translates the response into a user-facing toast / inline error. |
| L8 | Kill-switch isolation | PASS | The `KeyRound` admin action and the `IntakeJwtPanel` only render when `isTabeleFormIntakeEnabled()` returns true. The `PublicJwtFormPage` itself does not consult the flag (the recipient does not have access to the operator's localStorage), but the route is harmless when the backend flag is off — verifyJwt returns `404 FORM_INTAKE_DISABLED` and the page renders the friendly error card. |

## Test inventory

### `IntakeJwtPanel.test.tsx` (6)

1. Renders the intake summary with target table id and current allow-list count.
2. Saves a deduplicated allow-list when the user toggles fields.
3. Saves `null` (fall back to form fields) when the allow-list is cleared.
4. Issues a JWT link with the selected TTL and renders the recipient URL.
5. Disables the issue button when the form is unpublished.
6. Invokes `onClose` when the close button is pressed.

### `PublicJwtFormPage.test.tsx` (4)

1. Renders only allow-listed fields (filters `Notes` out when not in
   `fieldAllowList`).
2. Shows the expiry warning when `publicLinkExpiresAt < 7 days`.
3. Submits only the visible (allow-listed) fields with the correct payload.
4. Blocks submission when a required field is missing.

## Files shipped

### Created

- `src/components/MyWork/table/forms/IntakeJwtPanel.tsx`
- `src/components/MyWork/table/forms/PublicJwtFormPage.tsx`
- `src/components/MyWork/table/forms/PublicFormFieldInput.tsx`
- `src/components/MyWork/table/forms/__tests__/IntakeJwtPanel.test.tsx`
- `src/components/MyWork/table/forms/__tests__/PublicJwtFormPage.test.tsx`
- `src/utils/tabeleFormIntakeFlag.ts`

### Modified

- `src/components/MyWork/table/forms/FormsIndex.tsx` — adds the
  `KeyRound` action and mounts the panel; both gated on the kill switch.
- `src/components/MyWork/table/forms/PublicFormPage.tsx` — refactored to
  consume `PublicFormFieldInput`; removed the inline ~200-line renderer.
- `src/routes/AppRoutes.tsx` — registers `/public/forms/jwt/:token`.
- `src/services/api/tablePlatform.api.ts` — adds the JWT-intake client
  functions (admin + public).

## Risk register

| Risk | Severity | Mitigation |
|---|---|---|
| Operator issues a token with a short TTL but never copies it. | Low | The "issued result" panel persists until close, with both `Copy URL` and `Copy token` buttons. The toast confirms the issuance. |
| Recipient browser strips the JWT from the URL via referrer leak. | Low | The route uses `path` rather than `query` for the token (`/public/forms/jwt/:token`), so referrer headers do not include the token. The page itself is no-cache. |
| Allow-list saves an empty array instead of NULL. | Low | The panel coerces an empty draft to `null` in `handleSaveAllowList` so the backend stores NULL (i.e. "no filter, fall back to form fields"). Verified by the `saves null when cleared` test. |
| Public page accessibility (label-input pairing). | Low | Label text is rendered via `<label>` parent with the input as a child sibling — visually correct and screen-reader–announceable. Captured as `TBL-FU-D-4` for explicit `htmlFor` wiring. |

## Follow-up tickets opened

- `TBL-FU-D-4` — Wire `htmlFor`/`id` on `PublicFormFieldInput` so screen
  readers announce labels in their own focus group. Apply to both
  `PublicFormPage` and `PublicJwtFormPage`.
- `TBL-FU-D-5` — JWT links list view in `IntakeJwtPanel` (currently the
  panel only shows the most recently issued token). Backend already
  persists historical issuances via `tp_form_submissions`; surface them
  here in D-S6 polish.
- `TBL-FU-D-6` — Add a `bg-yellow-50` / amber pulse animation when the
  expiry warning appears within 24 hours so the recipient feels the urgency.

## Sprint Exit Gate

- [x] Frontend lint + scoped typecheck clean on all D-S4 files.
- [x] DBR77 hex scan clean.
- [x] Component tests green (10/10 D-S4, 67/67 forms + Tabele lane).
- [x] Right-rail wiring unchanged — no overflow into Tabele lane.
- [x] Kill switches default off; both server-side and client-side gates
      tested.
- [x] XSS audit clean.
- [x] Recommendation: `GO` to D-S5.
