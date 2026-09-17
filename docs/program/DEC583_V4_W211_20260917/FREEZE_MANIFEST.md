# Freeze manifest — DEC-583 v4 W211

Package: DEC-583 live organization person directory v4.
Status: READY FOR CTO REVIEW.
Base: `fa075366be0c8bafa666275c8f8cb7868e5f0099`.
Branch: `codex/b-dec583-v4-w211-20260917`.

V4 implementation delta:

- `server/src/controllers/UserController.ts`
- `server/src/routes/user/users.routes.ts`
- `server/src/routes/users.routes.ts` (removed dead router)
- `server/src/routes/__tests__/usersPersonDirectory.routes.test.ts`
- `server/src/routes/__tests__/usersPersonDirectory.gateway.pg.test.ts`
- `tests/unit/backend/routes/h64-failsoft-batch6.test.ts`
- `docs/program/DEC583_V4_W211_20260917/**`

Acceptance evidence:

- Live Gateway + RealPG: 4/4 PASS.
- Live-router unit tests: 5/5 PASS.
- Mutation route order: 1 RED / 3 PASS, restored GREEN 4/4.
- Restored staging-copy runtime: MEMBER same-org 200 without private fields; search 200 with names; cross-org 403; OWNER gets email without credentials.
- EN Calendar attendee picker rendered and selected `Thomas Baker`; screenshots captured in the Codex task; no event submitted.
- H64 users tests: 3/3 PASS. Full H64 retains only the two known Table Platform baseline failures.
- Server TypeScript PASS; ESLint 0 errors; four repository ratchets PASS.
- No migration.

