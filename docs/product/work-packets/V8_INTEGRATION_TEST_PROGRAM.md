# V8 Integration Test Program

> Owner: Manager Agent
> Status: Active — mandatory gate before any production rollout
> Authority: Source-of-truth chat decision (2026-03-23)
> Rule: no production rollout before integration verification

---

## 1. Purpose

Unit tests (1,837 passing) verify each of the 27 V8 services in isolation with mocked DB. Integration tests verify that **cross-service contracts hold** when services are composed — proving the V8 primitive layer works as a coherent system, not just 27 independent modules.

---

## 2. Integration test tiers

| Tier | Scope | What it proves | Gate |
|---|---|---|---|
| **T1 — Contract** | Type-level: Zod schemas parse outputs of upstream services | Services produce data that downstream services can consume | Hard gate |
| **T2 — Flow** | Multi-service orchestration: service A calls service B with real return values | End-to-end flows work across service boundaries | Hard gate |
| **T3 — Data** | Migration-level: all 27 migrations run in sequence without conflict on a real SQLite DB | Schema is consistent, no table/index collisions | Hard gate |

---

## 3. T1 — Contract integration tests

Verify that the output of one service can be parsed by the input schema of another.

| # | Upstream service | Downstream service | Contract point | Test description |
|---|---|---|---|---|
| C01 | `contextSnapshotService.captureSnapshot()` | `chatExecutionService.initiateHandoff()` | `contextSnapshotId` | Snapshot output ID is valid input for handoff |
| C02 | `executionSpineService.createRun()` | `chatExecutionService.initiateHandoff()` | `executionRunId` | Run output ID is valid input for handoff |
| C03 | `executionSpineService.createProposal()` | `chatExecutionService.createChatActionProposal()` | `underlyingProposalId` | Proposal ID bridges execution → chat facade |
| C04 | `governedRetrievalService.createRetrievalRequest()` | `knowledgeRetrievalService.orchestrateRetrieval()` | `retrievalRequestId` | Retrieval request feeds orchestration |
| C05 | `trustAuditService.assignTrustClass()` | `knowledgeRetrievalService.orchestrateRetrieval()` | `mergedTrustClass` | Trust class feeds orchestrated result |
| C06 | `promptOsRuntimeService.createReleaseBundle()` | `reportsPresModelService.setAIGovernanceConfig()` | `presetRef` | Release bundle ref feeds output AI governance |
| C07 | `contextSnapshotService.captureSnapshot()` | `sourceTruthService.recordSourceMaterialization()` | `contextSnapshotId` | Snapshot feeds source traceability |
| C08 | `executionSpineService.createRun()` | `executionVisibilityService.createRebaselineProposal()` | `executionRunId` | Run feeds rebaseline via shared spine |
| C09 | `collaborationRoomService.createRoom()` | `multiplayerHardeningService.startFacilitationSession()` | `roomId` | Room feeds facilitation lifecycle |
| C10 | `collaborationRoomService.createRoom()` | `multiplayerHardeningService.updateSurfacePresence()` | `roomId` | Room feeds surface-aware presence |
| C11 | `pmSyncTruthService.setConnectorAuthState()` | `pmSyncAuthService.checkEscalationLevel()` | `connectorId` + auth state | Auth state feeds escalation ladder |
| C12 | `replayDeadLetterService.createDeadLetterRecord()` | `operatorAdminService.recordFleetHealth()` | `deadLetterCount` | Dead-letter count feeds fleet health |
| C13 | `resultsROIService.createKPI()` | `resultsROIService.initiateReconciliation()` | `kpiId` | KPI feeds reconciliation (Results starts) |
| C14 | `reportsPresModelService.createOutputArtifact()` | `publishReviewService.createPublishRecord()` | `artifactId` | Output artifact feeds publish lifecycle |
| C15 | `financeIntegrationService.evaluatePromotionGate()` | `sourceTruthService.validatePromotion()` | Dual-gate result | Finance gate aligns with source truth validation |
| C16 | `executionVisibilityService.emitSignal()` | `myWorkRoofService.recordInboxMaterialization()` | Signal → inbox | Execution signals feed inbox materialization |
| C17 | `toolGovernanceService.registerTool()` | `toolsOrgAdminService.registerTool()` | Tool identity | V8 tool governance aligns with shared registry |
| C18 | `concurrentEditingService.acquireLock()` | `collaborationRoomService.recordEvent()` | `lock.acquired` event | Lock acquisition produces room event |

---

## 4. T2 — Flow integration tests

Multi-service orchestration scenarios.

