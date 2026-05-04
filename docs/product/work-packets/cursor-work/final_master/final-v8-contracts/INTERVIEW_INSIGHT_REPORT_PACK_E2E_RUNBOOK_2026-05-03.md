# Interview Insight Report Pack E2E Runbook - 2026-05-03

> Purpose: manual product verification before treating Interview Insight Report Pack as client-ready.
> Status: ready for manual QA.
> Source of truth: `DRD/UI_UX_SOURCE_OF_TRUTH.md`.

---

## Decision Vocabulary

Use these outcomes exactly:

- `PASS`: no known P0/P1, the core flow works, refresh survives writes, and audit/read-back is visible.
- `PASS_WITH_P2`: the core flow works, but there are quality, copy, UX, fixture, or secondary workflow issues.
- `BLOCKED_P1`: the main workflow is broken, writes do not persist, a gate lies, a mutation has no audit, or a critical action crashes.
- `INCONCLUSIVE`: the tester cannot prove the result because of account, data, environment, fixture, or unclear UI limitations.

Severity reminders:

- `P0`: silent mutation, hidden learning, cross-tenant leakage, fake success, missing audit for critical mutation, crash/hang on critical path.
- `P1`: no save/read-back, broken main action, infinite spinner, HTTP 500 without honest degraded UI, missing traceability for business decisions.
- `P2`: confusing copy, weak empty state, poor discoverability, missing helper UI, slow but recoverable flow.

---

## Preconditions

Use one organization and keep evidence tenant-scoped.

Required data:

- At least one completed and approved Interview session set.
- Enough answers to produce themes, issues, opportunities, and evidence.
- One user with `INTERVIEW_INSIGHTS_VIEW`.
- One user with `INTERVIEW_INSIGHTS_REVIEW`.
- One user with `INTERVIEW_INSIGHTS_PUBLISH`.

Recommended fixture:

- 2-4 completed interview sessions.
- 8+ useful answers.
- At least two respondent roles or departments.
- Some real evidence snippets, not only empty placeholders.

Do not start the final pass with demo-only data unless the result is marked `INCONCLUSIVE`.

---

## Evidence To Capture

For each run capture:

- Browser URL and visible org/user identity.
- Screenshot of the created insight.
- Screenshot of the Report Pack card with 15 worksheets.
- Screenshot of readiness gate before and after worksheet edits.
- Screenshot of `source_register` or `appendix_provenance` showing organization context documents when context docs are selected.
- Screenshot of downstream `Next Actions` confirmation/read-back before creating any artifact.
- Network evidence for these endpoints when available:
  - `GET /api/v8/interview/insights/:id/report-pack`
  - `GET /api/v8/interview/insights/:id/report-pack/readiness`
  - `PATCH /api/v8/interview/insights/:id/report-pack/worksheets/:worksheetKey`
  - `POST /api/v8/interview/insights/:id/report-pack/submit-review`
  - `POST /api/v8/interview/insights/:id/report-pack/publish`
  - `GET /api/v8/interview/insights/:id/report-pack/export-manifest`
  - `GET /api/v8/interview/insights/:id/report-pack/export-markdown`
  - `POST /api/v8/interview/insights/:id/report-pack/revisions`
- Activity feed screenshot after worksheet update, review, publish, export, and revision.
- Downloaded manifest JSON and visible `manifestHash`.
- Downloaded Markdown report and visible `sourceManifestHash` / `exportHash`.
- Downstream artifact conversion evidence, if a report/deck/table/idea/note/initiative is created.
- Console errors, if any.

---

## Core E2E Path

### 1. Create Or Open Insight

Steps:

1. Log in as a user who can create or view Interview insights.
2. Create an insight from completed/approved sessions, or open an existing completed insight.
3. Confirm the insight loads without repeated spinner or raw backend error.

Expected:

- Insight has a stable URL.
- Summary/material/evidence sections load or show honest degraded states.
- No cross-tenant data is visible.

Fail as:

- `BLOCKED_P1` if the insight cannot load, crashes, or shows wrong tenant data.
- `INCONCLUSIVE` if source sessions are missing or fixture is invalid.

### 2. Generate And Read Report Pack

Steps:

1. Open `Report Pack` section.
2. Confirm the pack is created/read.
3. Count worksheets.
4. Refresh the page and reopen `Report Pack`.

Expected:

- Exactly 15 required worksheets are visible.
- Each worksheet has status, completeness score, row count, and warnings if applicable.
- Empty/degraded worksheets are shown honestly.
- Refresh does not remove the pack.

Fail as:

- `BLOCKED_P1` if pack disappears after refresh or the main card cannot load.
- `PASS_WITH_P2` if all data loads but copy/layout is confusing.

### 3. Worksheet Edit And Read-Back

Steps:

1. Pick one worksheet.
2. Change status to `Partial`.
3. Refresh page.
4. Reopen `Report Pack`.
5. Open activity feed.

Expected:

- Status persists after refresh.
- Readiness changes if the edit affects blockers/warnings.
- Activity feed shows a worksheet update entry.
- No duplicate or silent state change occurs.

