# DBR77 Enterprise Account, Identity & Authorization - Technical Handoff Package

This package contains the technical architecture artifacts for the DBR77 enterprise account system upgrade.

Files included:

1. `01_er_diagram_mermaid.md` - ER diagram as Mermaid.js code.
2. `02_sequence_diagrams_mermaid.md` - three critical sequence diagrams.
3. `03_api_policy_payloads.md` - API context and policy payload examples.
4. `04_user_lifecycle_flow.md` - manual invite and SCIM lifecycle flow.

Architecture upgrade highlights:

- RBAC remains the UX abstraction.
- ABAC handles classification, session, tenant, and contextual constraints.
- ReBAC becomes the technical authorization backend for complex relationships.
- SCIM is added for enterprise identity lifecycle management.
- IP Critical data supports tenant encryption and customer-managed keys.
- Marketplace can use aggregated views; sensitive modules use isolated workspaces.
- Audit events are designed for customer SIEM streaming.
# 01 - DBR77 Enterprise Account System ER Diagram

```mermaid
erDiagram
    USER {
        uuid id PK
        string email UK
        string display_name
        string auth_provider
        string external_identity_id
        string user_type "core|workforce|end_user|external_consultant|dbr77_support|dbr77_service"
        boolean mfa_enabled
        string status "invited|active|suspended|deleted"
        datetime last_login_at
        datetime created_at
        datetime updated_at
    }

    ORGANIZATION {
        uuid id PK
        string legal_name
        string display_name
        string verification_status "unverified|verified|enterprise_verified"
        string[] business_types "manufacturer|integrator|technology_supplier|consultant_company|dbr77_internal"
        string tenant_encryption_mode "platform_managed|tenant_managed|customer_managed_key"
        string customer_kms_key_ref
        uuid scim_tenant_id FK
        string status "active|suspended|deleted"
        datetime created_at
        datetime updated_at
    }

    MEMBERSHIP {
        uuid id PK
        uuid user_id FK
        uuid organization_id FK
        string org_role "owner|admin|security_admin|billing_admin|member"
        string source "manual_invite|scim|support_created"
        string external_group_id
        string status "invited|active|suspended|expired|deleted"
        datetime invited_at
        uuid invited_by_user_id FK
        datetime activated_at
        datetime expires_at
        datetime created_at
        datetime updated_at
    }

    SCIM_TENANT {
        uuid id PK
        uuid organization_id FK
        string idp_type "entra_id|okta|onelogin|custom"
        string scim_base_url
        string status "active|paused|disabled"
        datetime last_sync_at
        datetime created_at
        datetime updated_at
    }

    SCIM_GROUP_MAPPING {
        uuid id PK
        uuid scim_tenant_id FK
        string external_group_id
        string target_scope "organization|module|project"
        string target_role_bundle_key
        uuid target_project_space_id FK
        string status "active|disabled"
        datetime created_at
        datetime updated_at
    }

    ENTITLEMENT {
        uuid id PK
        uuid organization_id FK
        string module_key "marketplace|digital_twin|iot|iris|iris_hrm|consultify"
        string license_type "full|module|admin|workforce|self_service|external|device"
        int seat_limit
        int seats_used
        string status "active|expired|suspended"
        datetime active_from
        datetime active_until
    }

    PROJECT_SPACE {
        uuid id PK
        string name
        uuid owner_organization_id FK
        string workspace_type "isolated|aggregated"
        string sensitivity_level "internal|confidential|ip_critical"
        string status "draft|active|archived|closed"
        uuid created_by_user_id FK
        datetime start_date
        datetime end_date
        datetime created_at
        datetime updated_at
    }

    PROJECT_SPACE_ORG {
        uuid id PK
        uuid project_space_id FK
        uuid organization_id FK
        string relationship_type "owner|customer|integrator|supplier|consultant|dbr77_support|dbr77_service"
        string status "invited|active|suspended|removed"
        datetime invited_at
        uuid invited_by_user_id FK
        datetime expires_at
    }

    PROJECT_SPACE_USER {
        uuid id PK
        uuid project_space_id FK
        uuid user_id FK
        uuid organization_id FK
        string project_role "project_owner|project_admin|contributor|viewer|external_consultant|dbr77_support|dbr77_service"
        string status "invited|active|suspended|expired|removed"
        datetime invited_at
        uuid invited_by_user_id FK
        datetime expires_at
    }

    ROLE_BUNDLE {
        uuid id PK
        string key UK
        string display_name
        string archetype "viewer|contributor|specialist|manager|admin|owner"
        string product_scope "global|marketplace|digital_twin|iot|iris|iris_hrm|consultify"
        boolean external_allowed
        boolean export_allowed_by_default
        string status "active|deprecated"
        datetime created_at
        datetime updated_at
    }

    ROLE_BUNDLE_PERMISSION {
        uuid id PK
        uuid role_bundle_id FK
        string permission_key
        string effect "allow|deny"
        json conditions
        datetime created_at
    }

    USER_ROLE_ASSIGNMENT {
        uuid id PK
        uuid user_id FK
        uuid organization_id FK
        uuid project_space_id FK
        uuid role_bundle_id FK
        string assignment_source "manual|scim_group|system|support_escalation"
        uuid assigned_by_user_id FK
        datetime valid_from
        datetime valid_until
        string status "active|expired|revoked"
    }

    RESOURCE {
        uuid id PK
        string resource_type "twin|model|simulation|iot_device|iot_stream|iris_analysis|hrm_employee|marketplace_product|consultify_document"
        uuid owner_organization_id FK
        uuid project_space_id FK
        uuid created_by_user_id FK
        string data_classification "public|internal|confidential|ip_critical"
        string encryption_mode "platform_managed|tenant_managed|customer_managed_key"
        string encryption_key_ref
        string visibility "private|project|organization|marketplace_public"
        string status "draft|active|archived|deleted"
        datetime created_at
        datetime updated_at
    }

    ACCESS_POLICY {
        uuid id PK
        string subject_type "user|organization|role_bundle|project_role|dbr77_support|scim_group"
        uuid subject_id
        uuid resource_id FK
        uuid organization_id FK
        uuid project_space_id FK
        string action "view|create|edit|delete|share|export|download|approve|manage|support_read|support_edit|act_on_behalf"
        string effect "allow|deny"
        json conditions
        datetime valid_from
        datetime valid_until
        uuid created_by_user_id FK
        string status "active|revoked|expired"
    }

    REBAC_RELATION_TUPLE {
        uuid id PK
        string object_type
        uuid object_id
        string relation "owner|member|admin|viewer|editor|participant|shared_with|acts_on_behalf|parent"
        string subject_type
        uuid subject_id
        json caveat_context
        datetime valid_from
        datetime valid_until
        datetime created_at
    }

    DEVICE {
        uuid id PK
        uuid organization_id FK
        string device_type "tablet|kiosk|terminal"
        string name
        string location_ref
        string[] allowed_modules
        string[] allowed_workflows
        int session_timeout_seconds
        string status "registered|active|lost|revoked"
        datetime registered_at
        uuid registered_by_user_id FK
    }

    SESSION {
        uuid id PK
        uuid user_id FK
        uuid active_organization_id FK
        uuid active_project_space_id FK
        uuid device_id FK
        uuid acting_on_behalf_of_org_id FK
        string session_type "personal|workforce|device|consultant|support_readonly|support_edit|delegated"
        string auth_strength "password|mfa|sso_mfa|device_pin|badge"
        datetime issued_at
        datetime expires_at
        datetime last_activity_at
    }

    SUPPORT_GRANT {
        uuid id PK
        uuid organization_id FK
        uuid project_space_id FK
        uuid granted_to_user_id FK
        uuid granted_by_user_id FK
        string mode "read_only|edit"
        json scope
        string reason
        string ticket_id
        datetime valid_from
        datetime valid_until
        string status "active|expired|revoked"
    }

    AUDIT_EVENT {
        uuid id PK
        uuid actor_user_id FK
        uuid actor_organization_id FK
        uuid active_project_space_id FK
        uuid acting_on_behalf_of_org_id FK
        uuid resource_id FK
        string action
        string decision "allowed|denied"
        string policy_engine "rebac|abac|rbac|manual"
        json decision_reason
        string ip_address
        string user_agent
        datetime occurred_at
    }

    SIEM_EXPORT_SUBSCRIPTION {
        uuid id PK
        uuid organization_id FK
        string destination_type "webhook|eventbridge|kafka|splunk_hec|datadog"
        string endpoint_ref
        string[] event_types
        string status "active|paused|disabled"
        datetime created_at
        datetime updated_at
    }

    USER ||--o{ MEMBERSHIP : has
    ORGANIZATION ||--o{ MEMBERSHIP : contains
    ORGANIZATION ||--o{ ENTITLEMENT : owns
    ORGANIZATION ||--|| SCIM_TENANT : may_use
    SCIM_TENANT ||--o{ SCIM_GROUP_MAPPING : maps
    ORGANIZATION ||--o{ PROJECT_SPACE : owns
    PROJECT_SPACE ||--o{ PROJECT_SPACE_ORG : includes
    ORGANIZATION ||--o{ PROJECT_SPACE_ORG : participates
    PROJECT_SPACE ||--o{ PROJECT_SPACE_USER : has_users
    USER ||--o{ PROJECT_SPACE_USER : assigned_to
    ORGANIZATION ||--o{ RESOURCE : owns
    PROJECT_SPACE ||--o{ RESOURCE : contains
    RESOURCE ||--o{ ACCESS_POLICY : protected_by
    ROLE_BUNDLE ||--o{ ROLE_BUNDLE_PERMISSION : contains
    USER ||--o{ USER_ROLE_ASSIGNMENT : receives
    ORGANIZATION ||--o{ USER_ROLE_ASSIGNMENT : scopes
    PROJECT_SPACE ||--o{ USER_ROLE_ASSIGNMENT : scopes
    ROLE_BUNDLE ||--o{ USER_ROLE_ASSIGNMENT : assigned_as
    ORGANIZATION ||--o{ DEVICE : registers
    DEVICE ||--o{ SESSION : starts
    USER ||--o{ SESSION : owns
    ORGANIZATION ||--o{ SUPPORT_GRANT : grants
    USER ||--o{ SUPPORT_GRANT : receives
    USER ||--o{ AUDIT_EVENT : acts
    RESOURCE ||--o{ AUDIT_EVENT : referenced_by
    ORGANIZATION ||--o{ SIEM_EXPORT_SUBSCRIPTION : exports_to
```
# 02 - Critical Sequence Diagrams

