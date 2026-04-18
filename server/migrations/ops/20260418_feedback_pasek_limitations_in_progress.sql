-- Feedback cluster: pasek-limitations (demo mode banner + access popups)
--
-- Items resolved in this pass:
--   #f574311b MEDIUM — "Pasek Limitations" overlapped the sibling banner
--                       below when the user expanded the limitations
--                       drawer.
--   #b85f5a91 MEDIUM — Translations for the demo banner (modes, hints,
--                       limitations, exit CTA, usage widgets) were
--                       missing outside of PL/EN. DE/ES/AR/JP users saw
--                       raw i18n keys such as `demo.banner.showLimitations`.
--   #4180b14f MEDIUM — "Demo mode" blocked-action popup rendered the
--                       hardcoded English copy shipped inside the frontend
--                       `access:blocked` event, overriding the i18n catalog
--                       for every non-EN locale.
--   #a26d96f3 HIGH   — AI usage chip read "AI: 25/25" which users parsed
--                       as "25 remaining of 25 daily" — they kept trying
--                       to chat even after their quota was exhausted and
--                       reported "chat blocked despite 25/25 available".
--   #34d68475 MEDIUM — After clearing the browser cache the demo banner
--                       disappeared until the next login because every
--                       demo-state signal lived in localStorage.
--   #da76799b MEDIUM — Same root cause as #34d68475 for the 24h countdown:
--                       each reload started a new client-side session and
--                       the timer reset to "24h" instead of continuing
--                       from the server-authoritative `expires_at`.
--
-- Root cause (single cluster, six user symptoms):
--   The demo banner + access blocked modal were running an almost
--   exclusively client-side state machine:
--     1. `useDemoSession` kept `sessionStartTime`, `aiInteractionsUsed`,
--        and all milestones in `localStorage('dbr77_demo_session')`. When
--        the user (or the browser) cleared storage, the hook had no way
--        to know a demo session was already live on the server, so it
--        either started a fresh 24h timer or fell through to the logged-
--        out state depending on whether the auth cookie survived the
--        cache wipe.
--     2. `DemoModeBanner` animated in with `y: -100 → 0`, i.e. the banner
--        visually translated down while still occupying its layout slot.
--        During the transition the translated element painted over the
--        sibling `TrialBanner` below, reproducing the "bar overlaps bar
--        below" report. The effect was amplified when the limitations
--        drawer expanded because the container was `fixed / z-50`.
--     3. The limitations drawer labels (`showLimitations`, `hideLimitations`
--        and the `limitations.*` sub-tree) only existed in the PL and
--        EN catalogs. DE/ES/AR/JP rendered the raw key strings and the
--        usage chips read `AI: 25/25` with no "used" / "remaining" hint
--        in any locale.
--     4. `UnifiedChatPanel` dispatched `access:blocked` with a hardcoded
--        English `message` + `cta`, and `AccessBlockedModal.resolved`
--        preferred `detail.message` over `t('access.blocked.<code>')`,
--        so even after adding the translations the popup still fell back
--        to the English string on every locale.
--
-- Fix:
--   * `useDemoSession.ts` — when localStorage is empty, hydrate the
--     session timer from `Api.getDemoOrganization()` (`demoSession.expiresAt`);
--     derive `sessionStartTime = expiresAt - DEMO_SESSION_DURATION_MS` so
--     the 24h countdown now continues from the server anchor across cache
--     clears instead of restarting at 00:00:00. Falls back to the previous
--     "start-now" behavior when the API is unreachable.
--   * `DemoModeBanner.tsx` — switch the root `motion.div` from a
--     `y: -100 → 0` translate to opacity-only (`relative z-0`) so the
--     banner always participates in normal document flow and cannot paint
--     on top of sibling bars. Rename the drawer trigger from "Hints" to
--     "Limitations" with the localized "Hide" toggle. Add explicit "used"
--     suffix + tooltips to the AI / token usage chips.
--   * `fix_demo_i18n.py` (and the resulting `public/locales/*/translation.json`)
--     — inject the missing `demo.banner.*` + `access.*` keys for EN / PL /
--     DE / ES / AR / JP, including `showLimitations`, `hideLimitations`,
--     `limitations.readOnly|sampleData|session|aiQuota`, `aiUsageLabel`,
--     `tokenUsageLabel`, `used`, `aiUsageTooltip`, `tokenUsageTooltip`.
--   * `AccessBlockedModal.tsx` — always prefer `t('access.blocked.DEMO_READ_ONLY')`
--     for `DEMO_ACTION_BLOCKED` events and only fall back to the event's
--     English `message` when the i18n catalog is genuinely missing.
--   * `UnifiedChatPanel.tsx` — drop the hardcoded `message` + `cta` from
--     the `access:blocked` events for `DEMO_TIME_EXPIRED` and
--     `DEMO_AI_SESSION_LIMIT_REACHED`; ship only the `code` and let the
--     modal resolve the localized copy via its existing `access.blocked.*`
--     + `access.cta.*` lookups.
--
-- Audit commit(s): see repo history around 2026-04-{16,17,18} for the
--   "fix(demo): pasek-limitations cluster" commit.
-- Staging deploy: pending (Railway auto-deploy on push to develop).

