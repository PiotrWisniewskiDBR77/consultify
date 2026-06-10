# Consultify — Cloud QA Test Brief (data-rich account)

> Hand this whole document to the Chrome Cloud agent. It is self-contained.
> The operator is **already logged in** with a data-rich account that has test data across all tools.

## 0. Mission
Exhaustively exercise these modules and report **every** bug, broken state, dead button, wrong/empty data, layout glitch, slow load, console error, or confusing UX:
**Chat · My Work · Interview · Initiatives (deep) · Execution/Implementation (deep)**.
Be thorough and skeptical — open every tab, click every control, try edge cases. Quantity and precision of findings is the goal.

## 1. Setup
1. **Use the browser session that is already open and logged in.** Do **NOT** log out, do **NOT** switch or create accounts, do **NOT** use any invite/registration link.
2. At the top of your final report, record: the **URL host** (`consultify.ai` = production, `demo.consultify.ai` = staging), the **account name/role** shown top-right, and the **date/time**.
3. If the session is logged out or expired, **STOP** and report that — do not attempt to log in.

## 2. Ground rules (MUST follow)
- This is a **real account with real test data**. Treat it carefully.
- **Do NOT delete** anything. **Do NOT** change Organization / Billing / Admin / Security / Team settings. **Do NOT** invite/remove users. **Do NOT** send, email, share, publish, or export anything externally.
- You **may** create new test items and edit items **you create**. **Prefix every name you create with `ZZQA-`**. Keep a running list of everything you create or modify.
- Prefer **creating new `ZZQA-` items** over editing existing data. If you must edit existing data to test an edit flow, note the **before** value and restore it after.
- For **every** issue: capture a **screenshot** + read the **browser console** (errors/warnings) + note the **URL** + exact **steps**.
- Don't get stuck: if a flow blocks you, log it as a finding and move on.

## 3. Quick smoke (Test Suite A)
- A1. Open each target module from the sidebar: **Chat, My Work, Interview, Initiatives, Execution**. Each must open **real content with data** — not a white screen, not "module not enabled", not an infinite spinner.
- A2. Note load time for each; flag anything > ~5s.
- A3. Scan the browser console on each page; record errors/warnings.

