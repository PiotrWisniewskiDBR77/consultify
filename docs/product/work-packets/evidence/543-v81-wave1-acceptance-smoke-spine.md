# 543 - V8.1 wave 1 acceptance smoke spine

Date: 2026-03-29
Owner: Cursor agent
Scope: deterministic smoke acceptance for the wave-1 must-have shell and entry spine

## Why this pass was needed

Wave 1 already had many focused unit/component closeout proofs, but manual acceptance was still scattered across separate module documents.

That left one practical gap:

- no single repeatable browser-level run proving the public entry assistant, internal assistant, and canonical must-have module routes still mount together after the closeout wave
- manual gates were too dependent on brittle ad-hoc browser sessions

## What landed

Added:

- `tests/e2e/smoke/wave1-module-closeout.spec.ts`

The suite now proves, on deterministic local Playwright runtime:

- `Anna` remains the external/public assistant on landing
- `Teresa` remains the internal in-app assistant on `/chat`
- core wave-1 must-have routes mount without route-boundary failure:
  - `/my-work`
  - `/interview`
  - `/assessment/overview`
  - `/initiatives`
  - `/execution`
  - `/kpi-okr`
  - `/benefits`
  - `/finance`
  - `/settings/integrations`
  - `/docs`
  - `/partner`

## Acceptance truth captured by the suite

### Public vs internal AI identity

- Landing confirms `Anna` widget opens with explicit public/external identity copy
- Landing confirms `Anna` exposes canonical CTA handoffs: `demo`, `trial`, `contact`
- `/chat` confirms the in-app assistant identity is `Teresa`, not `Anna`

### Canonical route truth

The smoke also preserved two important routing truths discovered during the run:

- `/kpi-okr` resolves to the canonical `Results` surface at `/benefits`
- `/settings/integrations` resolves to the canonical integrations surface at `/settings/connected-apps`

These redirects were encoded into the acceptance suite instead of being treated as false failures.

## Verification

Passed:

- `E2E_MODE=true E2E_USE_WEB_SERVER=true E2E_BACKEND_RUNNER=tsx E2E_API_URL=http://127.0.0.1:3001 E2E_BASE_URL=http://127.0.0.1:3000 npx playwright test --config playwright.smoke.config.ts tests/e2e/smoke/wave1-module-closeout.spec.ts`
- `npx vitest run tests/components/MyWork/NotebookCanonicalPathStrip.test.tsx tests/components/MyWork/AIChatInlinePanel.convert-guard.test.tsx tests/components/MyWork/notebookMetadataBadges.test.tsx tests/components/MyWork/NotebookContent.manual-gate.test.tsx tests/unit/components/MyWork/notebookConvertedOutputSummary.test.ts tests/unit/components/MyWork/ideaWorkspaceState.test.ts tests/components/MyWork/IdeasMindMap.redirect.test.tsx tests/components/MyWork/ideaEntryTypes.test.ts tests/unit/mindmap/canvasLeftToolbar.test.tsx tests/unit/mindmap/mindmapInteractionGrammar.test.ts tests/unit/components/MyWork/useKeyboardShortcuts.test.tsx tests/unit/mywork/whiteboardInteractionGrammar.test.ts tests/unit/mywork/whiteboardNodes.test.ts tests/unit/backend/services/ideaAIGeneratorService.whiteboardFormatters.test.ts tests/components/MyWork/IdeaProcessFlowTool.error-state.test.tsx tests/unit/mywork/useProcessFlowNodes.test.ts tests/unit/mywork/crossToolTransform.test.ts tests/components/MyWork/IdeaTableTool.honesty.test.tsx tests/components/MyWork/TableRealtimeStatusIndicator.test.tsx tests/components/Survey/SurveyShell.capture-resume.test.tsx tests/components/Interview/interviewErrorCopy.test.ts tests/components/Interview/InsightCreatorModal.error-state.test.tsx tests/components/MyWork/HomeView.outputs.test.tsx tests/components/MyWork/AIPulseCore.actionable-priority.test.tsx tests/components/Landing/AnnaAssistantWidget.cta-authority.test.tsx`

Result:

- `13 / 13` tests passed
- `25 / 25` test files passed
- `86 / 86` focused regression tests passed

Notes:

- The focused regression pack still emits the already-known React `act(...)` warnings from `tests/components/Landing/AnnaAssistantWidget.cta-authority.test.tsx`
- They did not fail the suite and were treated as pre-existing test noise, not a regression introduced in this pass

## Residual risk

- This suite validates the wave-1 shell and route spine, not every deep CRUD path inside `Notebook`, `Mind map`, `Whiteboard`, `Tables`, `Surveys`, or `Interview insights`
- Those deeper module behaviors are now also re-verified by the focused regression pack above, but not every checklist item is yet expressed as one browser-driven end-to-end scenario

## Status

- Wave-1 now has one repeatable browser-level smoke spine covering the public assistant, internal assistant, and canonical must-have route shell
- The acceptance story is materially stronger and less dependent on fragile ad-hoc browser sessions
- Together with `544-v81-mywork-deep-acceptance-pack.md` and `548-v81-wave1-final-module-gate-ratification.md`, this spine now participates in the final closure-grade Wave 1 module acceptance set
