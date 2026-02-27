# Roles model (canonical) — system, project, initiative, consultant overlay

## Purpose

This document is the **canonical, precise** description of roles in Consultify:

- **what each role means** (responsibility + authority boundaries)
- **where the role applies** (system vs project vs initiative)
- **how roles are resolved** into _effective roles_ for workflow gates & UI capabilities
- **how consultant overlay works** (visibility/audit, not authority)

Backend is the **source of truth** for role resolution and UI capabilities:

- initiatives: `GET /api/initiatives/:id/gate-readiness-check` (see `docs/product/INITIATIVE_CAPABILITIES_SYSTEM.md`)

---

## 1) Role layers (never mix them)

Consultify has **four** distinct “role layers”:

1. **System role** (tenant/account scope)
   - Controls: billing, admin settings, user management, global access.
2. **Project role** (delivery/governance inside a project)
   - Controls: what you can do in a project and its initiatives (content, gates, execution).
3. **Steering Board membership** (optional governance body per project)
   - Controls: whether you can act as `STEERING_COMMITTEE` for approvals.
4. **Consultant overlay** (visibility/audit overlay on user + project membership)
   - Controls: **labeling & auditability only**. It **does not** grant authority.

On an initiative, these layers are resolved into **effective roles** used by:

- gate executability (`availableTransitions[].canCurrentUserExecute`)
- UI `capabilities` (top bar editability, CTA availability, AI availability, card read-only)

---

## 2) System roles (canonical)

System roles exist **outside projects** and primarily control administration.

| Role    | Scope              | Primary authority                           | Typical actions                                     | Not responsible for                    |
| ------- | ------------------ | ------------------------------------------- | --------------------------------------------------- | -------------------------------------- |
| `OWNER` | Org/account        | **ADMIN +** billing + ownership transfer + deletion | all admin functions + billing, subscription, ownership transfer, org deletion | day-to-day initiative work             |
| `ADMIN` | Org                | configuration + user/project administration | create projects, manage members, configure policies, Admin Panel | being a gate decision maker by default |
| `USER`  | Project scope only | none by itself                              | acts only via project role & initiative context     | any system configuration               |

**Owner is a special administrator:** OWNER has **all normal ADMIN functions** (Admin Panel, users, projects, settings, AI config, etc.) **plus** additional powers: billing, subscription, ownership transfer, and organization deletion. Implementations must treat OWNER as ADMIN+ for route guards, sidebar visibility, and permission checks.

Notes:

- Some environments may use `SUPERADMIN` internally; treat it as a technical superset of `ADMIN`.

---

## 3) Project roles (canonical set = 8)

These are **the only canonical project-level roles** used for permissions/capabilities and governance:

- `SPONSOR`
- `PROJECT_LEADER`
- `INITIATIVE_OWNER`
- `TEAM_MEMBER`
- `PMO` _(invoked)_
- `PORTFOLIO_OWNER` _(invoked)_
- `BUSINESS_OWNER`
- `STEERING_COMMITTEE` _(via optional Steering Board)_

### 3.0 PL nazewnictwo (UI / komunikacja)

W UI używamy stabilnych etykiet (PL), żeby użytkownicy rozumieli sens ról:

| Canonical key        | PL label (meaning)                                                                |
| -------------------- | --------------------------------------------------------------------------------- |
| `SPONSOR`            | Sponsor (Właściciel biznesowy) — decyzje inwestycyjne/go-no-go                    |
| `PROJECT_LEADER`     | Project Leader — operacyjny dowódca delivery                                      |
| `INITIATIVE_OWNER`   | Właściciel inicjatywy — odpowiedzialny za gotowość i realizację obszaru           |
| `TEAM_MEMBER`        | Członek zespołu — wykonanie pracy i aktualizacje                                  |
| `PMO`                | PMO — kontrola standardów i kompletności (często „wywoływane”)                    |
| `PORTFOLIO_OWNER`    | Właściciel portfela — decyzje inwestycyjne ponad projektami (często „wywoływane”) |
| `BUSINESS_OWNER`     | Business Owner (Korzyści) — odpowiedzialny za korzyści/KPI po delivery            |
| `STEERING_COMMITTEE` | Komitet sterujący / Steering Board — opcjonalne approvals/escalations             |

Uwaga: `SPONSOR` i `BUSINESS_OWNER` mogą być tą samą osobą w organizacji, ale w modelu są rozdzielone
(inwestycja/governance vs realizacja korzyści po delivery).

### 3.1 Definitions (responsibility + boundaries)

