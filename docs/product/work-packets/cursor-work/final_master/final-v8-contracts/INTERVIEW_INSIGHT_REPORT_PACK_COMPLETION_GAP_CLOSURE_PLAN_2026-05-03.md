# Interview Insight Report Pack - Gap Closure Plan

Date: 2026-05-03
Status: implementation complete; automated closeout passed; manual fixture execution still required
Parent plan: `MDI_INTERVIEW_INSIGHT_REPORT_PACK_COMPLETION_PLAN_2026-05-03.md`
Manual runbook: `INTERVIEW_INSIGHT_REPORT_PACK_E2E_RUNBOOK_2026-05-03.md`

---

## 1. Current State

The Report Pack governance spine is implemented:

- Persistent `interview_report_packs`.
- Persistent `interview_report_pack_worksheets`.
- Persistent `interview_report_pack_revisions`.
- 15 required worksheets.
- Worksheet status editing.
- Worksheet audit log.
- Activity read-back.
- Readiness gate.
- Submit for review.
- Publish gate.
- Published immutability.
- Client-ready JSON export manifest.
- Client-ready Markdown report export.
- Export audit.
- Stable `manifestHash`.
- Stable Markdown `exportHash`.
- Create editable draft revision from published pack.
- Scope integrity filters for respondent, role, department, template, date, and approved-only source material.
- Option honesty for output types and analysis modes.
- Versioned structured generation contract.
- Material Quality confidence downgrade and recommendation posture.
- Six downstream actions with confirmation and Report Pack lineage.
- Organization context document provenance in source/provenance worksheets.
- Manual E2E runbook.
- Targeted Playwright smoke for Report Pack governance UI.

This means the core artifact lifecycle is now controlled:

`draft -> readiness -> in_review -> published -> export manifest/export markdown -> downstream actions/revision draft`

Remaining work is no longer about implementing the Report Pack mechanics. It is about executing the manual E2E run on a real fixture before claiming full product `PASS`.

Automated closeout status:

- Gap A Scope Integrity: implemented and covered by targeted tests.
- Gap B Option Honesty: implemented and covered by targeted tests.
- Gap C Structured Insight Schema: implemented and covered by targeted tests.
- Gap D Material Quality Depth: implemented and covered by targeted tests.
- Gap E Six Downstream Actions: implemented as controlled, confirmed downstream actions with lineage and covered by targeted tests.
- Gap F Organization Context Lineage: implemented in Report Pack source/provenance worksheets and covered by targeted tests.
- Gap G Client Export Formats: first client-ready Markdown report export implemented and covered by service/API tests plus targeted Playwright UI smoke.
- Gap H Manual E2E Fixture Execution: still open. This cannot be marked `PASS` from automated evidence alone.

Automated evidence captured on 2026-05-03:

- Targeted Vitest transition suite: `80` tests passed across service, API route, and component governance coverage.
- Targeted Playwright Report Pack governance smoke: `1` Chromium test passed for published readiness display and governed Markdown export.
- Existing broad Interview Playwright smoke remains `INCONCLUSIVE` on mock DB/harness stability and should not be used as the final product `PASS` gate.

---

## 2. Remaining Gap Summary

### Gap A - Scope Integrity

Risk:

- Report Pack may be structurally correct while source material used by generation does not perfectly match selected filters.

Needs:

- Prove that selected sessions/respondents/roles/departments/templates/date range are exactly the material used in prompt/source pack/report source register.

Blocking level:

- `P1` if mismatch exists.

Target outcome:

- `G1 Scope Integrity` and `G2 Approved-Only` can be marked `PASS`.

### Gap B - Analysis Mode / Output Type Honesty

Risk:

- UI may expose analysis/output options that are stored but do not change backend behavior.

Needs:

- Either wire each visible option to backend prompt/service behavior or disable/remove cosmetic choices.

Blocking level:

- `P1` if UI suggests behavior that does not exist.

Target outcome:

- `G3 Option Honesty` can be marked `PASS`.

### Gap C - Structured Insight Schema Completeness

Risk:

