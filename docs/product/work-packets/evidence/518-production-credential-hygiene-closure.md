# 518 - production credential hygiene closure

Date: 2026-03-28
Owner: Manager Agent
Scope: wider-production readiness closeout
Status: closed

## What changed

- inventoried the real in-scope privileged production accounts by checking live production password hashes against the known weak credential set via the public production Postgres target
- rotated every affected privileged production account to a fresh unique strong password
- stored the fresh credentials only in the local approved secret system used for this run: macOS Keychain service `consultify-prod-credential-rotation-2026-03-28`
- stored a rollback backup of the pre-rotation credential state only in macOS Keychain service `consultify-prod-credential-rotation-backup-2026-03-28`
- revoked stale access artifacts for the rotated accounts by clearing `refresh_tokens`, `user_sessions`, `sessions`, and `password_resets`
- verified that the old weak credential path now fails and the replacement credential path succeeds for every affected account through the normal production login route at `https://consultify.ai/api/auth/login`

## In-scope inventory

Approval basis: execute the active production credential-hygiene closeout from the current endgame plan.

Rotation reason for every row below: the production password hash for the privileged account still matched the previously known weak credential `123456`.

| Account | Role | Organization |
|---|---|---|
| `admin@dbr77.com` | `SUPERADMIN` | `dbr77` |
| `piotr.wisniewski@dbr77.com` | `OWNER` | `dbr77` |
| `adam.kilka@dbr77.com` | `ADMIN` | `dbr77` |
| `anja.nugmanowa@dbr77.com` | `ADMIN` | `dbr77` |
| `bartlomiej.straszka@dbr77.com` | `ADMIN` | `dbr77` |
| `bartosz.solomski@dbr77.com` | `ADMIN` | `dbr77` |
| `doreen.mittelstaedt@dbr77.com` | `ADMIN` | `dbr77` |
| `jeremiasz.kazmierczak@dbr77.com` | `ADMIN` | `dbr77` |
| `justyna.laskowska@dbr77.com` | `ADMIN` | `dbr77` |
| `kamil.kuczek@dbr77.com` | `ADMIN` | `dbr77` |
| `katarzyna.marszalkiewicz@dbr77.com` | `ADMIN` | `dbr77` |
| `katarzyna.szwarocka@dbr77.com` | `ADMIN` | `dbr77` |
| `konrad.milewski@dbr77.com` | `ADMIN` | `dbr77` |
| `konrad.stefanik@dbr77.com` | `ADMIN` | `dbr77` |
| `marcin.zorawik@db77.pl` | `ADMIN` | `dbr77` |
| `michal.lomzynski@dbr77.com` | `ADMIN` | `dbr77` |
| `paulo.soares@dbr77.com` | `ADMIN` | `dbr77` |
| `pawel.dera@dbr77.com` | `ADMIN` | `dbr77` |
| `pawel.kalinski@dbr77.com` | `ADMIN` | `dbr77` |
| `pawel.mroczkowski@dbr77.com` | `ADMIN` | `dbr77` |
| `tomasz.jankowski@dbr77.com` | `ADMIN` | `dbr77` |
| `torian.richardson@dbr77.com` | `ADMIN` | `dbr77` |
| `wojciech.wesolowski@dbr77.com` | `ADMIN` | `dbr77` |
| `anna.zielinska@ateliertoys-demo.com` | `ADMIN` | `ateliertoys-demo` |
| `ewa.gajda@ateliertoys-demo.com` | `ADMIN` | `ateliertoys-demo` |
| `jan.wozniak@ateliertoys-demo.com` | `ADMIN` | `ateliertoys-demo` |
| `karolina.mazur@ateliertoys-demo.com` | `ADMIN` | `ateliertoys-demo` |
| `magda.nowak@ateliertoys-demo.com` | `ADMIN` | `ateliertoys-demo` |
| `mateusz.kurek@ateliertoys-demo.com` | `ADMIN` | `ateliertoys-demo` |
| `michal.stepien@ateliertoys-demo.com` | `ADMIN` | `ateliertoys-demo` |
| `ola.mroz@ateliertoys-demo.com` | `ADMIN` | `ateliertoys-demo` |
| `piotr.baran@ateliertoys-demo.com` | `ADMIN` | `ateliertoys-demo` |
| `tomasz.lewandowski@ateliertoys-demo.com` | `ADMIN` | `ateliertoys-demo` |

## Verification

Executed checks:

1. Queried live production `users` through `DATABASE_PUBLIC_URL` and compared the in-scope privileged password hashes against the known weak credential set: `123456`, `test123`, `test123456`, `demo123`, `Demo2025!`, `superadminpassword123`.
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
- `docs/product/work-packets/PRODUCTION_CREDENTIAL_HYGIENE_CLOSEOUT_CHECKLIST_2026-03-28.md`
- the final wider-production decision memo
