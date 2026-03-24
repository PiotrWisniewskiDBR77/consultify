# Superadmin V8 SSOT — Horizontal Information Architecture

> Status: Canonical (Wave 7 deliverable)
> Owner: Product + Engineering (horizontal layer)
> Scope: platform-wide Superadmin IA, ownership model and domain map across all verticals
> Authority: Highest for Superadmin navigation structure, domain ownership and cross-domain capability model
> Mandate: Decision W7-10 (`DECISION_LOG_WAVE_7.md`)

---

## 1. Purpose and scope

This document defines the horizontal information architecture for all Superadmin surfaces in Consultify.

It does not duplicate vertical feature specs. It provides:

- the ownership model for admin vs superadmin surfaces
- the canonical domain map that organizes all Superadmin capabilities
- the inventory of vertical packages that mount into Superadmin
- the cross-domain capabilities that span multiple verticals
- the integration path for Wave 5 operator/admin surfaces
- the gap summary for domains without V8-level Superadmin coverage

Every vertical Superadmin package (Virtual Workers, Partner Control Tower, Help/KB Content Ops, Connector Fleet) remains authoritative for its own domain. This doc is authoritative for the horizontal structure that connects them.

---

## 2. Ownership model (Decision W7-7)

Decision W7-7 establishes:

> Unified admin surface owned as a horizontal product layer, not by one module only.

The ownership split is:

| Layer | Owner | Scope |
|---|---|---|
| **Organization Settings** | Tenant admin | Tenant-facing administration: org profile, users, roles, billing, plan, module configuration |
| **Superadmin** | Platform operator | Platform/operator-facing administration: cross-tenant operations, platform governance, vertical control towers, fleet management |
| **Module-specific settings** | Module owner | Embedded sub-surfaces within modules where domain-specific configuration lives |

Rules:

- `shared IA at top, module settings underneath, not competing roots`
- Organization Settings and Superadmin are separate navigation roots
- Module settings embed inside their module; they do not create parallel admin branches
- Superadmin surfaces are invisible to tenant users; Organization Settings surfaces are invisible to platform operators unless explicitly shared

---

## 3. Superadmin domain map

The canonical Superadmin IA is organized into the following top-level domains:

| Domain | Purpose | Vertical package status |
|---|---|---|
| **Virtual Workers** | Agent registry, profiles, knowledge, tools, memory, channels, evals, rollout, audit | Strong — 4 canonical docs |
| **Partner Program** | Partner lifecycle, applications, directory, enablement, communications, settlements, configuration, health | Strong — Control Tower + Completion Plan |
| **Help / Knowledge Base** | Content operations, publishing lifecycle, recommendations, Teresa framing, analytics | Strong — Content Ops Runtime |
| **Connector Fleet** | Connector package lifecycle, fleet health, promotion/demotion, diagnostics, cross-tenant emergency controls | Documented in Wave 5 — mounting needed |
| **AI Platform** | LLM management, prompt governance, model routing, knowledge infrastructure (RAG/docs) | Partial — exists in code, no dedicated V8 Superadmin doc |
| **Organizations / Tenants** | Tenant lifecycle, plan management, usage, health, billing status | Gap — legacy admin module docs only |
| **Users (cross-tenant)** | Platform-level user operations, impersonation, access review, account actions | Gap — no V8 doc |
| **Platform Configuration** | Feature flags, plan definitions, limit policies, global settings | Gap — scattered across module configs |
| **Demo / Trial Operations** | Demo analytics, conversion funnel, trial usage, activation monitoring | Gap — v3 docs only, V8 refresh mandated by Decision W7-11 |
| **Platform Health** | Service status, error rates, performance, capacity, observability | Partial — Wave 1 AI ops baseline exists, needs extension |
| **Audit / Compliance** | Cross-tenant audit console, compliance review, override decision logs | Partial — Wave 1 baseline exists |

---

## 4. Vertical package inventory

### 4.1 Virtual Workers (strong)

Canonical docs:

- `VIRTUAL_WORKERS_SUPERADMIN_V8_READINESS_AUDIT.md` — package framing and readiness
- `VIRTUAL_WORKERS_SUPERADMIN_BENCHMARK_V8.md` — leader-pattern benchmarking
- `VIRTUAL_WORKERS_SUPERADMIN_CONTROL_PLANE_V8.md` — target control-plane model
- `VIRTUAL_WORKERS_SUPERADMIN_IMPLEMENTATION_PLAN_V8.md` — phased implementation

Superadmin capabilities: agent registry, execution profiles, knowledge management, tool governance, memory policy, channel configuration, evals and regression, rollout and release, audit trail.

