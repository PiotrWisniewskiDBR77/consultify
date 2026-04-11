# FINAL IMPLEMENTATION PLAN 32 ADMIN ENTERPRISE 2026-04-11

## Status
This document supersedes the narrow-scope P32 cockpit contract that limited Admin to
`members/security/collaboration/integrations/audit`.

## Product Decision
`P32` is the canonical tenant-admin command center for enterprise operations.

It owns:
- `Overview`
- `People & Access`
- `Security & Identity`
- `Billing, Limits & FinOps`
- `AI Governance & AI Operations`
- `Integrations & External Systems`
- `Audit, Compliance & Risk`
- `Organization Operations`

It does not replace:
- `P30 Organization` as the business profile and strategic context workspace
- `P31 Settings` as personal and user-scoped preferences
- `P33 Superadmin` as cross-tenant platform control plane

## Ownership Matrix
### P32 Tenant Admin owns
- tenant membership and ownership operations
- tenant security, SSO, MFA, privileged access policy
- tenant billing, limits, usage posture, spend alerts
- tenant AI policy, AI settings, AI operating posture, token economics visibility
- tenant integrations health and remediation
- tenant audit trail for admin high-risk actions
- tenant domains, branding, competency admin surfaces required for operations

### P33 Superadmin owns
- cross-tenant overrides
- platform-level pricing, catalog, and global policy exceptions
- platform infrastructure and global AI platform controls
- emergency intervention across tenants

### Rules
- superadmin override must be explicit and auditable
- tenant admin writes fail closed on permission ambiguity
- P32 is the preferred write surface for tenant-critical admin operations
- legacy Organization admin fragments must redirect or hand off to P32

## Enterprise IAM Baseline
Required administrative roles:
- `Owner`
- `Admin`
- `Billing Admin`
- `Security Admin`
- `AI Admin`
- `Compliance Admin`
- `Member`
- `Guest`

Required governance capabilities:
- delegated admin roles
- recurring access reviews
- privileged session reauthentication
- break-glass policy with named approvers
- context-aware access posture
- privileged change alerting

## Acceptance Bar
P32 is enterprise-ready only when:
1. the Admin shell exposes all tenant-critical domains listed above
2. `/api/admin` provides the canonical aggregation spine for tenant-admin posture
3. admin navigation no longer depends on legacy `Organization` or old five-branch assumptions
4. billing, limits, AI governance, and admin IAM are first-class P32 capabilities
5. audit evidence exists for high-risk security, IAM, and collaboration changes

## Migration Notes
- Old `Organization` admin sections should hand off to P32 equivalents.
- Existing tenant admin endpoints can remain as implementation dependencies, but the product
  contract should treat `/api/admin` as the canonical admin-facing surface.
- Future enterprise work should extend this contract rather than reintroduce split ownership.
