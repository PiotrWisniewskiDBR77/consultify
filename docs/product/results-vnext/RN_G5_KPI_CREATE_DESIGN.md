# RN-G5 — KPI create → edit → submit → approve/reject (design + contract notes)

Status: implemented, behind `kpiRegistry` flag (default OFF). Base SHA
`35a1dee6c03b66907219b5b645e4e3ecb267f80a`, branch `rn-g5-kpicreate`.

## 1. Problem

Before this package, nothing in `src/components/ResultsVNext/` called any of
the five KPI definition-side write commands. `grep -rn
"createKpi\|submitKpi\|approveDefinitionVersion" src/components/ResultsVNext/`
returned only doc-comment references (`kpiApi.ts:15`,
`KpiToolPage.tsx:561-562`). There was no "New KPI" button anywhere. The
backend has had a complete command set since `kpiDefinitionCommands.ts`
shipped (`POST /kpi`, `PUT /:id/draft`, `POST /:id/submit`, `POST
.../definition-versions/:id/approve`, `.../reject`) — the gap was entirely on
the client.

## 2. Confirmed backend contract (read before writing any UI code)

- `createKpiDraft` (`kpiDefinitionCommands.ts:236`) — the ONLY create
  endpoint. One atomic write: `rvn_kpi_definitions` root row (`status:
  'draft'`) + its version-1 `rvn_kpi_definition_versions` row
  (`approval_status: 'draft'`, `row_version: 1` — column default,
  `20260810_rvn_kpi_core.sql:75,162`). Fails closed
  (`KpiNoActiveVisibilityPolicyError`) if the org has no active visibility
  policy for the `'kpi'` domain.
- `editDraft` (`kpiDefinitionCommands.ts:436`) — mutates the version row
  only. Guards `approval_status === 'draft'` (else `KpiDefinitionValidationError`
  code `NOT_A_DRAFT`, mapped to HTTP 409 by `kpi.routes.ts:205`). CAS'd on
  the version's own `row_version` via `expectedVersion`.
- `submitDefinition` (`kpiDefinitionCommands.ts:568`) — draft → submitted
  (version) and, only if the KPI root was `'draft'`, → `pending_approval`
  (root). Guards `NOT_A_DRAFT`.
- `approveDefinitionVersion` (`kpiDefinitionCommands.ts:689`) — self-approval
  denial FIRST, before any write (`currentRow.submitted_by === approverId`
  OR `currentRow.created_by === approverId` →
  `SelfApprovalDeniedError`, HTTP 403, `kpi.routes.ts:184`). Then guards
  `approval_status === 'submitted'` (else `NOT_SUBMITTED`, 409). Sets
  `rvn_kpi_definitions.current_definition_version_id` as a derived pointer —
  does NOT change the KPI root `status` (only `activateKpi` does that,
  separately).
