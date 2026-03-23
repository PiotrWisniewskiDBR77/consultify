# V8 UI Wiring Queue

> Owner: Manager Agent
> Status: Gated — only after integration tests pass
> Authority: Source-of-truth chat decision (2026-03-23)
> Rules:
> - every UI slice must be bounded, reversible and feature-flagged
> - no broad UI rewiring in one pass
> - only controlled, feature-flagged slices after integration gate passes

---

## 1. Governing principles

1. **Bounded**: each slice touches one module surface, not cross-cutting UI.
2. **Reversible**: feature flag disables the slice; existing UI remains unchanged.
3. **Feature-flagged**: every slice is gated by its wave-level flag + a slice-specific flag.
4. **Incremental**: slices are ordered by dependency and risk, not by wave number.
5. **No existing UI modification without flag**: existing components are not changed; V8 surfaces are additive behind flags.

---

## 2. UI wiring slices

### Priority 1 — Operator/admin surfaces (lowest user-facing risk)

These surfaces are internal-facing and have the lowest blast radius.

| Slice | V8 services consumed | UI surface | Feature flag | Risk |
|---|---|---|---|---|
| **UI-01** Operator connector fleet dashboard | `operatorAdminService`, `pmSyncAuthService`, `replayDeadLetterService` | Superadmin → Connectors | `v8_operator_admin_enabled` | Low — new surface, no existing UI change |
| **UI-02** Dead-letter queue viewer | `replayDeadLetterService` | Superadmin → Connectors → Dead Letters | `v8_dead_letter_enabled` | Low — new surface |
| **UI-03** Provider health dashboard | `replayDeadLetterService.getProviderHealth()` | Superadmin → Connectors → Provider Health | `v8_external_sync_enabled` | Low — new surface |
| **UI-04** Emergency pause controls | `operatorAdminService.initiateEmergencyPause()` | Superadmin → Connectors → Emergency | `v8_operator_admin_enabled` | Medium — has side effects (pauses sync) |

### Priority 2 — AI runtime observability (internal + power-user)

| Slice | V8 services consumed | UI surface | Feature flag | Risk |
|---|---|---|---|---|
| **UI-05** Trust/audit trace viewer | `trustAuditService` | Superadmin → AI Operations | `v8_ai_runtime_enabled` | Low — read-only surface |
| **UI-06** Prompt OS release dashboard | `promptOsRuntimeService` | Superadmin → AI Operations → Prompts | `v8_prompt_os_enabled` | Low — read-only surface |
| **UI-07** Tool governance catalog | `toolGovernanceService` | Superadmin → AI Operations → Tools | `v8_ai_runtime_enabled` | Low — read-only surface |
| **UI-08** Execution run inspector | `executionSpineService`, `chatExecutionService` | Superadmin → AI Operations → Runs | `v8_chat_execution_enabled` | Low — read-only surface |

### Priority 3 — Collaboration indicators (user-facing, low risk)

| Slice | V8 services consumed | UI surface | Feature flag | Risk |
|---|---|---|---|---|
| **UI-09** Room presence indicators | `collaborationRoomService`, `multiplayerHardeningService` | Workspace tool headers | `v8_multiplayer_enabled` | Medium — visible to all users in workspace |
| **UI-10** Lock indicators | `concurrentEditingService` | Workspace tool editing surfaces | `v8_concurrent_editing_enabled` | Medium — affects editing UX |
| **UI-11** Notification inbox integration | `concurrentEditingService` (notification records) | My Work → Inbox | `v8_notification_spine_enabled` | Medium — new inbox items |

### Priority 4 — Output/finance governance (user-facing, medium risk)

| Slice | V8 services consumed | UI surface | Feature flag | Risk |
|---|---|---|---|---|
| **UI-12** Output delivery state tracker | `reportsPresModelService` | Reports/Presentations module | `v8_reports_pres_enabled` | Medium — new state indicators |
| **UI-13** Publish/review workflow | `publishReviewService` | Reports/Presentations → Publish | `v8_publish_review_enabled` | Medium — new workflow gates |
| **UI-14** KPI dashboard integration | `resultsROIService` | Results module | `v8_results_roi_enabled` | Medium — new data source |
| **UI-15** Finance promotion gates | `financeIntegrationService` | Finance → Initiative promotion | `v8_finance_enabled` | High — affects data flow between modules |

### Priority 5 — Lifecycle/planning (user-facing, higher risk)

