# Final Implementation Contract — Superadmin (Position 33/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: `approved(scope)` for **P33-A** (root control plane + guardrails frozen); P33-B / P33-C not started  
Last updated: 2026-03-30 (P33-A scope closure)

## 1. Executive summary
- **Intent**: Dopasować UI/UX; pełne zarządzanie dzierżawcą + Virtual Workers (Anna/Teresa) + governance; role.
- **Primary users**: platform operatorzy (cross-tenant).
- **Success metric**: jeden widoczny **platform root control plane** z zamontowanymi gałęziami (tenant/user ops, AI ops, connector ops, governance) i bez mieszania z tenant Admin (P32). Każda wrażliwa akcja ma jawny **approval gate + confirmation + audit + degraded posture**.

## 2. Scope
### 2.1 In-scope
- Root control plane + mounted branches (tenant/user ops, AI ops, connector ops, governance/compliance, platform security).
- Cross-tenant ops: tenant lifecycle, user lookup, platform-wide security overrides.
- AI ops: model management, Virtual Workers (Anna/Teresa) oversight, prompt governance.
- Connector ops: platform-wide integration health, connector lifecycle, reauth escalation.
- Emergency controls: tenant lockdown, connector kill-switch, AI model suspend.
- Guardrails: approval gates, confirmation UI, immutable audit, reversibility rules.

### 2.2 Out-of-scope / non-goals
- **Zastąpienie tenant Admin (P32)** — tenant-level membership, role assignment, per-tenant security policy writes stay in P32; Superadmin may **override** platform-wide but does not replicate tenant flows.
- **Org identity** (companyName, industry, branding, resolved profile SSOT) — Organization (P30); Superadmin reads cross-tenant, does not write identity.
- **User/module preferences** — Settings (P31); Superadmin has no personal preference surface.
- **Full enterprise observability parity** — bounded to what P33-B delivers; no open-ended "platform dashboard" without packet.
- Creating **parallel** tables (`superadmin_tenants`, `superadmin_users`, `superadmin_security_v2`).

### 2.3 P33-A — Root control plane + guardrails (single platform surface)

#### 2.3.1 Root control plane IA (one tree with mounted branches)

Superadmin is exactly **one** root control plane with mounted branches (order is canonical):

```
Superadmin (platform root control plane)
├── Tenant & User Operations
│   ├── Tenant directory (cross-tenant search/list)
│   ├── Tenant lifecycle (create / suspend / reactivate / archive — gated)
│   ├── Tenant detail (read-only org identity from P30 + plan/billing from organizations row)
│   ├── User lookup (cross-tenant user search)
│   ├── User lifecycle (force-reset password, force-reset MFA, deactivate — gated)
│   └── Impersonation (bounded: read-only session or scoped action — gated)
│
├── AI Operations
│   ├── Model management (available models, default model per plan tier, model suspend — gated)
│   ├── Virtual Workers oversight (Anna / Teresa: status, config, usage, suspend — gated)
│   ├── Prompt governance (system prompt registry, prompt version control, rollback — gated)
│   └── Token / usage monitoring (cross-tenant aggregates, budget alerts)
│
├── Connector Operations
│   ├── Platform connector catalog (available connectors, enable/disable globally — gated)
│   ├── Cross-tenant health dashboard (aggregated connector status per tenant)
│   ├── Reauth escalation (force-reauth for tenant when Admin P32 cannot resolve)
│   └── Emergency connector kill-switch (disable connector platform-wide — gated)
│
├── Governance & Compliance
│   ├── Platform audit log (cross-tenant, immutable, filterable by actor/action/tenant/time)
│   ├── Policy enforcement (platform-wide rules: data retention, export restrictions)
│   ├── Bulk data export (cross-tenant — gated, audit-logged)
│   └── Tenant data purge (GDPR/compliance — gated, irreversible confirmation)
│
└── Platform Security
    ├── Platform-wide MFA override (force MFA for all tenants — gated)
    ├── Platform-wide SSO override (enforce SSO provider for all tenants — gated)
    ├── Cross-tenant security posture (aggregated view: which tenants have MFA/SSO enabled)
    └── Emergency tenant lockdown (disable all access for a tenant — gated)
```

