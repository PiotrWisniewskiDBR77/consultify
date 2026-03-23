# V8 Deployment Readiness Plan

> Owner: Manager Agent
> Status: Planning (may run parallel with integration testing)
> Authority: Source-of-truth chat decision (2026-03-23)
> Rule: no production rollout before integration verification

---

## 1. Deployment scope

27 SQL migrations creating 104 `v8_`-prefixed tables. Zero modifications to existing tables. Zero modifications to existing application code. The V8 primitive layer is purely additive.

---

## 2. Migration strategy

### 2.1 Migration inventory

All 27 migrations share the date prefix `20260323` and use `CREATE TABLE IF NOT EXISTS` for idempotency.

| # | Migration file | Tables created | Dependencies |
|---|---|---|---|
| 1 | `20260323_v8_context_snapshot.sql` | 1 | None |
| 2 | `20260323_v8_execution_spine.sql` | 3 | None |
| 3 | `20260323_v8_collaboration_room.sql` | 4 | None |
| 4 | `20260323_v8_governed_retrieval.sql` | 2 | None |
| 5 | `20260323_v8_tool_governance.sql` | 4 | None |
| 6 | `20260323_v8_trust_audit.sql` | 4 | None |
| 7 | `20260323_v8_version_replay.sql` | 3 | None |
| 8 | `20260323_v8_pm_sync_truth.sql` | 4 | None |
| 9 | `20260323_v8_chat_execution.sql` | 2 | #1, #2 (FK refs) |
| 10 | `20260323_v8_knowledge_retrieval.sql` | 2 | None |
| 11 | `20260323_v8_prompt_os_runtime.sql` | 5 | None |
| 12 | `20260323_v8_source_truth.sql` | 2 | None |
| 13 | `20260323_v8_planning_continuity.sql` | 3 | None |
| 14 | `20260323_v8_execution_visibility.sql` | 4 | #2 (FK ref) |
| 15 | `20260323_v8_multiplayer_hardening.sql` | 5 | None |
| 16 | `20260323_v8_tool_collaboration.sql` | 3 | None |
| 17 | `20260323_v8_concurrent_editing.sql` | 6 | None |
| 18 | `20260323_v8_pm_sync_auth.sql` | 3 | None |
| 19 | `20260323_v8_replay_deadletter.sql` | 5 | None |
| 20 | `20260323_v8_operator_admin.sql` | 5 | None |
| 21 | `20260323_v8_reports_pres_model.sql` | 4 | None |
| 22 | `20260323_v8_results_roi.sql` | 5 | None |
| 23 | `20260323_v8_finance_integration.sql` | 5 | None |
| 24 | `20260323_v8_publish_review.sql` | 5 | None |
| 25 | `20260323_v8_mywork_roof.sql` | 4 | None |
| 26 | `20260323_v8_tools_org_admin.sql` | 5 | None |
| 27 | `20260323_v8_landing_superadmin.sql` | 5 | None |

### 2.2 Migration execution order

