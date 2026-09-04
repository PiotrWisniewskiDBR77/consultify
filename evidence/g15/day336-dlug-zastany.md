# Day 336 / R2 — imienna lista długu zastanego

Klasa oznacza tę samą pełną nazwę czerwoną na kompilowalnej bazie `f65c4ff6a0` i na HEAD. Łącznie: 63 przypadki.

## 03_TOOLS (1)

- `src/components/DiscoveryTools/__tests__/toolCanvas.smoke.test.tsx` — `ToolCanvas — guard for unresolved steps never renders the raw "not implemented" string for an unknown step`

## 04_ASSESSMENT (11)

- `DrdHttpMethodWorkspaceScreen.offlineRecovery.test.tsx` — `scenario 1 — utrata API w trakcie pracy: OFFLINE, praca nie ginie forceState="offline" shows the OFFLINE badge and the offline banner, without losing the session already on screen`
- `DrdHttpMethodWorkspaceScreen.offlineRecovery.test.tsx` — `scenario 2 — zmiana lokalna przy braku łączności -> RECOVERY_DRAFT editing a field while offline flips the badge from OFFLINE to RECOVERY_DRAFT, never SAVED`
- `DrdHttpMethodWorkspaceScreen.offlineRecovery.test.tsx` — `scenario 3 — przywrócenie połączenia -> RECONNECTING -> RECOVERED clicking "apply pending" shows RECONNECTING while the retry is in flight, then RECOVERED, then settles to SERVER`
- `DrdHttpMethodWorkspaceScreen.offlineRecovery.test.tsx` — `scenario 6 — retry po nieudanym zapisie the offline banner's retry button re-asks the server and clears the banner on success`
- `DrdHttpMethodWorkspaceScreen.offlineRecovery.test.tsx` — `scenario 8 — reopen po restarcie: serwer wygrywa resuming a session with a stale cached revision shows the fresh server version, never the cache, once loaded`
- `DrdHttpMethodWorkspaceScreen.test.tsx` — `requirement 1 — flag OFF: legacy runtime, zero HTTP calls mounts without forceHttpSourceOfTruth and never touches methodCoreApi`
- `DrdHttpMethodWorkspaceScreen.test.tsx` — `requirement 2 — flag ON: DrdHttpSessionRuntime, indicator shows SERVER creates a session over HTTP and renders the SERVER indicator once ready`
- `DrdHttpMethodWorkspaceScreen.test.tsx` — `canonical cold reopen identity and read-only contract renders exact session/method versions and disables writes without a write role`
- `DrdHttpMethodWorkspaceScreen.test.tsx` — `requirement 3 — a 409 on write shows an explicit conflict screen, never a silent overwrite keeps Freeze disabled for an in-review owner without the approver process role`
- `DrdHttpMethodWorkspaceScreen.test.tsx` — `requirement 3 — a 409 on write shows an explicit conflict screen, never a silent overwrite turns a real stale transition 409 into ConflictView without painting false success`
- `drdMethodWorkspaceGating.test.tsx` — `DrdMethodWorkspaceScreen (the ON-path render target) mounts the REAL MethodWorkspaceShell shows the explicit demo-bypass banner (never a silent override of pack readiness)`

## 05_INITIATIVES (16)

- `chatActionHandler.createInitiative.test.ts` — `handleChatAction CREATE_INITIATIVE creates the initiative and navigates to its DOCUMENT deep link`
- `chatActionHandler.createInitiative.test.ts` — `handleChatAction CREATE_INITIATIVE supports the { initiative: { id } } response envelope`
- `chatActionHandler.createInitiative.test.ts` — `handleChatAction CREATE_INITIATIVE still succeeds without navigation when no id is returned`
- `canonicalInitiativeRegisterParity.test.tsx` — `canonical Initiative register parity keeps identical presentation while routing Open for initiatives.canonical-register.v1`
- `canonicalInitiativeRegisterParity.test.tsx` — `canonical Initiative register parity keeps identical presentation while routing Open for execution.canonical.executions.v1`
- `executionControlSurface.test.tsx` — `ExecutionControlSurface filters the visible projection and reports counts from the same canonical rows`
- `executionControlSurface.test.tsx` — `ExecutionControlSurface creates governed PLANNING_BASELINE change from the exact selected RESEQUENCE option`
- `executionControlSurface.test.tsx` — `ExecutionControlSurface ingests a deduplicated exact occurrence and guides a multi-signal Intervention draft`
- `executionControlSurface.test.tsx` — `ExecutionControlSurface opens stable Intervention ID by keyboard and closes only EFFECTIVE verification`
- `executionWorkResources.test.tsx` — `Execution canonical work/resources keeps Work fail-closed and retries the canonical case register`
- `executionWorkResources.test.tsx` — `Execution canonical work/resources keeps Resources fail-closed and retries the canonical case register`
- `executionWorkResources.test.tsx` — `Execution canonical work/resources loads Task projection by stable executionCaseId and opens preview with keyboard`
- `executionWorkResources.test.tsx` — `Execution canonical work/resources creates a canonical Milestone with exact Case and Handoff baseline versions`
- `executionWorkResources.test.tsx` — `Execution canonical work/resources keeps allocation simulation pure and exposes literal EVIDENCE_MISSING`
- `executionWorkResources.test.tsx` — `Execution canonical work/resources opens Allocation preview on single click and workspace on double click`
- `financialNarrativeBlocks.test.ts` — `upsertFinancialBlock language toggle still matches the same block via the stable marker token`.

