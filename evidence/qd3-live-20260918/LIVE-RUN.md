# QD3 — LIVE staging orphan sweep (Wpis 163 pkt 2, DEC-658 + DEC-670)

Date: 2026-09-18 ~21:35 CDT (commit 2026-09-19T02:36:01Z). DB host: thomas.proxy.rlwy.net:52567 (staging, wdrożenie 29 = `adea785c97`).
Script: `server/scripts/cleanup-orphan-demo-residue.ts`, blob `9bb497f9923cfbb07bf0a40d68b5a36a93beabf5` — byte-identical to the QD3-reviewed line version `d9f8b2203f` (NOT modified).
Prefix: `ateliertoys-demo-session-`. Scope: dangling only (literal prefix AND no `organizations` row). `--apply FORCE_PURGE=true`.

## Reversibility (two independent layers)
1. Pre-dump: `~/Developer/kopie/staging-pre-sieroty-20260918.dump` (252 236 328 B, 13 084 TOC entries, pg18).
2. Row-level JSONL: `server/_backup/qd3-residue-2026-09-19T02-35-55-690Z/` — 23 108 rows across 6 files (gitignored, local). `receipt.json` copied here.

## Per-table PRZED → PO (real-org rows protected; total drops by exactly the swept count)
| table | real PRZED=PO | total PRZED | total PO | swept |
|---|---|---|---|---|
| artifact_lineage_events | 911 | 1295 | 911 | 384 |
| artifact_lineage_receipts | 424 | 808 | 424 | 384 |
| conversion_events | 21 | 225 | 223 | 2 |
| v8_artifact_origin_links | 932 | 1337 | 956 | 381 |
| work_signal_runs | 2977 | 21616 | 2977 | 18639 |
| work_signals | 172 | 3490 | 172 | 3318 |
| **SUM swept** | | | | **23108** |
| results_writer_observations | 85 | 343 | 343 | 0 (append-only trigger `trg_results_writer_observation_no_delete`, SKIPPED, 258 left) |

## Acceptance proofs
- (c) checksum 13 real orgs PRZED == PO == `9b2de44a7c54ae0631c2e21a5fc5fb5f`, ORG_COUNT=13 both (`checksum-przed.txt`, `checksum-po.txt`). Surgical: real-org data byte-identical.
- (d) 2nd dry-run pass = **0 sweepable** (`pass2-idempotency.log`); only the 258 append-only remain. Idempotent by construction.
- Backup JSONL row counts sum to 23108 == receipt.totalDeleted.

## ORG_COUNT 12 → 13 note
QD3 simulation (older fixture copy) had 12 real orgs. Live staging now has 13: the 13th is `ateliertoys-demo` ("Atelier Toys", created 2026-09-18) — the demo *template* org. It does NOT match the sweep prefix `ateliertoys-demo-session-` (lacks `-session-`) and `organizations` is never a target, so it is protected. `demo_prefix_org_rows=0` confirms every sweep candidate was dangling.

## NW junk (QD11 / D-49) — NOT executed live, STOP pending CTO word
Wpis 162 DEC-670 / Wpis 163 say the 2 NW junk items ride "TYM SAMYM runbookiem", but the interview-answer operation is unresolved: QD11's RECOMMENDED variant FABRICATES EN prose answer text (wording explicitly "do akceptu lub edycji CTO" — never approved), while Wpis 162/163 say "usuwa się" (remove). Two unapproved choices on LIVE real-org (Northwind) data + C is concurrently capturing QC11 owner-acceptance cards from live Northwind screens (Wpis 163 pkt 1) → mutating NW now would corrupt that evidence. Per Step 5 ("nic nie zgaduj") the NW half is STOPPED, not guessed.
