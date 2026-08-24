# Chat → Tools integration handoff — 2026-08-23

Status: `LOCAL WIP / NO COMMIT / NO MERGE / NO PUSH / NO DEPLOY / NOT OWNER_ACCEPTED`

Canonical denominator: 96 unique atoms; 41 meet both expert numeric thresholds;
55 remain in the strict `<9` union. Module gates remain `NO-GO`.

## 1. Changed-file inventory

This inventory is the integration scope. Re-run `git status --short` before
transfer because the worktree is shared and dirty.

### Chat

- Backend/data: `server/src/routes/chat-projects.routes.ts`,
  `server/src/services/AuditEventsService.ts`,
  `server/migrations/20260823_chat_project_context_governance.sql`.
- UI/state: `src/components/AIChat/{BranchSelector,ChatHistorySidebar,ChatSignalsPanel,GovernedChatHandoffCard,MoveToProjectModal,OutputToolSelector,PrivateModeDetails,ProjectMembersModal,UnifiedChatPanel,V8ArtifactRunControl,V8ContextIndicator,WorkCanvasDocumentPanel,CanvasViewModeControl}.tsx`,
  `src/components/AIChat/{chatHeaderControlStyles,chatHistoryVisibility,teresaWelcome}.ts`,
  `src/store/useChatProjectStore.ts`.
- Tests: modified/new files under `src/components/AIChat/__tests__/`,
  `tests/components/AIChat/`, `tests/integration/chat-projects/`,
  `tests/store/useConversationStore.p35-history.test.ts`, and
  `tests/unit/backend/services/AuditEventsService.transaction.test.ts`.

### My Work

- Backend/API: `server/src/routes/v8/my-work.routes.ts`,
  `server/src/routes/v8/__tests__/my-work-notebook.routes.test.ts`,
  `src/services/api.ts`, `src/services/api/v8/{client,my-work}.ts`.
- Main UI: `src/components/MyWork/{IdeaAINudgeStrip,IdeaWhiteboardTool,MyWorkHub,NotebookContent,TaskDetailView,IdeaDocumentTabRename}.tsx`,
  `src/components/MyWork/table/IdeaStartupTemplates.tsx`,
  `src/components/MyWork/taskGeneratedSectionPersistence.ts`.
- Notebook: `src/components/MyWork/notebook/{NotebookBubbleToolbar,NotebookExportMenu,NotebookHamburgerMenu,NotebookInlineAIMenu,NotebookRightRail,NotebookToolbar,SlashMenu}.tsx`,
  `src/components/MyWork/notebook/notebookActionRegistry.ts` and the corresponding
  new/modified tests under `src/components/MyWork/notebook/__tests__/` plus
  `tests/components/MyWork/{NotebookExportMenu,NotebookToolbar}.test.tsx`.
- Other tests: new/modified files under `src/components/MyWork/__tests__/`,
  including Ideas, Decisions and Task contracts.

### Interview

- `server/src/controllers/InterviewController.ts`.
- `src/components/Interview/{AssignInterviewModal,InterviewHub,InterviewTemplatePreview,InterviewWorkspace,TemplateBuilder}.tsx`.
- `src/components/Interview/__tests__/*` and
  `src/components/Interview/__tests__/TemplateBuilder.smoke.test.tsx`.
- Shared Preview dependency: `src/components/shared/PreviewPane/PreviewActionBar.tsx`.

### Tools and shared surfaces

- `src/components/DiscoveryTools/{ToolDocumentView,ToolSessionPreviewV3}.tsx`.
- `src/components/DiscoveryTools/shared/StrategicCanvasVisuals.tsx`.
- `src/components/DiscoveryTools/tools/DynamicSWOT/{SWOTBuildPhase,SWOTInputExplorationPhase}.tsx` plus targeted tests.
- Shared/My Work-adjacent surfaces: `src/components/shared/{ModuleMenu3,NModeLayout/NModeCardState}.tsx`,
  `src/components/shared/NModeSections/{ActivityLogCanvas,RiskCanvas}.tsx`,
  `src/views/vault/VaultDocumentsView.tsx`, `src/views/vault/vaultIndexRefreshPolicy.ts`
  and their tests.
