# Final-demo runtime — Assessment

Date: 2026-08-23  
Qualified product SHA: `bcfb01483a368fb4baa133d35dbc7b56ba6c7857`  
Reconciliation commit at runtime preparation start: `d1837d128dfff432c5cc3e735ae9c1e5cfaaf8c0`  
Production / Railway: `NOT_AUTHORIZED / NOT_TOUCHED`

## Runtime identity

- clean detached worktree:
  `/Users/piotrwisniewski/Developer/Consultify/.worktrees/finaldemo-bcfb`;
- client: `http://127.0.0.1:4370`;
- server: `http://127.0.0.1:4371`;
- isolated native PostgreSQL 17: `127.0.0.1:34945`;
- database: `consultify_w3_assessment_owner_finaldemo_bcfb`;
- database is a full logical local clone of the recovered Assessment owner
  fixture, not the protected source fixture;
- migrations: `832`, exact chain SHA-256
  `7bf049c73f56e6ea6a5fbac89605da862b20944f000f5b4aba8ca38ef6aad1c3`;
- health, readiness and frontend: HTTP `200`;
- server SHA, readiness SHA and served client marker: exact
  `bcfb01483a368fb4baa133d35dbc7b56ba6c7857`;
- server/client exact PID and process-group ownership: PASS;
- auth/test bypasses: OFF; persisted runtime secret: false; prohibited
  credential-shaped environment values in owned process groups: absent.

Guarded runtime manifest:
`/private/tmp/consultify-wave3-runtime-manifest-finaldemo-bcfb-v3.json`.

## API and SQL readback

- real OWNER password login against the isolated server: PASS;
- `GET /api/method/packs`: HTTP `200`;
- `GET /api/method/sessions?limit=20`: HTTP `200`, three tenant sessions;
- `GET /api/method/outputs?limit=20`: HTTP `200`, one immutable Output;
- SQL session readback: one `frozen`, one `draft`, one `active`;
- SQL Output readback: exactly one;
- source fixture database and owner runtime `4363/4364` were not mutated or
  stopped.

## Browser readback

The browser reached the exact-SHA client and preserved the requested Assessment
Library redirect. The unauthenticated screen rendered `LOCAL @bcfb01483a36`
and redirected to:

`/login?redirect=%2Fassessment%2Foverview%3Ftab%3Dlibrary`.

The authenticated UI was deliberately not fabricated by injecting browser
storage or enabling a test bypass. The tab is retained for the next owner-review
turn. Authentication and the visible Library/Processes/Interview/Matrix/Report
readback therefore remain `PENDING`, while API/SQL identity is `PASS`.

## Residuals and stop contract

- The server log contains one expected development-runtime warning that
  `dist/index.html` is absent; the separately owned Vite client serves `4370`
  successfully. No uncaught/unhandled/fatal runtime error was found.
- Do not treat this Assessment fixture as proof of the signed cross-module FLOW
  browser journey.
- Do not deploy, push, mutate Railway or reuse the database name outside this
  local runtime.
- Stop only with the guarded runtime script and the exact manifest/state/ports;
  preserve the database until owner review or an explicit cleanup decision.