- Report Pack generator maps from available insight fields, but the LLM generation contract is not yet a fully versioned report-pack schema.

Needs:

- Introduce/confirm schema version.
- Normalize sections used by all worksheets.
- Add contract tests for generated structure.
- Preserve old insight compatibility.

Blocking level:

- `P1` if fake completeness is produced from missing structured data.

Target outcome:

- Report worksheets are populated from explicit machine-usable sections, not accidental field shapes.

### Gap D - Material Quality Depth

Risk:

- Material quality is visible, but may not yet cover all consulting dimensions from the MDI plan.

Needs:

- Coverage by role/department/template/date.
- Thin answer detection.
- Missing voices.
- Contradiction density.
- Evidence sufficiency.
- Recommendation confidence downgrade when material is weak.

Blocking level:

- `P1` if weak material is presented as decision-ready.
- `P2` if only copy/visual explanation is weak.

Target outcome:

- `G5 Material Quality Honesty` can be marked `PASS`.

### Gap E - Six Downstream Actions

Risk:

- Report Pack is governed, but the six downstream actions are not fully verified/implemented from the pack context.

Required actions:

- Report.
- Presentation.
- Table/sheet.
- Idea.
- Note.
- Initiative draft.

Needs:

- Explicit approval before mutation.
- Draft status for app objects.
- Lineage to insight/report/finding.
- No silent object creation.

Blocking level:

- `P0` if app objects are silently created.
- `P1` if core expected action is unavailable.

Target outcome:

- `G7 No Silent Execution` and Phase 9 can be marked `PASS`.

### Gap F - Organization Context Lineage

Risk:

- External documents may influence insight/report without enough visible lineage, or may be shown as used when only metadata exists.

Needs:

- Context document status shown honestly.
- Report provenance identifies used/not-used context.
- ACL/tenant scope verified.
- No fake success on unreadable documents.

Blocking level:

- `P0/P1` depending on tenant/silent/fake-success risk.

Target outcome:

- `G8 Context Honesty` can be marked `PASS`.

### Gap G - Client Export Formats

Risk:

- JSON manifest is auditable, but not the final client-facing report artifact.

Needs:

- Decide first client format:
  - DOCX/PDF report, or
  - XLSX workbook, or
  - presentation deck.
- Use manifest as the canonical input.
- Preserve `manifestHash` in export metadata.
- Export degraded reports with visible warning.

Blocking level:

- `P2` if JSON manifest is accepted as interim internal export.
- `P1` if business expects client-ready file now.

Target outcome:

- Client can receive a polished report artifact with provenance.

### Gap H - Manual E2E Fixture Execution

Risk:

- Automated tests prove contracts, but no real UI/data run has validated product sense.

Needs:

- Execute `INTERVIEW_INSIGHT_REPORT_PACK_E2E_RUNBOOK_2026-05-03.md`.
- Use real-ish fixture with strong/thin answers, contradictions, missing voices.
- Capture UI, Network/API, Console, refresh resistance, activity feed evidence.

Blocking level:

- Cannot claim final `PASS` without this.

Target outcome:

- Manual result classified as `PASS`, `PASS_WITH_P2`, `BLOCKED_P1`, or `INCONCLUSIVE`.

---

## 3. Implementation Order

### Step 1 - Scope Integrity Audit And Fixes

Files to inspect:

- `src/components/Interview/InsightCreatorModal.tsx`
- `src/services/api/v8/interview.ts`
- `server/src/routes/v8/interview.routes.ts`
- `server/src/services/InterviewInsightService.ts`
- `server/src/services/interviewInsightReportPackService.ts`

Tasks:

- Trace selected filters from UI payload to backend generation.
- Confirm `fetchSessionData` uses selected sessions and allowed statuses.
- Confirm respondent/role/department/template/date filters affect fetched material.
- Add or repair material pack summary in generation context.
- Ensure `source_register` worksheet reflects only in-scope material.

Tests:

- Respondent filter excludes other respondents.
- Role filter excludes other roles.
- Department filter excludes other departments.
- Template/date filters exclude out-of-scope sessions.
- Approved-only still blocks invalid source material.

