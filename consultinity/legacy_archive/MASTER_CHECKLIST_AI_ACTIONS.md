# MASTER CHECKLIST — AI Actions + Playbooks Enterprise System (Steps 9–18)

> **Legenda statusów:**
> - ✅ Istnieje / OK
> - ⚠️ Częściowe / Wymaga weryfikacji
> - ❌ Brakuje
> - 🔍 Do sprawdzenia manualnie

---

## A. Platform Core: Organizacja, RBAC, Permissions

### A1. Identity & Org Context

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| A1.1 | Middleware ustawia `req.user` oraz `req.organizationId` | `server/middleware/auth.js` | 🔍 | |
| A1.2 | Każdy endpoint ADMIN filtruje po `organization_id` | Wszystkie routes w `server/routes/` | 🔍 | |
| A1.3 | SUPERADMIN ma jawny bypass, ale logowany (audit) | `server/middleware/requireAuth.js`, `governanceAuditService.js` | 🔍 | |

### A2. Role + PBAC (Step 14)

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| A2.1 | Permissions catalog (min. 30) | `server/migrations/014_governance_enterprise.sql` → tabela `permissions` | 🔍 | |
| A2.2 | Role → permissions map (`role_permissions`) z defaultami | `server/migrations/014_governance_enterprise.sql` | 🔍 | |
| A2.3 | User overrides per org (`org_user_permissions`) działają | `server/services/permissionService.js` | 🔍 | |
| A2.4 | `permissionMiddleware` na admin/superadmin endpoints | `server/middleware/permissionMiddleware.js` | 🔍 | |
| A2.5 | Deny-by-default: brak permission = 403 | `server/services/permissionService.js` | 🔍 | |

### A3. Governance UI

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| A3.1 | `PermissionManager.tsx` działa | `components/governance/PermissionManager.tsx` | ✅ | |
| A3.2 | Uprawnienia nie przeciekają między organizacjami | Test: `tests/integration/` | 🔍 | |
| A3.3 | UI pokazuje kto ma jakie permissions (z filtrami) | `components/governance/PermissionManager.tsx` | 🔍 | |

---

## B. Step 9.1 — Action Proposal Engine (No Side Effects)

### B1. Deterministic Engine

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| B1.1 | `actionProposalMapper.js` mapuje sygnały → proposals | `server/ai/actionProposalMapper.js` | ✅ | |
| B1.2 | Engine nie wykonuje żadnych zapisów do DB | `server/ai/actionProposalEngine.js` | ✅ | |
| B1.3 | Proposals sortowane deterministycznie (`proposal_id`) | `server/ai/actionProposalEngine.js` | 🔍 | |

### B2. Mandatory Proposal Model

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| B2.1 | Output zawiera: `proposal_id`, `origin_signal`, `title`, `action_type`, `scope` | `server/ai/actionProposalMapper.js` | 🔍 | |
| B2.2 | Output zawiera: `payload_preview`, `risk_level`, `expected_impact`, `simulation` | `server/ai/actionProposalMapper.js` | 🔍 | |
| B2.3 | `requires_approval: true` zawsze | `server/ai/actionProposalMapper.js` | 🔍 | |
| B2.4 | JSON schema / test waliduje strukturę | `tests/unit/actionProposalEngine.test.js` | ✅ | |

### B3. API

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| B3.1 | `GET /api/ai/actions/proposals` istnieje | `server/routes/ai.js` | 🔍 | |
| B3.2 | RBAC: ADMIN/SUPERADMIN only | `server/routes/ai.js` | 🔍 | |
| B3.3 | Endpoint jest org-scoped | `server/routes/ai.js` | 🔍 | |

### B4. Tests

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| B4.1 | `actionProposalEngine.test.js` przechodzi | `tests/unit/actionProposalEngine.test.js` | ✅ | |

---

## C. Step 9.2 — Approval & Audit Layer (Tamper-proof)

