# Documents / Reports / Outputs Sprint 5 Runtime Gate - 2026-05-15

## Verdict

`PASS_WITH_BUSINESS_MANUAL_FOLLOWUP`

Sprint 5 closes the developer-side runtime preflight for Documents, Reports, and Outputs Library. Reports quality-gate contracts pass, Outputs Library canonical artifact wiring passes, Document Studio targeted UI/share-link coverage passes, staging routes are available, and the production build succeeds.

The full Business Owner Document Studio Mode 1 flow remains intentionally open for manual acceptance: `intake -> plan -> generate -> preview -> export DOCX/PDF`.

## Scope

- Outputs Library canonical hub and legacy reports route availability.
- Reports export quality-gate contract.
- Document Studio MELS shell and share-link runtime coverage.
- Staging route/API availability for `/presentations`, `/reports`, `/reports/management`, and `/document-studio`.

## Fix Applied

The local Outputs Library L4 harness initially failed before test execution while importing the server:

`Error: .partial() cannot be used on object schemas containing refinements`

Root cause: `UpdateInitiativeSchema` called `.partial()` on `CreateInitiativeSchema`, which carries a Zod refinement. The fix extracts the shared initiative payload object into `InitiativePayloadBaseSchema`, keeps the create-time `sourceType/sourceId` refinement on `CreateInitiativeSchema`, and builds `UpdateInitiativeSchema` from the unrefined base object.

This preserves create validation while allowing partial updates to import under Zod v4.

## Validation Evidence

- `npm run smoke:v3:reports-quality` -> PASS
  - export endpoints enforce quality gates before file generation
  - outline API keeps compatibility for sections and variants
  - export panel reads backend quality gates and blocks export on errors
- `npm run test:l4:local:outputs-library` -> `1/1 PASS`
  - `Outputs Library — canonical artifacts`
  - Mine tab renders rows from canonical `GET /api/artifacts?view=mine`
- Targeted Document Studio tests -> `25/25 PASS`
  - `DocumentStudioDocumentPanel.test.tsx` -> `5/5 PASS`
  - `document-studio-share-links.routes.test.ts` -> `20/20 PASS`
- Validator targeted run -> no validator test files found, command exited `0` with `--passWithNoTests`
- Production build -> PASS

## Staging Route/API Probe

Target: `https://demo.consultify.ai`

- `GET /presentations` -> `200`
- `GET /reports` -> `200`
- `GET /reports/management` -> `200`
- `GET /document-studio` -> `200`
- `GET /document-studio/__probe__` -> `200`
- `GET /api/document-studio/policy` unauthenticated -> `401 No token provided`

The route probe confirms the user-facing app routes are available and the Document Studio API is auth-gated.

## Remaining Risk

- `docs/modules/09_outputs` and `docs/modules/10_dokumenty` remain `status: draft`.
- Document Studio Mode 1 still needs Business Owner manual evidence for intake, planning, generated preview, DOCX/PDF export, refresh/read-back, and honest failure behavior.
- Legacy `/reports*` currently returns the app shell on staging; browser-level redirect semantics should be covered in the manual business gate before promoting module docs to release truth.