## 06_EXECUTION (12)

- `canonicalInitiativeRegisterParity.test.tsx` — `canonical Initiative register parity keeps identical presentation while routing Open for initiatives.canonical-register.v1`
- `canonicalInitiativeRegisterParity.test.tsx` — `canonical Initiative register parity keeps identical presentation while routing Open for execution.canonical.executions.v1`
- `executionControlSurface.test.tsx` — `ExecutionControlSurface filters the visible projection and reports counts from the same canonical rows`
- `executionControlSurface.test.tsx` — `ExecutionControlSurface creates governed PLANNING_BASELINE change from the exact selected RESEQUENCE option`
- `executionControlSurface.test.tsx` — `ExecutionControlSurface ingests a deduplicated exact occurrence and guides a multi-signal Intervention draft`
- `executionControlSurface.test.tsx` — `ExecutionControlSurface opens stable Intervention ID by keyboard and closes only EFFECTIVE verification`
- `executionWorkResources.test.tsx` — `Execution canonical work/resources keeps Work fail-closed and retries the canonical case register`
- `executionWorkResources.test.tsx` — `Execution canonical work/resources keeps Resources fail-closed and retries the canonical case register`
- `executionWorkResources.test.tsx` — `Execution canonical work/resources loads Task projection by stable executionCaseId and opens preview with keyboard`
- `executionWorkResources.test.tsx` — `Execution canonical work/resources creates a canonical Milestone with exact Case and Handoff baseline versions`
- `executionWorkResources.test.tsx` — `Execution canonical work/resources keeps allocation simulation pure and exposes literal EVIDENCE_MISSING`
- `executionWorkResources.test.tsx` — `Execution canonical work/resources opens Allocation preview on single click and workspace on double click`

## 07_MY_WORK_AGENT (2)

- `CommentPersistence.day222.aiComment.test.ts` — `Day 222 AI task comment persistence persists before replacing local state with the GET readback`
- `DecisionDetailView.raciDownload.day222.test.tsx` — `Day 222 DecisionDetailView RACI row actions does not render an attachment download action for a stakeholder row`

## 08_MEETINGS (3)

- `MeetingHub.smoke.test.tsx` — `MeetingHub (smoke) shows an honest error + retry when the operator brief fetch fails (500)`
- `MeetingHub.smoke.test.tsx` — `MeetingHub (smoke) surfaces a 404 brief as an honest error, not as silent emptiness`
- `MeetingObjectPage.test.tsx` — `MeetingObjectPage Decyzje i działania section shows meeting decisions and follow-ups`

## 11_MATERIALS (2)

- `DocumentStudioDocumentPanel.test.tsx` — `DocumentStudioDocumentPanel uses the Artifact Studio shell without a local Teresa or legacy right rail`
- `PresentationStudioLayoutCapacityAdminPanel.test.tsx` — `PresentationStudioLayoutCapacityAdminPanel — loadWarning renders a rose loadWarning banner for signature_mismatch (tampered persistence file)`

## 14_ADMIN (7)

- `AdminAuditExportHistoryPanel renders real receipt`
- `Admin day-2 i18n contract keeps the exact 26-panel denominator free of generated textN keys and Polish fallbacks`
- `AdminDependenciesPanel renders cached dependency status without claiming health`
- `AdminJobsPanel renders tenant jobs without mutation actions`
- `AdminSeatsLicencesPanel renders configuration, history and honest purchase boundary`
- `AdminSeatsLicencesPanel saves auto-add through the readback API`
- `AdminSecurityAlertsPanel renders and resolves with server readback`

## 16_PARTNER (9)

- `EarningsSection V8 payout request seam prefers governed payout history read before legacy fallback`
- `EarningsSection V8 payout request seam falls back to legacy payout history read on bounded compatibility statuses`
- `EarningsSection V8 payout request seam does not expose a payout request mutation even when historical balance is available`
- `PartnerPortalView company info V8 seam uses the V8 route first for company-info updates`
- `PartnerPortalView company info V8 seam fails closed without a legacy mutation when the governed writer fails`
- `PartnerPortalView regions V8 seam uses the V8 route first for region updates`
- `PartnerPortalView regions V8 seam fails closed without a legacy mutation when the governed writer fails`
- `PartnerPortalView specializations V8 seam uses the V8 route first for specialization updates`
- `PartnerPortalView specializations V8 seam fails closed without a legacy mutation when the governed writer fails`