### C1. DB: action_decisions (hardened)

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| C1.1 | Tabela `action_decisions` z polami: `organization_id`, `action_type`, `scope` | `database.sqlite.active.js` lub `database.postgres.js` | 🔍 | |
| C1.2 | Pole `proposal_snapshot` (source of truth) | DB schema | 🔍 | |
| C1.3 | Pole `modified_payload`, `decision_reason` | DB schema | 🔍 | |
| C1.4 | Indexy na `proposal_id`, `org_id`, `created_at` | DB schema | 🔍 | |

### C2. Service Logic

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| C2.1 | `proposal_snapshot` NIE z klienta (server fetch) | `server/ai/actionDecisionService.js` | 🔍 | |
| C2.2 | `getProposalById(orgId, proposalId)` istnieje | `server/ai/actionDecisionService.js` | 🔍 | |
| C2.3 | MODIFIED allowlist per `action_type` | `server/ai/actionDecisionService.js` | 🔍 | |
| C2.4 | Double approval conflict → HTTP 409 | `server/ai/actionDecisionService.js` | 🔍 | |

### C3. API

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| C3.1 | `POST /api/ai/actions/decide` - strict body parsing, RBAC, org isolation | `server/routes/actionDecisions.js` | 🔍 | |
| C3.2 | `GET /api/ai/actions/audit` - org-scoped dla ADMIN | `server/routes/actionDecisions.js` | 🔍 | |
| C3.3 | SUPERADMIN bypass (explicit flag) | `server/routes/actionDecisions.js` | 🔍 | |

### C4. Tests

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| C4.1 | Testy integracyjne approval & audit przechodzą | `tests/integration/actionDecision.test.js` | ✅ | |

---

## D. Step 9.3 — Execution Adapter (Hardened)

### D1. DB: action_executions

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| D1.1 | Tabela `action_executions` append-only | DB schema | 🔍 | |
| D1.2 | Pola: `decision_id`, `proposal_id`, `action_type`, `organization_id` | DB schema | 🔍 | |
| D1.3 | Pola: `error_code`, `error_message` | DB schema | 🔍 | |
| D1.4 | Indexy: `decision_id`, `org + created_at` | DB schema | 🔍 | |

### D2. Execution Rules

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| D2.1 | Execution używa `proposal_snapshot`, nie client payload | `server/ai/actionExecutionAdapter.js` | 🔍 | |
| D2.2 | Idempotency: drugi execute → `idempotent_replay=true` | `server/ai/actionExecutionAdapter.js` | 🔍 | |
| D2.3 | REJECTED nie jest wykonywany (400) | `server/ai/actionExecutionAdapter.js` | 🔍 | |
| D2.4 | Cross-org guard: ADMIN nie wykona obcej org | `server/ai/actionExecutionAdapter.js` | 🔍 | |

### D3. Executors

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| D3.1 | `TaskExecutor` istnieje | `server/ai/actionExecutors/taskExecutor.js` | 🔍 | |
| D3.2 | `PlaybookExecutor` istnieje | `server/ai/actionExecutors/playbookExecutor.js` | ✅ | |
| D3.3 | `MeetingExecutor` istnieje | `server/ai/actionExecutors/meetingExecutor.js` | 🔍 | |
| D3.4 | MeetingExecutor w mock → `metadata.mock=true` | `server/ai/actionExecutors/meetingExecutor.js` | 🔍 | |

### D4. API

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| D4.1 | `POST /api/ai/actions/decisions/:id/execute` działa | `server/routes/actionDecisions.js` | 🔍 | |
| D4.2 | Response contract stabilny (`execution_id`, `status`, `result`…) | `server/routes/actionDecisions.js` | 🔍 | |

### D5. Tests

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| D5.1 | Execution tests przechodzą (idempotent + cross-org + rejected) | `tests/integration/actionExecution.test.js` | ✅ | |

---

## E. Step 9.4 — UI: AI Action Proposals

### E1. UI Screens

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| E1.1 | `ActionProposalDetail.tsx` z reasoning, evidence, simulation | `components/ai/ActionProposalDetail.tsx` | ✅ | |
| E1.2 | `ActionProposalList.tsx` z risk badges, action icons | `components/ai/ActionProposalList.tsx` | ✅ | |
| E1.3 | Pending Approvals + Audit Trail widoki | `components/ai/ActionAuditTrail.tsx` | ✅ | |

