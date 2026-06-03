# Round fixes — from owner screenshot session (2026-06-03)

Running list of concrete fixes found while the owner clicks through and screenshots. Feeds the next big repair version. Evidence = dev backend log + code.

---

## FIX-1 — 🔴 P0 (blocks everything): app rate-limits ITSELF (429 storm)
**Symptom:** Ideas loops on spinner then shows "Your Idea Garden awaits" empty state + two "Failed to load" toasts. (Screenshots 2026-06-03.)
**Root cause (PRECISE):** NOT the global `apiLimiter` (that skips in dev). The real source is the **per-route `apiAuthRateLimiter`** (`rateLimiting.middleware.ts:358`, `max: isProd?1000:2000` per 15-min window) applied via `router.use(apiAuthRateLimiter)` at **`my-work.routes.ts:73`** — so EVERY my-work request counts. The 2000/15min bucket is exhausted by: React StrictMode double-firing (dev), background polling (session-context, focus/state, inbox stats), the inbox N+1 (`my-work.routes.ts:1398`), AND amplified by the new `fetchWithRetry`/`lazyWithRetry` retrying on failure → 429 death-spiral. Backend log: HTTP 429 on `/my-work/my-ideas`, `/notebooks`, `/session-context`, `/inbox`, `/tasks` etc.
**Impact:** NOT just Ideas — Notebook ("Failed to load notebooks"), Inbox (stuck "Loading..."), Tasks ("Something went wrong"), Manager ("No data" everywhere) all hit it. **Sabotaged the whole screenshot session.**
**DEV MITIGATION APPLIED (2026-06-03):** restarted backend with `DISABLE_RATE_LIMIT=true` → `createLimiter` skips in non-prod (`rateLimiting.middleware.ts:277`). App loads again for screenshots. NOT committed (runtime env only).
**Proper fix (next round):**
- `fetchWithRetry` (api.ts + v8 baseClient): **do NOT retry on 429** (only network/5xx) — retry amplifies the storm. (regression I introduced in the stability pass — prioritize.)
- Scope `apiAuthRateLimiter` per authenticated user (not IP) and exclude internal SPA GET traffic, or raise the bucket; current 2000/15min is too low for the SPA fan-out.
- Reduce the My Work startup request storm (batch/dedupe parallel hub loaders; fix inbox N+1).
- Frontend should honor `Retry-After`/back off, not hammer.

## FIX-2 — 🟠 P1: `collab_sessions.duration_seconds` column missing (schema drift)
**Evidence:** backend log `error: column "duration_seconds" of relation "collab_sessions" does not exist` (code 42703) on IdeaCollabWs leave-persist.
**Impact:** idea/whiteboard collab leave fails silently; part of the schema-bootstrap drift family.
**Fix:** add the missing column via a date-prefixed migration (and fold into the consolidation pass).

## FIX-3 — 🟠 P1: Ideas shows EMPTY state on FAILURE (misleading)
**Symptom:** on fetch failure Ideas renders "Your Idea Garden awaits / Plant your first idea" (empty) **and** "Failed to load" toasts simultaneously.
**Fix:** when the ideas fetch errors, render an ErrorState (with retry), NOT the empty "garden" CTA — otherwise users think they have 0 ideas when the load actually failed. Same audit pattern across hubs (empty vs error must be distinct).

## FIX-4 — note: lazy/retry interplay
The "context of project" Ideas sub-view spun indefinitely in screenshot 1 (before falling to empty in screenshot 2). With FIX-1 (429) resolved, confirm the sub-view resolves; if not, check its dedicated loader's timeout/error path.

---
(append further screenshot findings below)
