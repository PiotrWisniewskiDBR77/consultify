# Freeze manifest — DEC-583 v3 W206

Package: DEC-583 organization person directory v3.
Status: READY FOR CTO REVIEW.

Changed files in v3:

- `src/hooks/useOrganizationMemberNames.ts`
- `src/hooks/__tests__/useOrganizationMemberNames.access.test.tsx`
- `server/src/routes/users.routes.ts`
- `server/src/routes/__tests__/usersPersonDirectory.routes.test.ts`
- `docs/program/DEC583_V3_W206_20260917/RECEIPT.md`
- `docs/program/DEC583_V3_W206_20260917/FREEZE_MANIFEST.md`

Acceptance evidence:

- MEMBER hook contract updated from "does not fetch" to "fetches minimal directory payload".
- Minimal person payloads with `displayName` are resolved to names in the UI hook.
- `GET /api/users/:id` first read is scoped by `organization_id`.
- Same-org MEMBER receives no email; same-org OWNER receives email; cross-org id returns 403.
- Tenant-scope mutation is RED.
- No migration was added.