DoD:

- Prompt/source pack/report source register agree.
- No unapproved or out-of-scope material enters report generation.

### Step 2 - Option Honesty

Tasks:

- Inventory all visible analysis mode/output type controls.
- Mark each as:
  - implemented,
  - stored-only,
  - cosmetic,
  - unused.
- For cosmetic/unused controls, either wire backend behavior or disable/remove UI.
- Update copy so user understands what affects analysis.

Tests:

- Selected mode reaches API/service.
- Mode appears in `analysis_scope_json`.
- Backend prompt/context changes or UI does not claim it does.

DoD:

- No visible option suggests behavior that is not implemented.

### Step 3 - Structured Generation Schema

Tasks:

- Define report-pack schema version in generation context.
- Normalize generated sections for all 15 worksheets.
- Add parse/normalization safeguards.
- Keep compatibility with old insight rows.

Tests:

- Fixture insight generates normalized structure.
- Malformed/missing sections degrade honestly.
- Old insight still opens.

DoD:

- Report Pack does not rely on accidental freeform fields for core worksheets.

### Step 4 - Material Quality Completion

Tasks:

- Expand material quality dimensions.
- Surface weak-material warning in executive summary and material quality worksheet.
- Downgrade recommendations to hypotheses when evidence/material quality is weak.

Tests:

- Thin material produces lower confidence/degraded warnings.
- Strong material can pass without false warnings.
- Recommendations remain labeled.

DoD:

- Weak material cannot appear decision-ready.

### Step 5 - Six Downstream Actions

Tasks:

- Add/verify actions for report, presentation, table/sheet, idea, note, initiative draft.
- Require explicit approval for mutations.
- Store lineage to report pack, insight, finding/candidate, and manifest hash where relevant.

Tests:

- Each action is visible only when allowed.
- Mutating actions create drafts only.
- Activity/audit exists.
- Lineage is visible or retrievable.

DoD:

- No silent downstream execution.

### Step 6 - Organization Context Lineage

Tasks:

- Confirm selected context documents reach insight generation.
- Add report provenance rows for context docs used/not used.
- Show unreadable/processing/policy/quota states honestly.

Tests:

- Ready doc can be used with lineage.
- Unreadable doc does not produce fake success.
- Cross-tenant doc cannot be used.

DoD:

- Context is honest, ACL-safe, and traceable.

### Step 7 - Client Export Format

Tasks:

- Pick first polished format.
- Generate from export manifest, not directly from mutable UI state.
- Embed/attach `manifestHash`.
- Keep degraded warnings visible.

Tests:

- Published pack exports client artifact.
- Draft/in_review cannot export client-ready artifact.
- Exported artifact matches manifest hash/source.

DoD:

- Client-ready export exists beyond JSON manifest.

### Step 8 - Manual E2E Fixture Run

Tasks:

- Execute the runbook.
- Record evidence and final classification.
- Fix any P0/P1 before claiming `PASS`.

DoD:

- Manual run result is documented.
- No P0/P1 remains.

---

## 4. Current Recommended Next Step

Start with **Step 1 - Scope Integrity Audit And Fixes**.

Reason:

- Report Pack lifecycle is already governed.
- If scope integrity is wrong, the whole report can be beautifully controlled but still based on the wrong material.
- This is a `P1` risk in the original MDI plan.

First implementation target:

- Trace and test that `analysisScope` filters affect actual material fetched by `InterviewInsightService`.
- Add missing tests before touching UI polish or export formats.

---

## 5. Final Completion Criteria

The original MDI plan can be marked complete only when:

- Scope integrity is proven.
- Option honesty is proven.
- Structured insight schema is stable enough for all worksheets.
- Material quality blocks/downgrades weak recommendations.
- Six downstream actions are governed.
- Context document usage is honest and traceable.
- Client export format exists or JSON manifest is explicitly accepted as interim.
- Manual E2E runbook has a documented `PASS` or accepted `PASS_WITH_P2`.

Until then, current status is:

`PASS_WITH_P2 for Report Pack governance spine`

not:

`full MDI PASS`.