## A) Login & Context Switch into Project Space

```mermaid
sequenceDiagram
    autonumber
    participant FE as Frontend
    participant API as DBR77 API
    participant IDP as IdP / SSO
    participant SCIM as SCIM Directory Mirror
    participant PE as AuthZ Policy Engine / ReBAC
    participant DB as Database
    participant AUD as Audit Event Store

    FE->>API: POST /auth/login
    API->>IDP: Authenticate user via OIDC/SAML
    IDP-->>API: id_token + user claims
    API->>DB: Find or create User by external_identity_id
    API->>SCIM: Check latest provisioned user status
    SCIM-->>API: user_status, groups, org mappings
    API->>DB: Load active Memberships for User
    DB-->>API: organizations + roles + entitlements
    API-->>FE: Login success + available organizations

    FE->>API: POST /session/context {active_organization_id}
    API->>PE: check(user, "member", organization)
    PE-->>API: allow/deny
    API->>DB: Create personal_session with active_organization_id
    API->>AUD: audit context_selected
    API-->>FE: Session token with active_org context

    FE->>API: POST /session/project-context {project_space_id}
    API->>PE: check(user, "participant", project_space)
    PE->>DB: Resolve relations user->membership->org->project
    DB-->>PE: relation tuples + project status
    PE-->>API: allow with reason
    API->>DB: Update session.active_project_space_id
    API->>AUD: audit project_context_selected
    API-->>FE: Updated context token
```