**Rule:** Superadmin branches consume P30 org identity (read-only), P32 Admin state (read-only), and P31 Settings taxonomy (read-only). Superadmin **never** duplicates tenant-level write surfaces from P32 — it provides **platform-wide overrides and cross-tenant visibility** only.

#### 2.3.2 Guardrails model (sensitive actions)

Every action marked **gated** in §2.3.1 must satisfy all four guardrail columns before execution:

| # | Action | Approval gate | Confirmation UI | Audit event | Reversibility |
| --- | --- | --- | --- | --- | --- |
| 1 | **Suspend tenant** | Superadmin role required; second-factor confirmation | "Tenant [name] will lose access immediately. [N] active users affected. Type tenant name to confirm." | `tenant.suspended` — actor, tenant_id, reason, timestamp | **Reversible**: reactivate tenant restores access; data preserved |
| 2 | **Force-reset user MFA** | Superadmin role required | "User [email] will be required to re-enroll MFA on next login." | `user.mfa_reset` — actor, user_id, tenant_id, timestamp | **Reversible**: user re-enrolls; no data loss |
| 3 | **Platform-wide MFA override** | Superadmin role required; second-factor confirmation | "MFA will be enforced for ALL tenants. [N] tenants affected. Tenants without MFA will require enrollment on next login." | `platform.mfa_override` — actor, scope=all, timestamp | **Reversible**: remove override; tenant-level policies resume |
| 4 | **Platform-wide SSO override** | Superadmin role required; second-factor confirmation | "SSO will be enforced platform-wide. Password login disabled for all tenants." | `platform.sso_override` — actor, scope=all, timestamp | **Reversible**: remove override; tenant-level SSO policies resume |
| 5 | **Suspend AI model** | Superadmin role required | "Model [name] will be unavailable for all tenants. Active generations will fail gracefully." | `ai.model_suspended` — actor, model_id, reason, timestamp | **Reversible**: re-enable model |
| 6 | **Emergency connector kill-switch** | Superadmin role required; second-factor confirmation | "Connector [name] will be disabled platform-wide. [N] tenants affected. Active syncs will be interrupted." | `connector.emergency_kill` — actor, connector_id, affected_tenants, timestamp | **Reversible**: re-enable connector; tenants may need reauth |
| 7 | **Impersonate user** | Superadmin role required; second-factor confirmation; time-limited (max 30 min) | "You will view [user]'s session as read-only. Actions are logged. Session expires in 30 minutes." | `user.impersonation_start` / `user.impersonation_end` — actor, target_user, tenant_id, duration, timestamp | **N/A**: session is read-only; no state change |
| 8 | **Bulk data export** | Superadmin role required; second-factor confirmation | "Exporting data for [scope]. This may take [estimate]. Export will be audit-logged." | `data.bulk_export` — actor, scope, format, row_count, timestamp | **N/A**: export is read-only; data not modified |
| 9 | **Tenant data purge** | Superadmin role required; second-factor confirmation; type-to-confirm tenant name | "ALL data for tenant [name] will be PERMANENTLY DELETED. This action CANNOT be undone. Type tenant name to confirm." | `tenant.data_purge` — actor, tenant_id, data_scope, timestamp | **IRREVERSIBLE**: no recovery after confirmation |
| 10 | **Suspend Virtual Worker** | Superadmin role required | "Virtual Worker [Anna/Teresa] will stop processing for all tenants. Queued tasks will be paused." | `ai.virtual_worker_suspended` — actor, worker_id, reason, timestamp | **Reversible**: re-enable worker; queued tasks resume |

**Audit immutability rule:** All audit events from gated actions are **append-only**. No Superadmin action may delete or modify existing audit entries. Audit log retention policy is a governance concern (P33-B defines retention period).

#### 2.3.3 Ownership boundaries (P33 vs P32 vs P30 vs P31)