| Slice | V8 services consumed | UI surface | Feature flag | Risk |
|---|---|---|---|---|
| **UI-16** Source traceability indicators | `sourceTruthService` | Initiatives → Source tab | `v8_lifecycle_enabled` | Medium — new metadata on initiatives |
| **UI-17** WBS depth visualization | `planningContinuityService` | Initiatives → Planning | `v8_lifecycle_enabled` | Medium — new planning view |
| **UI-18** Execution signal dashboard | `executionVisibilityService` | Initiatives → Execution | `v8_lifecycle_enabled` | Medium — new signal aggregation |
| **UI-19** Chat → Execution handoff UX | `chatExecutionService` | Chat module | `v8_chat_execution_enabled` | High — modifies chat interaction model |

### Priority 6 — MyWork/Landing (user-facing, highest visibility)

| Slice | V8 services consumed | UI surface | Feature flag | Risk |
|---|---|---|---|---|
| **UI-20** Home block maturity labels | `myWorkRoofService` | My Work → Home | `v8_mywork_enabled` | Medium — visible maturity indicators |
| **UI-21** Cross-surface state sync | `myWorkRoofService` | My Work → all surfaces | `v8_mywork_enabled` | High — affects state consistency |
| **UI-22** Tools registry integration | `toolsOrgAdminService` | Tools module | `v8_tools_admin_enabled` | Medium — new registry source |
| **UI-23** Landing page V8 content | `landingSuperadminService` | Landing page | `v8_landing_enabled` | High — public-facing |

---

## 3. Slice execution rules

### 3.1 Per-slice checklist

Before starting any slice:

- [ ] Integration tests for consumed V8 services pass (T1 + T2)
- [ ] Feature flag exists and defaults to `false`
- [ ] Slice scope document written (max 1 page: what changes, what doesn't, rollback)
- [ ] Existing UI behavior preserved when flag is `false`
- [ ] Slice has a dedicated test (V8 surface renders correctly when flag is `true`)
- [ ] Slice has a rollback test (existing UI unchanged when flag is `false`)

### 3.2 Slice completion criteria

- [ ] Feature flag toggles the slice on/off without side effects
- [ ] No existing UI regression when flag is `false`
- [ ] V8 surface functional when flag is `true`
- [ ] Slice reviewed by at least one team member
- [ ] Slice deployed to staging and verified

### 3.3 Batch rules

- Maximum 3 slices in parallel development.
- No two slices from the same Priority group in parallel (reduces blast radius).
- Each batch must complete staging verification before the next batch starts.

---

## 4. Dependency graph

```
Integration Tests Pass (hard gate)
    │
    ├── Priority 1 (UI-01 to UI-04) — Operator surfaces
    │       │
    │       ├── Priority 2 (UI-05 to UI-08) — AI observability
    │       │       │
    │       │       └── Priority 3 (UI-09 to UI-11) — Collaboration
    │       │               │
    │       │               ├── Priority 4 (UI-12 to UI-15) — Outputs
    │       │               │       │
    │       │               │       └── Priority 5 (UI-16 to UI-19) — Lifecycle
    │       │               │               │
    │       │               │               └── Priority 6 (UI-20 to UI-23) — MyWork/Landing
    │       │               │
    │       │               └── (independent path for Priority 4-6 where no dependency)
    │       │
    │       └── (Priority 2 can start as soon as Priority 1 batch 1 passes staging)
    │
    └── Each priority level gates the next
```

---

## 5. Timeline estimate

| Phase | Slices | Estimated duration | Gate |
|---|---|---|---|
| Priority 1 | UI-01 to UI-04 | 1-2 weeks | Staging verification |
| Priority 2 | UI-05 to UI-08 | 1-2 weeks | Staging verification |
| Priority 3 | UI-09 to UI-11 | 2 weeks | Staging verification + user testing |
| Priority 4 | UI-12 to UI-15 | 2-3 weeks | Staging verification + user testing |
| Priority 5 | UI-16 to UI-19 | 2-3 weeks | Staging verification + user testing |
| Priority 6 | UI-20 to UI-23 | 2-3 weeks | Staging verification + user testing |
| **Total** | **23 slices** | **10-15 weeks** | Full V8 UI rollout |

---

## Related documents

- `V8_INTEGRATION_TEST_PROGRAM.md` — integration test specification (hard gate)
- `V8_DEPLOYMENT_READINESS_PLAN.md` — deployment strategy
- `IMPLEMENTATION_CONTROL_BOARD.md` — program status
