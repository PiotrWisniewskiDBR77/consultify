# K7 W81 — F9 Initiative test debt freeze

Status: **READY FOR CTO REVIEW**

- Base and accepted F9 product: `df3428e7e027124a60dfdc0b7ae1ba3a76c4facc`
- Test-repair HEAD: `a4da46fda4ca9fef9f6cf81d4fb8f44c870f02e8`
- Branch: `codex/a-k7-f9-initiative-tests-20260915`
- Product changes in this packet: none.
- Classification: all thirteen red files contained stale assertions, source anchors, labels, lifecycle statuses, routes, or incomplete mocks. F9 behavior remains unchanged: three visible Menu 2 pills, project names instead of UUIDs, flag-gated surfaces in Status, and visible CTA.

## Exact denominator reconstruction

The missing F9 list was reconstructed from tests that import or name-anchor one of the changed F9 modules: `InitiativesHub`, `projectFilterLabel`, `ModuleNavBar`, `initiativeProjectPolicyService`, or Sidebar `menuConfig`. The exact denominator is these 50 files:

1. `server/src/services/__tests__/initiativeProjectPolicyService.systemPortfolioName.test.ts`
2. `src/components/Finance/__tests__/financeWave2Gate.test.tsx`
3. `src/components/Initiatives/__tests__/InitiativesHub.deepLinkRuntimeV1.source.test.ts`
4. `src/components/Initiatives/__tests__/InitiativesHub.fourButtonsE1.test.tsx`
5. `src/components/Initiatives/__tests__/InitiativesHub.journeyNavigation.test.tsx`
6. `src/components/Initiatives/__tests__/InitiativesHub.kanonPaskow.source.test.ts`
7. `src/components/Initiatives/__tests__/InitiativesHub.licznikiSpojne.test.tsx`
8. `src/components/Initiatives/__tests__/InitiativesHub.menu2CtaWidoczne.test.tsx`
9. `src/components/Initiatives/__tests__/InitiativesHub.menu3Chips.test.tsx`
10. `src/components/Initiatives/__tests__/InitiativesHub.newModalA11y.test.tsx`
11. `src/components/Initiatives/__tests__/InitiativesHub.previewDetails.t25.test.tsx`
12. `src/components/Initiatives/__tests__/InitiativesHub.pustaLista.test.tsx`
13. `src/components/Initiatives/__tests__/InitiativesHub.smoke.test.tsx`
14. `src/components/Initiatives/__tests__/InitiativesHub.workReportFlag.test.tsx`
15. `src/components/Initiatives/__tests__/day274-jedna-kolumnistyka.test.tsx`
16. `src/components/Initiatives/__tests__/initiativeRegisterProjection.legacyMerge.test.ts`
17. `src/components/Initiatives/__tests__/initiativeRegisterProjection.ownerName.test.ts`
18. `src/components/Initiatives/__tests__/projectFilterLabel.test.ts`
19. `src/components/MyWork/__tests__/MyWorkHub.menu3PanelControls.test.ts`
20. `src/components/MyWork/__tests__/TaskDetailView.ownerScoped.test.tsx`
21. `src/components/Portfolio/__tests__/PortfolioGridView.canonCard.test.tsx`
22. `src/components/assessment/__tests__/AssessmentHub.ownerScoped.test.tsx`
23. `src/components/navigation/Sidebar/__tests__/Sidebar.pilotMeetingLock.test.tsx`
24. `src/components/navigation/Sidebar/__tests__/menuConfig.interview.test.ts`
25. `src/components/navigation/Sidebar/__tests__/menuConfig.meetingsWave2.test.ts`
26. `src/components/navigation/Sidebar/__tests__/menuConfig.pmoProjects.test.ts`
27. `tests/components/Initiatives/InitiativesHub.load-error-state.test.tsx`
28. `tests/components/Initiatives/InitiativesHub.r11-wiring.source-anchor.test.ts`
29. `tests/components/Initiatives/InitiativesHub.t30-wiring.source-anchor.test.ts`
30. `tests/components/Initiatives/PortfolioAnalysisView.r13-wiring.source-anchor.test.ts`
31. `tests/components/Initiatives/TasksMilestonesSection.milestones.test.tsx`
32. `tests/components/Portfolio/PortfolioKanbanView.capabilities.test.tsx`
33. `tests/components/assessment/AssessmentHub.fiveSurfaces.t22-integration.test.tsx`
34. `tests/components/navigation/Sidebar.full-chat-routing.test.tsx`
35. `tests/components/navigation/Sidebar.mobile-overlay.test.tsx`
36. `tests/components/navigation/Sidebar/Sidebar.real-components.test.tsx`
37. `tests/components/navigation/Sidebar/Sidebar.test.tsx`
38. `tests/components/navigation/Sidebar/menuConfig.moduleStatusTruth.test.ts`
39. `tests/components/navigation/Sidebar/menuConfig.test.ts`
40. `tests/components/shared/ModuleHub/ModuleNavBar.button-type.test.tsx`
41. `tests/components/shared/ModuleHub/ModuleNavBar.search-a11y.test.tsx`
42. `tests/components/smoke/hubs.smoke.test.tsx`
43. `tests/navigation/routeMapping.test.ts`
44. `tests/unit/backend/wave5ArtifactRuntimeService.test.ts`
45. `tests/unit/i18n/results-module-naming.test.ts`
46. `tests/unit/initiatives-execution/initiativesHubCanonicalTabs.test.tsx`
47. `tests/unit/initiatives-execution/portfolioHealthWiring.test.ts`
48. `tests/unit/initiatives/initiativeRecordCanon.test.ts`
49. `tests/unit/koniecAngielskiegoP3.test.ts`
50. `tests/unit/superadmin/superAdminEntry.test.ts`

