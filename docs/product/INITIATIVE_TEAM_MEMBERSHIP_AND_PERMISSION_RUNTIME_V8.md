# Initiative Team Membership And Permission Runtime v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: canonical team-building, initiative staffing, membership-derived permissions and permission-safe collaboration inside project and initiative runtime

---

## 1. Why this document exists

Initiative delivery depends not only on abstract roles, but on the actual team assembled around the initiative.

The system therefore needs one explicit contract for:

- who belongs to the project
- who belongs to the initiative team
- what permissions come from membership
- what permissions come from workflow authority

Without this split, team management and gate governance become inconsistent.

---

## 2. Core statement

Team membership and workflow authority are related, but not identical.

Canonical path:

`org user -> project membership -> initiative staffing and assignments -> permissions payload -> initiative capabilities and workflow actions`

Rule:

`being on the team does not automatically mean having gate authority`

---

## 3. Team-building doctrine

The system should distinguish:

- project membership
- initiative team composition
- initiative-specific ownership assignments
- invoked governance roles
- external consultant participation

Each serves a different purpose.

### 3.1 Project membership

Defines the user's base delivery role and permissions inside the project.

### 3.2 Initiative staffing

Defines who is actively contributing to this initiative and in what capacity.

### 3.3 Governance assignments

Defines who can satisfy gate or accountability roles such as:

- initiative owner
- sponsor
- business owner
- steering-board authority

---

## 4. Permission doctrine

Permissions should be split into at least two layers:

- `work permissions`
- `workflow authority`

### 4.1 Work permissions

Examples:

- can view initiative
- can edit initiative sections
- can create or update tasks
- can comment
- can use AI on allowed sections

### 4.2 Workflow authority

Examples:

- can submit for review
- can send back
- can approve gates
- can schedule
- can start tracking

Important:

`workflow authority should not be inferred only from generic edit permissions`

---

## 5. Current hardening needs

The package should explicitly align:

- project membership roles
- initiative staffing roles
- effective initiative roles
- permissions JSON and capability payloads

This prevents a user from being:

- visible in the team
- allowed to edit work
- but silently excluded from workflow logic

or the reverse.

---

## 6. Team and permissions target behavior

The initiative package should support:

- clear team composition surfaces
- explicit role labels in the team
- permission-safe collaboration
- external consultant participation with visible overlay
- initiative ownership and governance assignments without ambiguity
- backend-derived capability payloads as the final UI truth

---

## 7. Main risks this document closes

- project-member roles not mapping cleanly into initiative authority
- team-management UI showing roles that the workflow engine does not understand
- permission JSON and gate permissions drifting apart
- board-only or invoked roles being misunderstood as normal execution team roles
- consultant memberships being mistaken for approval power

---

## 8. Related canonical docs

- `PROJECT_AND_INITIATIVE_ROLE_RESOLUTION_V8.md`
- `ROLES_MODEL.md`
- `PROJECT_ROLES_AND_GOVERNANCE.md`
- `INITIATIVE_CAPABILITIES_SYSTEM.md`
- `INITIATIVE_STATUS_ROLE_CTA_MATRIX.md`
