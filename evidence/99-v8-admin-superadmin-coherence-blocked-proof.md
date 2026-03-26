## V8 Admin / Superadmin coherence retest

- Date: `2026-03-26`
- Environment: staging (`https://stage.consultinity.ai`)
- Goal: verify whether the bounded `Organization / Admin / Superadmin` packet is closure-ready on a live operator-facing surface

## Routes checked

1. `https://stage.consultinity.ai/admin?tab=integrations&ts=1774600100`
2. `https://stage.consultinity.ai/superadmin?ts=1774609999`
3. redirected runtime surface: `https://stage.consultinity.ai/chat`

## Observed authenticated state

- The browser session was authenticated on staging.
- The session could open the normal `Admin Panel` surface.
- Direct navigation to `/superadmin` did not stay on a superadmin surface; it settled on `/chat`, so this runtime window did not provide a superadmin-grade UI proof path.

## Live operator-facing UI observations

### `Admin -> Integrations`

- The admin shell rendered normally with the `Admin Panel` navigation active.
- The visible operator surface showed:
  - `Integrations Hub`
  - `Connected Apps`
  - `Sync Health`
  - `Permissions & Scopes`
  - `Audit Log`
  - `Connect`
  - `Connect your first integration`
- This confirms the staging session was healthy enough to render the bounded admin shell itself.

### `/superadmin`

- The attempted superadmin route did not expose a superadmin system/health/flags diagnostics surface in this session.
- The runtime landed on the normal authenticated `Chat` surface instead.

## Relevant network observations

### Confirmed live V8 admin request

- `GET /api/v8/admin/flags` -> `200` from the live authenticated `Admin Panel` runtime

### Later runtime volatility on the redirected `/chat` surface

- `GET /api/v8/admin/flags` -> `429`
- `GET /api/health` -> `200`
- multiple unrelated authenticated boot requests also returned `429`

## What was not observed from an operator-facing surface

- no live `GET /api/v8/admin/health`
- no live `GET /api/v8/admin/metrics`
- no live `GET /api/v8/admin/shadow/stats`
- no live `GET /api/v8/admin/shadow/comparisons`
- no live `GET /api/v8/admin/shadow/promotion-readiness`

## Decision

The packet is **not closure-ready yet** from staging proof.

What is now proven:

- the bounded admin runtime does call `GET /api/v8/admin/flags` on a real authenticated surface,
- the admin shell itself is live on staging,
- the route/client contract is already covered by automated regression.

What still blocks closure:

- this runtime session did not provide a superadmin-facing staging proof path,
- no operator-facing staging evidence was obtained for `health`, `metrics`, or `shadow` diagnostics,
- the remaining gap is now specifically **superadmin/operator staging coherence**, not missing backend implementation or missing bounded client contract.