## RED -> GREEN

The reproduced baseline matched the W81 headline exactly: **13 red files, 32 failed tests/assertions, zero skipped**. Vitest reported 448 total assertions: 416 passed and 32 failed; two of the thirteen files failed during setup/source loading before registering a failed assertion.

Red file names:

- `tests/navigation/routeMapping.test.ts`
- `tests/unit/koniecAngielskiegoP3.test.ts`
- `tests/components/Initiatives/InitiativesHub.load-error-state.test.tsx`
- `tests/components/Initiatives/InitiativesHub.r11-wiring.source-anchor.test.ts`
- `tests/components/Initiatives/InitiativesHub.t30-wiring.source-anchor.test.ts`
- `tests/components/Initiatives/PortfolioAnalysisView.r13-wiring.source-anchor.test.ts`
- `tests/components/Portfolio/PortfolioKanbanView.capabilities.test.tsx`
- `tests/components/assessment/AssessmentHub.fiveSurfaces.t22-integration.test.tsx`
- `tests/components/smoke/hubs.smoke.test.tsx`
- `tests/unit/initiatives/initiativeRecordCanon.test.ts`
- `tests/unit/initiatives-execution/initiativesHubCanonicalTabs.test.tsx`
- `tests/unit/initiatives-execution/portfolioHealthWiring.test.ts`
- `src/components/Initiatives/__tests__/InitiativesHub.menu3Chips.test.tsx`

The exact same 50-file command after repair produced **50/50 files green, 453/453 assertions passed, zero failed, zero skipped**, with `--retry=0` and one worker.

## Additional evidence

- Focused repaired suites passed before the final denominator run.
- No product file changed, so no product importer or screenshot was required.
- Base type-check at exact `df3428e7e0`: frontend `193`, server `22`. First three frontend diagnostics were `ChatV9FlagsIndicator.test.tsx:137 TS2345`, `day374-canvasTooLong.i18n.test.tsx:38 TS2322`, and `UnifiedChatPanel.przewodyChat.test.tsx:206 TS2493`. First three server diagnostics were `server/src/index.ts:1579 TS2769`, `assessment-reports.routes.ts:3170 TS2345`, and `benefits.routes.ts:941 TS2345`.
- Candidate frontend type-check: **TIMEOUT_120 / NOT_PROVEN**; the full process group was stopped and the command was not rerun.
- Candidate server type-check: `22` diagnostics, equal to base. Its first three diagnostics are identical to base.
- `git diff --check`: clean.
- Disk checkpoint: `33 GiB` free, above the `20 GiB` stop threshold.

No staging, deployment, protected ref, screenshot, or `OD_CODEXA.md` change was made.