## B) Delegated Access: Integrator acts on behalf of Manufacturer

```mermaid
sequenceDiagram
    autonumber
    participant FE as Frontend
    participant API as DBR77 API
    participant PE as AuthZ Policy Engine / ReBAC
    participant DB as Database
    participant AUD as Audit Event Store

    FE->>API: POST /delegations/start {project_space_id, acting_on_behalf_of_org_id}
    API->>DB: Load current session, user, active_org
    DB-->>API: user belongs to Integrator Org

    API->>PE: check(integrator_org, "can_act_on_behalf_of", manufacturer_org) in project_space
    PE->>DB: Resolve relations and delegation caveats
    DB-->>PE: project relations, valid delegation, expiry, allowed actions
    PE-->>API: allow with allowed_actions

    API->>DB: Update session.session_type = delegated
    API->>DB: Set acting_on_behalf_of_org_id = manufacturer_org
    API->>AUD: audit delegated_session_started

    API-->>FE: Delegated context token + allowed_actions
    FE-->>FE: Show permanent UI badge "Acting on behalf of Manufacturer"

    FE->>API: POST /marketplace/offers {proposal_data}
    API->>PE: check(user, "marketplace.offer.create", project_space/resource) with acting_on_behalf_of_org
    PE-->>API: allow
    API->>DB: Create offer with created_by_user_id and acting_on_behalf_of_org_id
    API->>AUD: audit offer_created_delegated
    API-->>FE: Offer created
```

