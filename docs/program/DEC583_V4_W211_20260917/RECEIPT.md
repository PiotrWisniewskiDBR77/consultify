# DEC-583 v4 — W211 live users router

Status: READY FOR CTO REVIEW.

Base and current line: `fa075366be0c8bafa666275c8f8cb7868e5f0099` (`origin/integracja/20260911`).
Branch: `codex/b-dec583-v4-w211-20260917`.

## Runtime fix

- `Gateway.ts` still mounts the canonical `server/src/routes/user/users.routes.ts` router.
- `GET /api/users/search` is defined before `GET /api/users/:id` in that live router.
- Both reads use `shapeOrgPersonPayload`; MEMBER receives a minimal person payload and OWNER/ADMIN may receive email.
- `GET /api/users/:id` selects an explicit safe column list. It never selects or returns password or MFA fields.
- A user id that exists outside the active organization returns `403 USERS_READ_FORBIDDEN`; a genuinely absent id remains 404.
- The unmounted `server/src/routes/users.routes.ts` file was removed.
- The direct router test and H64 test now import the live router mounted by `ApiGateway`.

## Real Gateway and PostgreSQL

Fresh disposable PostgreSQL 18 (`127.0.0.1:6477/consultify`) was migrated with 926 migrations. The mounted `ApiGateway` test ran with `RUN_DB_TESTS=1`, `MOCK_DB=false`, and auth bypass disabled:

- 1 file / 4 tests PASS.
- MEMBER same-org response contains `id` and `displayName` and no `email`, `password`, or `mfa*` key.
- `/search` returns selectable names and no private fields to MEMBER.
- cross-org id returns `403 USERS_READ_FORBIDDEN`.
- OWNER gets email while password and MFA fields remain absent.

Evidence: `evidence/gateway-realpg-green.log`.

## Restored staging-copy runtime

The dump `/Users/piotrwisniewski/Developer/kopie/staging-pre-wdrozenie22-20260917T1636.dump` was restored only to the disposable local database `staging_copy`. No staging database was written.

The candidate server ran on the restored copy with real JWT verification and the live Gateway. HTTP probes:

- MEMBER Laura Novak → `GET /api/users/6aef8e3b-e295-5aef-ba46-bbfaa730ca21`: 200, `Thomas Baker`, no email/password/MFA (`evidence/member-user-runtime.txt`).
- MEMBER Laura Novak → `GET /api/users/search?q=nov&limit=8`: 200, selectable `Laura Novak`, no email/private fields (`evidence/member-search-runtime.txt`).
- MEMBER Northwind → foreign organization user id: 403 `USERS_READ_FORBIDDEN` (`evidence/cross-org-runtime.txt`).
- OWNER James Whitfield → Thomas Baker: 200 with email, still no password/MFA (`evidence/owner-user-runtime.txt`).

The local EN My Work → Calendar → Add event picker was opened as MEMBER Laura Novak. Typing `Tho` rendered selectable `Thomas Baker`; selecting it produced a `Thomas Baker` attendee chip. Both states were captured as screenshots in the Codex task. No event was submitted. A text readback is in `evidence/ui-picker-proof.txt`.

## Mutation and regression evidence

- Route-order mutation: changing the literal live route `/search` to `/search-disabled` let `/:id` catch the request. Result: 1 RED / 3 PASS; `/search` returned 404 `User not found`. After restore: 4/4 GREEN. Evidence: `evidence/mutation-route-order-red.log` and `evidence/gateway-realpg-green.log`.
- Direct live-router test: 5/5 PASS (`evidence/users-route-unit.log`).
- H64 full file: 16/18 PASS. The only two failures are the previously measured Table Platform mock failures at `table-platform.routes.ts:2870`; all three `/api/users` cases pass. Evidence: `evidence/h64-full.log`.
- Server TypeScript: PASS, 0 errors (`evidence/typecheck-server.log`).
- ESLint on changed server/router tests: 0 errors; existing warnings remain (`evidence/eslint.log`).
- `git diff --check`: PASS.

## Repository gates

- Language ratchet: PASS — nothing increased (`evidence/gate-language.log`).
- Docker flag guard: PASS, missing=0 (`evidence/gate-flags.log`).
- List canon: PASS, 346=current baseline (`evidence/gate-canon.log`).
- Artifact guard: PASS, 8=current baseline; R2/R3=0, danger=117 baseline (`evidence/gate-artifact.log`).

## Scope

- No migration added.
- No deployment and no push to staging, production, or `integracja/20260911`.
- V4-specific implementation changes are limited to the live users router/controller, their tests, H64 rewiring, dead-router removal, and this receipt. The inherited DEC-583 v3 delta remains unchanged apart from the required live-router migration.

