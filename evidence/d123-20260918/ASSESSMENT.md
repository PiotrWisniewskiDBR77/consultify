# D-123 — KROK 0 (read-only): assessment of interview session `13c932b0` (Northwind)

**VERDICT / RECOMMENDATION: ZOSTAWIĆ (leave the session in place).** After the D-49-LIVE and D-121
cleanups the session contains **no remaining junk** — what is left is legitimate Northwind demo-scenario
scaffolding (a curated seed-style assignment + 4 template questions + 3 system answer-mirrors) with two
light, plausible answers. The only blemish is **denormalized-counter drift** caused by the earlier junk
delete; that is a small follow-up repair, not a reason to delete curated demo data. Deletion decision rests
with CTO/owner (D-123 is read-only; nothing was modified).

Read-only attestation: every query ran with `PGOPTIONS=-c default_transaction_read_only=on` against staging
(`railway`, PostgreSQL 18.4). No INSERT/UPDATE/DELETE issued. No pre-dump taken (none needed for read).

---

## 1. Session identity

| field | value |
|---|---|
| session id | `13c932b0-e750-410c-996b-66a98f8fb234` |
| name | `Interview 9/16/2026` (auto-generated default name) |
| organization | `468b234c-66c4-54e1-b626-5e0fb3a92f6a` = **Northwind Manufacturing Ltd.** (one of the 13 real orgs) |
| project | `ac3c5d4c-2c4c-4af6-9516-314e0d962402` = "Portfolio — direct initiatives" |
| owner / creator | `75f25357-2f33-48b8-9638-ad67ff65bcef` = **irina.lebedjuk@dbr77.com** (role ADMIN, org Northwind) — the "irina" test persona |
| template | `v6_t06_process_pain_mapping` v1 |
| assignment | `ia_19f0ea57-fd3d-47f8-b286-a563828df148` |
| status | `active` (in_progress; never completed/submitted; not archived; not trashed) |
| created / started | 2026-09-16 09:31:10 UTC |
| last activity | 2026-09-16 12:20:03 UTC |
| anonymity | identified (not anonymous) |
| session counters (denormalized) | `total_questions=6`, `answered_questions=4` — **STALE, see §4** |

**Who created it / when:** the linked assignment `ia_19f0ea57` was created 2026-09-15 02:14 UTC by irina
(`created_by = 75f25357`), with curated demo content — `process_ref = "Northwind 2027 transformation
discovery"`, `notes = "Goods-in and changeover pain points across the three sites."`,
`create_request_key = nw-iv-v6_t06_process_pain_mapping-75f25357:...` (deterministic Northwind-interview
key). The session itself was started the next day (2026-09-16 09:31 UTC) and answered interactively
11:05–12:20 UTC. The seed key/process_ref text is **not present in the current repo** (grep across the
worktree returns only this evidence file), so the scaffolding was created live via the API/seed-run by the
irina persona rather than by a checked-in seed script — but its content is purposeful Northwind demo
scenario, not random noise.

## 2. Full footprint (contained — 8 rows)

Counted across every public table bearing a `session_id` column. Non-zero only:

| table | rows |
|---|---|
| `interview_assignments` | 1 |
| `interview_questions` | 4 |
| `interview_evidence` | 3 |

All other session_id-bearing tables = **0** for this session: `interview_answers`, `interview_answer_history`,
`interview_answer_decisions`, `interview_distributions`, `interview_diagnostics_snapshots`,
`interview_findings`, `interview_insights`, `interview_insight_exports`, `interview_messages`,
`interview_notes`, `interview_ai_parse_log`, `interview_ai_suggestion_audit`,
`interview_public_answer_receipts`, `interview_transcript_messages`, `method_outputs`, `method_snapshots`,
`method_report_snapshots`, `method_events`, `method_evidence`, `method_approvals`, `method_session_roles`,
`teresa_proposals`, `ai_decision_*`, `ai_partial_responses`, `assessment_skip_reasons`, `project_insights`,
`siri_dimension_scores`. **The "CTO smoke" snapshot (`6099f51a`, deleted in D-49-LIVE) was never linked to
this session** — it lived in `method_outputs`, which has 0 rows here.

## 3. Row-by-row classification (real content vs test)

### Questions (4) — all `is_template = t`, category `operations`

| # | id | sort | status | question_text | answer | class |
|---|---|---|---|---|---|---|
| 1 | `60cf1a88` | 1 | not_started | "Which process do you spend the most time on that you feel adds the least value?" | (empty) | REAL template question, unanswered |
| 2 | `20c3ff6d` | 3 | answered | "How many different systems or tools do you use in a typical day to complete your work?" | `10` (number) | REAL question; plausible answer (test-entered) |
| 3 | `74871891` | 5 | answered | "How much of your working time is spent on manual data entry, copy-pasting, or re-keying information?" | `10-25%` (single_choice) | REAL question; valid choice answer (test-entered) |
| 4 | `538921ad` | 6 | in_progress | "If you could fix one thing about how work flows through your area, what would it be?" | (empty) | REAL template question, unanswered |