BEGIN;

UPDATE feedback_items
   SET status = 'IN_PROGRESS',
       updated_at = NOW(),
       metadata_json = (
           COALESCE(metadata_json::jsonb, '{}'::jsonb)
           || jsonb_build_object(
                'in_progress_at', NOW()::text,
                'cluster', 'pasek-limitations',
                'root_cause',
                  CASE substring(id::text, 1, 8)
                    WHEN 'f574311b' THEN 'DemoModeBanner animated in with a y:-100 translate and used fixed/z-50 positioning, so the translated element painted over the sibling TrialBanner below while the limitations drawer was expanded. Fixed by switching to opacity-only animation and relative/z-0 positioning so the banner always participates in normal document flow.'
                    WHEN 'b85f5a91' THEN 'The demo banner copy (limitations drawer, usage widgets, exit CTA, hints) only shipped in the PL and EN i18n catalogs. DE/ES/AR/JP rendered the raw keys such as demo.banner.showLimitations. Fixed by backfilling demo.banner.* + access.* keys across all six locales via scripts/fix_demo_i18n.py.'
                    WHEN '4180b14f' THEN 'UnifiedChatPanel dispatched access:blocked with a hardcoded English message + cta, and AccessBlockedModal preferred detail.message over t(access.blocked.<code>), so the demo blocked popup rendered English for every locale. Fixed by sending only the error code from the dispatcher and preferring the localized string in the modal (falling back to the event message only when the i18n key is missing).'
                    WHEN 'a26d96f3' THEN 'The AI usage chip rendered "AI: 25/25" with no direction hint; users read it as "25 remaining" and reported the chat being blocked while quota appeared available. Fixed by rewriting the chip to "AI 25/25 used" with an explanatory tooltip ("AI calls used today / daily limit") in every locale.'
                    WHEN '34d68475' THEN 'Demo-mode signals (isDemo, sessionStartTime, aiInteractionsUsed) lived exclusively in localStorage; clearing the browser cache wiped them, so the banner disappeared until the next login even though the server still had an active demo_sessions row. Partially addressed by useDemoSession now hydrating from the server via Api.getDemoOrganization() when localStorage is empty; the "until re-login" gap is expected because the auth cookie is also cleared.'
                    WHEN 'da76799b' THEN 'Same localStorage dependency as #34d68475 — every reload after a cache clear started a fresh 24h client-side session and the countdown reset to 00:00:00. Fixed by deriving sessionStartTime = demoSession.expiresAt - DEMO_SESSION_DURATION_MS on hydration so the timer now continues from the server-authoritative anchor across cache clears.'
                    ELSE NULL
                  END,
                'fix_summary',
                  'Pasek-limitations cluster: make the demo banner server-authoritative (timer hydrates from demo_sessions.expires_at), stop the limitations drawer from painting over sibling bars (opacity-only animation + relative positioning), backfill demo.banner.* and access.* translations across EN/PL/DE/ES/AR/JP, and stop leaking hardcoded English copy through the access:blocked event pipeline so AccessBlockedModal always renders the localized message.',
                'files',
                jsonb_build_array(
                  'src/hooks/useDemoSession.ts',
                  'src/components/layout/DemoModeBanner.tsx',
                  'src/components/access/AccessBlockedModal.tsx',
                  'src/components/AIChat/UnifiedChatPanel.tsx',
                  'public/locales/en/translation.json',
                  'public/locales/pl/translation.json',
                  'public/locales/de/translation.json',
                  'public/locales/es/translation.json',
                  'public/locales/ar/translation.json',
                  'public/locales/jp/translation.json',
                  'scripts/fix_demo_i18n.py'
                ),
                'timeline_entry',
                jsonb_build_object(
                  'at', NOW()::text,
                  'by', 'system',
                  'type', 'progress',
                  'note',
                  'Pasek-limitations cluster landed: (1) useDemoSession now hydrates the 24h timer from the server demoSession.expiresAt so the countdown continues through cache clears instead of resetting; (2) DemoModeBanner switched to an opacity-only entry animation with relative positioning so the expanded limitations drawer stops painting over the TrialBanner below; (3) demo.banner.* + access.* keys were backfilled for DE/ES/AR/JP (and completed for PL) via scripts/fix_demo_i18n.py, adding explicit "used" suffixes and tooltips to the AI/token usage chips so "25/25" can no longer be misread as "25 remaining"; (4) AccessBlockedModal + UnifiedChatPanel now cooperate on localized copy — the chat panel emits only the error code and the modal always prefers t(access.blocked.<code>) over any English string attached to the event.'
                )
              )
       )::text
 WHERE substring(id::text, 1, 8) IN (
   'f574311b', 'b85f5a91', '4180b14f', 'a26d96f3', '34d68475', 'da76799b'
 );

COMMIT;