| # | Flow name | Services involved | Scenario |
|---|---|---|---|
| F01 | **Chat → Execution full handoff** | contextSnapshot → executionSpine → chatExecution | User message classified as `governed_work` → snapshot captured → run created → handoff recorded → chat proposal facade created |
| F02 | **Knowledge retrieval with trust** | governedRetrieval → trustAudit → knowledgeRetrieval | Retrieval request created → ACL checked → trust class assigned → working memory combined → orchestrated result returned |
| F03 | **Prompt release → output generation** | promptOsRuntime → reportsPresModel | Preset created → bundle released → eval gate passed → bundle activated → output artifact created with governance ref |
| F04 | **Initiative lifecycle end-to-end** | sourceTruth → planningContinuity → executionVisibility | Source materialized → WBS decomposed → signals emitted → aggregated → handoff event emitted |
| F05 | **Multiplayer room lifecycle** | collaborationRoom → multiplayerHardening → concurrentEditing | Room created → surface presence updated → facilitation started → lock acquired → conflict recorded → notification created |
| F06 | **PM sync failure → recovery** | pmSyncTruth → pmSyncAuth → replayDeadLetter → operatorAdmin | Auth state degraded → failure classified → dead-letter created → fleet health updated → emergency pause initiated |
| F07 | **Output publish → recall** | reportsPresModel → publishReview → financeIntegration | Output created → publish lifecycle → review gate → coordinated publish → recall (auditable, lineage preserved) |
| F08 | **KPI → Finance reconciliation** | resultsROI → financeIntegration → executionVisibility | KPI created → deviation recorded → reconciliation initiated → delta escalation → executive review pack |
| F09 | **Tool session governance** | toolGovernance → toolsOrgAdmin → toolCollaboration | Tool registered → session governance created → action gate evaluated → adapter registered |
| F10 | **MyWork cross-surface** | myWorkRoof → executionVisibility → concurrentEditing | Canonical state set → surface projections → inbox materialized → latency tracked |

---

## 5. T3 — Migration integration tests

| # | Test | Description |
|---|---|---|
| M01 | **Sequential migration run** | All 27 migrations execute in alphabetical order on a fresh SQLite DB without errors |
| M02 | **Table collision check** | No duplicate table names across all 27 migration files |
| M03 | **Index collision check** | No duplicate index names across all 27 migration files |
| M04 | **Foreign key consistency** | All FK references point to tables that exist after full migration |
| M05 | **v8_ prefix enforcement** | Every table created by V8 migrations starts with `v8_` |
| M06 | **Idempotent re-run** | All migrations use `CREATE TABLE IF NOT EXISTS` and can be re-run safely |

---

## 6. Test file structure

```
server/src/services/v8/__tests__/
  integration/
    t1-contracts/
      contractIntegration.test.ts       (C01-C18)
    t2-flows/
      chatExecutionFlow.test.ts         (F01)
      knowledgeRetrievalFlow.test.ts    (F02)
      promptOutputFlow.test.ts          (F03)
      initiativeLifecycleFlow.test.ts   (F04)
      multiplayerRoomFlow.test.ts       (F05)
      pmSyncRecoveryFlow.test.ts        (F06)
      outputPublishFlow.test.ts         (F07)
      kpiReconciliationFlow.test.ts     (F08)
      toolGovernanceFlow.test.ts        (F09)
      myWorkCrossSurfaceFlow.test.ts    (F10)
    t3-migrations/
      migrationIntegrity.test.ts        (M01-M06)
```

---

## 7. Pass criteria

| Gate | Requirement | Blocks |
|---|---|---|
| **T1 pass** | All 18 contract tests green | T2 execution |
| **T2 pass** | All 10 flow tests green | Production deployment |
| **T3 pass** | All 6 migration tests green | Production deployment |
| **All tiers pass** | T1 + T2 + T3 | UI wiring may begin (feature-flagged slices only) |

---

## 8. Execution plan

| Step | Action | Dependency |
|---|---|---|
| 1 | Implement T3 (migration integrity) | None — can start immediately |
| 2 | Implement T1 (contract tests) | None — can run parallel with T3 |
| 3 | Run T1 + T3 | Steps 1-2 complete |
| 4 | Implement T2 (flow tests) | T1 pass |
| 5 | Run full suite (T1 + T2 + T3) | Steps 3-4 complete |
| 6 | Report results to ICB | Step 5 complete |

---

## Related documents

- `IMPLEMENTATION_CONTROL_BOARD.md` — Report #11 (program complete)
- `DECISION_LOG_PROGRAM_CONTROL.md` — conditional build phase approval