- Locales/telemetry: `public/locales/{en,pl}/translation.json`,
  `src/services/funnelAnalytics.ts`.

### Documentation

- `OWNER_NOTES_CHAT_TO_TOOLS_2026-08-23.md`.
- `CHAT_TO_TOOLS_IMPLEMENTATION_RECONCILIATION_2026-08-23.md`.
- `CHAT_TO_TOOLS_UX_ATOMIC_REVIEW_2026-08-23.md`.
- `CHAT_TO_TOOLS_CONSULTING_ATOMIC_REVIEW_2026-08-23.md`.
- `CHAT_TO_TOOLS_BACKLOG_BELOW_9_2026-08-23.md`.
- `CHAT_TO_TOOLS_FINAL_THREE_PERSON_PANEL_2026-08-23.md`.
- This handoff.

### Explicit exclusions

- Do not transfer or edit untracked `docs/.../owner_feedback/04_ASSESSMENT/`.
- Do not transfer `false/`; classify it separately before any cleanup.
- `src/components/Discovery/DiscoveryToolsHub.tsx` is inherited preview WIP,
  not this task's change. Do not count or copy it from this worktree; use the
  separately repaired main-checkout version.

## 2. Requirement → code → test map

| Module    | Implemented bounded requirements                                                                                                                                                                  | Primary code                                                                                                                                                                                            | Primary evidence                                                                                                                                                          |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chat      | Canvas header/save/conflict truth; branch lineage; governed move/visibility consent and receipt history; shared-context provenance/hash/history; stable response actions and proposal-card states | `WorkCanvasDocumentPanel.tsx`, `BranchSelector.tsx`, `MoveToProjectModal.tsx`, `ProjectMembersModal.tsx`, `ChatHistorySidebar.tsx`, `GovernedChatHandoffCard.tsx`, `chat-projects.routes.ts`, migration | Canvas `11/11`; branch UI `6/6` + local RealPG `9/9`; history/context `28/28` + hash follow-up `23/23`; consent `9/9`; response actions `15/15`; proposal card `9/9`      |
| My Work   | Ideas intake/tabs/rename/nudge truth; Task Analyze fail-closed UI; Decisions states; Vault live-index safety; Notebook 104-action/7-surface audit and governed Delete                             | `MyWorkHub.tsx`, `IdeaDocumentTabRename.tsx`, `IdeaAINudgeStrip.tsx`, `TaskDetailView.tsx`, `VaultDocumentsView.tsx`, Notebook files listed above, `my-work.routes.ts`                                  | Ideas targeted suites recorded in reconciliation; Vault `8/8`; Notebook combined real-component `64/64`; governed Delete backend selected `7/7`; toolbar/registry `12/12` |
| Interview | shared question workspace; preview footer; assignment eligibility/version/recovery; approval lifecycle transaction and fail-closed history; new-template guidance                                 | Interview files above and `InterviewController.ts`                                                                                                                                                      | workspace `10/10`; Preview `12/12`; Assign `10/10`; TemplateBuilder smoke `6/6`; lifecycle structure/tests recorded in reconciliation                                     |
| Tools     | bounded Preview completion; bounded Dynamic SWOT Input/matrix segment; shared strategic canvas presentation                                                                                       | `ToolSessionPreviewV3.tsx`, `SWOTInputExplorationPhase.tsx`, `SWOTBuildPhase.tsx`, `StrategicCanvasVisuals.tsx`                                                                                         | targeted preview evidence externally reported `242/242` on repaired main checkout; local SWOT owner-feedback test and bounded technical review only                       |

The full atom-by-atom mapping is canonical in
`CHAT_TO_TOOLS_IMPLEMENTATION_RECONCILIATION_2026-08-23.md`; this table is only
an integration index.

## 3. Verification results and literal failures

- `git diff --check`: PASS after the final Notebook delta.
- Notebook seven-surface combined run: `10 files / 64 tests PASS`.
- Notebook Slash/audit focused run: `3 files / 25 tests PASS`.
- Notebook Inline AI/audit focused run: `3 files / 9 tests PASS`; post-format
  rerun of behavior/governance: `2 files / 5 tests PASS`.
