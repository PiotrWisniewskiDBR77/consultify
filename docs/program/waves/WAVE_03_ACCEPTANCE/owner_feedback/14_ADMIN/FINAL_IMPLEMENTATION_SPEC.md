# Admin — final implementation specification

Status: `COMPLETE_EXPERT_SPEC / OWNER_CONFIRMATION_REQUIRED`

## Purpose and boundary

Admin governs organization-wide policy and controlled operations. Personal choices
remain in Settings; business context remains in Organization. Platform operations
are not exposed to customer administrators merely because a control exists in UI.

## Roles

| Role | Scope |
|---|---|
| Owner | ownership transfer, full organization policy and irreversible decisions |
| Admin | membership and general organization administration, excluding protected owner/security/billing actions |
| Billing Admin | plans, invoices, payment and budgets only |
| AI Admin | AI policies, personas, limits and approved AI operations |
| Security Admin | identity, SSO/SCIM, API access and security policy |
| Auditor | read-only audit/compliance access and authorized exports |
| Platform Operator | technical health/operations across allowed platform scope; not a customer role |

Every authorization is checked server-side against organization/tenant scope.

## Seven-domain menu and screens

### 1. Team & Access

Children: `Members`, `Invitations`, `Roles & Permissions`, `Teams`,
`Guests & External Access`, `Access Requests`, `Access Reviews`, `Ownership`.
Functions: invite, resend/revoke, change role, suspend/reactivate, transfer ownership.
Owner transfer requires target resolution, re-authentication, impact preview and
explicit confirmation; the current owner cannot be removed before transfer.

### 2. Billing & Plans

Children: `Overview`, `Plan & Limits`, `Usage & Costs`, `Payment Methods`,
`Invoices`, `Seats & Licences`, `Billing Details`, `Budgets & Alerts`,
`Plan Change History`.
The UI declares whether each function is read-only, contact-sales or self-service.
Provider state is canonical for payment/subscription mutations and requires readback.

### 3. AI Control

Children: `Policy & Autonomy`, `Personas`, `Models & Providers`, `Limits & Budgets`,
`Data & Privacy`, `Quality Evaluations`, `AI Incidents`, `Configuration Versions`,
`AI Operations`, `AI Audit`.
Policy separates allowed actions, approval requirements and maximum autonomy.
Secrets are never redisplayed; model/provider changes show impact and rollback path.

### 4. Security & Identity

Children: `Security Policy`, `SSO`, `SCIM & Lifecycle`, `Sessions`, `API Access`,
`Domains`, `Service Accounts`, `Security Alerts`, `Break-glass`, `Risk Summary`.
Enforcement changes fail closed, include lockout prevention and preserve a controlled
break-glass path. API secrets are shown once and masked everywhere else.

### 5. Audit Log

Children: `Events`, `High-risk Changes`, `Compliance Evidence`, `Retention & Export`.
Additional controlled views: `Integrity`, `Legal Hold`, `Export History`.
Events contain actor, action, target, scope, timestamp, before/after summary and
result. Filters and exports respect tenant and role scope. Logged evidence is
immutable to customer roles.

### 6. Admin Command Center

Children: `Overview`, `Attention Queue`, `Compliance Posture`, `Cost & Capacity`.
This domain aggregates signals only. Each card shows source, freshness, severity,
owner and a deep-link to the canonical configuration screen. It does not duplicate
editable policy forms.

### 7. System Health

Children: `Service Status`, `Dependencies`, `Diagnostics`, `Incident History`,
`Queues & Jobs`, `SLA/SLO`, `Platform Operations`.
Customer Admin sees scoped health and allowlisted safe diagnostics. Run-all probes,
repair, rollback, infrastructure mutation and cross-tenant detail require Platform
Operator authorization and are absent for customer roles.

## Mutation contract

Every Admin mutation defines: authorized roles; exact resource/tenant; precondition;
impact; confirmation; idempotency key where applicable; persisted/provider readback;
audit event; partial-failure handling; recovery/retention; and success receipt.

Destructive or lockout-capable actions additionally require re-authentication,
typed target confirmation, reason, blast-radius preview and recovery statement.
Bulk actions return per-target results and never report all-success on partial failure.

## Acceptance suite

| AC | Expected result | Required evidence |
|---|---|---|
| `ADM-FINAL-AC-001` | Seven domains and all child screens use the shared Settings shell | exact-SHA multi-viewport replay |
| `ADM-FINAL-AC-002` | Each role sees only permitted destinations and server rejects direct unauthorized calls | positive and negative UI/API evidence |
| `ADM-FINAL-AC-003` | Membership, role and ownership changes persist and emit scoped audit events | UI + API/DB + audit + cold session |
| `ADM-FINAL-AC-004` | Billing mutations match provider readback; read-only/contact-sales states cannot mutate | provider test evidence |
| `ADM-FINAL-AC-005` | AI policy/model/limit changes are versioned, recoverable and audited; secrets remain masked | positive/negative/security evidence |
| `ADM-FINAL-AC-006` | SSO/SCIM/session/API changes fail closed without owner lockout | controlled identity fixtures and break-glass test |
| `ADM-FINAL-AC-007` | Audit export is scoped, reproducible and does not expose protected secrets | export comparison and authorization tests |
| `ADM-FINAL-AC-008` | Command Center deep-links to canonical screens and shows freshness/source | visual + routing + data-source evidence |
| `ADM-FINAL-AC-009` | Customer Admin cannot execute platform operations or access cross-tenant data | negative tenant-isolation tests |
| `ADM-FINAL-AC-010` | Destructive and bulk actions satisfy the complete mutation contract | per-action receipts, readback and recovery evidence |

No static green indicator or smoke test establishes these results.
