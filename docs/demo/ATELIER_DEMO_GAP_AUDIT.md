# Atelier Demo — Gap Audit & Action Plan
**Date:** 2026-07-03 (pass 3, after Piotr's client meeting reported the demo as weak)
**Method:** rendered the ACTUAL UI (local vite → demo backend, JWT injected, no password) and clicked every key module — not just API checks. The earlier "all endpoints return 200" pass gave false confidence; this pass looked at the screens a client actually sees.

---

## ★ ROOT CAUSE #1 — the demo was showing Piotr's real, junk-filled org (FIXED)
- **Symptom:** Initiatives showed **132 initiatives, 114 of them junk Polish DRAFTs** ("Zbudowac jedno zrodlo prawdy…", "F1-26 from assessment", "Weekly priorities — Sprint 14"), not Atelier's clean 22.
- **Cause:** Piotr's login (`piotr.wisniewski@dbr77.com`) resolved to org **`a3e05d4a` = "DBR77"** — his real paid-org mirror on the demo DB, which has 139 initiatives / 114 junk drafts. Demo mode is driven by a client header (`X-Demo-Mode`) that a global middleware reads *before* auth; any request that omits it (cold loads, v8 pages) falls back to the JWT's org → DBR77 junk. Proven: `/api/v8/planning/initiatives/portfolio` with demo headers → 22 (Atelier), without → 139 (DBR77).
- **Fix (done, live, reversible):** repointed Piotr's demo-DB account org from `a3e05d4a` → **`atelier`**. His login JWT now carries `org=atelier, isDemo=true`, so every call — header or not — resolves to the clean Atelier workspace. Verified in the browser: Initiatives, Results, Chat all now show clean Atelier data. Demo DB only; production untouched; reversible.
- **This was almost certainly the main reason the demo looked weak.**

## ★ ROOT CAUSE #2 — systemic hardcoded Polish in an English UI (FIXED)
- **Symptom:** on an English demo, key screens render Polish labels. e.g. Results shows "Wartość transformacji", "ZABANKOWANE", "W REALIZACJI", "ZAGROŻONE", "LEJEK WARTOŚCI", "REKOMENDACJE", "Skaluj", "Zatrzymaj"; Initiatives shows "Zrób materiał".
- **Scope:** hardcoded Polish literals (not translation keys) across 20 files in Results, Initiatives, and Presentations. Piotr's call: fast English-only swap, not a full bilingual i18n pass.
- **Fix (done, deployed):** swept all 20 files (parallel agents + direct edits), fixed a syntax bug one pass introduced (unclosed `<div>` in `PortfolioInsightsPanel.tsx` — would have broken the production build), verified with a full `npm run build` before deploying. Also caught and fixed while in there: Results portfolio panels formatted money as **PLN** (wrong currency for a EUR client) → switched to €; widened a Polish-only substring match (`'zagrożon'`/`'ryzyko'`) to also match English so at-risk styling doesn't silently break now that labels are English. Bilingual `{ en, pl }` data maps and `isPolish ? …` conditionals were correctly left alone — legitimate i18n, not the bug.

## ROOT CAUSE #3 — empty default states / thin modules (partially fixed)
- **Interview** — FIXED: seeded 40 answered Q&A across the 5 discovery sessions (Plant Manager, Procurement, VP Sales, CFO, CTO), in-character with the Atelier Forward story; fixed the empty "Inbox" (assignments pointed at a deleted junk user, reassigned to Piotr).
- **Results → OKR/Goals** — FIXED: seeded 3 objectives (factory excellence, digital growth, supply resilience) + 8 key results tied to the same KPIs used elsewhere (OEE, ARR, lead-time).
- **Reports** — FIXED (thin but non-empty): seeded 3 report rows (Q1 Board Readout, Line 3 Digital Twin progress, Supplier Risk monthly review).
- **Materials** — already rich (17 deliverables via `v8_output_artifacts`); not re-touched this pass.
- **Meetings / Calendar, Audits, extra Assessment frameworks (SIRI/ADMA/CMMI/LEAN)** — still empty. Not in this pass's priority list (Piotr chose Interview + Results/OKRs/Finance + Reports/Materials). Flag if needed for a future pass.

## What looks GOOD now
- **Chat (Teresa)** — strong landing, persona/scenario picker, output modes.
- **Initiatives** — clean 22-initiative Atelier portfolio, Kanban/gates, flagship with Gantt, English labels.
- **Results** — value funnel (1.4M banked, 194% of 736k target), ROI recommendations tied to real initiatives, OKRs, all in English with € currency.
- **Interview** — 5 fully answered discovery sessions, non-empty inbox.
- **Finance, DRD Assessment, Tools (SWOT/Porter), Materials (17 deliverables), Reports (3)** — data present and served (v8 enabled for atelier).

---

## Post-fix visual re-check caught 2 more spots (both fixed, deployed)
- **"Rekomendacje"** on the Results scorecard — missed in the first sweep (a section further down the same file). Now "Recommendations".
- **"Materiały"** in the permanent sidebar nav + breadcrumb — highest-visibility miss, since it's on every screen, not scoped to one module. Was outside the three swept directories (`src/routes/AppRoutes.tsx`, `src/components/navigation/Sidebar/menuConfig.ts`). Now "Materials".

Both found by actually rendering the app end-to-end (not grep) — the org-leak fix made this kind of check reliable for the first time, since before it, every screen showed the wrong company's junk data and Polish text was the least of the problems.

Live sha as of that pass: `ffa4da3b` (deploy chain: `35d10cf6` English sweep → `4880a9b0` Recommendations → `ffa4da3b` sidebar Materials).

## Round 4 (quality-control pass — Piotr asked to finish remaining gaps, then verify rigorously before declaring done)
- **Meetings — SEEDED, VERIFIED VISUALLY, looks great.** 5 meetings (4 upcoming + 1 completed with real notes/decisions synthesized from the discovery interviews), clean English, correct attendee counts and statuses. Screenshotted and confirmed on the live bridge.
- **Audits — SEEDED but feeds the wrong screen.** Found honestly during QC: the client-facing "Audits" sidebar module (`AuditsHub.tsx`) is an ISO-27001-style governance model (programs → templates → assignees → surveys). The `audits`/`audit_findings` tables I populated actually feed a *different*, admin-only compliance-audit surface (`server/src/routes/audit.routes.ts`, gated by `verifyAdmin`) that isn't in the main nav at all. The visible Audits screen shows one plausible "Active" program (real name + objective) but 0 templates/assignees/surveys — not empty-looking, but not rich. Properly populating the real model is a bigger job than time allowed; flagging honestly rather than claiming it's done.
- **Assessment (DRD) — found and fixed a real, pre-existing app bug, unrelated to seeding.** The Assessment list showed **0% progress** on the DRD baseline despite it being Approved with full data (39/39 areas, 233/233 path, rich per-axis scores + narrative notes — confirmed via the raw API response). Root cause: `AssessmentHub.tsx`'s list mapper read `item.progress` (camelCase, never set by the backend) instead of `item.completion_percent` (snake_case, correctly `100`) — the exact bug pattern already fixed elsewhere in the codebase (`MyAssessmentsList.tsx`). This affects every org's assessment list, not just Atelier's. Fixed with the same defensive fallback, clean production build (verified twice), deployed as commit `904c445033`.
- **Assessment "Report" viewer is broken** — `/assessment-reports/:id` redirects to the Report Builder, which looks up the report in `report_builder_reports` (empty table) instead of `assessment_reports` (where the real DRD board-readout content lives). Confirmed via console error: `Failed to load report: Report not found`. Genuine gap between two report data models in the codebase — not something safely fixable in the time remaining. **Recommendation: during the live demo, don't click "view report" from the Assessment list — stay on the assessment workbench view itself, which correctly shows completion stats (100%, 39/39 areas).**
- **Honest confidence note:** Organization, Chat, Initiatives, Results, and Meetings were verified with actual rendered screenshots. The Assessment-list fix is verified by exact source-code diagnosis + a clean production build matching an established pattern elsewhere in the app — but I could not get a final screenshot of it live, because the local verification bridge became unresponsive near the end of a very long session (many hard reloads across ~2 hours). I'm confident in the fix; I want to be upfront that this last one is diagnosis-verified, not screenshot-verified.
- **Also found during this pass: a shared-branch git incident.** Another agent working on this same branch/working-tree switched it to a different feature branch (`vb4-table-editors-anatomy`) mid-session, which orphaned one of my commits (this doc's previous update) onto the wrong branch temporarily. No code or seed work was lost — recovered cleanly via an isolated git worktree, cherry-picked the assessment fix back onto `feat/deliverables-w1`, and rewrote this file. Mentioned for transparency.

## Still open (not fixed this pass)
- Audits — real governance model (templates/assignees/surveys) not populated; current screen is a plausible but thin "in setup" state.
- Assessment "Report" viewer — broken redirect/data-model mismatch (see above); avoid that click path live.
- SIRI/ADMA/CMMI/LEAN assessment tabs — still empty (only DRD is rich).
- Full non-Results/Initiatives/Presentations Polish sweep — only the three priority directories were swept; other modules may still have hardcoded Polish.

## How to re-verify visually (the method that caught #1)
Launch config `demo-bridge` in `.claude/launch.json` → `vite :3013` with `VITE_API_TARGET=https://demo.consultify.ai`; inject a minted `token`/`refreshToken` into localStorage; the local frontend renders with live demo data. This is the only reliable way to see what the client sees (API 200s are not enough).