- Notebook rail/audit focused run: `3 files / 12 tests PASS`.
- Notebook menu/export focused run: `2 files / 18 tests PASS`.
- Governed Delete selected backend run after access/org fencing:
  `1 file / 7 tests PASS / 18 skipped`.
- Full `npm run type-check`: exit `2`, with exactly three inherited diagnostics:
  `src/components/Discovery/DiscoveryToolsHub.tsx:4299`, `:4300`, `:4301`, each
  `TS2345 ToolsPreviewItem is not assignable to Record<string, unknown>`.
  No task-owned TypeScript error was reported. CTO separately reports typecheck
  exit `0` and preview `242/242 PASS` after repairing this boundary in the main
  checkout; that is external evidence, not proof for this snapshot.
- Full `my-work-notebook.routes.test.ts` is not green: five unrelated/order-dependent
  failures remain (upload attachment, delete attachment, update page, classify,
  then delete through mock cascade). Do not broaden the selected `7/7` claim.
- Interview browser/runtime: `ECONNREFUSED 127.0.0.1:3001`; authenticated module
  UI was not reached, so this is not a pass.
- Fresh isolated RealPG: `could not extend file ... wrote only 4096 of 8192 bytes`;
  Docker VM storage blocked the replay.
- Dependency runtime is the reversible symlink to
  `/Users/piotrwisniewski/Developer/Consultify/node_modules`; local test results
  are not production evidence. No dependency install or lockfile change.

## 4. OWNER_DECISION_REQUIRED / not locally authorized

- `CHAT-OWN-001`: confirm swap semantics and persistence model.
- `CHAT-OWN-004`: accept the producer→consumer→action purpose of Important Signals,
  or remove it.
- `INT-CREATOR-OWN-001`, alias/collision `REC-INT-007`, and `REC-INT-009`:
  approve the shared three-creator prototype/platform contract.
- `REC-INT-003`, `REC-INT-004`, `REC-INT-005`: resolve identifier collisions
  between Owner Notes and the detailed Interview register.
- `TLS-PREV-CONTENT-OWN-001`: approve a cross-app Preview Content Contract;
  local Tools fork is `IMPLEMENTATION_NOT_AUTHORIZED`.
- `TLS-SWOT-OWN-001`: authorize the full reusable seven-stage method and confirm
  the ninth Synthesis category; current bounded SWOT segment is insufficient.
- `TLS-READY-OWN-001`: decide final screen name and readiness lifecycle.
- `TLS-CHAIN-OWN-001`: reconcile five navigation stages with four result classes.
- `MYW-NBK-005`: prove Quick Capture's unique value/contract or approve removal.
- `MYW-CV-REC-004`: choose the private/project/organization hierarchy and migration.
- Cross-module N-Type/card and Manager redesign remain owner/platform decisions;
  do not create local one-off forks.

## 5. Recommended clean-candidate transfer order

1. Freeze and record clean candidate SHA; verify clean `node_modules` runtime.
2. Apply shared primitives/locales first, excluding Assessment and
   `DiscoveryToolsHub.tsx`; run typecheck immediately.
3. Apply Chat migration/backend/service changes, then Chat state/UI/tests. Run
   migration-shape tests and targeted Chat suites before other modules.
4. Apply Interview backend transaction boundary, then Preview/Assign/workspace UI
   and targeted tests.
5. Apply My Work API/backend changes, then Ideas/Tasks/Vault, then Notebook in
   this order: registry → menus/toolbars/Slash/InlineAI/rail → `NotebookContent`
   → targeted backend/component suites.
6. Apply bounded Tools files last. Do not copy inherited `DiscoveryToolsHub.tsx`;
   reconcile against the main-track fix, then run the reported preview suite.
7. Run `git diff --check`, targeted suites, full typecheck and build. Do not call
   the candidate accepted if the three inherited errors or five broad route-suite
   failures reappear.
8. Only after a frozen clean candidate exists: authenticated browser, RealPG/cold
   readback and owner retest. No merge/push/deploy without separate authorization.