- `rejectDefinitionVersion` (`kpiDefinitionCommands.ts:806`) — submitted →
  rejected (version), and if the KPI root was `pending_approval` → `draft`
  (root), so it "can be edited and resubmitted" per the code comment. In
  practice it CANNOT: `editDraft`'s only guard is `approval_status ===
  'draft'`, and a rejected version's `approval_status` is the terminal value
  `'rejected'` — there is no command anywhere in this codebase that creates
  a second (amendment) definition version for an existing `kpi_id`.
  **This is a confirmed, un-fixed gap**: a rejected KPI is permanently stuck
  with no way to create a corrected version through any implemented
  endpoint. Not fixed here — `kpiDefinitionCommands.ts` is out of this
  package's allowlist (parallel safety track). The UI reflects this honestly:
  once `knownVersions[kpiId].approvalStatus === 'rejected'`, Edit is shown
  locked with this exact reason instead of round-tripping to a guaranteed
  409.

Routes: `server/src/routes/resultsVnext/kpi.routes.ts` — `POST /`, `GET /`,
`GET /:kpiId`, `PUT /:kpiId/draft`, `POST /:kpiId/submit`, `POST
/:kpiId/definition-versions/:versionId/approve`, `.../reject`. Validators:
`server/src/validators/resultsVnextKpi.validators.ts`
(`CreateKpiDraftSchema`/`EditKpiDraftSchema`/`SubmitDefinitionSchema`/
`ApproveDefinitionVersionSchema`/`RejectDefinitionVersionSchema`).

## 3. The load-bearing gap: no GET ever returns a definition version

`kpiRepository.ts`'s `listKpis` (`kpiRepository.ts:88`) and `getKpi`
(`kpiRepository.ts:124`) both do a bare `SELECT kd.*` against
`rvn_kpi_definitions` — **no join** to `rvn_kpi_definition_versions`. The
`KpiDefinition` DTO (`kpiTypes.ts:196`) has no `name`/`unit`/`targetGeometry`/
`approvalStatus`/`rowVersion`-of-the-version field at all. Contrast with
`kpiPerspectivesRepository.ts:165`, which DOES `INNER JOIN
rvn_kpi_definition_versions kdv ON kdv.definition_version_id =
kd.current_definition_version_id` for its own (different, obligations-feed)
purpose — the join pattern exists in the codebase, it is simply never used
by the plain KPI list/get reads.

Every one of the five write commands is CAS'd on the **version's own**
`row_version` (`expectedVersion` in the request body) — not the KPI root's.
Combined with the missing GET, a client can only safely know the correct
`expectedVersion` for a version it just created or itself just mutated (the
version DTO comes back from all five responses) — never for a version loaded
cold from a list/row alone.

### Resolution chosen here (client-only, no server changes)

`ResultsKpiRegistryPage.tsx` keeps an in-memory `knownVersions: Record<kpiId,
KpiDefinitionVersionDto>` populated **exclusively** from the five write
commands' own return values. Edit/Submit/Approve/Reject are offered (row
menu + preview) only when a KPI's version is present in this map;
otherwise every one of those actions renders **locked** (visible, disabled,
with an explicit reason — same discipline `noApprovedVersionReason` already
uses for Activate) rather than sending a guessed `expectedVersion` that
would deterministically 409.

This is not a UI shortcut — it is the correct, honest response to a real
data-access gap. A future GET endpoint that joins the current definition
version (out of this package's allowlist:
`server/src/services/resultsVnext/**`/`server/src/routes/resultsVnext/**`)
would let these actions unlock regardless of session history, with no UI
change required (the gating already keys off "is the version known", not off
any session/actor concept).

## 4. Maker-checker / D06 (uprawnienia bramkują akcje)

`approveDefinitionVersion`'s self-approval denial is real and server-
enforced (§2). The UI never tries to pre-guess it client-side — it always
lets the user attempt Approve, and on a 403 `SELF_APPROVAL_DENIED` response
shows a specific, non-generic message ("you cannot approve your own
definition — a second person is required") rather than a raw error string.

A capability/permission gate for the write commands is being added by a
parallel track (per task brief). This package does not implement or guess
that gate. What it DOES do, per D06, is make sure the UI is already shaped
correctly for it to slot in without rework: every gated action (row-menu
entry, preview action, the "New KPI" primary CTA) is a normal, always-
rendered, `onClick`-driven control — never conditionally omitted from the
DOM — so a future capability check only needs to flip `disabled`+supply a
`note`/reason (`lockedRowMenuAction`, `StandardPreviewAction.disabled`),
exactly the same shape already used for the `knownVersions` gate and the
`noApprovedVersionReason`/archived/suspended locks. No UI rework will be
needed when that gate lands.

## 5. What was built

- `src/components/ResultsVNext/kpiApi.ts` — five new typed wrappers
  (`createKpiDraft`, `editKpiDraft`, `submitKpiDefinition`,
  `approveKpiDefinitionVersion`, `rejectKpiDefinitionVersion`),
  `KpiDefinitionVersionDto`, `newKpiIdempotencyKey`, `isConflictError`,
  `isSelfApprovalDeniedError`.
- `src/components/ResultsVNext/KpiDraftFormModal.tsx` — create/edit form
  (`Modal` primitive, zero `window.prompt`/`confirm`/`alert`). Fields =
  exactly `CreateKpiDraftSchema`/`EditKpiDraftSchema`. Geometry-specific
  bound fields shown/hidden per the EXACT field set
  `targetGeometryEvaluator.ts` reads for that geometry (verified by reading
  that file).
- `src/components/ResultsVNext/KpiTransitionDialog.tsx` — shared submit/
  approve/reject reason dialog (submit/approve optional reason, reject
  required `rejectionReason`).
- `src/components/ResultsVNext/ResultsKpiRegistryPage.tsx` — "Nowy KPI"
  primary CTA (moduleBar), `knownVersions` cache, row-menu + preview
  entries for edit/submit/approve/reject with honest locking.
- `dev-render/screens/results-vnext-kpi-registry.tsx` — write-endpoint
  mocks mirroring the real contract (CAS, self-approval denial, NOT_A_DRAFT/
  NOT_SUBMITTED guards) + a harness-only actor-switch button (swaps
  `useAppStore`'s `currentUser` without unmounting the page, so a create →
  submit → approve click-through can demonstrate a real second actor).
- `tests/components/ResultsVNext/ResultsKpiRegistryPage.kpiCreate.test.tsx`
  — component tests for the full cycle + the locked-gap case + the
  required-reject-reason negative control.

## 6. What this does NOT prove / known gaps left for later packages

- The rejected-version amend-and-resubmit path (§2) — no backend command
  exists; not fixed here.
- No GET returns a definition version (§3) — worked around client-side,
  not fixed.
- The capability/permission gate for these five commands is being added by
  a parallel track; not implemented or guessed here (§4).
- `ownerUserId` on create always defaults to the caller (server-side) —
  there is still no general "list org members" endpoint a normal member can
  call, same limitation `RoiCaseCreateModal.tsx` documents for ROI.
