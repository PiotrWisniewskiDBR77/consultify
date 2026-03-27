# V8.1 Sync Entry Canonicalization

Date: 2026-03-26
Lane: `Sync / connectors / interoperability`
Taxonomy: `T2`
Status: `done`

## Goal

Remove the live entry ambiguity around sync settings by turning `/settings/integrations` into a
controlled compatibility alias instead of letting it fall through to the wrong settings section.

## What changed

1. Settings entry resolver
   - added `resolveLegacySyncSettingsEntry()` in `src/views/settings/syncEntryResolver.ts`
   - admin and superadmin users now redirect from `/settings/integrations` to `/admin?tab=integrations`
   - non-admin users now redirect from `/settings/integrations` to `/settings/connected-apps`

2. SettingsView hardening
   - updated `src/views/SettingsView.tsx`
   - legacy sync entry aliases no longer render the `profile` fallback
   - the legacy section slug `integrations` now normalizes to `connected-apps` during section resolution

3. Regression coverage
   - added `tests/unit/settings/sync-entry-resolver.test.ts`

## Why this matters

This closes the first bounded sync split-brain cut:

- the legacy sync settings deep link no longer lands on the wrong user-facing surface
- admin/operator sync entry and user connected-apps entry are now explicitly separated
- the next sync packet can focus on bounded hub read/runtime continuity instead of entry ambiguity

## Verification

`npx vitest run tests/unit/settings/sync-entry-resolver.test.ts tests/components/RouterSync.idea-artifact.test.tsx tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx`