| Project role                  | Accountability (A)                                 | Responsible for (R)                       | Typical in-app actions                                          | Explicitly not allowed/expected                       |
| ----------------------------- | -------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------- |
| `SPONSOR` (Business Owner)    | business goal, ROI, go/no-go                       | strategic approvals                       | approve/stop initiatives at gates; decide investment            | does not run daily delivery or tasks                  |
| `PROJECT_LEADER`              | operational delivery                               | plan/schedule/execution management        | manage execution plan, coordinate owners/team, escalate         | does not change strategic goal/budget without Sponsor |
| `INITIATIVE_OWNER`            | readiness + delivery of a specific initiative area | initiative content + progress             | edit initiative content, submit gates, manage execution context | does not approve own strategic gates                  |
| `TEAM_MEMBER`                 | assigned work                                      | execution updates                         | execute tasks, update progress, raise risks/issues              | does not approve gates                                |
| `PMO` _(invoked)_             | standards/compliance control                       | completeness + quality control            | schedule baselines, reporting completeness, closure checks      | not a strategic decision maker                        |
| `PORTFOLIO_OWNER` _(invoked)_ | investment across projects                         | portfolio-level decisions                 | start/stop allocation, priority overrides, escalations          | not a daily project manager                           |
| `BUSINESS_OWNER` (Benefits)   | benefits/KPI outcomes                              | benefits tracking + acceptance            | confirm benefits tracking start, own KPI outcomes               | not a delivery commander                              |
| `STEERING_COMMITTEE`          | strategic board approvals                          | gate approvals/escalations (when enabled) | approve specific gates when Steering Board enabled              | does not execute daily work                           |

### 3.2 Invoked roles (`is_invoked`)

`PMO` and `PORTFOLIO_OWNER` are frequently **invoked** (not always active).

Data model uses:

- `project_members.is_invoked = 1` to mark _invoked_ membership

Interpretation:

- invoked role may be added for **control moments** (audit, tolerance breach, lack of reporting, budget escalation)
- invoked role is still a **real role** for permissions; it just communicates that it is not “daily”

---

## 4) Steering Board (optional per project)

Steering Board is optional and controlled by project configuration:

- `project_steering_board.enabled`

Membership types:

- `CHAIR`
- `BOARD_MEMBER`
- `OBSERVER`

Effective authority:

- `CHAIR` and `BOARD_MEMBER` resolve to effective role `STEERING_COMMITTEE` **only when enabled**
- `OBSERVER` is information-first (does not grant `STEERING_COMMITTEE`)

Delegation rule when Steering Board is disabled:

- approvals that would require `STEERING_COMMITTEE` must delegate to **`SPONSOR`** (or **`PORTFOLIO_OWNER`** if invoked/configured)

---

## 5) Consultant overlay (canonical)

Consultant is not a “separate permission universe”.

Consultant overlay fields live on canonical project membership:

- `consultant_profile`: `NONE | EXTERNAL | PARTNER | INTERNAL`
- `engagement_type`: `INTERNAL | INVITED_BY_CLIENT | CONSULTANT_LED_ONBOARDING`

Rules:

- overlay is **always visible** in UI badges and audit logs
- overlay **never grants authority by itself**
- permissions come from: system role + project role + steering board policy + initiative context

See `docs/product/CONSULTANT_OVERLAY_MODEL.md`.

---

## 6) Initiative “effective roles” (technical, backend-owned)

On an initiative, backend resolves _effective roles_ used by the gate workflow engine and capability computation.

Canonical resolver:

- `server/src/services/initiative/initiativeAccessResolver.ts` (`resolveInitiativeAccessContext`)

### 6.1 Effective role identifiers used in workflow/gates

The gate engine uses these identifiers (subset/compat layer):

- `ADMIN`
- `CONSULTANT`
- `PROJECT_MANAGER` _(compat)_
- `PROJECT_LEAD` _(compat)_
- `INITIATIVE_OWNER`
- `TEAM_MEMBER`
- `PROJECT_SPONSOR`
- `PMO`
- `PORTFOLIO_OWNER`
- `BUSINESS_OWNER`
- `STEERING_COMMITTEE`

### 6.2 Mapping: canonical project role → initiative effective roles

Today (v1) we keep legacy identifiers for some gates:

| Canonical project role | Effective roles on initiatives                                       |
| ---------------------- | -------------------------------------------------------------------- |
| `SPONSOR`              | `PROJECT_SPONSOR`                                                    |
| `PROJECT_LEADER`       | `PROJECT_MANAGER`, `PROJECT_LEAD` _(compat)_                         |
| `INITIATIVE_OWNER`     | `INITIATIVE_OWNER`                                                   |
| `TEAM_MEMBER`          | `TEAM_MEMBER`                                                        |
| `PMO`                  | `PMO`                                                                |
| `PORTFOLIO_OWNER`      | `PORTFOLIO_OWNER`                                                    |
| `BUSINESS_OWNER`       | `BUSINESS_OWNER`                                                     |
| `STEERING_COMMITTEE`   | `STEERING_COMMITTEE` _(when board membership resolves to committee)_ |

Additional rules:

- if `consultant_profile != NONE` ⇒ add effective role `CONSULTANT` (identity/visibility for workflow rules)
- if system role is admin (`ADMIN`/`OWNER`/`SUPERADMIN`) ⇒ add effective role `ADMIN` (OWNER is special admin with all admin functions + billing/ownership/deletion)

---

## 7) Where to look next

- Project roles overview: `docs/product/PROJECT_ROLES_AND_GOVERNANCE.md`
- Consultant overlay: `docs/product/CONSULTANT_OVERLAY_MODEL.md`
- Initiative governance vocabulary: `docs/product/INITIATIVE_GOVERNANCE_MODEL.md`
- Capabilities contract: `docs/product/INITIATIVE_CAPABILITIES_SYSTEM.md`
- Status/role/CTA matrix: `docs/product/INITIATIVE_STATUS_ROLE_CTA_MATRIX.md`
