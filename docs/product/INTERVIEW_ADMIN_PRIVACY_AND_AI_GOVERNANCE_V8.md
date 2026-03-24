# Interview Admin Privacy And AI Governance v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: consent, access policy, retention, auditability and AI policy for Interview voice, transcript, evidence and knowledge reuse

---

## 1. Why this document exists

Interview often captures sensitive operational and organizational knowledge.

This requires explicit governance.

---

## 2. Governance areas

The package must govern:

- consent
- visibility
- retention
- evidence handling
- transcript handling
- AI reuse
- organizational knowledge promotion

---

## 3. AI policy

AI may:

- summarize
- infer themes
- propose missing context
- draft structured findings

AI may not:

- silently expose sensitive interview content wider than policy allows
- promote raw sensitive content into org-shared knowledge without policy-aware write rules

---

## 4. Retention and reuse

The system must define:

- what stays session-local
- what may become org context
- what may be embedded into vector knowledge
- what must be deleted or redacted

---

## 5. Related canonical docs

- `INTERVIEW_INTEGRATION_AND_EXPORT_CONTRACT_V8.md`
- `KNOWLEDGE_RAG_V8_SSOT.md`
- `AI_CONNECTORS_ENTERPRISE_SEARCH_ARCHITECTURE_V8.md`

---

## 6. V8 Program Decisions

### 6.1 Consulting tool AI governance granularity

> V8 Decision W7-6 applied — 2026-03-23

AI governance for consulting tools (including interview-adjacent tools) operates at two levels:

| Level | Scope |
|---|---|
| **Session-level** | Defines broad mode, permissions, and context boundaries for the session |
| **Action-level** | Decides whether a specific AI action can execute, propose, or requires approval |

Rule: `session sets the sandbox, action decides the gate`.

This applies to interview AI operations: session-level governance sets consent, visibility, and retention boundaries; action-level governance gates specific AI actions (summarize, infer themes, draft findings, promote to org knowledge) against the session's policy.

### 6.2 Unified admin surface ownership

> V8 Decision W7-7 applied — 2026-03-23

Admin surfaces follow a unified ownership model:

| Surface | Scope |
|---|---|
| **Organization Settings** | Tenant-facing administration (org admins configure policies for their tenant) |
| **Superadmin** | Platform/operator-facing administration (platform operators manage cross-tenant concerns) |
| **Module-specific settings** | Embedded sub-surfaces where module-specific configuration is needed |

Rule: `shared IA at top, module settings underneath, not competing roots`.

Interview privacy and AI governance admin controls live as a module-specific sub-surface under Organization Settings (for tenant admins) and under Superadmin (for platform operators reviewing cross-tenant compliance). They do not create a competing root-level admin surface.