## C) Resource Access: IRIS Analyst requests IoT raw data

```mermaid
sequenceDiagram
    autonumber
    participant FE as Frontend
    participant API as DBR77 API
    participant PE as AuthZ Policy Engine / ReBAC
    participant DB as Database
    participant KMS as KMS / Key Service
    participant AUD as Audit Event Store

    FE->>API: GET /iot/streams/{stream_id}/raw-data
    API->>DB: Load session context
    DB-->>API: user_id, active_org_id, active_project_space_id, session_type

    API->>DB: Load Resource metadata for stream_id
    DB-->>API: owner_org_id, project_space_id, data_classification, encryption_mode, key_ref

    API->>PE: check(user, "iot.data.view.raw", resource, context)
    PE->>DB: Resolve ReBAC tuples: user->org->project->resource
    PE->>DB: Load ABAC caveats: classification, export/raw-data rules, entitlement
    DB-->>PE: relations + caveats
    PE-->>API: allow/deny + decision_reason

    alt Denied
        API->>AUD: audit access_denied with reason
        API-->>FE: 403 Forbidden + safe_error_code
    else Allowed
        alt Resource is IP_CRITICAL with CMK
            API->>KMS: Request decrypt permission for key_ref
            KMS-->>API: temporary decrypt grant or deny
            alt KMS denied
                API->>AUD: audit kms_decrypt_denied
                API-->>FE: 403 Forbidden
            else KMS allowed
                API->>DB: Fetch encrypted raw data
                DB-->>API: encrypted payload
                API->>API: Decrypt in trusted service boundary
                API->>AUD: audit raw_data_view_allowed
                API-->>FE: raw data response
            end
        else Non-CMK Resource
            API->>DB: Fetch raw data
            DB-->>API: raw data response
            API->>AUD: audit raw_data_view_allowed
            API-->>FE: raw data response
        end
    end
```
# 03 - API and Policy Payload Examples

## 1) Request Context Object

This object must be available for every protected request.

Recommended transport:

- short-lived signed session token
- explicit headers for observability
- server must verify token values against the database/session store
- frontend-sent context must never be trusted without backend validation

### Example Context Payload

```json
{
  "request_id": "req_01JZ9CJ2K4K8ZP1XS2FWZQ6AKT",
  "session_id": "ses_01JZ9BXR7ZB8KJ9ED2VN8G59ZM",
  "user": {
    "id": "usr_123",
    "type": "core_user",
    "mfa_verified": true,
    "auth_strength": "sso_mfa"
  },
  "context": {
    "active_organization_id": "org_integrator_456",
    "active_project_space_id": "prj_retrofit_789",
    "acting_on_behalf_of_org_id": null,
    "session_type": "personal_session",
    "workspace_mode": "isolated"
  },
  "entitlements": [
    "digital_twin",
    "iot",
    "iris"
  ],
  "constraints": {
    "ip_address": "203.0.113.24",
    "device_id": null,
    "expires_at": "2026-05-04T14:30:00Z"
  }
}
```