### E2. Decision UX

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| E2.1 | `ActionDecisionDialog.tsx` - reason required for reject | `components/ai/ActionDecisionDialog.tsx` | ✅ | |
| E2.2 | Confirmation before execute | `components/ai/ActionDecisionDialog.tsx` | 🔍 | |

### E3. Audit UI

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| E3.1 | `ActionAuditTrail.tsx` pokazuje kto/kiedy/co/why | `components/ai/ActionAuditTrail.tsx` | ✅ | |
| E3.2 | UI respektuje RBAC | `components/ai/ActionAuditTrail.tsx` | 🔍 | |

---

## F. Step 9.5 — Observability & Error Catalog

### F1. Error Catalog

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| F1.1 | `actionErrors.js` zawiera kody: `RBAC_DENIED`, `NOT_FOUND`, etc. | `server/ai/actionErrors.js` | ✅ | |
| F1.2 | Wszystkie błędy execution mają `error_code` | `server/ai/actionExecutionAdapter.js` | 🔍 | |

### F2. Structured Logging

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| F2.1 | `auditLogger.js` / `aiAuditLogger.js` loguje JSON z timestamp, event, correlation_id | `server/services/aiAuditLogger.js` | ✅ | |
| F2.2 | Logi zawierają: `org_id`, `action_type`, `status` | `server/services/aiAuditLogger.js` | 🔍 | |

### F3. Correlation & Duration

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| F3 | Correlation & Tracing | `server/ai/actionProposalMapper.js`, `aiAuditLogger.js` | ✅ | `correlation_id` tracing (Proposal -> Decision -> Execution) |
| F3.2 | `duration_ms` zapisywany dla execution | `server/ai/actionExecutionAdapter.js` | 🔍 | |

---

## G. Step 9.6 — Dry-run Execution Contract

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| G.1 | `POST /api/ai/actions/decisions/:id/dry-run` działa | `server/routes/actionDecisions.js` | 🔍 | |
| G.2 | Dry-run nie robi DB writes | `server/ai/actionExecutionAdapter.js` | 🔍 | |
| G.3 | Dry-run zwraca `would_do`, `external_calls`, `validation` | `server/ai/actionExecutionAdapter.js` | 🔍 | |
| G.4 | Dry-run używa tej samej walidacji co real execute | `server/ai/actionExecutionAdapter.js` | 🔍 | |

---

## H. Step 9.7 — Retention + Export (Audit/Executions)

### H1. Export Service

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| H1.1 | `auditExport.js` eksportuje CSV i JSON | `server/ai/auditExport.js` | ✅ | |
| H1.2 | `/api/ai/actions/audit/export` endpoint | `server/routes/actionDecisions.js` | 🔍 | |
| H1.3 | `/api/ai/actions/executions/export` endpoint | `server/routes/actionDecisions.js` | 🔍 | |
| R5.1 | CSV/JSON export redacts PII | `server/ai/auditExport.js` | ✅ | |

### H2. Retention Script

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| H2.1 | `ai_audit_retention.js` istnieje | `server/scripts/` lub `server/cron/` | 🔍 | |
| H2.2 | Soft archive (`archived_at`), brak hard delete | Retention script | 🔍 | |
| H2.3 | `AI_AUDIT_RETENTION_DAYS` configurable | Retention script / `.env` | 🔍 | |
| H2.4 | `--dry-run` działa i nic nie zmienia | Retention script | 🔍 | |

---

## I. Step 9.8 — Policy Engine (Auto-Approval)

### I1. DB

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| I1.1 | Tabela `ai_policy_rules` | DB schema | 🔍 | |
| I1.2 | Tabela `ai_policy_settings` (global toggle) | DB schema | 🔍 | |
| I1.3 | `policy_rule_id` w `action_decisions` | DB schema | 🔍 | |

