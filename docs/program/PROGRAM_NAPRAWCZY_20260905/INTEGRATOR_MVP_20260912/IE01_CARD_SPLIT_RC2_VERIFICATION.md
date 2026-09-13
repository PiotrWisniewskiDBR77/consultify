# IE01 native card split — integrated verification

Source commit `60bd526b92caa51c4de145ddb2c38f645787dd5e`, integration `c98da8bc7c3d0b59283db25c56d18db1ba9b405a`. Source normal hooks passed. Independent and integrated seven-file tests each 30/30 PASS. Full build exit0. Frontend typecheck initial default-heap OOM134 retained; unchanged-source 8GB retry exit2, 192 vs192 existing file/code diagnostics. This is not a clean typecheck.

Actual built preview5292 + API5293: open Milestones, explicitly switch Preview and verify Add milestone disappears, Tasks → Milestones → reload retains native card URL. Four navigation checkpoints PASS, no page errors. Screenshot inspected. Existing organization-members403 and planning/legacy/suggested-changes/attachments404 remain; not accepted by this check. Existing local DEFINED fixture has no milestones; this does not prove milestone persistence or a fresh full journey.

Build and served index SHA256 `0f11413090329945b83286b07283407eb187ca44caea9b19bb6af70595fff1dc`. Raw runtime: `codex4-scratch/ie01-rc2-runtime-20260913/ui-native-card-split-v3/result.json`, `milestones-preview.png`, `milestones-reload.png`. Earlier v1 incorrectly assumed DEFINED opened Preview; v2 used button locator for actual radio. Both instrument failures retained; no product change between attempts.

Native runtime-v1 Tasks and Milestones now separate; legacy keeps combined. Independent initial gate fixture was unreachable and is corrected explicitly in follow-up acceptance. Full milestone owner/evidence/dependency work, full IE01, full MVP and deployment remain OPEN.