### Required Headers

```http
Authorization: Bearer <short_lived_access_token>
X-DBR77-Request-Id: req_01JZ9CJ2K4K8ZP1XS2FWZQ6AKT
X-DBR77-Active-Org-Id: org_integrator_456
X-DBR77-Active-Project-Space-Id: prj_retrofit_789
X-DBR77-Acting-On-Behalf-Of-Org-Id:
```

Backend rule:

If header context differs from signed session context, reject the request with `401_CONTEXT_MISMATCH`.

---

## 2) Role Bundle JSON - Simulation Engineer

```json
{
  "role_bundle_key": "digital_twin.simulation_engineer",
  "display_name": "Simulation Engineer",
  "archetype": "contributor",
  "product_scope": "digital_twin",
  "assignable_scopes": [
    "organization",
    "project_space"
  ],
  "external_allowed": false,
  "default_duration_days": null,
  "permissions": [
    {
      "permission": "digital_twin.twin.view",
      "effect": "allow"
    },
    {
      "permission": "digital_twin.model.view.partial",
      "effect": "allow"
    },
    {
      "permission": "digital_twin.model.edit",
      "effect": "allow",
      "conditions": {
        "resource.data_classification": {
          "in": ["internal", "confidential"]
        },
        "resource.project_space_id": {
          "equals": "$context.active_project_space_id"
        }
      }
    },
    {
      "permission": "digital_twin.simulation.create",
      "effect": "allow"
    },
    {
      "permission": "digital_twin.simulation.run",
      "effect": "allow"
    },
    {
      "permission": "digital_twin.simulation.view",
      "effect": "allow"
    },
    {
      "permission": "digital_twin.simulation.compare",
      "effect": "allow"
    },
    {
      "permission": "digital_twin.model.export",
      "effect": "deny",
      "conditions": {
        "unless_explicit_policy_grant_exists": true
      }
    },
    {
      "permission": "resource.share",
      "effect": "deny"
    }
  ],
  "guardrails": {
    "deny_export_by_default": true,
    "deny_full_model_view_by_default": true,
    "requires_project_context_for_confidential_resources": true,
    "audit_on": [
      "digital_twin.model.edit",
      "digital_twin.simulation.run",
      "digital_twin.simulation.compare"
    ]
  }
}
```

---

## 3) Policy Check Request to Authorization Engine

```json
{
  "subject": {
    "type": "user",
    "id": "usr_123",
    "organization_id": "org_integrator_456"
  },
  "action": "iot.data.view.raw",
  "resource": {
    "type": "iot_stream",
    "id": "res_iot_stream_999",
    "owner_organization_id": "org_manufacturer_111",
    "project_space_id": "prj_retrofit_789",
    "data_classification": "ip_critical"
  },
  "context": {
    "active_organization_id": "org_integrator_456",
    "active_project_space_id": "prj_retrofit_789",
    "acting_on_behalf_of_org_id": null,
    "session_type": "personal_session",
    "auth_strength": "sso_mfa",
    "request_id": "req_01JZ9CJ2K4K8ZP1XS2FWZQ6AKT"
  },
  "environment": {
    "timestamp": "2026-05-04T12:00:00Z",
    "ip_address": "203.0.113.24"
  }
}
```

### Example Policy Decision

```json
{
  "decision": "deny",
  "reason_code": "RAW_DATA_ACCESS_NOT_GRANTED",
  "evaluated_by": [
    "rebac_relation_graph",
    "abac_data_classification_guardrail",
    "role_bundle_permissions"
  ],
  "explanation": {
    "user_is_project_member": true,
    "organization_is_project_participant": true,
    "resource_is_shared_to_project": true,
    "role_allows_raw_iot_data": false,
    "resource_is_ip_critical": true,
    "explicit_raw_data_grant_exists": false
  },
  "audit_required": true
}
```

---

## 4) ReBAC Relation Tuple Examples