## 4. Chat (Teresa) — Test Suite B
URL: `/chat`
- B1. Loads: hero/composer, suggestion chips, starter cards (Market analysis / Financial analysis / Classic consulting / Digital transformation). Dismiss any onboarding modal ("Skip for now").
- B2. Open an **existing conversation from history** (clock icon) → confirm messages render correctly.
- B3. Send a message: `ZZQA-1 Summarize what you can help me with` → expect a streamed AI reply (no error, no infinite spinner). Note latency.
- B4. Try a suggestion chip and a starter card → each should trigger a sensible action.
- B5. OUTPUT tabs (Auto / Documents / Tables / Presentations): switch between them; if data/artifacts exist, open one; confirm no crash.
- B6. Attachments / voice mic: open the control (don't record anything sensitive); confirm it opens cleanly.
- B7. New chat (+) then back via history → confirm persistence. Refresh mid-chat → conversation persists.
- B8. Edge: empty message; ~2,000-char paste → graceful handling, no crash.

## 5. My Work — Test Suite C
URL: `/my-work`
- C1. Open every tab (Radar, Ideas, Notebook, Inbox, Calendar, Tasks, Decisions, Manager). Each must render with its data (or a clean empty state). Note any tab that errors or is unexpectedly locked.
- C2. Radar: review signals / try **Retry** / open a signal's detail if present.
- C3. Tasks: review existing tasks; **create** `ZZQA-Task-1` (due date / priority) → appears; edit it; toggle complete; refresh → persists. Try sorting/filtering existing tasks.
- C4. Decisions: review existing; create `ZZQA-Decision-1` → save + persistence.
- C5. Notebook: open an existing note (confirm content renders); create `ZZQA-Note-1`, type, navigate away/back → persists.
- C6. Calendar / Inbox / Manager: open existing data, click items, exercise filters/controls; confirm no crashes.

## 6. Interview — Test Suite D
URL: `/interview`
- D1. Tabs: Inbox, Sessions, Assigned, Templates, Insights, Initiatives. Open each; confirm render with data.
- D2. **Inbox / Assigned**: open an existing assigned interview → step through the question flow; answer a couple of questions with `ZZQA-` test text; use **Save / continue later** → reopen → answers persisted. **Do not** click final Submit on a real/important record unless it's clearly a `ZZQA-` test item.
- D3. **Sessions**: open an existing session → review transcript/answers/state.
- D4. **Templates**: open a template → preview questions; try editing/duplicating into a `ZZQA-` copy if supported. **Do not** delete existing templates.
- D5. **Insights**: open the list → open one insight → side preview → "Open" full view. Exercise sections (Executive Summary, Themes, Issues & Risks, Recommendations, Next Actions) and the AI actions (Summarize / Suggest actions) and "Create report/deck/table/idea/note/initiative" buttons (open the generator, don't necessarily finalize). Note any broken/empty section.
- D6. **Initiatives tab** (inside Interview): confirm the insight→initiative handoff opens.
- D7. Filters / search / view switch / column toggles across these tabs → confirm correct behavior.

## 7. Initiatives — Test Suite E (DEEP — primary focus)
URL: `/initiatives`
- E1. Portfolio board: columns **In Review / Promoted / Planning / Approved / Scheduled** with counts; cards show priority, status, owner, NEXT GATE. Confirm existing data renders.
- E2. **Open detail** of an existing initiative → exercise EVERY section/tab (overview, charter, gates, tasks, KPIs, financials, links, history). Confirm each renders with data, no NaN/undefined.
- E3. **Create**: New initiative → `ZZQA-Initiative-1` with required fields → save → appears in the right column. If "AI Initiative Wizard" / "Charter" exist, run them with `ZZQA-` data; if marked "coming soon", confirm they're gated gracefully.
- E4. **Edit** a `ZZQA-` initiative: change priority, status, owner, dates, description → save → refresh → persists.
- E5. **Gate transitions**: promote/move a `ZZQA-` (or clearly-test) initiative across a gate (card menu or drag-and-drop). Confirm column/count update + any gate dialog/approval flow works.
- E6. **Views**: switch list / board / calendar / table (top-right icons) → each renders the same data without crashing.
- E7. **Filters & search**: every filter chip, Active vs All, search/🔍 → correct filtering + counts.
- E8. **Analysis tab**: open → charts/tables render with real numbers, no broken/empty/NaN states.
- E9. **Card actions** (⋮): open the menu; try non-destructive actions (open, duplicate). **Do not delete** existing (non-ZZQA) initiatives.

## 8. Execution / Implementation — Test Suite F (DEEP)
URL: `/implementation`
- F1. Loads with tabs **Summary / Rollout / Reporting / Management** and filters (All / Blocked / Overdue Decisions / Missing Dates / Due Soon). List columns: INITIATIVE / TYPE / STATUS / ASSIGNEE / PROGRESS / DEADLINE / ALERTS / TASKS. Confirm existing data renders.
- F2. Open each tab → confirm real content, no blank/"not enabled".
- F3. **Open an execution item** (the "cover"/detail) → exercise every section (rollout plan, tasks, decisions, reporting, KPIs, milestones). Confirm rendering with data.
- F4. Update progress / add a task / move an item forward — on a `ZZQA-` (or clearly-test) item → confirm persistence after refresh.
- F5. Filters (Blocked / Overdue Decisions / Missing Dates / Due Soon) → correct filtering + counts.
- F6. Views (list / board / calendar) → switch; each renders.
- F7. Reporting tab: charts/exports render. **Do not** email/share externally.

## 9. Cross-cutting — Test Suite G
- G1. **Responsive**: resize to ~375px (mobile) and ~768px (tablet) on Chat, My Work, Initiatives → layout holds, sidebar collapses properly.
- G2. **Theme**: toggle Light (Settings → Appearance → Theme), re-open Initiatives + an Insight → flag low-contrast/unreadable text. Switch back.
- G3. **Navigation**: browser back/forward across modules; deep-link by pasting `/initiatives`, `/implementation`, `/interview`, `/my-work`, `/chat` directly → load correctly.
- G4. **Refresh persistence**: hard-refresh on each module → state/route persists, no error screen.
- G5. **404**: visit `/this-does-not-exist` → graceful not-found.
- G6. **Settings**: open Settings → Profile (read-only check); confirm it loads. **Do not** change org-level settings.

## 10. Severity guide
- **P0** — blocks usage (module won't open, data loss, white screen on a core flow, save corrupts data).
- **P1** — major broken feature (button does nothing, save fails, wrong data, crash on a common action).
- **P2** — noticeable, workaround exists (layout glitch, slow load, confusing state).
- **P3** — cosmetic (spacing, copy, minor contrast).

## 11. Already-known issues — note if seen, don't dwell
- Console: `[InterviewHub] Failed to load insights: Permission denied` (may be role-specific)
- Console warnings re `user_status` column / `partner_organizations` relation (schema drift)
- Insight preview shows raw `## …` markdown
- Light-theme low contrast (app-wide)
- **Chat composer toolbar (attach / draw / mention / voice) is hidden by design** when the input is empty and not focused/hovered — it fades in on focus, hover, typing, or while streaming (EnhancedChatInput "Action Bar — less is more"). This is INTENDED, not a bug. Do NOT report the toolbar as "missing".
- Any colored rectangle/outline you (the agent) draw around an element is your own interaction highlight — never report it as an app visual bug.
Focus energy on **new** findings beyond these.

## 12. Required deliverable (report format)
Produce one structured report:
1. **Header**: URL host, account/role, date/time.
2. **Summary table**: counts by severity (P0/P1/P2/P3) and by module.
3. **Findings** — each: `[Severity] Module > Page | Steps | Expected | Actual | URL | Console errors | Screenshot ref`.
4. **Data touched** — every `ZZQA-…` item created, and any existing item edited (with before/after).
5. **Coverage** — which suites (A–G) you completed; anything you couldn't reach and why.