### I2. Policy Logic

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| I2.1 | HIGH risk never auto-approve | `server/ai/policyEngine.js` | 🔍 | |
| I2.2 | MEETING_SCHEDULE always manual | `server/ai/policyEngine.js` | 🔍 | |
| I2.3 | Unknown conditions fail safe | `server/ai/policyEngine.js` | 🔍 | |
| I2.4 | `max_actions_per_day` działa | `server/ai/policyEngine.js` | 🔍 | |
| I2.5 | `time_window` działa | `server/ai/policyEngine.js` | 🔍 | |
| I2.6 | Global kill switch (SUPERADMIN) | `server/ai/policyEngine.js` | 🔍 | |

### I3. API + UI

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| I3.1 | CRUD rules endpoints działają | `server/routes/` (policy routes) | 🔍 | |
| I3.2 | UI pokazuje "AUTO-APPROVED (Policy)" + rule id | `components/ai/ActionProposalDetail.tsx` | 🔍 | |
| I3.3 | Pre-check endpoint `/evaluate-policy` | `server/routes/` | 🔍 | |

### I4. Tests

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| I4.1 | `policyEngine.test.js` green | `tests/unit/policyEngine.test.js` | ✅ | |

---

## J. Step 10–12 — AI Playbooks + Branching

### J1. DB: Templates + Runs + Steps

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| J1.1 | Tabela `ai_playbook_templates` | DB schema | 🔍 | |
| J1.2 | Tabela `ai_playbook_template_steps` | DB schema | 🔍 | |
| J1.3 | Tabela `ai_playbook_runs` | DB schema | 🔍 | |
| J1.4 | Tabela `ai_playbook_run_steps` | DB schema | 🔍 | |

### J2. Step Types (Step 12)

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| J2.1 | `step_type`: ACTION, CHECK, WAIT, BRANCH, AI_ROUTER | `server/ai/aiPlaybookService.js` | 🔍 | |
| J2.2 | `branch_rules`, `next_step_id` | `server/ai/aiPlaybookRoutingEngine.js` | 🔍 | |
| J2.3 | `inputs_schema`, `outputs_schema` | DB schema / `aiPlaybookService.js` | 🔍 | |
| J2.4 | `outputs`, `status_reason`, `selected_next_step_id`, `evaluation_trace` | `server/ai/aiPlaybookRoutingEngine.js` | 🔍 | |

### J3. Routing Engine

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| J3.1 | `aiPlaybookRoutingEngine.js` istnieje | `server/ai/aiPlaybookRoutingEngine.js` | ✅ | |
| J3.2 | Conditions: `metric_lte/gte`, `flag_eq`, `has_open_tasks` | `server/ai/aiPlaybookRoutingEngine.js` | 🔍 | |
| J3.3 | Conditions: `signal_present`, `time_since_step_gte` | `server/ai/aiPlaybookRoutingEngine.js` | 🔍 | |
| J3.4 | `else_goto` fallback działa | `server/ai/aiPlaybookRoutingEngine.js` | 🔍 | |
| J3.5 | Unknown condition fail-safe | `server/ai/aiPlaybookRoutingEngine.js` | 🔍 | |

### J4. API

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| J4.1 | `/api/ai/playbooks/templates` (SUPERADMIN) | `server/routes/aiPlaybooks.js` | 🔍 | |
| J4.2 | `/api/ai/playbooks/proposals` (ADMIN) | `server/routes/aiPlaybooks.js` | 🔍 | |
| J4.3 | `/api/ai/playbooks/runs` start (ADMIN) | `server/routes/aiPlaybooks.js` | 🔍 | |
| J4.4 | `/advance`, `/cancel` działają | `server/routes/aiPlaybooks.js` | 🔍 | |
| J4.5 | `/runs/:id/dry-run-route` (no persistence) | `server/routes/aiPlaybooks.js` | 🔍 | |

