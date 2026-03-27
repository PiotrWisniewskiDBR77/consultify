# V8.1 broader Sync settings connect/readback authority continuity seam

Date: 2026-03-27
Lane: broader `Sync` completion
Taxonomy: `T4`
Packet: twenty-sixth bounded packet after broader-lane promotion

## Why this packet

After the post-Asana assessment, the remaining live broader-sync split-brain sat on the user-level settings integrations surface.

That surface was still dishonest because:

- `GET /api/settings/integrations` read a separate preferences-backed integration list instead of governed sync truth,
- `POST /api/settings/integrations/:provider/connect` immediately wrote fake connected truth for the user,
- and the response still returned `authUrl: null` instead of real governed external-auth preparation.

The next honest bounded step was to align settings connect initiation and readback with the governed sync seam, without yet pulling the entire remaining settings lifecycle into the same packet.

## What changed

### Settings integrations readback now surfaces governed sync truth

- updated `server/src/routes/settings.routes.ts`
- `GET /api/settings/integrations` now reads governed integration inventory when the governed connector schema is available
- the settings surface now overlays governed integrations ahead of legacy preferences-backed rows instead of pretending the preferences list is authoritative
- provider cards are now returned with `isConnected` and `connection` derived from the same governed readback envelope

### Settings connect initiation now reuses the governed sync path

- updated `server/src/routes/settings.routes.ts`
- `POST /api/settings/integrations/:provider/connect` now reuses governed connector creation semantics for governed connectors
- the settings surface now creates pending governed integration truth instead of immediate fake `active` user preference truth
- when the connector is ready for oauth, the route now returns a real governed provider authorization URL instead of `authUrl: null`

### Focused regressions were added

- added `server/src/routes/__tests__/settings.routes.test.ts`
- extended targeted route coverage to prove that the settings surface now exposes governed pending truth and real provider auth initiation
- kept `server/src/routes/__tests__/integrations.routes.test.ts` green to confirm canonical org-level continuity still holds

### Scope stayed bounded

- no settings disconnect continuity was attempted
- no settings config/test/refresh/logs continuity was attempted
- no full user-preferences storage migration was mixed into the same packet

## Regression coverage

Passed:

- `server/src/routes/__tests__/settings.routes.test.ts`
- `server/src/routes/__tests__/integrations.routes.test.ts`

Verification command:

`npx vitest run server/src/routes/__tests__/settings.routes.test.ts server/src/routes/__tests__/integrations.routes.test.ts`

Result: `5` tests passing.

## Residual after this packet

Broader `Sync` completion is still not done.

Remaining honest residuals include:

- assessing whether one more thinner settings-lifecycle continuity seam remains after settings readback/connect alignment
- deeper authority alignment still remains across the rest of the user-level settings integrations lifecycle (`disconnect`, `config`, `status`, `test`, `refresh`, `logs`)