| Concern | Owner (contract) | Superadmin (P33) | Admin (P32) | Organization (P30) | Settings (P31) |
| --- | --- | --- | --- | --- | --- |
| **Cross-tenant tenant lifecycle** (create/suspend/archive) | P33 | **Write** (gated) | — | — | — |
| **Cross-tenant user lookup / lifecycle** | P33 | **Write** (gated) | — | — | — |
| **Platform-wide MFA/SSO override** | P33 | **Write** (gated) | Tenant-level write (P32) | Stores columns (P30 SSOT) | Read-only |
| **Tenant-level MFA/SSO/session/password** | P32 | Read-only cross-tenant view | **Write** (tenant) | Stores columns (P30 SSOT) | Read-only; routes → Admin |
| **Members / invites / roles** (within tenant) | P32 | Cross-tenant support only | **Write** | — | No members UI |
| **Org identity** (name, industry, branding) | P30 | Read-only cross-tenant view | Read-only | **Write** | Read-only |
| **Tenant preferences** | P31 | — | — | — | **Write** |
| **Personal preferences** | P31 | — | — | — | **Write** |
| **AI model management** (platform-wide) | P33 | **Write** (gated) | — | — | Module AI prefs only |
| **Virtual Workers** (Anna/Teresa platform ops) | P33 | **Write** (gated) | — | — | — |
| **Prompt governance** (system prompts) | P33 | **Write** (gated) | — | — | — |
| **Platform connector catalog** | P33 | **Write** (gated) | Tenant integration health (P32) | — | — |
| **Emergency controls** (lockdown, kill-switch) | P33 | **Write** (gated) | — | — | — |
| **Platform audit log** (cross-tenant) | P33 | **Read** (immutable) | Admin-scoped audit (P32) | — | — |
| **Bulk data export / purge** | P33 | **Write** (gated) | — | — | — |

**Superadmin MUST NOT** replicate: tenant membership flows (P32), org identity writes (P30), personal/module preference taxonomy (P31). **Superadmin MAY** override platform-wide security policies that P32 writes at tenant level (MFA/SSO).

#### 2.3.4 Emergency / degraded posture

**Emergency controls** (what Superadmin can do in crisis):

