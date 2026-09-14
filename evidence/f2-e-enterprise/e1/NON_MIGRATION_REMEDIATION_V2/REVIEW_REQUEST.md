# F2-E E1 — NON_MIGRATION_REMEDIATION V2 scoped review

Verdict: READY_FOR_INDEPENDENT_SCOPED_REREVIEW; FULL E1 REMAINS HOLD.

This checkpoint fixes the four findings in the prior scoped review:

1. Archive receipts hash JSON/CSV through `createReadStream` and count bytes incrementally. A unit mutation guard rejects any receipt-level `fs.readFile`. The RealPG archive probe passes 20,001 rows with a 4,096-byte payload through paged writes, receipt hashing and ZIP finalization while sampling peak RSS.
2. A failed job starts its terminal retention window at the failed transition. A clock-controlled run lasts beyond the original running deadline, then proves its stable failure and partial artifact remain until the full terminal window expires and both disappear afterward.
3. `C6_FINDINGS_DISPOSITION.md` now records the implemented R2 organization-budget authority and cites unit plus mounted route/JWT/PostgreSQL behavior. The durable-resume migration HOLD remains separate and explicit.
4. Export success uses a stable toast ID; the next start/failure removes it immediately. The production-built PL/DE browser proof requires zero Preparing, zero progress/ready success copy in failed state, localized retry, successful recovery, and zero page/console errors.

Review only the non-migration remediation. Do not accept full E1: restart-safe, multi-replica checkpoint/resume persistence remains `MIGRATION_REQUIRED`. No migration was written.
