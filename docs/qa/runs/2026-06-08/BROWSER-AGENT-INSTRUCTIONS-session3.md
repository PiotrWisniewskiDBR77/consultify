# Browser Agent Instructions — Session 3 (front-end clicks)

> Paste this whole document to Claude-in-Chrome. It is self-contained.
> **You drive the UI. Your backend partner (another Claude on Railway CLI) verifies the API/RBAC/DB side in parallel.** Your job: click the front, observe the UI, and **capture hard evidence** (network status + correlationId + timestamp) for every issue so the backend side can confirm server behavior in the logs.

Derived from `docs/qa/runs/2026-06-08/TEST-CHARTER-session3.md`. Target: **PROD `https://consultify.ai`** (where the VTS rollout is live).

## Account
- **USER (pilot):** `qa.cloud.zzqa001@example.com` / `QaCloud!2026` — already a USER in VTS GROUP S.A.
- Use this account. Do **NOT** log into any real person's account. (An ADMIN comparison account will be provided separately if needed.)

## Ground rules (MUST follow — this is real prod with client data)
- **Non-destructive:** do NOT delete data, do NOT change VTS org settings, do NOT send real invites/emails, do NOT do mass writes. Create only `ZZQA-`prefixed artifacts and clean up.
- **For EVERY finding capture all of:** (1) screenshot, (2) **the failing network request** — method + full URL + **HTTP status**, (3) the **`correlationId`** from the response body/headers if present, (4) **timestamp** (so the backend partner can match it in Railway logs), (5) browser console errors.
- Open the Network panel / use the network-reading tool from the start — **the network evidence matters more than the visual** for this session (it's an RBAC/security audit).
- If a page hangs without reaching idle, note it and move on (don't get stuck).

## PRIORITY 1 — Data-safety / RBAC mini-audit (most important)
For each module below, as the **USER**, record **what data is visible that may be out of this user's scope** (other people's names, other teams' items, whole-org data) AND the API call that returned it (URL + status + correlationId + time).
1. **PII / out-of-scope data.** Open and scan: **Execution** (Management, Action Queue, Reporting), **Initiatives** (assignees, owners), **Interview** (other people's sessions/insights), **Finance**, **Portfolio**, **KPI/OKR**, **Benefits**, **My Work** (whose tasks/decisions appear?). For each: does it show data belonging to other users/teams? Note the endpoint that fed it.
2. **Privilege escalation via URL.** As USER, manually type these into the address bar and record the **network status** (not just what the UI shows): `/admin/overview`, `/admin/people`, `/admin/billing`, `/superadmin/overview`, `/organization/members`, `/settings/billing`. Expected: blocked + backend 403. Flag any that load real admin data.
3. **IDOR.** Take an ID you can see (e.g., a conversation, an initiative, an interview session) and try swapping it for a different/guessed ID in the URL or a repeated request: `/api/conversations/:id`, `/api/initiatives/:id`, `/api/v8/interview/sessions/:id`. Record status (200 = potential IDOR, 403/404 = good).

## PRIORITY 2 — Reproduce conditional bugs (need exact repro)
4. **Chat/voice 403 — when it fires vs not.** Try these exact sequences and record `organizationId` + any `x-org-context` header on the request, plus status:
   - Fresh login → immediately click **"Talk to Teresa"** (before opening any chat).
   - After switching organization (if available).
   - After logout → login again.
   (Note: a root cause was fixed earlier — accounts missing org membership got 403. Confirm it's now consistently 200 for this USER, or capture any remaining 403 with its correlationId.)
5. **Settings sub-nav (Theme/Language/Auth & Access).** Click each under Settings. Does the **URL change** (`/settings/theme`, etc.) and the content re-render? Record which ones do nothing (dead link) vs navigate. (This tells us whether it's pilot gating or a real broken route.)

## PRIORITY 3 — Modules not yet covered (happy-path + save)
6. **Deliverables/Outputs:** Document Studio, Table Studio, Presentations, Reports builder — create a `ZZQA-` item, save, export. Watch for 4xx/5xx on save/export.
7. **Meeting, KPI/OKR, Benefits, Finance, Portfolio, AI OS (`/ai/*`)** — happy path + one save each. (Many may be locked for the pilot USER — if locked, note the lock plate is clean, no crash.)
8. **Assessment** (DRD/SIRI/ADMA/CMMI/Lean) — start one, step through, save.

## PRIORITY 4 — Coverage gaps
9. **Locale EN** — switch to English (if reachable) and walk the workspace; flag any Polish text leaking into English UI.
10. **Password reset end-to-end** — `/forgot-password` → (don't complete with a real mailbox; just verify the request flow + UI states).
11. **Responsive** — 375px (sidebar) and 768px (nav); check forms/modals on mobile widths.

## PRIORITY 5 — Performance (note in passing)
12. Note any endpoint slower than ~1.5s or with obviously heavy loading (especially `title/generate`, `/api/v8/admin/flags`). Note if normal navigation triggers a cascade of **429** (rate-limit) responses.

## Report format (so the backend partner can correlate)
For each finding:
`BUG-xx [Severity P0–P3] Module > Page | Steps | Expected | Actual | METHOD URL → HTTP status | correlationId | timestamp | console errors | screenshot ref`
End with: a table of findings by severity/module, and the list of `ZZQA-` artifacts you created.

> Backend partner is simultaneously: tailing Railway prod logs, calling the same endpoints as the USER token, and checking the DB for org-scoping — so your **status + correlationId + timestamp** let us confirm each issue from both sides.