### J5. Integration: ACTION → Step 9

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| J5.1 | ACTION step tworzy action proposal | `server/ai/aiPlaybookExecutor.js` | 🔍 | |
| J5.2 | Approval → execution | `server/ai/aiPlaybookExecutor.js` | 🔍 | |
| J5.3 | Playbook step status odzwierciedla approval/execution | `server/ai/aiPlaybookExecutor.js` | 🔍 | |

### J6. Tests

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| J6.1 | Routing unit tests green | `tests/unit/aiPlaybookRoutingEngine.test.js` | ✅ | |
| J6.2 | Branching integration tests green | `tests/integration/aiPlaybookBranching.test.js` | ✅ | |

---

## K. Step 11 — Async / Queue / Saga Execution

### K1. DB

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| K1.1 | Tabela `async_jobs` jako source of truth | DB schema | 🔍 | |
| K1.2 | `job_id` kolumny w `action_executions` i `ai_playbook_run_steps` | DB schema | 🔍 | |

### K2. BullMQ Integration

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| K2.1 | Worker `asyncJobProcessor.js` istnieje | `server/workers/asyncJobProcessor.js` | ✅ | |
| K2.2 | Task types: `EXECUTE_DECISION`, `ADVANCE_PLAYBOOK_STEP` | `server/workers/asyncJobProcessor.js` | 🔍 | |
| K2.3 | Retry/backoff/dead-letter działa | `server/workers/asyncJobProcessor.js` | 🔍 | |

### K3. API

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| K3.1 | `/decisions/:id/execute-async` | `server/routes/actionDecisions.js` | 🔍 | |
| K3.2 | `/runs/:id/advance-async` | `server/routes/aiPlaybooks.js` lub `aiAsync.js` | 🔍 | |
| K3.3 | Job status/retry/cancel endpoints | `server/routes/aiAsync.js` | 🔍 | |
| K3.4 | Org isolation dla job endpoints | `server/routes/aiAsync.js` | 🔍 | |

### K4. Observability

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| K4.1 | Audit events: `JOB_ENQUEUED/STARTED/SUCCEEDED/FAILED` | `server/ai/asyncJobService.js` | 🔍 | |
| K4.2 | Audit events: `DEAD_LETTER/CANCELLED/RETRIED` | `server/ai/asyncJobService.js` | 🔍 | |

---

## L. Step 13 — Visual Playbook Editor

### L1. Template Versioning

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| L1.1 | Pola: `version`, `status`, `published_at`, `published_by_user_id` | DB schema | 🔍 | |
| L1.2 | Pola: `template_graph`, `parent_template_id` | DB schema | 🔍 | |
| L1.3 | Indexy na `status` + `trigger_signal` | DB schema | 🔍 | |

### L2. Graph Services

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| L2.1 | `templateGraphService.js` istnieje | `server/ai/templateGraphService.js` | ✅ | |
| L2.2 | Funkcje: `stepsToGraph`, `graphToSteps` | `server/ai/templateGraphService.js` | 🔍 | |
| L2.3 | Funkcje: `validateDAG`, `findDeadEnds` | `server/ai/templateGraphService.js` | 🔍 | |
| L2.4 | Funkcje: `findBranchesWithoutElse`, `createEmptyGraph` | `server/ai/templateGraphService.js` | 🔍 | |

### L3. Validation Service

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| L3.1 | 1 START node, min 1 END node | `server/ai/templateValidationService.js` | 🔍 | |
| L3.2 | DAG only, no cycles | `server/ai/templateValidationService.js` | 🔍 | |
| L3.3 | No dead-ends (except END) | `server/ai/templateValidationService.js` | 🔍 | |
| L3.4 | BRANCH has else | `server/ai/templateValidationService.js` | 🔍 | |
| L3.5 | ACTION has actionType | `server/ai/templateValidationService.js` | 🔍 | |
| L3.6 | `trigger_signal` required | `server/ai/templateValidationService.js` | 🔍 | |
| L3.7 | Zwraca błędy z `{code, message, nodeId}` | `server/ai/templateValidationService.js` | 🔍 | |

