# Lane A — task verdict table

Baseline: `64f507859c717494ffa5e83fae550173c9382230` (tag `closure-execution-baseline-v2-20260816`).
Branch: `codex/closure-claude-a-method-evidence`. Generated 2026-08-17.

| Task ID | Verdict | Commit SHA(s) | Evidence pointer | Single most important open blocker |
| --- | --- | --- | --- | --- |
| `ASM-METHOD-CATALOG-001` | DONE_CURRENT_SHA | `3a56c6b1e5ddb3a56b947cb0afb01074bf488dd6` | `ASM-METHOD-CATALOG-001/TASK_EVIDENCE.json` (pre-existing) | Non-DRD activation stays BLOCKED_OWNER by design (not a blocker on this task). |
| `ASM-BVP-001` | PARTIAL | `60a1be98d5db37e6fe017b39ab6fbd55c3f832fa`, `634f84eb7df5dd84fafa30591805b5d911d170cb` | `ASM-BVP-001/TASK_EVIDENCE.json` | Two out-of-lease writers (`AssessmentController.ts:1547`, `assessmentInitiativeGenerationRunService.ts:146`) don't catch the new unique-index violation and will 500 instead of reusing the active batch until they adopt the shared CAS upsert. |
| `TLS-BVP-001` | PARTIAL | `55a55fc0111507ab686c7265323f12d4ea6ac511` | `TLS-BVP-001/TASK_EVIDENCE.json` | `tests/integration/tools/tool-session-roundtrip.contract.test.ts` (default suite, not RUN_DB_TESTS-gated) now fails after this change, plus two further unnamed fixtures. |
| `INT-BVP-001` | PARTIAL | `6ce3cea3c5186d3dc04f63575353bdfec1415af8` | `INT-BVP-001/TASK_EVIDENCE.json` | The invite/expiry/revoke/anonymous-wall/access-matrix half of the task's own DoD (`CLAUDE_LANE_A_15_TASKS_20260816.md` lines 76-79) is not touched by any commit in range; unclear if code even exists to test it — scope question for the owner. |
| `AUD-MVP-OWNER-001` | DONE_CURRENT_SHA | `b438de0f4d00a0a5be7319c7e5250f9f336d6af1` | `AUD-MVP-OWNER-001/TASK_EVIDENCE.json` | None recorded — writer inventory verified at exactly 1, 48/48 tests, reversible via env flag. |
| `AUD-MVP-AI-HANDOFF-001` | DONE_CURRENT_SHA | `acde875c9527468bb5a93faa0dcf0b1b73750a00` (shared with LIFECYCLE) | `AUD-MVP-AI-HANDOFF-001/TASK_EVIDENCE.json` | Non-blocking: cross-lane note that the new `initiatives` unique index touches a Lane-B-owned table (scoped to `source_type='audit'`, no writer added). |
| `AUD-MVP-LIFECYCLE-001` | PARTIAL | `acde875c9527468bb5a93faa0dcf0b1b73750a00` (shared with AI-HANDOFF) | `AUD-MVP-LIFECYCLE-001/TASK_EVIDENCE.json` | `audit_domain_events` is append-only by service-layer discipline only — no DB trigger blocks a direct UPDATE/DELETE — which is a real, disclosed-but-unfixed gap against the task's own "immutable trail" requirement. |
| `AUD-MVP-DATA-001` | not started | — | — | No commit in range; not in this batch's task list. |
| `TLS-CATALOG-001` | not started | — | — | No commit in range; not in this batch's task list. |
| `TLS-UI-CANON-001` | not started | — | — | No commit in range; not in this batch's task list. |
| `AUD-BVP-001` | not started | — | — | No commit in range; not in this batch's task list. |
| `AUD-POL-001` | BLOCKED_OWNER | `78a618942ea0e12e7837bf64dec05f0b30bbdff1` (shared with RIGHTS) | `AUD-POL-001/TASK_EVIDENCE.json` | Activating any named external standard, and the fate of the legacy ISO 27001 preset, are Product + Methodology/Rights + Legal decisions this lane may not take. |
| `AUD-MVP-RIGHTS-001` | BLOCKED_OWNER | `78a618942ea0e12e7837bf64dec05f0b30bbdff1` (shared with POL) | `AUD-MVP-RIGHTS-001/TASK_EVIDENCE.json` | GAP 1 (unpublished packs listable by any org member) has a ready diff sitting outside this lane's lease; GAP 2 (ISO 27001 preset) has no diff at all pending a Product decision. |
| `INT-DELIVERY-OPS-001` | not started | — | — | No commit in range; not in this batch's task list. |
| `ASM-UI-CANON-001` | not started | — | — | No commit in range; not in this batch's task list. |

## Notes

- Rows marked "not started" are named in `docs/cleanup/agents/CLAUDE_LANE_A_15_TASKS_20260816.md` (Lane A's 15-task list) but have no commit in `64f507859c..HEAD` and were explicitly out of scope for this evidence-assembly pass per instruction ("do NOT create records for tasks with no commit yet").
- No task in this batch has browser/visual evidence yet. For the four backend-only, no-UI-surface tasks (`AUD-MVP-OWNER-001`, `AUD-MVP-AI-HANDOFF-001`, `AUD-MVP-LIFECYCLE-001`, `AUD-POL-001`/`AUD-MVP-RIGHTS-001`) this is recorded as not bearing on their DoD. For the three tasks with a real UI-facing surface (`ASM-BVP-001` Library Start click-through, `TLS-BVP-001` SWOT freeze/promote flow, `INT-BVP-001` whichever half has a UI) it is recorded as a genuine gap contributing to the PARTIAL verdict.
- `AUD-MVP-AI-HANDOFF-001` and `AUD-MVP-LIFECYCLE-001` share `productSha acde875c9527468bb5a93faa0dcf0b1b73750a00`; `AUD-POL-001` and `AUD-MVP-RIGHTS-001` share `productSha 78a618942ea0e12e7837bf64dec05f0b30bbdff1`. Each pair's `TASK_EVIDENCE.json` lists only the paths/tests genuinely attributable to that specific task, with a `sharedCommitNote` field pointing at its sibling record.
