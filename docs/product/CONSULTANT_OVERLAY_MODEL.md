# Consultant overlay model (canonical)

Consultants in Consultify use an **overlay-only** model:

- A consultant can hold **any** project role (Sponsor/Project Leader/Team Member…).
- Separately, we mark a user as a consultant via an **overlay** that is always visible and auditable.
- The overlay **never grants authority by itself**. Authority comes from system role + project role + (optional) steering board policy.

For the complete role layers and “effective role” resolution rules, see `docs/product/ROLES_MODEL.md`.

## Fields

Stored on canonical project membership (see migrations / data model docs):

- `consultant_profile`: `NONE | EXTERNAL | PARTNER | INTERNAL`
- `engagement_type`: `INTERNAL | INVITED_BY_CLIENT | CONSULTANT_LED_ONBOARDING`

## Visibility rules

- UI always shows badges:
  - system role,
  - project role,
  - consultant overlay (External/Partner/Internal).
- Audit logs include **both**:
  - acting project role,
  - consultant overlay.

## Invitation/onboarding

Consultant invitations use the **same project membership table** (no separate “consultant project access” universe).

Legacy endpoints may exist temporarily for compatibility, but they must write to canonical membership.
