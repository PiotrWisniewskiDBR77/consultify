# Execution regression closure — exact-SHA evidence

Date: `2026-08-24`

Candidate: `e04797f99335f8e268e4dc5153c4bd2dd7a2b725`

Scope: bounded local verification of three visible Execution regressions found
during the 2026-08-23 owner review. This packet does not constitute owner
acceptance, production release evidence or Railway verification.

## Runtime identity

- Client: `http://127.0.0.1:4007`
- Server: `http://127.0.0.1:4006`
- Local disposable PostgreSQL database:
  `consultify_w3_initiatives_owner_execution_20260824`
- Database endpoint: `127.0.0.1:35623`
- Ready response: exact candidate SHA, database ready, SQL migration chain
  `ok`, no pending migrations and no drift.
- Startup readback: `0` applied and `685` already-current server migrations;
  the guarded fixture readback records the complete `834`-migration chain.
- Authentication: real local OWNER login. Test-auth, gateway-auth bypass and
  support bypass were disabled.
- Browser marker: `LOCAL @e04797f99335`.
- Railway and production were not accessed or changed.

## Guarded fixture

Manifest:
`/private/tmp/consultify-wave3-initiatives-owner-execution-e04797f9-20260824.json`

Manifest SHA-256:
`fccf29bf8ed463435f378f9b92b611428a11b09c30ba434cf0e14660125e588e`

The `0600` manifest identifies a reconstructible local synthetic fixture. Its
post-reset seed/readback reconciled one Initiative, one Execution link and
Case, two tasks, one decision, two allocations, one management signal, one
intervention and one report definition/run. The fixture also contains readable
same-organization actors. It records `productionWrites=false`,
`legacyWritersInvoked=false` and `aiGenerationInvoked=false`.

## Browser checks

| Check | Expected | Result | Evidence |
|---|---|---|---|
| Execution lifecycle label | Polish `W realizacji`, not raw `Executing` | `PASS` | `execution-list-status-pl.png` |
| Control actors | readable owner and approver names, not UUIDs | `PASS` | `execution-control-readable-actors-no-closure-panel.png` |
| Historical closure panel | absent from Control | `PASS` | same Control screenshot; DOM count `0` |

### Screenshots

- `execution-list-status-pl.png` — SHA-256
  `3e47d942e6fa7a10ee6aa67ee12a9ca91bfd7368da26daba4f93d1fa57f7adc6`
- `execution-control-readable-actors-no-closure-panel.png` — SHA-256
  `0689b75bb7589225d6d3f4eba865a816c541d2d305cb18a59cdcb86bdea98f98`

## Automated regression checks

Focused Execution tests at this exact source checkpoint: `20/20 PASS`.

The repository-wide typecheck remains outside this bounded closure because it
contains pre-existing unrelated failures. No claim of a full-product green
typecheck is made here.

## Gate conclusion

`TECHNICAL_EXACT_SHA_BROWSER_PASS / OWNER_RETEST_REQUIRED`

The three bounded regressions are technically closed on the exact local
candidate. All broader Execution product, responsive, theme, accessibility,
cross-language and final 16-module gates remain governed by the module register.