Fail as:

- `BLOCKED_P1` if edit appears successful but disappears after refresh.
- `P0` if mutation occurs without an audit entry.

### 4. Readiness Gate

Steps:

1. Observe readiness gate state.
2. If there are blockers, inspect blocker messages.
3. Mark enough worksheets as generated/complete to reach `ready_for_review`.

Expected:

- Gate shows `BLOCKED_P1`, `PASS_WITH_P2`, or `PASS`.
- Blockers/warnings are specific enough to act on.
- Gate does not claim readiness while required worksheets are empty/degraded.

Fail as:

- `P0` if gate shows fake success while blockers exist.
- `P1` if gate is unavailable with no honest degraded UI.

### 5. Submit For Review

Steps:

1. Try `Submit for review` while blockers exist.
2. Remove blockers.
3. Submit again.
4. Refresh.
5. Open activity feed.

Expected:

- Blocked attempt does not transition status.
- Successful attempt moves pack to `in_review`.
- Activity feed includes review submission or review block.

Fail as:

- `P0` if blocked attempt silently changes status.
- `P1` if successful submit does not persist after refresh.

### 6. Publish Gate

Steps:

1. Try to publish before review where possible.
2. Publish an `in_review` pack with full readiness `PASS`.
3. Refresh.
4. Open activity feed.

Expected:

- Publish is blocked unless status is `in_review`.
- Publish is blocked unless readiness is full `ready_for_review`.
- Successful publish changes status to `published`.
- Activity feed includes publish block or publish success.

Fail as:

- `P0` if publish succeeds while gate says blocked.
- `P1` if published status does not persist.

### 7. Published Immutability

Steps:

1. After publish, try changing a worksheet status.
2. If UI disables the button, verify that state is clear.
3. Optionally attempt direct API mutation with the same user.

Expected:

- UI explains that published pack is locked.
- Backend rejects worksheet edit with `409 INTERVIEW_REPORT_PACK_IMMUTABLE`.
- Activity feed shows blocked worksheet update if direct mutation is attempted.

Fail as:

- `P0` if a published pack can be edited with no revision/audit.
- `P1` if UI says locked but backend allows edit.

### 8. Export Manifest

Steps:

1. Click `Download manifest` after publish.
2. Inspect downloaded JSON.
3. Refresh and open activity feed.

Expected:

- Draft/in-review exports are blocked with `409 INTERVIEW_REPORT_PACK_EXPORT_BLOCKED`.
- Published export downloads JSON.
- Manifest includes:
  - `reportPackId`
  - `insightId`
  - `status: published`
  - `manifestHash`
  - `readiness`
  - `worksheetCount`
  - `worksheets`
- Activity feed includes export event and hash prefix.

Fail as:

- `P0` if export is allowed before publish as client-ready.
- `P1` if export has no audit trail.

### 9. Export Client Markdown Report

Steps:

1. Click `Download report MD` after publish.
2. Inspect downloaded Markdown.
3. Refresh and open activity feed.
4. Try the same endpoint or button on a draft/in-review pack if possible.

Expected:

- Draft/in-review Markdown export is blocked with `409 INTERVIEW_REPORT_PACK_EXPORT_BLOCKED`.
- Published export downloads a `.md` file.
- Markdown includes:
  - `Report Pack ID`
  - `Insight ID`
  - `Status: published`
  - `Source manifest hash`
  - `Completeness`
  - `Readiness`
  - all worksheet sections
  - degraded/readiness warnings when present
- Activity feed includes client-ready Markdown export event and `exportHash` prefix.

Fail as:

- `P0` if Markdown export is allowed before publish as client-ready.
- `P1` if Markdown export has no audit trail or omits source hash.
- `PASS_WITH_P2` if Markdown is complete but visual polish is not client-grade enough.

### 10. Context Document Provenance

Steps:

1. Create or open an insight generated with selected organization/project context documents.
2. Open `Report Pack`.
3. Inspect `source_register`.
4. Inspect `appendix_provenance`.
5. Use a fixture with at least one ready/used document and, if possible, one selected document with no used chunks or inaccessible document.

Expected:

- Context documents appear as `organization_context_document` rows.
- Used documents show `usageStatus: used_in_generation`.
- Selected-but-unused documents show `usageStatus: selected_not_used`.
- Inaccessible/missing requested documents show `usageStatus: not_used`.
- Degraded context state produces visible worksheet warning.
- UI does not imply that a document was used when only metadata was available.

Fail as:

- `P0` if cross-tenant document metadata/content is visible.
- `P1` if context is silently omitted while UI implies it influenced the report.
- `PASS_WITH_P2` if lineage exists but copy is hard to understand.

### 11. Six Downstream Actions

Steps:

1. Open `Next Actions`.
2. For document actions, open each generator:
   - report
   - deck
   - table
3. Confirm that no artifact is created before the confirmation checkbox is selected.
4. Confirm read-back/downstream warnings include Report Pack lineage/limits where relevant.
5. Create one document artifact if the environment supports it.
6. For app actions, open each confirmation modal:
   - idea
   - note
   - initiative