All four are legitimate `v6_t06_process_pain_mapping` template questions. The two answers (`10`, `10-25%`)
are generic but plausible values entered by the irina persona during a 9/16 UI pass — they function as
acceptable demo content. **No "asdf"/empty-junk question rows remain.**

### Evidence (3) — all `evidence_type=text`, `evidence_role=answer_text`

| id | question_id | title | uploaded_by | created | class |
|---|---|---|---|---|---|
| `92859ebd` | `74871891` | "Answer – Q 74871891" | irina | 2026-09-16 11:05:57 | system answer-mirror (benign) |
| `5fd2a7ce` | `538921ad` | "Answer – Q 538921ad" | irina | 2026-09-16 11:06:05 | system answer-mirror (benign) |
| `b50c496e` | `20c3ff6d` | "Answer – Q 20c3ff6d" | irina | 2026-09-16 12:19:52 | system answer-mirror (benign) |

All three are auto-generated `answer_text` mirrors of the questions (no file, no URL, no transcript, empty
description). Each points at an existing question (no orphans). These are system artifacts, not user junk.

### Assignment (1)

`ia_19f0ea57` — curated demo content (process_ref + notes, see §1). Status in_progress, due 2026-10-20,
not submitted. **REAL demo-scenario row.**

## 4. Counter drift (the one defect found)

`interview_sessions.total_questions = 6` and `answered_questions = 4`, but the actual rows are **4 questions,
2 with status `answered`**. The drift is exactly explained by D-49-LIVE: the session originally had 6
questions (4 template + 2 junk "asdf qwerty" `233ae4ce`/`e563ed82`, both counted as answered). D-49-LIVE
deleted the 2 junk questions (and D-121 deleted the 2 resulting orphaned `interview_evidence` rows
`03e3f1d9`/`b140e82d`), but the **denormalized session counters were not decremented**. Net: counters overstate
by +2 questions / +2 answered.

This is a code defect in the question-delete path (it does not update `interview_sessions` counters), not a
data-junk problem. Per DEC-607 it is disclosed here as a finding with **zero fix in D-123** (read-only).

## 5. Recommendation (ONE)

**ZOSTAWIĆ (leave).** Rationale:
1. No junk remains — the "asdf"/orphan rows were already removed (D-49-LIVE, D-121); "CTO smoke" was never in
   this session.
2. What remains is legitimate Northwind demo scaffolding: a curated assignment ("Northwind 2027 transformation
   discovery", "Goods-in and changeover pain points across the three sites"), 4 real template questions, and
   3 benign system answer-mirrors.
3. Deleting it would remove purposeful demo content from the Northwind showcase org to fix a counter, which is
   disproportionate.

**Recommended follow-up (separate, needs CTO GO — a write, out of D-123 scope):** repair the drift by setting
`total_questions=4`, `answered_questions=2` for this session, and fix the question-delete path to decrement
`interview_sessions` counters so future deletes do not re-introduce drift.

**If CTO/owner instead want a pristine Northwind:** the alternative is **skasować całość** — delete the session
with its 8 contained rows (1 assignment + 4 questions + 3 evidence) under the standard delete-rows runbook
(pre-dump, JSONL before-images, FK pre-flight, one transaction with in-txn assertions, surgical checksum,
2nd pass = 0). "Skasować część" does not apply: after the prior cleanups there is no junk subset left to
remove — the rows are uniformly legitimate-or-benign.

## 6. Cascade scope (measured — for whichever decision CTO takes)

Footprint is 8 rows in 3 tables (§2). FK directions measured from `pg_constraint` (`confdeltype`:
`c`=CASCADE, `n`=SET NULL):

| from | column | to | on_delete |
|---|---|---|---|
| `interview_questions` | `session_id` | `interview_sessions` | **CASCADE** |
| `interview_evidence` | `session_id` | `interview_sessions` | **CASCADE** |
| `interview_evidence` | `question_id` | `interview_questions` | SET NULL |

So deleting the **session row alone cascades** to all 4 questions and all 3 evidence rows (both child tables
carry `session_id → interview_sessions ON DELETE CASCADE`) — collateral is exactly the 8-row footprint, no
wider. The `interview_evidence.question_id → interview_questions ON DELETE SET NULL` is the FK that produced
the D-121 orphans when the 2 junk questions were deleted directly (not via the session); it is irrelevant to a
whole-session delete because the evidence rows are removed by their own `session_id` CASCADE. The
`interview_assignments.session_id` FK was not in this measurement set and must be checked at delete time per
the standing runbook (Wpis 178 pt 2) before any cascade is relied upon.
