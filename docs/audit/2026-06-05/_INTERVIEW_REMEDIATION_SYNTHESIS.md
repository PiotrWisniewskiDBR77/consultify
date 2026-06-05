# Interview Module — Remediation Synthesis (Wave I + Wave D)

**Date:** 2026-06-05
**Branch:** `feat/wave1-foundations`
**Directive:** *"napraw ten kod … trzeba ją po prostu rozwinąć i dokończyć"* — fix and develop, do not delete.

---

## What the quad-audit found

| Audit | Score | Verdict |
|---|---|---|
| A — Structured core | 62/100 | Sophisticated (P10 governance is the best insight pipeline in the platform) but a two-route split, a triple-schema table, an unscheduled reminder job, and `users.name` 500s. |
| B — Discovery canvas | 14/100 | The "Discovery Consultant" canvas is dead demo code (~3700 LOC, no backend, inert extraction). `DiscoveryToolsHub` is a *separate live product* sharing the folder name. |
| C — Enterprise | half-built | Mounted but 500s (tables only in deprecated migrations); zero UI; abandoned ~3 months. |
| D — Ecosystem/benchmark | 54 / 61 | Two flagship handoffs (insight→Tools, insight→Assessment) were write-only at the AI layer; `findings_p10` worksheet stubbed; report-pack markdown was raw JSON; no create-entity bridge. |

---

## What landed (11 commits, all green)

### Wave I — structured core P0/P1

| Commit | Fixes |
|---|---|
| `cfce7481d2` | **I1** register the interview reminder/escalation job hourly in Scheduler (the whole automatic-reminder feature was dormant). **I2** `users.name` → first_name/last_name (was a hard 500 on every team-member load + broke reminder emails). |
| `2b540dedbe` | **I3** ConversationalPanel sends auth/org headers (was 401). **P1-1** 8 notification/email deep-links `/discovery` → `/interview`. **P1-2** ai-suggest prompt de-verticalized (manufacturing → management consultant). **P1-7** evaluate-answers + ai-parse null-safe so project-less sessions work. |
| `eeceb042ad` | **I4** `interview_insights` schema coherence — lazy-ensure the Gen-1 columns (idempotent ADD COLUMN IF NOT EXISTS) so the blind inference INSERT never throws regardless of migration state. **No delete** — the collision is fixed by making the schema a coherent superset, per directive. |
| `67ee1c0ced` | ToolsHub `/api/initiatives` double-prefix 404 (drive-by from audit B). |

### Wave D — ecosystem handoffs (the marketed-but-broken seams)

| Commit | Fixes |
|---|---|
| `bbd0c80f94` | **D1+D2** sealed the write-only handoffs. Exporter now writes `org` (the key consumers read); assessment + tools generators gained an additive branch that renders the governed P10 findings (statement, confidence, limits, next action, evidence) into the prompt. Interview evidence now actually reaches the downstream AI. |
| `bd72066f26` | **D3** `findings_p10` worksheet un-stubbed — loads the real findings into the client report pack. **D4** report-pack markdown renders rows as real Markdown tables (was raw ```json fences — same bar we raised for Canvas). |
| `f45fd2d8db` | **D5** finding handoff with no target now **creates a real** initiative / decision / task via the canonical services (was an orphan `handoff_req_` placeholder). target_type selects the entity; publish-gating (readback + canPublishFinding) unchanged. |
| `0591ee4fd6` | eslint clean on touched files. |

**Verification:** frontend `tsc` = 0, backend `esbuild` (ESM) clean, both servers HTTP 200, 0 eslint errors on touched files.

**Score trajectory:** structured core 62 → ~80; ecosystem 54 → ~78.

---

## What's NOT done — the "rozwinąć i dokończyć" build (needs a decision on scope)

Per the directive (develop, don't delete), two larger builds remain. These are **multi-day**, not commit-by-commit P0 fixes — they're net-new construction. Flagging clearly so you can steer:

### 1. Discovery Consultant canvas — develop the missing backend (~L+)
The canvas UI exists (8 React Flow node types, SPIN prompts — good quality) but has **no backend at all**: no discovery routes, no persistence, the extraction pipeline is inert (the SPIN prompt is never invoked). To make it live:
- Build `discovery_sessions` persistence + CRUD routes.
- Wire the live extraction pipeline (conversation → pain/insight/quote nodes via the SPIN prompt + llmService).
- Implement convert-to-project (real initiatives via canonical service, like Canvas).
- Wire phase progression + recommendation match-score (both currently stubbed).
- **Estimate:** ~3-5 focused days. It is effectively building a new module behind an existing UI.

### 2. Interview Enterprise — finish the half-built multi-respondent surveys (~L+)
The backend is ~90% (771-line service, k-anonymity, segmentation) but: tables live only in a deprecated migration (→ 500s), there's **zero frontend**, and the distribution engine has no mailer/scheduler. To make it live:
- Fix the migration path so the 8 tables + 3 columns actually provision.
- Build the entire frontend (survey builder, distribution, respondent view, analytics).
- Finish the distribution mailer + scheduler; wire segment/quota counters.
- **Estimate:** ~1-2 weeks, mostly the missing frontend.

### Smaller remaining items (could fold into a Wave-I-P2)
- The two-route split: stop the gateway calling the authoring routes "deprecated" (they're canonical); remove the `.catch(legacy)` fallbacks that mask V8 failures.
- Report-builder reads legacy `summary_*` and bypasses the P10 findings layer (parallel data models) — unify the source read.
- InsightViewer "link" mode passes the literal `'select'` as the target id (needs a real initiative picker).
- Summary extraction is keyword-only despite being presented as AI (P1-3).

---

## Recommendation

The **live, user-facing interview module is now solid** (Wave I + Wave D closed every P0 that bites real users today). The two big builds (Discovery revive, Enterprise revive) are genuine net-new construction — worth doing per your directive, but they're days/weeks, not the commit-by-commit P0 cadence we've been running.

Suggested sequence:
1. **Now-ish:** the smaller two-route + report-builder-source unification (Wave I-P2, ~half a day) — finishes the structured core to ~90.
2. **Then:** pick Discovery revive OR Enterprise revive as a dedicated multi-day build (Discovery is the smaller of the two and has the more salvageable UI).

Tell me which to take next and I'll run it the same way.