### L4. API

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| L4.1 | List templates (status filter) | `server/routes/aiPlaybooks.js` | 🔍 | |
| L4.2 | Create draft | `server/routes/aiPlaybooks.js` | 🔍 | |
| L4.3 | Update draft (tylko DRAFT) | `server/routes/aiPlaybooks.js` | 🔍 | |
| L4.4 | Validate | `server/routes/aiPlaybooks.js` | 🔍 | |
| L4.5 | Publish | `server/routes/aiPlaybooks.js` | 🔍 | |
| L4.6 | Deprecate | `server/routes/aiPlaybooks.js` | 🔍 | |
| L4.7 | Export/import JSON | `server/routes/aiPlaybooks.js` | 🔍 | |
| L4.8 | List published (ADMIN) | `server/routes/aiPlaybooks.js` | 🔍 | |

### L5. UI

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| L5.1 | TemplatesListView | `components/PlaybookEditor/` lub `pages/` | 🔍 | |
| L5.2 | EditorView (canvas + properties + toolbar) | `components/PlaybookEditor/` | ✅ | |
| L5.3 | Nodes render per type | `components/PlaybookEditor/PlaybookNode.tsx` | ✅ | |
| L5.4 | Validate/Save/Publish flow działa | `components/PlaybookEditor/PlaybookToolbar.tsx` | ✅ | |
| L5.5 | Edge creation UX | `components/PlaybookEditor/PlaybookCanvas.tsx` | ✅ | |

### L6. Tests

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| L6.1 | Testy walidacji zielone | `tests/unit/templateValidationService.test.js` | ✅ | |
| L6.2 | Testy graph ops zielone | `tests/unit/templateGraphService.test.js` | ✅ | |

---

## M. Step 14 — Governance, Security & Enterprise Controls

### M1. PII Redactor

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| M1.1 | `piiRedactor.js` redaguje PII konsekwentnie | `server/services/piiRedactor.js` | 🔍 | |
| M1.2 | Redaction w audycie i exportach | `server/ai/auditExport.js`, `governanceAuditService.js` | 🔍 | |

### M2. Audit Log Tamper-evident

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| M2.1 | Hash chain działa (`prev_hash` + record) | `server/services/governanceAuditService.js` | 🔍 | |
| M2.2 | Wpisy append-only | `server/services/governanceAuditService.js` | 🔍 | |

### M3. Break Glass

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| M3.1 | Start/close endpoints | `server/routes/governanceAdmin.js` | 🔍 | |
| M3.2 | Time-limited session | `server/services/breakGlassService.js` | ✅ | |
| M3.3 | UI banner działa | `components/governance/BreakGlassBanner.tsx` | ✅ | |

### M4. Security Hardening

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| M4.1 | Security headers | `server/index.js` (helmet) | 🔍 | |
| M4.2 | Rate limiting | `server/middleware/` | 🔍 | |
| M4.3 | Input validation | Wszystkie routes | 🔍 | |

### M5. UI

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| M5.1 | `AuditLogViewer` | `components/governance/AuditLogViewer.tsx` | ✅ | |
| M5.2 | `PermissionManager` | `components/governance/PermissionManager.tsx` | ✅ | |
| M5.3 | `BreakGlassBanner` | `components/governance/BreakGlassBanner.tsx` | ✅ | |

---

## N. Step 15 — Explainability Ledger & Evidence Pack

### N1. DB

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| N1.1 | Tabela `ai_evidence_objects` | `server/migrations/006_ai_evidence_ledger.sql` | 🔍 | |
| N1.2 | Tabela `ai_explainability_links` | `server/migrations/005_ai_explainability.sql` | 🔍 | |
| N1.3 | Tabela `ai_reasoning_ledger` | DB schema | 🔍 | |

### N2. Service

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| N2.1 | `evidenceLedgerService.js` istnieje | `server/services/evidenceLedgerService.js` | ✅ | |
| N2.2 | `createEvidenceObject` (PII safe) | `server/services/evidenceLedgerService.js` | 🔍 | |
| N2.3 | `linkEvidence` | `server/services/evidenceLedgerService.js` | 🔍 | |
| N2.4 | `recordReasoning` (server-only) | `server/services/evidenceLedgerService.js` | 🔍 | |
| N2.5 | `getExplanation`, `exportExplanation` | `server/services/evidenceLedgerService.js` | 🔍 | |