```json
[
  {
    "object": "organization:org_integrator_456",
    "relation": "member",
    "subject": "user:usr_123"
  },
  {
    "object": "project_space:prj_retrofit_789",
    "relation": "participant",
    "subject": "organization:org_integrator_456"
  },
  {
    "object": "project_space:prj_retrofit_789",
    "relation": "participant",
    "subject": "organization:org_manufacturer_111"
  },
  {
    "object": "resource:res_twin_partial_555",
    "relation": "shared_with",
    "subject": "project_space:prj_retrofit_789"
  },
  {
    "object": "organization:org_manufacturer_111",
    "relation": "can_act_on_behalf_of",
    "subject": "organization:org_integrator_456",
    "caveat": {
      "project_space_id": "prj_retrofit_789",
      "allowed_actions": [
        "marketplace.offer.create",
        "consultify.recommendation.create"
      ],
      "valid_until": "2026-06-01T00:00:00Z"
    }
  }
]
```
# 04 - User Lifecycle Flow

## Principle

User lifecycle must support two paths:

1. Manual Invite Flow - for SMBs, partners, smaller customers, external consultants.
2. SCIM Provisioning Flow - mandatory for Enterprise customers using Entra ID, Okta, OneLogin, etc.

SSO handles authentication.
SCIM handles provisioning and deprovisioning.

---

# A. Manual Invite Flow

## 1. Invite Created

Actor:

- Org Owner
- Org Admin
- Project Admin, if inviting into a Project Space
- DBR77 Support only if explicitly allowed

System actions:

1. Create or locate User by email.
2. Create Membership with status `invited`.
3. Assign default organization role or project role.
4. Assign Role Bundle if selected.
5. Set optional expiration for external users.
6. Send invitation email.
7. Create ReBAC relation tuples in pending state if needed.
8. Write Audit Event: `user_invited`.

Required fields:

- invited_email
- target_organization_id
- target_project_space_id optional
- role_bundle_key
- invited_by_user_id
- expires_at required for external users
- source = manual_invite

Rules:

- external consultants must have expiry
- DBR77 Support Edit cannot be granted through normal invite
- Org Owner role should require elevated confirmation

---

## 2. Invite Accepted / Activation

User actions:

1. Opens invitation link.
2. Creates account or logs into existing account.
3. Completes MFA if required.
4. Accepts terms and privacy requirements.
5. Selects or confirms organization/project context.

System actions:

1. Verify invite token.
2. Activate User if new.
3. Set Membership status to `active`.
4. Activate related project membership.
5. Create or activate ReBAC relation tuples.
6. Issue first session.
7. Write Audit Event: `user_activated`.

Rules:

- if MFA required and not completed, block access
- if invite expired, reject and require new invite
- if user belongs to multiple organizations, force context selection after login

---

## 3. Role Assignment

Actor:

- Org Owner
- Org Admin
- Security Admin for security roles
- Project Owner / Project Admin for project roles
- SCIM Group Mapping for Enterprise

System actions:

1. Validate assigner has permission `org.user.role.assign` or `project.role.assign`.
2. Validate target user belongs to organization or project.
3. Validate Role Bundle is assignable in this scope.
4. Create UserRoleAssignment.
5. Create/update ReBAC relation tuples.
6. Write Audit Event: `role_assigned`.

Rules:

- Org Admin cannot remove or downgrade Org Owner.
- External Consultant roles must be project-scoped.
- Role Bundle cannot exceed Organization Entitlement.
- Export permissions require explicit grant if resource is Confidential or IP Critical.

---

## 4. Entering a Project Space

User action:

- selects Project Space in UI or follows project link

System actions:

1. Load current session.
2. Verify active organization.
3. Check membership: user belongs to active organization.
4. Check organization participates in Project Space.
5. Check user has direct or role-based project access.
6. Check project status is active.
7. Set `active_project_space_id` in session.
8. Return new context token.
9. Write Audit Event: `project_context_selected`.

Rules:

- no project access without active organization
- no lateral movement between projects
- expired project memberships are denied
- frontend must display active Project Space clearly

---

## 5. Deactivation / Removal

Manual path:

1. Admin removes user or role.
2. Membership status changes to `suspended` or `deleted`.
3. UserRoleAssignments are revoked.
4. ReBAC relation tuples are deleted or expired.
5. Active sessions are revoked.
6. Audit Event: `user_access_revoked`.

