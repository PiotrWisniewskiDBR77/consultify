## V8 Assessment Editor Deploy Blocker

Date: 2026-03-26
Scope: `C-04` assessment session/editor continuity

### Local code truth

This wave moved the full assessment editor/session core onto the bounded V8 lane locally:

- `AssessmentSessionEditorView` now prefers bounded V8 detail/update for:
  - session load
  - autosave
  - manual save
  - save-and-exit
  - rename
  - chat-context attachment
- shared `Api.getAssessmentSession()` now prefers bounded V8 detail
- shared `Api.updateAssessmentSession()` now prefers bounded V8 update

Residual legacy use inside the editor is still intentionally limited to:

- `/assessment-workflow-v2/:id/user-state`
- `/assessment-workflow-v2/:id/assignments`

### Local verification

- `tests/unit/services/v8-assessment-api.test.ts` -> passed
- `server/src/routes/v8/__tests__/assessment.routes.test.ts` -> passed
- lints for touched files -> clean

### Staging blocker

Two consecutive staging deploy attempts failed before a real build was created:

- `823f77a4-1e68-428f-90c6-8eec131426d6`
- `693b8b88-6dca-417f-a190-0218a7bb0004`

Railway reported the same deployment metadata error on both attempts:

- `Failed to create code snapshot. Please review your last commit, or try again.`
- `If this error persists, please reach out to the Railway team.`

Observed deployment truth:

- failed deployments had no associated build
- Railway fell back to a malformed `RAILPACK` manifest instead of the normal `railway.json` + `DOCKERFILE` path
- last healthy staging deployment remained `0f71289e-41ca-4117-b0a4-4efb7029714b`

### Operational conclusion

This was a deploy transport/snapshot blocker, not a discovered code regression.

It is now superseded by `evidence/95-v8-assessment-editor-continuity-proof.md`, which captures the later successful deploy after the upload payload was reduced.