| Emergency scenario | Control | Effect | Recovery path |
| --- | --- | --- | --- |
| **Compromised tenant** | Tenant lockdown (§2.3.2 #guardrail) | All users in tenant lose access immediately; data preserved | Reactivate tenant after investigation; users regain access |
| **Rogue connector** | Emergency connector kill-switch | Connector disabled platform-wide; active syncs interrupted | Re-enable after vendor/security review; tenants may need reauth via Admin (P32) |
| **AI model safety issue** | Suspend AI model | Model unavailable; active generations fail gracefully with user-facing message | Re-enable after review; queued work resumes |
| **Virtual Worker malfunction** | Suspend Virtual Worker | Worker stops processing; queued tasks paused | Re-enable; queued tasks resume from last checkpoint |
| **Data breach / compliance** | Bulk export + tenant data purge | Export for investigation; purge if legally required | Export is reversible (read-only); purge is **irreversible** |

**Degraded states** (partial failure handling):

- **Cross-tenant action partially fails** (e.g. suspend tenant succeeds but audit write fails): **Reject entire action** — no partial state; retry with full atomicity. If atomicity is not achievable in P33-B, surface explicit "action succeeded but audit failed — manual audit entry required" with operator guidance.
- **Platform audit log unavailable**: Fail **closed** on all gated actions — no sensitive action may proceed without audit. Surface "Audit system unavailable — gated actions disabled" with retry guidance.
- **AI model / connector service unavailable**: Surface **degraded** banner in respective branch; read-only views remain available; write actions (suspend/enable) queue for retry with timeout.
- **P30/P32 resolver unavailable**: Cross-tenant reads may show cached data with `stale: true` label; writes that depend on P30/P32 state fail closed.

**Recovery paths:**

- All reversible actions (§2.3.2) have an explicit **undo** path in the same branch where the action was taken.
- Irreversible actions (tenant data purge) require **pre-action export** as a recommended step in the confirmation UI.
- Emergency controls have a **cool-down** period (configurable in P33-B) before re-enabling to prevent oscillation.

#### 2.3.5 Anti-duplicate gate (extend — no parallel superadmin truth)

| Area | Canon (path / entity) | Rule |
| --- | --- | --- |
| Tenant data | `organizations` table (P30 SSOT) | Superadmin reads/lifecycle-manages through existing `organizations` rows; **no** parallel `superadmin_tenants` table. |
| User data | Existing user tables + org membership | Superadmin cross-tenant lookup uses existing user tables; **no** `superadmin_users` store. |
| Security policy | `organizations.mfa_*`, `sso_configurations` (P30 SSOT) | Platform overrides write through existing columns/tables; **no** `superadmin_security_policy` duplicate. |
| Audit log | Existing audit infrastructure (extend for cross-tenant + immutability) | Single audit store; Superadmin adds cross-tenant filter + immutability constraint; **no** parallel `superadmin_audit_v2`. |
| AI models / Virtual Workers | Existing AI config tables (extend for platform-level management) | Extend existing model/worker config; **no** `superadmin_ai_models` parallel store. |
| Connectors | Existing integration/connector tables (extend for platform catalog) | Extend existing connector tables; **no** `superadmin_connectors` parallel store. |
| Admin cockpit | P32 §2.3.1 tree | Superadmin **does not** fork tenant admin flows; cross-tenant support links into P32 Admin context. |
| Settings taxonomy | P31 §2.3.1 tree | Superadmin **does not** create preference surfaces; reads P31 taxonomy for cross-tenant view only. |
| Wave2 product SSOT | `WAVE2_FINAL_IMPLEMENTATION_PLAN_SUPERADMIN_2026-03-29.md` | §2.3 of **this** contract wins for control plane / guardrails truth vs narrative gaps. |
| Final V8 | This file + references to P30 / P31 / P32 | Superadmin extends **existing** entities only (canon-first). |

### 2.4 Degraded / error posture (denial taxonomy)

- **Insufficient platform role** (non-Superadmin attempts cross-tenant action): HTTP **403** + stable error code + guidance "This action requires platform operator access. Contact your platform administrator."; **no** partial UI mutation.
- **Cross-tenant action denied** (policy restriction, e.g. tenant is in protected state): HTTP **403** or **409** + reason ("Tenant is in compliance hold — cannot suspend") + escalation path ("Contact compliance team").
- **Partial failure on cross-tenant op** (action succeeds but side-effect fails): **Reject** entire action if atomicity is possible; otherwise surface explicit degraded state with manual recovery guidance (see §2.3.4).
- **Emergency action audit failure** (gated action succeeds but audit write fails): Surface **critical** alert to operator — "Action completed but audit record failed. Manual audit entry required." + link to audit remediation flow. **Never** silently succeed without audit for gated actions.
- **Impersonation boundary violation** (operator attempts write during read-only impersonation): **Reject** with "Impersonation sessions are read-only. End session to perform actions as yourself."
- **Irreversible action confirmation failure** (operator does not complete type-to-confirm): **Reject** — no partial execution; return to confirmation screen.
- **Service unavailable** (AI/connector/audit backend down): Fail **closed** on writes; surface "Service temporarily unavailable" with retry guidance; read-only views may show cached data with `stale` indicator.

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_SUPERADMIN_2026-03-29.md`
- SSOT: `docs/product/SUPERADMIN_V8_SSOT.md`

## 4. Softs inspirations (benchmark apps)
### 4.1 Primary benchmark family (SSOT)
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_SUPERADMIN_2026-03-29.md`
- SSOT: `docs/product/SUPERADMIN_V8_SSOT.md`
- Boundaries (must stay explicit):
  - `Organization` (30), `Admin` (32), `Settings` (31)

### 4.2 Local Softs evidence (concrete artifacts)
- **OpenAI (operator-grade approvals and security posture for agents/tools)**:
  - `Softs/0 Agenci/OpenAI.zip :: OpenAI/developers.openai.com/codex/agent-approvals-security.html` (approvals/security posture).
  - `Softs/0 Agenci/OpenAI.zip :: OpenAI/developers.openai.com/codex/security.html` (security posture adjacency).
- **Linear (security posture adjacency for “who can do what” controls)**:
  - `Softs/0 Projekty/Linear.zip :: Linear/linear.appx/security.html` (security posture).

### 4.3 Parity checklist vs Softs (approval-grade)
**Parity oznacza “platform control plane z mounted branches i emergency controls”, nie “ukryty zestaw linków”.**

- **Mounted branches are visible from root (Wave2)**:
  - Root pokazuje gałęzie (tenant/user ops, AI ops, connector ops, governance) i prowadzi do nich przewidywalnie.
- **Cross-tenant approvals/guardrails (OpenAI approvals posture)**:
  - Wrażliwe akcje mają approvals i jawne guardrails; operator widzi co jest “dangerous”.
- **Separation of concerns (Wave2 boundaries)**:
  - Superadmin ≠ tenant Admin; nie ma mieszania prawdy i ról.
- **Operator trust posture (security adjacency)**:
  - Uprawnienia i skutki akcji są czytelne; error/degraded states nie udają sukcesu.

### 4.4 Gap ledger vs Softs (what we are missing — derived from Wave2 plan)
Źródło prawdy: `WAVE2_FINAL_IMPLEMENTATION_PLAN_SUPERADMIN_2026-03-29.md`.

| Capability cluster (parity target) | What Softs implies | Current truth (per plan) | Gap statement (contract requirement) | Priority |
| --- | --- | --- | --- | --- |
| Root control plane closure | visible root | “root not fully mounted” | Dopiąć root + mounted branches jako jeden control plane | P0 |
| Cross-tenant intervention | approvals + safety | “operator trust partial” | Zdefiniować approvals/guardrails + emergency posture | P0 |
| Domain convergence | one operator truth | “fragmented” | Ujednolicić tenant/user + AI/connector towers bez scope blur | P1

## 5. Evidence plan (DoD)
### 5.1 Acceptance criteria
- Root + branches są odkrywalne; cross-tenant operations są spójne; boundaries z Organization/Admin/Settings są jawne.
- Wrażliwe akcje są gated (approvals/confirmations) i mają audyt.
- AI/connector ops są wpięte jako jawne gałęzie (bez “ukrytych ścieżek”).

### 5.2 Tests
- Integracyjne: operator navigates root→branch→action; permissions gate; audit event captured.
- Regression: denied / partial failure → czytelny degraded state; brak silent success.
- Contract tests: cross-tenant actions require elevated role; approvals recorded.

### 5.3 Staging proof checklist
- Demo: root walk-through + 2 branches (AI ops + tenant/user search) + jedna gated akcja z audit.

## 8. Delivery plan
### 8.0 Context pack (read first)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Execution playbook: `docs/product/work-packets/cursor-work/final_master/PROGRAM_EXECUTION_PLAYBOOK.md`
- Authority chain (Superadmin SSOT): see section 3.
- Softs parity + gaps: see section 4.
- Evidence plan: see section 5.

### 8.1 Bounded delivery packets
#### P33-A — Root control plane canon + guardrails (scope approval)
- **Goal**: root + mounted branches jako jeden control plane; cross-tenant ops z guardrails/approvals.
- **Inputs required**: permissions model + approvals posture; audit baseline; emergency/degraded rules.
- **Acceptance**: scope zatwierdzony; boundaries z Organization/Admin/Settings jawne; no “hidden paths”.
- **Evidence**: scope approval + linkowane SSOT.
- **Tasks** (see library: `docs/product/work-packets/cursor-work/final_master/PACKET_TASKS_AND_DOD_LIBRARY.md`):
  - Freeze mounted branches list (P0) and their boundaries vs tenant-level admin.
  - Freeze guardrails: approvals/confirmations + emergency/degraded posture.
  - Freeze audit requirements for all sensitive actions (no silent success).
- **DoD**:
  - Approved(scope): control plane boundaries and guardrails are explicit and enforceable.

##### P33-A — Acceptance checklist (testable)

1. **Single root tree**: Superadmin IA has exactly one root with 5 mounted branches (§2.3.1); no hidden paths outside this tree.
2. **All gated actions documented**: Every action marked "gated" in §2.3.1 has a corresponding row in §2.3.2 guardrails table (minimum 10 actions).
3. **Four-column guardrails**: Each gated action has: approval gate, confirmation UI text, audit event name, reversibility statement — no column is empty.
4. **Audit immutability**: Contract states append-only rule for gated action audit events; no Superadmin action may delete/modify audit entries.
5. **Ownership boundary clarity**: §2.3.3 table explicitly marks every concern as P33/P32/P30/P31 with no ambiguous "shared" cells — each concern has exactly one **Write** owner.
6. **No tenant admin duplication**: Superadmin tree does NOT contain: member invite/assign/remove flows (P32), org identity edit (P30), personal preference edit (P31).
7. **Emergency controls bounded**: §2.3.4 lists at least 4 emergency scenarios with control, effect, and recovery path — no open-ended "do anything" posture.
8. **Degraded states explicit**: §2.3.4 degraded section covers: partial failure, audit unavailable, service unavailable, resolver unavailable — each with fail-closed or explicit degraded behavior.
9. **Anti-duplicate gate complete**: §2.3.5 covers all entity areas (tenants, users, security, audit, AI, connectors, admin, settings) with explicit "no parallel table" rules.
10. **Denial taxonomy complete**: §2.4 covers: insufficient role, cross-tenant denied, partial failure, audit failure, impersonation violation, irreversible confirmation failure, service unavailable — each with HTTP code + guidance.
11. **P32 boundary respected**: Platform-wide MFA/SSO overrides (P33) are distinct from tenant-level MFA/SSO writes (P32); contract does not collapse them.
12. **Irreversible actions flagged**: Tenant data purge is explicitly marked IRREVERSIBLE with type-to-confirm requirement and pre-action export recommendation.

#### P33-B — Cross-tenant actions + audit closure
- **Goal**: gated akcje działają; partial failure jest czytelny; audit jest kompletny.
- **Acceptance**: operator wykonuje min. 1 gated akcję z potwierdzeniem; AI/connector ops są wpięte jako jawne gałęzie.
- **Evidence**: integracyjne testy + staging demo root walk-through.
- **Tasks**:
  - Implement 1+ gated cross-tenant actions with confirmations and explicit partial-failure handling.
  - Implement root walk-through navigation + AI/connector branches (bounded).
  - Add integration/regression tests and run staging demo (5.3).
- **Staging proof script (click-by-click)**:
  1. Open Superadmin root and navigate to branch #1 (e.g., tenant/user search).
  2. Perform a read-only cross-tenant lookup and verify boundaries are explicit.
  3. Initiate one gated action; confirm confirmation/approval UI appears with clear “what will happen”.
  4. Execute the action and verify audit event is recorded; then simulate partial failure and verify degraded state.
  5. Navigate to branch #2 (AI ops / connector ops) and verify visibility is mounted (bounded).
- **DoD**:
  - Cross-tenant operations are safe, audytowalne, and have clear degraded states.

#### P33-C — Verification + rollout
- **Goal**: regresje, staging proof, rollout/rollback.
- **Acceptance**: bar `verified(evidence)` spełniony.
- **Evidence**: wypełniony evidence ledger (sekcja 10).
- **Tasks**:
  - Capture staging proof and fill ledger rows P33-A/B/C.
  - Validate rollback: disable gated actions; preserve read-only visibility.
- **DoD**:
  - Status `verified(evidence)` with complete ledger entries and known limits.

### 8.2 Rollout strategy
- Najpierw read-only visibility + navigation, potem gated actions (P0) i rozszerzenia (P1).

### 8.3 Rollback plan
- Wyłącz gated actions; zachowaj visibility; bez destrukcji danych.

## 9. Risks / open questions / decisions
- Ryzyko: operator ma za dużo mocy bez guardrails (incydenty).
- Ryzyko: scope blur (Admin vs Superadmin).
- Decyzje: minimalny zestaw cross-tenant akcji P0 i ich approvals.

## 10. Evidence ledger (fill after delivery)
| Packet ID | Status | PR / commit | Tests (what + result) | Staging proof | Notes / known limits |
| --- | --- | --- | --- | --- | --- |
| P33-A | approved(scope) | `c714bf3dae` | N/A — scope packet | N/A — scope packet | Root IA §2.3.1; guardrails §2.3.2; boundaries §2.3.3; emergency §2.3.4; anti-dup §2.3.5; errors §2.4; checklist §8.1 |
| P33-B |  |  |  |  |  |
| P33-C |  |  |  |  |  |