### 4.2 Partner Program (strong)

Canonical docs:

- `SUPERADMIN_PARTNER_CONTROL_TOWER_RUNTIME_V8.md` — 8 canonical families
- `PARTNER_PROGRAM_PORTAL_AND_SUPERADMIN_COMPLETION_PLAN_V8.md` — completion plan §4

Superadmin families: Program Ops, Applications, Directory, Enablement, Communications, Settlements, Configuration, Health & Reviews. Plus exception/dispute doctrine: AttributionDisputeQueue, ExceptionApproval, OverrideDecisionLog.

### 4.3 Help / Knowledge Base Content Operations (strong)

Canonical doc:

- `HELP_KNOWLEDGE_BASE_SUPERADMIN_CONTENT_OPERATIONS_RUNTIME_V8.md`

Superadmin capabilities: content lifecycle governance (draft → review → approved → published → deprecated → archived), recommendation operations, content quality checks, Teresa framing governance, editorial workflows, analytics, source governance.

Distinction: Knowledge infrastructure (documents, RAG) lives under AI Platform. Knowledge product operations (articles, collections, recommendations, Teresa framing) lives here.

### 4.4 Connector Fleet (documented, mounting needed)

Source docs:

- `WP-W5-EXT-03_OPERATOR_ADMIN_SURFACES.md` — operator dashboard, support surfaces, admin controls, diagnostics, promotion/demotion
- Decisions W5-9, W5-10, W5-11

Superadmin capabilities: full fleet health across tenants, connector package lifecycle (submit → review → approve → promote → deprecate → retire), cross-tenant emergency pause, promotion/rollback, drift detection, support note console, dead-letter and conflict queue management.

Access model: platform operator / superadmin gets full diagnostic access across tenants (WP-W5-EXT-03 §4.5).

### 4.5 AI Platform (partial)

Existing in code: `SuperAdmin > AI Platform > Knowledge` area.

No dedicated V8 Superadmin doc. Covered partially by:

- `AI_LLM_MODEL_MANAGEMENT_V8.md`
- `PROMPT_PLATFORM_GOVERNANCE_AND_SURFACE_OWNERSHIP_RUNTIME_V8.md`
- `PROMPT_RUNTIME_CONTROL_OUTPUT_MEMORY_AND_OBSERVABILITY_RUNTIME_V8.md`

Needed: explicit Superadmin surface inventory for LLM model management, prompt registry operations, knowledge infrastructure governance, and AI observability console.

---

## 5. Cross-domain capabilities

These capabilities span multiple vertical domains and must be governed as shared horizontal services within Superadmin:

| Capability | Domains served | Notes |
|---|---|---|
| **Audit trail** | All | Every admin control action produces a durable audit record (who, when, what, why). Wave 1 baseline + sync extension |
| **Cross-tenant search / lookup** | Organizations, Users, Connector Fleet, Support | Platform operators must locate and inspect any tenant, user, connector, or incident |
| **Emergency controls** | Connector Fleet, Platform Health | Cross-tenant emergency pause (Decision W5-11), service-level circuit breakers |
| **Support trace and incident reconstruction** | Connector Fleet, AI Platform, Platform Health | Unified SupportTrace model (Wave 1) extended with sync-specific traces (Wave 5) |
| **Observability dashboard** | Platform Health, Connector Fleet, AI Platform | Shared health signals, per-tenant health, failure queues with source-type filtering |
| **Feature flag / plan governance** | Platform Configuration, Organizations | Feature flags and plan definitions affect all tenants; must be governed centrally |
| **Content lifecycle governance** | Help/KB, Partner Enablement | Shared lifecycle pattern (draft → review → approved → published → deprecated → archived) |

---

## 6. Wave 5 operator/admin integration

Wave 5 delivered a comprehensive operator/admin capability model for connectors and sync. The following must be mounted into the Superadmin IA:

| Wave 5 deliverable | Superadmin mounting requirement | Status |
|---|---|---|
| Connector fleet health dashboard (7 views) | Mount under `Connector Fleet` domain | Not yet mounted |
| Support incident surfaces (7 reconstruction capabilities) | Mount under `Connector Fleet > Support` | Not yet mounted |
| Admin lifecycle controls (7 controls) | Mount under `Connector Fleet > Controls` | Not yet mounted |
| Diagnostics (4 health checks, 4 deep-dive tools) | Mount under `Connector Fleet > Diagnostics` | Not yet mounted |
| Connector promotion/demotion (6 + 3 controls) | Mount under `Connector Fleet > Package Lifecycle` | Not yet mounted |
| Drift detection (4 dimensions) | Mount under `Connector Fleet > Health` | Not yet mounted |

