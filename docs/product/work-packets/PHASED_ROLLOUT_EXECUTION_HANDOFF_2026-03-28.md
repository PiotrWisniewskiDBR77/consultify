# Phased Rollout Execution Handoff

> Date: 2026-03-28
> Purpose: operator handoff for rollout execution after the final wider-production `GO`
> Status: current rollout handoff

---

## 1. Authority order

Use these documents in this exact order:

1. `docs/product/work-packets/evidence/519-wider-production-go-no-go-decision.md`
2. `docs/product/work-packets/CP-10-ROLLOUT-SAFETY-CHECKLIST.md`
3. `docs/product/work-packets/evidence/518-production-credential-hygiene-closure.md`
4. `docs/product/work-packets/evidence/491-v8-production-pilot-shadow-readiness-green.md`
5. `docs/product/work-packets/evidence/520-production-phased-rollout-control-materialization.md`
6. `docs/product/work-packets/evidence/521-production-phased-rollout-second-org-promotion-ateliertoys-demo.md`
7. `docs/product/work-packets/evidence/522-production-post-promotion-monitoring-window-open.md`

If any older doc conflicts with the list above, the list above wins.

---

## 2. Current truth

- the post-`V8/V8.1` product program is complete at `13 / 13`
- wider production `GO` is approved
- no product lane remains open inside the completed program
- rollout now proceeds as a phased operational execution problem, not as a new product implementation track

Current live org map:

- `dbr77` = explicit promoted org, V8 primary, `shadow_mode=0`
- `ateliertoys-demo` = explicit promoted org, V8 primary, `shadow_mode=0`
- `system` = explicit not-yet-promoted org, V8 disabled
- the mandatory `48h` post-promotion observation window is currently open

---

## 3. Rollout posture in force

- do not perform a blind all-org cutover
- promote orgs through the existing per-org controls
- preserve rollback readiness at all times
- keep monitoring active during and after each promotion step

---

## 4. Required operator discipline

For each org promotion:

1. confirm the org is the intended next rollout target
2. confirm explicit production rows already exist or materialize them as part of the promotion
3. enable the intended V8 primary posture only for that org
4. keep the narrower per-org rollback path available
5. observe runtime, health, and mismatch signals during the promotion window
6. keep the `48h` post-promotion monitoring rule from `CP-10`
7. stop promotion and roll back if the live signals violate the thresholds in `CP-10`
8. do not promote another org while `evidence/522-production-post-promotion-monitoring-window-open.md` remains the current monitoring checkpoint
9. prefer rerunning `npm run rollout:v8:monitor -- --json` for repeatable checkpoint evidence instead of rebuilding the probe sequence by hand

---

## 5. Rollback hierarchy

Use the narrowest rollback that safely contains the issue:

1. per-org flag rollback
2. shadow-mode rollback where parallel verification is still needed
3. `ENABLE_V8_GLOBAL=false` global rollback if a wider production issue requires immediate containment

Do not widen rollout while an org is in a degraded or ambiguous state.

---

## 6. What not to do

- do not reopen accepted product lanes as a substitute for rollout execution
- do not reinterpret historical blocker docs as current authority
- do not remove monitoring discipline because the final decision is `GO`
- do not treat one successful org promotion as proof that all remaining orgs should flip at once

---

## 7. Handoff summary

If another operator or agent takes over, the shortest correct instruction is:

`Use evidence/519 as the rollout authority, follow CP-10 thresholds and rollback rules, and execute phased per-org promotion without reopening product scope.`
