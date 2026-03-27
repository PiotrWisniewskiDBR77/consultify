# V8 Superadmin Fresh-Shell Continuity Proof

Date: 2026-03-26
Environment: `staging`
Surface: `Superadmin > AI Platform > Operations > Health Monitoring`

## What was verified

1. A brand-new browser tab was opened after the latest staging deploy.
2. The fresh shell loaded the new deploy asset graph:
   - `index-DUdKlsAi.js`
3. Local frontend build contains the bounded V8 diagnostics panel in the generated AI Platform chunk:
   - `dist/assets/AIPlatformModule-DKvGEBp7.js`
   - contains `V8 Superadmin Diagnostics`
   - contains `src/views/superadmin/AIPlatformModule/Operations/HealthMonitoringTab.tsx`
   - contains `src/components/Admin/V8AdminDiagnosticsPanel.tsx`
4. The repo contains a service worker in `public/sw.js`, while `index.html` only unregisters it on production hosts `consultify.ai` / `www.consultify.ai`, not on `stage.consultinity.ai`.

## Observed blockers in the fresh shell

1. Logging out from the authenticated staging session crashed into the error boundary:
   - `Error: useHelp must be used within HelpProvider`
2. Root cause was narrowed in source:
   - `src/providers/AppProviders.tsx` mounted `HelpProvider` only for authenticated routes
   - public/logout flow could therefore render `useHelp()` consumers without the provider
3. A local continuity fix was added:
   - `HelpProvider` is now mounted outside the authenticated-only provider branch
   - regression test added in `tests/components/AppProviders.help-context.test.tsx`
4. Re-login in the fresh shell was then blocked by staging auth throttling:
   - `POST /api/auth/login`
   - status `429`
   - browser console reported `Too many authentication attempts.`

## Operational conclusion

The remaining `Organization / Admin / Superadmin` blocker is no longer best explained as missing frontend code for the bounded V8 diagnostics panel.

It is now narrowed to fresh-shell continuity and retest conditions on staging:

- the latest frontend shell is present,
- the bounded diagnostics panel is present in the local built AI Platform chunk,
- but fresh superadmin re-proof is currently blocked by logout/session-switch continuity and staging login throttling.

## Next move

1. Deploy the `HelpProvider` continuity fix.
2. Re-open a fresh staging shell after deploy.
3. Re-run the superadmin `Health Monitoring` proof after the `429` auth throttle window clears.
