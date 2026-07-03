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

Live sha as of this pass: `ffa4da3b` (deploy chain: `35d10cf6` English sweep → `4880a9b0` Recommendations → `ffa4da3b` sidebar Materials).

## Still open (not touched this pass, lower priority per Piotr)
- Meetings/Calendar — no meetings seeded.
- Audits — no audit programs seeded.
- Assessment — only DRD baseline; SIRI/ADMA/CMMI/LEAN tabs empty.
- Full non-Results/Initiatives/Presentations Polish sweep (e.g. other modules may still have hardcoded Polish; only the three priority directories were swept).

## How to re-verify visually (the method that caught #1)
Launch config `demo-bridge` in `.claude/launch.json` → `vite :3013` with `VITE_API_TARGET=https://demo.consultify.ai`; inject a minted `token`/`refreshToken` into localStorage; the local frontend renders with live demo data. This is the only reliable way to see what the client sees (API 200s are not enough).
