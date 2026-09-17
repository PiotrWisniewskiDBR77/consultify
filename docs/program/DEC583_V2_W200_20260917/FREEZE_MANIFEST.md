# Freeze manifest — DEC-583 v2 W200

Package: organization people directory minimization.

Changed files:

- `server/src/services/orgPersonPayloadPolicy.ts`
- `server/src/controllers/OrganizationController.ts`
- `server/src/controllers/__tests__/OrganizationController.membership.test.ts`
- `server/src/routes/organization/organizations.routes.ts`
- `server/src/routes/users.routes.ts`
- `server/src/routes/organization/teams.routes.ts`
- `server/src/routes/chat-projects.routes.ts`
- `server/src/routes/assessment-workflow-v2.routes.ts`
- `src/hooks/useOrganizationMemberNames.ts`
- `src/components/Execution/__tests__/ExecutionControlSurface.raidSygnaly.test.tsx`
- `docs/program/DEC583_V2_W200_20260917/RECEIPT.md`
- `docs/program/DEC583_V2_W200_20260917/FREEZE_MANIFEST.md`

Acceptance evidence:

- MEMBER can request the directory and resolve names.
- MEMBER payload excludes email.
- OWNER payload keeps email.
- Non-member org directory remains 403.
- Existing Execution RAID/signals behavior remains green.
