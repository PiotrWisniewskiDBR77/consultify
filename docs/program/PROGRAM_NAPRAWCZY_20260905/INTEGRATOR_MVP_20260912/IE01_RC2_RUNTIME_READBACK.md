# IE01 merged runtime readback — 2026-09-13

Source commit: 69dbb5b746 (documentation follow-up to merge 55823322b391cb8bc471b74a1a74f01ecd698a20). Repair 11/11 committed blobs match ea59dd1fbab2ff7fa42e7285839318d148496970. Served built index equals local dist index SHA256 `efb97bf8ef167c8e656588998842367d6ddb12a89f435ee20bb8e2d72922c8ab`.

Actual ApiGateway from the RC2 worktree, authenticated JWT login, existing PostgreSQL container bd644c57cb4c9f8626855da09a587e2897d5d5a07da97012d8897886aceac02c, localhost6459/cx8_e0. API5293 PID36180/session46475; preview5292 PID36259/session53029. No new source transforms, migrations or business fixtures. Existing local fixture readback only; not a fresh lifecycle journey.

Built dark browser: Definition approval and Approved decision visible, reload succeeds, screenshot inspected. No page errors. Actual API+SQL readback: initiative-53431a2c-e3f1-4e5b-b63a-8799f016e2eb DEFINED version24; Decision APPROVED version4; MyWork items1; legacy initiative count0. This preserves the prior real journey's persisted outcome on the merged source.

Qualified failures: organization members403 and inherited planning/legacy initiative/suggested-changes/object-attachments404 remain. Screenshot still shows duplicate tabs after reload, an already-open IE01 gap. This is bounded approved-state readback PASS; full UI, same-mounted A→B browser behavior, all26 card semantics, lifecycle, pilot and deployment remain OPEN.

Evidence directory: /Users/piotrwisniewski/Developer/codex-wt/codex4-scratch/ie01-rc2-runtime-20260913. `ui-final-dark/approved-dark.png`, `ui-final-dark/result.json`, `same-record-final-readback.json`, `readback.log`. Local auth material remains private and is not copied to the repository.

Environment recovery: Colima was stopped, original disk still locked by stopped colima instance. Verified Lima list+disk list; normal stop/start failed. Official limactl disk unlock colima released stale lock, colima start succeeded, only original cx-codex8-pg started. No disks or databases recreated; pgtest and other containers untouched.
