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
