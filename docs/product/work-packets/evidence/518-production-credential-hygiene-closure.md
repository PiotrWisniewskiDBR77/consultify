# 518 - production credential hygiene closure

Date: 2026-03-28
Owner: Manager Agent
Scope: wider-production readiness closeout
Status: closed

## What changed

- inventoried the real in-scope privileged production accounts by checking live production password hashes against the approved weak-credential detection set via the public production Postgres target
- rotated every affected privileged production account to a fresh unique strong password
- stored the fresh credentials only in the local approved secret system used for this run: macOS Keychain service `consultify-prod-credential-rotation-2026-03-28`
- stored a rollback backup of the pre-rotation credential state only in macOS Keychain service `consultify-prod-credential-rotation-backup-2026-03-28`
- revoked stale access artifacts for the rotated accounts by clearing `refresh_tokens`, `user_sessions`, `sessions`, and `password_resets`
- verified that the old weak credential path now fails and the replacement credential path succeeds for every affected account through the normal production login route at `https://consultify.ai/api/auth/login`

## In-scope inventory

Approval basis: execute the active production credential-hygiene closeout from the current endgame plan.

Rotation reason for every affected account: the production password hash still matched an approved weak-credential detection signature at the time of the closeout run.

The exact account roster is intentionally not stored in git. It was retained only in the approved operational systems for this run:

- live production `users` query output used during the execution window
- local macOS Keychain services `consultify-prod-credential-rotation-2026-03-28` and `consultify-prod-credential-rotation-backup-2026-03-28`

Sanitized scope summary:

| Organization | Role mix | Rotated accounts |
|---|---|---:|
| `dbr77` | `1 SUPERADMIN`, `1 OWNER`, `21 ADMIN` | `23` |
| `ateliertoys-demo` | `10 ADMIN` | `10` |
| **Total** | `1 SUPERADMIN`, `1 OWNER`, `31 ADMIN` | `33` |

## Verification

Executed checks:

1. Queried live production `users` through `DATABASE_PUBLIC_URL` and compared the in-scope privileged password hashes against the approved weak-credential detection set used for the closeout run.
2. Generated fresh unique 28-character strong passwords for every affected account and wrote them only to Keychain service `consultify-prod-credential-rotation-2026-03-28`.
3. Wrote a rollback-only backup of the previous credential state only to Keychain service `consultify-prod-credential-rotation-backup-2026-03-28`.
4. Updated every affected production password hash and revoked stale access artifacts from `refresh_tokens`, `user_sessions`, `sessions`, and `password_resets`.
5. For each of the `33` rotated accounts, executed production negative verification by calling `POST https://consultify.ai/api/auth/login` with the old credential and confirmed `401`.
6. For each of the `33` rotated accounts, executed production positive verification by calling `POST https://consultify.ai/api/auth/login` with the new credential and confirmed `200`.
7. For each of the `33` rotated accounts, confirmed the authenticated response still reported the same role and organization scope after rotation.
8. Purged the temporary verification sessions after proof collection and confirmed `refresh_tokens = 0`, `user_sessions = 0`, and `sessions = 0` for all rotated accounts.
9. No rollback was needed.

Verification summary:

- rotated accounts: `33`
- negative proof: `33 / 33` old credentials rejected with `401`
- positive proof: `33 / 33` new credentials accepted with `200`
- scope proof: `33 / 33` role and organization scope unchanged
- stale session proof after cleanup: `33 / 33` accounts show zero rows in `refresh_tokens`, `user_sessions`, and `sessions`

## Result

The remaining wider-production blocker recorded in `evidence/490-production-auth-guard-deploy-and-readiness-residual.md` is now closed.

Current truth:

- production shadow readiness remains green from `evidence/491-v8-production-pilot-shadow-readiness-green.md`
- credential hygiene is no longer the blocker for an honest wider-production go decision
- the remaining step is managerial rollout posture and final wider-production `GO / NO-GO`, not unresolved account security debt

## Follow-up doc updates

This closure requires aligned follow-up updates in:

- `docs/product/work-packets/CP-10-ROLLOUT-SAFETY-CHECKLIST.md`
- `docs/product/work-packets/cursor-work/PRODUCTION_CREDENTIAL_HYGIENE_CLOSEOUT_CHECKLIST_2026-03-28.md`
- the final wider-production decision memo
