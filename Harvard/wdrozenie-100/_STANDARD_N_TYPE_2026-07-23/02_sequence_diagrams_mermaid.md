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
