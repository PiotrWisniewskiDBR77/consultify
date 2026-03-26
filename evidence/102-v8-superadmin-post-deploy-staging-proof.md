# V8 Superadmin Post-Deploy Staging Proof

Date: 2026-03-26
Environment: `staging`
Service: `consultify`
Deployment: `ced66a48-7f16-4135-8e61-158adee57af7`

## What was verified

1. Fresh staging deploy was triggered for `consultify` on Railway.
2. Railway build logs completed successfully, including successful `/ping` healthcheck.
3. Browser retest was executed on the fresh staging runtime.

## Observed runtime facts

- `GET /api/auth/me` returned `200` in the browser session.
- `GET /api/v8/admin/flags` returned `200` in the browser session.
- Direct navigation to `/superadmin?ts=1774530550` still resolved back to `/chat`.
- The visible sidebar still did not expose a `Superadmin` entry for the tested session.

## Conclusion

The blocker is now narrowed further:

- this is no longer explainable as a stale frontend deploy,
- and it is no longer explainable by the previously fixed `SUPERADMIN` / `SUPER_ADMIN` client-side drift alone.

Current most likely remaining blocker:

- the active staging session does not actually resolve to a superadmin-entitled user path at runtime, despite authenticated app access and bounded admin reads.

## Operational decision

Keep `Organization / Admin / Superadmin` in `blocked` state until a real staging session reaches the superadmin route and bounded diagnostics surface.