Rules:

- removing last Org Owner is blocked
- project access must be removed when organization is removed from project
- external users should auto-expire

---

# B. SCIM Enterprise Provisioning Flow

## 1. SCIM Tenant Setup

Actor:

- Organization Security Admin
- DBR77 Enterprise Admin

System actions:

1. Create SCIM_TENANT for Organization.
2. Generate SCIM bearer token or OAuth client credentials.
3. Configure IdP app in Entra ID / Okta.
4. Define group mappings.
5. Test provisioning connection.
6. Audit Event: `scim_tenant_created`.

Required mappings:

- IdP group -> DBR77 organization role
- IdP group -> module role bundle
- IdP group -> project role bundle optional

---

## 2. SCIM User Provisioned

IdP action:

- sends SCIM `POST /Users`

System actions:

1. Create or update User.
2. Link User to external_identity_id.
3. Create Membership in mapped Organization.
4. Assign roles based on SCIM group mappings.
5. Create ReBAC relation tuples.
6. Do not require manual invite.
7. Audit Event: `scim_user_provisioned`.

Rules:

- SCIM is source of truth for Enterprise-managed users.
- local manual role overrides should be avoided or clearly marked.
- user may still need first login via SSO before receiving a session.

---

## 3. SCIM Group Update

IdP action:

- sends SCIM `PATCH /Users/{id}` with group changes

System actions:

1. Update group memberships.
2. Recalculate Role Assignments from SCIM mappings.
3. Add or revoke Role Bundles.
4. Update ReBAC relation tuples.
5. Revoke sessions if privileges were reduced.
6. Audit Event: `scim_group_membership_updated`.

Rules:

- removed group means role revoked.
- security-sensitive role changes should revoke active sessions immediately.
- downgrade from Admin/Owner-equivalent group requires immediate session refresh or logout.

---

## 4. SCIM User Deprovisioned

IdP action:

- sends SCIM `PATCH active=false` or `DELETE /Users/{id}`

System actions:

1. Set User or Membership status to `suspended`.
2. Revoke all Role Assignments for that Organization.
3. Expire all ReBAC relation tuples for that Organization.
4. Revoke active sessions.
5. Remove project access inherited from that Organization.
6. Audit Event: `scim_user_deprovisioned`.

Rules:

- deprovisioning must be near-real-time.
- user must lose access even if already logged in.
- if user belongs to other organizations, only the SCIM-managed org access is removed.
- if user was last Org Owner, trigger emergency owner recovery process.

---

# C. Special Lifecycle Rules

## External Consultants

- must always have expiration
- must always be project-scoped
- MFA required
- export disabled by default
- no organization-wide access

## Workforce / End Users

- can be manually created, bulk imported, or SCIM provisioned
- should be managed primarily inside HRM admin
- only self-service permissions by default
- no access to core platform modules unless explicitly upgraded

## Shared Devices

- devices are provisioned separately from users
- employee identity must still be captured for personal actions
- device sessions must be short-lived
- no persistent shared user session

## DBR77 Support

- read-only by default
- edit requires Support Grant
- Support Grant requires customer approval
- Support Grant requires scope and expiry
- all support actions are audited

## Role Bundle Assignment Defaults

Recommended defaults:

- new internal organization user: `global.viewer` or no role until assigned
- new project invite: `project.viewer`
- external consultant: `external.project_viewer` with expiry
- workforce user: `hrm.employee_self_service`
- DBR77 support: `support.readonly`
- DBR77 service user in project: assigned per project, never global

---

# D. Lifecycle State Machine

```mermaid
stateDiagram-v2
    [*] --> Invited
    Invited --> Active: invite accepted / SCIM provisioned
    Invited --> Expired: invite expired
    Active --> Suspended: admin suspend / SCIM active=false
    Active --> Expired: valid_until reached
    Active --> Deleted: hard delete request
    Suspended --> Active: admin reactivate / SCIM active=true
    Suspended --> Deleted: deletion
    Expired --> Active: renewed access
    Deleted --> [*]
```