### N3. API

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| N3.1 | `GET /api/ai/explain/:entityType/:id` | `server/routes/aiExplain.js` | 🔍 | |
| N3.2 | Export json/pdf-ready | `server/routes/aiExplain.js` | 🔍 | |
| N3.3 | List evidences org-scoped | `server/routes/aiExplain.js` | 🔍 | |
| N3.4 | Has-evidence endpoint | `server/routes/aiExplain.js` | 🔍 | |

### N4. Integration

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| N4.1 | Decyzja automatycznie tworzy evidence + reasoning | `server/ai/actionDecisionService.js` | 🔍 | |

### N5. UI

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| N5.1 | Evidence tab w `ActionProposalDetail` | `components/ai/ActionProposalDetail.tsx` → `EvidencePanel.tsx` | ✅ | |
| N5.2 | Evidence dla playbook run/steps | `components/ai/PlaybookStepEvidence.tsx` | ✅ | |
| N5.3 | `ConfidenceBadge` | `components/ai/ConfidenceBadge.tsx` | ✅ | |
| N5.4 | Export evidence pack button | `components/ai/EvidencePanel.tsx` | 🔍 | |

---

## O. Step 16 — Human Workflow + SLA + Notifications

### O1. DB

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| O1.1 | Tabela `approval_assignments` | DB schema | 🔍 | |
| O1.2 | Tabela `user_notification_preferences` | DB schema | 🔍 | |
| O1.3 | Tabela `notification_outbox` | DB schema | 🔍 | |

### O2. Services

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| O2.1 | `workqueueService.js` (assign/ack/list) | `server/services/workqueueService.js` | ✅ | |
| O2.2 | `slaService.js` (expiry + eskalacje) | `server/services/slaService.js` | ✅ | |
| O2.3 | `notificationOutboxService.js` (wysyła + retry) | `server/services/notificationOutboxService.js` | ✅ | |

### O3. Cron/Scheduler

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| O3.1 | SLA check co 10 minut | `server/cron/scheduler.js` | 🔍 | |
| O3.2 | Outbox processing co 10 minut | `server/cron/scheduler.js` | 🔍 | |
| O3.3 | Idempotency (nie wysyła dubli) | `server/services/notificationOutboxService.js` | 🔍 | |

### O4. API + UI

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| O4.1 | MyApprovalsView (user queue) | `components/MyWork/` lub dedykowany | 🔍 | |
| O4.2 | Ops dashboard (alerts) | `components/` | 🔍 | |
| O4.3 | Notification settings | `server/routes/notificationSettings.js` | ✅ | |

---

## P. Step 17 — Integrations & Secrets Platform

### P1. DB

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| P1.1 | Tabela `connectors` | DB schema | 🔍 | |
| P1.2 | Tabela `org_connector_configs` | DB schema | 🔍 | |
| P1.3 | Tabela `connector_health` | DB schema | 🔍 | |

### P2. Security

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| P2.1 | AES-256-GCM secrets vault | `server/services/secretsVault.js` | ✅ | |
| P2.2 | Secrets redacted w API i logach | `server/services/connectorService.js` | 🔍 | |
| P2.3 | Permission `connectors:manage` enforced | `server/routes/connectors.js` | 🔍 | |

### P3. API

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| P3.1 | List connectors | `server/routes/connectors.js` | 🔍 | |
| P3.2 | Connect/disconnect | `server/routes/connectors.js` | 🔍 | |
| P3.3 | Rotate secrets | `server/routes/connectors.js` | 🔍 | |
| P3.4 | Test health | `server/routes/connectors.js` | 🔍 | |
| P3.5 | List health statuses | `server/routes/connectors.js` | 🔍 | |