Binding decisions:

- **W5-9**: Connector packages are platform-managed assets. Superadmin owns package lifecycle; tenant admins own installation/configuration.
- **W5-10**: Support notes are durable and incident-scoped. Visible to support and authorized operators.
- **W5-11**: Tenant admins get tenant-scoped emergency pause. Platform operators (Superadmin) get cross-tenant emergency pause.

Reference: `WP-W5-EXT-03_OPERATOR_ADMIN_SURFACES.md` §7.1 explicitly lists Wave 7 Organization/Admin hardening as a downstream consumer.

---

## 7. Gap summary and hardening priorities

### 7.1 Structural gaps

| Gap | Severity | What is needed |
|---|---|---|
| **Connector fleet not mounted in Superadmin IA** | High | Wave 5 delivered the capability model; Superadmin needs visible navigation entry and mounting |
| **Partner Control Tower tools hidden** | High | Strong tools (settlements, config, outreach) exist but remain in orphaned views; need visible Partner Program branch |
| **No Organization/Tenant management V8 doc** | High | Superadmin view of all tenants: lifecycle, plan, usage, health, billing |
| **No cross-tenant User management V8 doc** | Medium | Platform-level user operations: impersonation, access review, account actions |
| **No Platform Configuration V8 doc** | Medium | Unified platform settings: feature flags, plan definitions, limit policies |
| **AI Platform Superadmin surfaces undocumented** | Medium | LLM management, prompt governance, knowledge infrastructure — surfaces exist in code but lack V8 canonical doc |
| **Demo/Trial operations at v3** | Medium | V8 refresh mandated by Decision W7-11; analytics dashboard, conversion funnel, usage stats |
| **Audit/Compliance console incomplete** | Medium | Wave 1 baseline needs extension to cross-tenant compliance review |
| **Help/KB Content Ops has no implementation anchor** | Medium | Full model documented but no code-level backlog |
| **Teresa framing governance not yet editable** | Medium | Currently prompt-hardcoded; Content Ops doc requires it to be editable through Superadmin |

### 7.2 Hardening priorities

| Priority | Action | Rationale |
|---|---|---|
| **P0** | Mount Connector Fleet into Superadmin IA | Wave 5 delivered capability; Decision W5-9 makes Superadmin the package lifecycle owner |
| **P0** | Mount Partner Control Tower as visible branch | Strong tools exist but are hidden; high-value, low-effort |
| **P1** | Create Organization/Tenant management V8 spec | Core platform operations domain without V8 coverage |
| **P1** | Create Help/KB Content Ops implementation backlog | Full model documented; needs implementation path |
| **P1** | Document AI Platform Superadmin surfaces | Surfaces exist in code; need V8 canonical alignment |
| **P2** | Create cross-tenant User management spec | Important for production but not blocking other work |
| **P2** | Create Platform Configuration spec | Scattered config needs unification |
| **P2** | Extend Audit/Compliance console | Enterprise readiness requirement |
| **P2** | Demo/Trial V8 refresh | Mandated by W7-11; scoped as part of Landing V8 |

---

## 8. Related documents

### Vertical Superadmin packages

- `VIRTUAL_WORKERS_SUPERADMIN_V8_READINESS_AUDIT.md`
- `VIRTUAL_WORKERS_SUPERADMIN_BENCHMARK_V8.md`
- `VIRTUAL_WORKERS_SUPERADMIN_CONTROL_PLANE_V8.md`
- `VIRTUAL_WORKERS_SUPERADMIN_IMPLEMENTATION_PLAN_V8.md`
- `SUPERADMIN_PARTNER_CONTROL_TOWER_RUNTIME_V8.md`
- `PARTNER_PROGRAM_PORTAL_AND_SUPERADMIN_COMPLETION_PLAN_V8.md`
- `HELP_KNOWLEDGE_BASE_SUPERADMIN_CONTENT_OPERATIONS_RUNTIME_V8.md`

### Wave 5 operator/admin

- `WP-W5-EXT-03_OPERATOR_ADMIN_SURFACES.md`
- `DECISION_LOG_WAVE_5.md` (Decisions W5-9, W5-10, W5-11)

### Wave 7 decisions

- `DECISION_LOG_WAVE_7.md` (Decision W7-7: ownership model, Decision W7-10: this doc mandate)

### Gap analysis

- `WP-W7-ROOF-03_LANDING_SUPERADMIN.md` §4 (platform-wide admin gaps)
- `SYSTEMATYKA_PRZEGLADU_V8.md` (Superadmin coverage assessment)
