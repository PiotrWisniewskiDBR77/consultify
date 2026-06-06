# Interview Module — Test Guide (V-A / V-B / V-C)

**For:** owner manual testing
**Branch:** `feat/wave1-foundations` · FE :3000 · BE :3001
**Note:** restart/refresh the app first so the new build loads.

Test in this order — start with the highest-visibility, highest-confidence fixes, end with the risk areas where a first-shot bug is most likely.

---

## A. Highest visibility — verify the screenshot bugs are gone

1. **Inbox → assignee names.** Open Interview → Inbox. The "Assignee" column previously showed **"Unknown" + ?** on every row. → Should now show the real person's name (or their email if they have no first/last name). **If still "Unknown":** tell me — means the assignment rows genuinely have no `assignee_user_id`, a different (data) issue.

2. **Inbox → counts.** The chip row (ALL / My inbox / To approve / Overdue). KNOWN/DEFERRED: "Overdue" and "To approve" are **manager shortcuts** that jump to the Assigned tab with org-wide counts — they intentionally differ from the personal "ALL/My inbox" counts. I did NOT change this (it's a UX-design call, not a bug). Flag if you want them unified.

---

## B. Templates — status + archive (medium confidence, please verify)

3. **Status column.** Open Templates (table view). Previously every row showed a fake **"Default / Active"** badge. → Should now show the real status: **Draft / In review / Published / Archived**, with a small separate "Default" marker only on the default template.
   - ⚠️ **Risk:** if the backend doesn't return a `status` field per template, everything will read as "Draft". If you see all-Draft, tell me — I'll check the backend list projection.

4. **Status filter chips.** The filter row should now read **All / Draft / In review / Published / Archived** (was All/Default/Active). Click each — the list should filter to that status with correct counts.

5. **Archive / Restore (NEW — was a dead backend).** Open a non-default template's "⋯" row menu.
   - Active template → should show **"Archive template"**. Click it → toast "archived", template should move to Archived status.
   - Archived template → the menu should show **"Restore template"** → click → back to Draft.
   - ⚠️ **Risk:** this is freshly wired. Verify the list actually refreshes and the status flips. If archive "works" but the row still shows active, the backend response or the status field is the suspect.

---

## C. Assigned (manager view) — status + actions

6. **Sent back chip.** Send an assignment back (Assigned tab → an in-progress/submitted one → Send back, with a reason). Previously `sent_back` was silently shown as "in_progress". → The row should now show a **"Sent back"** chip, and a sent_back count/filter should be non-zero.

7. **Approve / Send-back permissions (security — needs a 2nd user ideally).** As OWNER everything works. The fix was: a **non-manager** member can no longer approve/send-back via the API. Hard to test from the UI alone (buttons are hidden for them anyway). If you have a contributor test account, confirm they get a 403 if they try the action. Otherwise trust the code path.

---

## D. Sessions — ad-hoc no longer vanishes

8. **Create a session and reload.** Sessions tab → "New session" (the ad-hoc one, no template). Previously the new session **vanished on reload** (it had no assignment row and the list excluded it). → Create one, then refresh the page → it should still be in the Sessions list (surfaced near the top).
   - ⚠️ **Risk:** this is a new second query. Verify (a) the new session appears, (b) it doesn't duplicate, (c) the rest of the managed list still loads in the right order.

8b. **No demo data under a real project (TRUST fix).** Open the interview *workspace* for a real project that has **no sessions yet**. Previously it would silently load a fully-populated **demo interview** (fake transcript/insights) under your real project — easy to mistake for real data. → It should now open an **empty, real, newly-created session** (no fake transcript). Demo data only appears for explicit demo ids.
   - ⚠️ **Risk:** if you open a real empty project and still see a pre-filled fake interview, tell me — means a demo id is leaking into the real path.

---

## E. Initiatives — handoff traceability

9. **Finding → initiative shows in the tab.** Insights → open an insight with a published, readback-confirmed finding → hand it off to a new initiative (no existing target). → The created initiative should now appear in the **Interview → Initiatives** tab (previously it was created but invisible because it had `source_type=NULL`).
   - ⚠️ **Risk:** depends on the `initiatives` table having `source_type`/`source_id` columns. If the handoff initiative still doesn't appear, the columns may not exist in your DB — tell me and I'll confirm the migration.

---

## F. All tables — column resize persists

10. **Resize a column, reload.** On any Interview table (Inbox / Sessions / Templates / Insights / Initiatives / Assigned), drag a column border to resize it, then refresh. → The width should **persist** (previously resize was lost on reload). Hidden-columns + row-description toggles already persisted; now widths do too.

---

## What I did NOT change (so you know what to expect)

- **The 5 tables are still the hand-written builders** — I did NOT yet collapse them onto one canonical FilterableTable component. That's the large remaining V-B work. So the tables still look as they did; the fixes above are behavior/status/persistence, not a visual redesign. The 4 different status-pill styles across tabs are still there (Templates now uses the real-status chip; Sessions/Assignments still use their own). Unifying those is part of the deferred per-tab migration.
- **Inbox Overdue/To-approve count coherence** — deferred (design call).

---

## How to report back

For each numbered item: ✅ works / ❌ broken (with what you saw) / 🤔 unsure. Screenshots help most for the visual ones (B, C, F). I'll triage ❌/🤔 first — and yes, I expect at least one or two to need a second pass, which is exactly why we're testing now rather than after the big migration.