7. Confirm no mutation occurs until read-back checkbox is selected.
8. Create one app artifact if the environment supports it.
9. Verify artifact conversion/audit/lineage includes insight id, evidence refs, source pack, and Report Pack context.

Expected:

- All six actions are discoverable.
- All mutating actions require explicit confirmation.
- Created app objects are draft/proposal/intake objects, not silently approved work.
- Downstream payload includes `actionContract` and Report Pack lineage.
- Report Pack degraded/readiness warnings stay visible before creation.

Fail as:

- `P0` if any downstream artifact is created without explicit confirmation.
- `P1` if a required action is missing or mutation has no lineage/audit.
- `PASS_WITH_P2` if actions work but navigation/copy is confusing.

### 12. Create Revision

Steps:

1. From a published pack, click `New draft from published`.
2. Confirm pack returns to editable `draft`.
3. Edit one worksheet.
4. Refresh.
5. Open activity feed.

Expected:

- Revision is blocked unless pack is `published`.
- Published snapshot is preserved in `interview_report_pack_revisions`.
- Activity feed shows revision version and base hash.
- New draft can be edited and follows readiness/review/publish gates again.

Fail as:

- `P0` if revision overwrites published evidence without snapshot.
- `P1` if new draft cannot be edited or revision action does not persist.

---

## API Smoke Checks

Use these only after UI checks or when UI behavior is unclear.

Expected response patterns:

- `GET /report-pack`: `200`, returns `reportPack`.
- `GET /report-pack/readiness`: `200`, returns `readiness`.
- `PATCH /worksheets/:key`: `200` for draft/in_review, `409 INTERVIEW_REPORT_PACK_IMMUTABLE` for published.
- `POST /submit-review`: `200`, `result.blocked` truthfully reflects gate.
- `POST /publish`: `200`, `result.blocked` truthfully reflects gate.
- `GET /export-manifest`: `200` for published, `409 INTERVIEW_REPORT_PACK_EXPORT_BLOCKED` for draft/in_review.
- `GET /export-markdown`: `200` for published, `409 INTERVIEW_REPORT_PACK_EXPORT_BLOCKED` for draft/in_review.
- `POST /revisions`: `200` for published, `409 INTERVIEW_REPORT_PACK_REVISION_BLOCKED` otherwise.
- Downstream conversion: target creation endpoint is followed by `/artifact-conversions/record` with `actionContract`.

---

## Business Quality Review

After technical PASS, review content quality:

- Executive summary says what happened, why it matters, and what to do next.
- Evidence register contains usable snippets or honest missing evidence.
- Source register and provenance identify used/not-used organization context documents.
- Findings are not generic.
- Recommendations map to findings/opportunities.
- Open questions reflect actual gaps.
- Material quality honestly describes weak source coverage.
- Recommendations are downgraded to hypotheses/review-required when material quality is weak.
- Markdown report can be read by a client without exposing raw backend internals.
- Consultant can explain the report to a client without reading raw internals.

Classify:

- `PASS`: client-facing narrative is coherent and evidence-backed.
- `PASS_WITH_P2`: structurally correct, but copy needs polish or some worksheets feel thin.
- `BLOCKED_P1`: recommendations/findings are misleading, unsupported, or dangerously generic.
- `INCONCLUSIVE`: source data is too thin to judge business quality.

---

## Manual Evidence Record

Fill this section during the actual run. Do not pre-fill it from automated tests.

Run metadata:

- Date/time:
- Environment:
- Organization/tenant:
- Tester:
- User/role:
- Insight ID:
- Report Pack ID:
- Published manifest hash:
- Markdown export hash:

Evidence checklist:

- Insight screenshot:
- Report Pack screenshot:
- Readiness gate screenshot:
- Source register/provenance screenshot:
- Activity feed screenshot:
- Manifest file retained:
- Markdown file retained:
- Network/API evidence retained:
- Console evidence retained:
- Refresh resistance checked:
- Downstream action confirmation checked:

Decision:

- Result: `PASS` / `PASS_WITH_P2` / `BLOCKED_P1` / `INCONCLUSIVE`
- P0 findings:
- P1 findings:
- P2 findings:
- Accepted limitations:
- Follow-up owner:

---

## Final Acceptance Gate

Mark the Report Pack flow as `PASS` only if all are true:

- 15 worksheets are visible and refresh-resistant.
- Worksheet edits persist and audit.
- Readiness gate blocks honestly.
- Submit for review is gated and auditable.
- Publish is gated and auditable.
- Published pack is immutable.
- Export manifest is available only after publish.
- Export manifest has `manifestHash` and audit.
- Markdown report export is available only after publish.
- Markdown report has `sourceManifestHash`, `exportHash`, worksheet content, and audit.
- Organization context documents are traceable as used, selected-not-used, or not-used.
- Six downstream actions require confirmation and preserve Report Pack lineage.
- Revision creates a new editable draft from a preserved published snapshot.
- Activity feed gives readable evidence for all critical mutations.
- No P0/P1 found in the run.

If any critical evidence is missing, mark `INCONCLUSIVE`, not `PASS`.
