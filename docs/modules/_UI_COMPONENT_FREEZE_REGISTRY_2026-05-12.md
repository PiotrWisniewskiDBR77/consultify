---
doc_kind: UI_COMPONENT_FREEZE_REGISTRY
owner: user
status: active
last_updated: 2026-05-12
scope: strict-ui-freeze
work_type: ui-ux-governance
---

# UI Component Freeze Registry (Strict Mode)

## 1. Policy

Strict freeze is active:

- only approved components/patterns may be used,
- no new component pattern without mini-RFC and explicit approval,
- no merge allowed for unapproved UI pattern.

## 2. Canonical Sources

- `APPROVED_COMPONENT_COMPOSITION.md`
- `UI_UX_COMPONENTS_AND_ARTIFACTS_UNIFIED_STANDARD.md`
- `UI_UX_CONTRACT_INDEX.md`
- UI governance rules under `.cursor/rules/20-ui-ux-governance.mdc`

## 3. Registry Classes

| Class | Meaning | Delivery rule |
| --- | --- | --- |
| `APPROVED` | Fully accepted pattern | may be used directly |
| `CONDITIONAL` | Allowed with explicit condition | must include condition evidence in gate pack |
| `FORBIDDEN` | Not allowed in rollout | must be replaced before merge |

## 4. Global Hard UX Constraints

1. Contextual AI actions must live in Menu 3/right-side command slot.
2. No duplicate top-level toolbar for same action set.
3. Mandatory states: loading, empty, error, degraded, success with next action.
4. High-impact action UX must expose review/approval.

## 5. New Component Introduction (mini-RFC required)

Before adding any new component pattern:

1. create mini-RFC row with:
   - problem,
   - why existing approved pattern is insufficient,
   - proposed UX behavior,
   - rollback/replacement strategy;
2. get owner approval,
3. add to registry as `CONDITIONAL`,
4. promote to `APPROVED` only after gate evidence.

## 6. No-go Conditions

- unapproved component pattern in production path,
- hidden action surface outside Menu 3 when equivalent already exists,
- visual behavior not matching declared state model.
