# E4 built candidate — independent bounded acceptance

BOUNDED ACCEPT for actual organization export/download on source691982300372a9bdb9e506a4414e92ebbcd3e968. Full E4/export completeness and a clean error-free application remain OPEN. No product changes, build reruns, old runtime restarts, outbound actions or real AI calls by reviewer.

## Exact execution identity
Root RC2 `/Users/piotrwisniewski/Developer/codex-wt/codex-w17-deck-autosave-20260912`; HEAD clean reverified after tests. Built and served index SHA2567cca541d61229a73b683e7316979df04c5a8566649eff8c051d379780847df1e exactly matches. Preview configFile:false, strict5297, root/dist; API proxy5296. Both cwd independently verified root. API5296 PID90500/session11525; preview5297 PID90556/session34790. Real Gateway, JWT and localPG6457/cx6_export_contract. Protected5294/5295 untouched.

External harness/evidence: `/Users/piotrwisniewski/Developer/codex-wt/codex6-scratch/e4-built-independent/`. Private state and logs contain auth material; never publish them. All browser authentication used the real login form on built5297, not token injection. Ordinary visible Skip for now handled onboarding; no consent/flag bypass.

## Delivered behavior
- OWNER and ADMIN × light/dark1440×900:4 actual self-service UI downloads PASS via existing `/admin/audit/retention-export` and `/api/organizations/:ownId/export?format=json`.
- SUPERADMIN × light/dark:2 actual existing Organizations row menu Export Data downloads PASS via superadmin endpoint; no destructive commands.
- MEMBER login: Admin redirects to AI Chat, export control absent, direct authenticated tenant export403.
- Legal hold enabled through real existing superadmin policy PUT200 on our own organization; OWNER UI export423 with clear hold message and zero downloads. Policy cleared through same writer200. New browser visit/download after clearing PASS; same mounted-component retry is not claimed by this browser sequence.
- All7 downloaded JSON files byte-equal to their recorded Playwright HTTP response bodies and in-page native fetch response clone. Original bytes saved. Correct tenant/current canonical manual body and manual task body retained. D18 exact answer/context/transcript empty and AI recommendations/feedback empty; anonymous and foreign sentinels absent from full bytes, nonanonymous text retained.
- Additional actual JSON+CSV API file acceptance: Python csv parser confirms exact table,row_index,data_json header, one reserved manifest record, 24CSVrecords=22business+organization+manifest, counts not inflated. Privacy sentinels absent in both. Seven business table SQL snapshot hashes before/after identical; own policy legal_hold_enabled=false readback. CSV is endpoint/file proof, not a nonexistent UI CSV selector.

Fixtures: fresh own OWNER/ADMIN/MEMBER/SUPERADMIN accounts and memberships plus foreign organization; bcrypt, no edits to prior users. Project, MANUAL_HUB Submit/Register/read and personal task were created through actual writers. D18 session/question/note/evidence/assignment/AI payloads are explicit adversarial SQL fixtures matching accepted privacy contracts; not claims of Interview generation/AI/source authoring. Records retained for review.

## Visual/assets
All4 self-service,2superadmin and MEMBER/hold screenshots inspected. Export control/status readable, no white/crash. Luma light-dark differences221.37 OWNER,221.38 ADMIN,218.15 SUPERADMIN.225 observed self-service asset paths per case matched root/dist bytes; all observed superadmin assets matched as well. No /src,/@vite,/@fs requests. Final case pageerror arrays empty. See acceptance-summary.json, luma.json, file-readback.json and per-case result.json. HTTP errors are retained in http-errors-summary.json; this is not zero-error acceptance.

## Honest findings and failed instrument attempts
1. Audit panel visibly renders `[object Object]` after real audit500 from missing admin_audit_logs/bootstrap schema. Export still works under audit-load failure. Root identified ApiError nested-message stringification source debt; screenshot and exact endpoints retained. Superadmin separately displays Access requests failed to load. No mocked200 used.
2. Initial real login500 missing user_mfa; later500 missing refresh_tokens. Authorized faithful schema-only import from read-onlycx6_swieza added7 actual auth/bootstrap tables and preserved MFA revocation function/trigger, types/PK/FK/indexes; no customer records. First three-table DDL attempt rolled back atomically because trigger function dependency was missing. Full DDL/dependency/manifests/readbacks retained. No global migrations or MFA bypass.
3. First browser instrument left a download promise unhandled while onboarding overlay prevented click; next attempt captured the overlay. Ordinary Skip for now fixed the instrument flow. Those attempts are not product export failures.
4. Two earlier byte comparisons differed only in exportedAt (one firstdiff1844;44ms). Both raw files retained. A bounded native-fetch-clone observation, without replacing/rerouting responses, then proved actual response→download correspondence; all final7 also byte-match Playwright bodies. Earlier mismatch cause remains unproven; no normalization used to obtain PASS.
5. First SQL readback instrument used nonexistent initiative_aggregate_state; read-only42P01, corrected to actual ie_aggregate_state and retained as harness limitation. Final7table hash proof passed.

Schema completeness of disposablefixture differs from full database. Manifest reports44 unresolved self-service and48 after policy-related rows during superadmin tests; this does not supersede the full business denominator. Download status correctly says partial. Full self-service localization, full backup/restore export, all business families and staging/deployment remain unproven.

All browser/test processes terminal. Source freeze released to root after exact checks; API/preview remain running with handles above and ownership handed to root. Do not infer deployment permission.
