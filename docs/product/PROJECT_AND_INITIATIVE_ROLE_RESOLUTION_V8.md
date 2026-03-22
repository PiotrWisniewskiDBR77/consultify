# Project And Initiative Role Resolution v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: canonical resolution of organization roles, project roles, steering-board membership, consultant overlay and initiative-effective roles for workflow and capabilities

---

## 1. Why this document exists

Project and initiative governance breaks when the system mixes:

- organization roles
- project roles
- initiative assignments
- consultant identity
- local UI assumptions

`consultify` needs one explicit role-resolution contract so permissions, gates, team management and UI capabilities all follow the same truth.

---

## 2. Core statement

The platform should always resolve permissions in this order:

`organization role -> project membership role -> steering-board authority -> initiative-specific assignments -> consultant overlay -> effective roles for workflow and capabilities`

Rule:

`UI may display roles, but backend must remain the single source of truth for effective role resolution`

---

## 3. Role layers

### 3.1 Organization roles

These roles exist at org scope and govern administration:

- `OWNER`
- `ADMIN`
- `USER`

Important:

`OWNER` must behave as `ADMIN+`, not as a separate partial role`

This means:

- all admin-level project and initiative management paths must remain available to `OWNER`
- billing and ownership powers are additive, not a reason to lose admin override behavior

### 3.2 Project roles

These govern delivery and governance inside a project.

They must come from one canonical project-role catalog.

### 3.3 Steering-board authority

This is optional per project and only becomes effective when:

- the board is enabled
- the user is an authoritative board member

### 3.4 Consultant overlay

Consultant identity should remain:

- visible
- auditable
- non-authoritative by itself

---

## 4. Canonical resolution doctrine

The system should resolve one `EffectiveInitiativeRoleSet` from:

- org role
- project membership
- initiative gate-role assignments
- initiative owner and sponsor assignments
- steering-board membership
- consultant profile

This resolved set should drive:

- gate executability
- editability
- CTA visibility
- AI availability
- section read-only behavior

---

## 5. Hardening rules

### 5.1 Single project-role canon

The platform should not operate with competing project-role vocabularies.

All raw role values from:

- database membership rows
- admin settings
- frontend role pickers
- legacy routes

should map into one canonical project-role model before initiative permissions are computed.

### 5.2 One effective-role mapping path

The mapping from canonical project roles to initiative-effective roles should exist in one canonical resolver only.

No duplicated frontend or controller-local role maps should remain authoritative.

### 5.3 Backend-only gate authority

Frontend may display gate possibilities, but:

- gate permissions
- role delegation
- steering fallback
- admin override

must all be backend-owned.

---

## 6. Current risk areas this document closes

The system must explicitly avoid:

- `OWNER` failing to resolve to effective admin authority
- role values that exist in project membership but do not map into initiative-effective roles
- frontend gate matrices drifting from backend gate permissions
- duplicated role-resolution logic across controllers and clients
- custom org role systems being mistaken for initiative gate authority without an explicit bridge

---

## 7. Required target behaviors

The product package should guarantee:

- one canonical project-role catalog
- one canonical effective-role resolver
- one truth for admin and owner override
- one explicit policy for initiatives that do not belong to a project
- one explicit rule for how consultant overlay affects identity but not authority

---

## 8. Related canonical docs

- `ROLES_MODEL.md`
- `PROJECT_ROLES_AND_GOVERNANCE.md`
- `INITIATIVE_GOVERNANCE_MODEL.md`
- `INITIATIVE_CAPABILITIES_SYSTEM.md`
- `INITIATIVE_STATUS_ROLE_CTA_MATRIX.md`