### P4. Executor Integration

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| P4.1 | `MeetingExecutor` używa `connectorAdapter` | `server/ai/actionExecutors/meetingExecutor.js` | 🔍 | |
| P4.2 | `sandbox_mode` działa | `server/ai/connectorAdapter.js` | 🔍 | |
| P4.3 | Dry-run nie robi external calls | `server/ai/connectorAdapter.js` | 🔍 | |

---

## Q. Step 18 — Outcomes, ROI & Analytics

### Q1. DB

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| Q1.1 | Tabela `outcome_definitions` | DB schema | 🔍 | |
| Q1.2 | Tabela `outcome_measurements` | DB schema | 🔍 | |
| Q1.3 | Tabela `roi_models` | DB schema | 🔍 | |

### Q2. Services

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| Q2.1 | Baseline/after/delta deterministycznie | `server/services/outcomeService.js` | ✅ | |
| Q2.2 | ROI formulas evaluate safely (no `eval` injection) | `server/services/roiService.js` | ✅ | |
| Q2.3 | Analytics queries org scoped + indexed | `server/services/aiAnalyticsService.js` | ✅ | |

### Q3. API

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| Q3.1 | Dashboard summary endpoint | `server/routes/aiAnalytics.js` | 🔍 | |
| Q3.2 | Actions/approvals/playbooks/dead-letter/roi endpoints | `server/routes/aiAnalytics.js` | 🔍 | |
| Q3.3 | Export csv/json | `server/routes/aiAnalytics.js` | 🔍 | |
| Q3.4 | Recompute endpoint | `server/routes/aiAnalytics.js` | 🔍 | |

### Q4. UI

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| Q4.1 | Analytics dashboard działa | `components/AIAnalyticsDashboard.tsx` | ✅ | |
| Q4.2 | Date range filtering | `components/AIAnalyticsDashboard.tsx` | 🔍 | |
| Q4.3 | Export działa | `components/AIAnalyticsDashboard.tsx` | 🔍 | |

### Q5. Tests

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| Q5.1 | Unit + integration green | `tests/` | 🔍 | |

---

## R. Cross-Cutting: Enterprise Completeness Checks

### R1. Org Isolation Audit

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| R1.1 | Każdy SELECT/UPDATE/DELETE ma `org_id` filter | Wszystkie serwisy | 🔍 | |

### R2. No Client-Tampering

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| R2.1 | `proposal_snapshot` nie przychodzi z klienta | `server/ai/actionDecisionService.js` | 🔍 | |
| R2.2 | Evidence/reasoning tworzone server-side | `server/services/evidenceLedgerService.js` | 🔍 | |

### R3. Idempotency Everywhere

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| R3.1 | Execute decision idempotent | `server/ai/actionExecutionAdapter.js` | 🔍 | |
| R3.2 | Async jobs retry safe | `server/workers/asyncJobProcessor.js` | 🔍 | |
| R3.3 | Notifications outbox idempotent | `server/services/notificationOutboxService.js` | 🔍 | |
| R3.4 | Playbook advance idempotent | `server/ai/aiPlaybookExecutor.js` | 🔍 | |

### R4. Observability Completeness

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| R4.1 | `correlation_id` w kluczowych flow | All services | 🔍 | |
| R4.2 | Structured logs: proposals, approvals, policy | `server/services/aiAuditLogger.js` | 🔍 | |
| R4.3 | Structured logs: executions, playbooks, jobs | `server/services/aiAuditLogger.js` | 🔍 | |
| R4.4 | Structured logs: connectors, notifications | `server/services/` | 🔍 | |

### R5. Exports are Safe

| # | Check | Gdzie w kodzie | Status | Owner |
|---|-------|----------------|--------|-------|
| R5.1 | CSV/JSON export redacts PII | `server/ai/auditExport.js` | 🔍 | |
| R5.2 | Export endpoints permission gated | `server/routes/` | 🔍 | |
| R5.3 | Exports respect `archived_at` / retention rules | `server/ai/auditExport.js` | 🔍 | |

---

## Szybka weryfikacja

Uruchom skrypt: `./scripts/verify_ai_enterprise_checklist.sh`

