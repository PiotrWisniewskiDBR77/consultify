# Presentation RBAC Matrix (K1)

Status: `ACTIVE`
Owner: Security + Backend

## Capabilities

- `presentation_create`
- `presentation_edit`
- `presentation_approve`
- `presentation_export`
- `presentation_share`
- `template_approve`
- `brand_change`

## Role Matrix

| Role | create | edit | approve | export | share | template_approve | brand_change |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SUPERADMIN | yes | yes | yes | yes | yes | yes | yes |
| OWNER | yes | yes | yes | yes | yes | yes | yes |
| ADMIN | yes | yes | yes | yes | yes | yes | yes |
| PROJECT_MANAGER | yes | yes | no | yes | yes | no | no |
| USER / TEAM_MEMBER | yes | yes | no | yes | yes | no | no |
| VIEWER / GUEST | no | no | no | yes | no | no | no |

## Enforcement Notes

- API enforcement returns `403` with `requiredCapability`.
- UI should hide unavailable actions but backend is final authority.
- Any matrix change requires update in backend policy service and tests.