1. Run Wave 1 migrations first (#1-#8) — no inter-dependencies.
2. Run Wave 2 migrations (#9-#11) — #9 has FK refs to Wave 1 tables.
3. Run remaining migrations (#12-#27) in any order — #14 has FK ref to #2.

Recommended: alphabetical order (matches filename sort) with transaction wrapping per migration.

### 2.3 Migration safety

| Property | Status |
|---|---|
| All use `CREATE TABLE IF NOT EXISTS` | Yes — idempotent |
| All use `v8_` prefix | Yes — no collision with existing tables |
| No `ALTER TABLE` on existing tables | Yes — purely additive |
| No data migration from existing tables | Yes — clean schema |
| Transaction-safe | Each migration should run in a transaction |

---

## 3. Rollback strategy

### 3.1 Schema rollback

Since all V8 tables are new and prefixed with `v8_`, rollback is straightforward:

```sql
-- Emergency rollback: drop all V8 tables
-- Generate from: SELECT 'DROP TABLE IF EXISTS ' || name || ';'
--   FROM sqlite_master WHERE type='table' AND name LIKE 'v8_%';
```

This does not affect any existing application table.

### 3.2 Service rollback

All 27 V8 services are new files. No existing service was modified. Rollback = revert the deployment to the previous version. Feature flags (§4) provide a softer rollback path.

### 3.3 Rollback decision matrix

| Scenario | Action |
|---|---|
| Migration fails mid-run | Transaction rollback; retry after fix |
| Integration test regression in staging | Block deployment; fix and re-test |
| Production anomaly after deployment | Disable feature flags; investigate |
| Critical production issue | Full revert to previous deployment + drop V8 tables |

---

## 4. Feature flag strategy

### 4.1 Flag hierarchy

```
v8_runtime_enabled                    (master kill switch)
├── v8_ai_runtime_enabled             (Wave 1-2: AI spine + integration)
│   ├── v8_chat_execution_enabled     (Chat → Execution handoff)
│   ├── v8_knowledge_retrieval_enabled (Knowledge + Retrieval)
│   └── v8_prompt_os_enabled          (Prompt OS runtime)
├── v8_lifecycle_enabled              (Wave 3: transformation lifecycle)
├── v8_multiplayer_enabled            (Wave 4: collaboration hardening)
│   ├── v8_facilitation_enabled       (Facilitation sessions)
│   ├── v8_concurrent_editing_enabled (Locking, conflicts)
│   └── v8_notification_spine_enabled (Notification triggers)
├── v8_external_sync_enabled          (Wave 5: PM sync hardening)
│   ├── v8_dead_letter_enabled        (Dead-letter queue)
│   └── v8_operator_admin_enabled     (Operator surfaces)
├── v8_outputs_enabled                (Wave 6: outputs/finance/results)
│   ├── v8_reports_pres_enabled       (Reports/Presentations)
│   ├── v8_results_roi_enabled        (Results/ROI)
│   ├── v8_finance_enabled            (Finance integration)
│   └── v8_publish_review_enabled     (Publish/review)
└── v8_roof_enabled                   (Wave 7: roof package)
    ├── v8_mywork_enabled             (MyWork surfaces)
    ├── v8_tools_admin_enabled        (Tools/Admin)
    └── v8_landing_enabled            (Landing/Superadmin)
```

### 4.2 Flag rules

- Master flag `v8_runtime_enabled` = `false` by default in production.
- Child flags only evaluated when parent is `true`.
- Flags are org-scoped (tenant-level enablement).
- Flag changes are audited.

---

## 5. Rollout strategy

### 5.1 Rollout phases

| Phase | Scope | Duration | Gate to next |
|---|---|---|---|
| **R0 — Staging** | Full V8 stack on staging environment | 1 week | All integration tests pass on staging |
| **R1 — Internal dogfood** | `v8_runtime_enabled=true` for internal org(s) only | 2 weeks | No P0/P1 issues; operator surfaces functional |
| **R2 — Canary** | Enable for 1-2 selected tenant orgs | 2 weeks | No regressions; performance within bounds |
| **R3 — Gradual rollout** | Expand to 10% → 25% → 50% → 100% of tenants | 4-6 weeks | Each step gated on error rate, latency, support volume |

### 5.2 Rollout decision authority

| Decision | Authority |
|---|---|
| Advance to next rollout phase | Product owner + Engineering lead |
| Emergency rollback | Any on-call engineer (with post-mortem) |
| Feature flag changes in production | Requires approval from 2 team members |

---

## 6. Support readiness

### 6.1 Operator knowledge

| Topic | Documentation | Status |
|---|---|---|
| V8 table schema reference | Migration files + type definitions | Available |
| Service API reference | 27 service files with JSDoc | Available |
| Feature flag reference | §4 of this document | Available |
| Rollback procedure | §3 of this document | Available |
| Escalation path | Standard on-call + V8 program owner | To be confirmed |

### 6.2 Monitoring requirements

| Signal | Source | Alert threshold |
|---|---|---|
| V8 service error rate | Application logs | > 1% of V8 service calls |
| Migration execution time | Deployment pipeline | > 60s per migration |
| Feature flag state changes | Flag audit log | Any change in production |
| V8 table row counts | DB monitoring | Unexpected growth patterns |
| Integration test results | CI pipeline | Any failure blocks deployment |

### 6.3 Support runbook items (to create before R1)

- [ ] "V8 tables are empty" — expected until feature flags are enabled
- [ ] "V8 service returns error" — check feature flag state first
- [ ] "Migration failed" — transaction rollback procedure
- [ ] "Need to disable V8 for one tenant" — org-scoped flag procedure
- [ ] "Need to disable V8 globally" — master kill switch procedure

---

## 7. Pre-deployment checklist

| # | Item | Status |
|---|---|---|
| 1 | Integration tests T1 (contracts) pass | Pending |
| 2 | Integration tests T2 (flows) pass | Pending |
| 3 | Integration tests T3 (migrations) pass | Pending |
| 4 | Feature flag infrastructure confirmed | Pending |
| 5 | Rollback procedure tested on staging | Pending |
| 6 | Monitoring dashboards created | Pending |
| 7 | Support runbook items written | Pending |
| 8 | Staging deployment successful | Pending |
| 9 | Internal dogfood org identified | Pending |
| 10 | Product owner sign-off | Pending |

---

## Related documents

- `V8_INTEGRATION_TEST_PROGRAM.md` — integration test specification
- `V8_UI_WIRING_QUEUE.md` — UI surface wiring queue
- `IMPLEMENTATION_CONTROL_BOARD.md` — program status
