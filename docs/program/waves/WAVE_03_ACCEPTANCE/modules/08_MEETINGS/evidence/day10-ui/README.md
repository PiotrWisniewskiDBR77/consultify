# Day 10 UI wiring — decisions & follow-ups (D.4/D.5)

Captured 2026-08-25, dev-render harness (real Postgres + real backend + real
frontend, no mocks), before Piotr saw anything — per CLAUDE.md §UI pkt 7.

## What these show

`meeting-decisions-dark.png` / `meeting-decisions-light.png`: the
`/meetings/:id/decisions` ("Decyzje i działania") section of
`MeetingObjectPage.tsx`, after real writes through the new client (`src/services/api.ts`
`listMeetingDecisionRecords`/`createMeetingDecisionRecord`/`updateMeetingDecisionRecord`/
`listMeetingFollowUpRecords`/`createMeetingFollowUpRecord`/`updateMeetingFollowUpRecord`)
against the day-10 backend (`server/src/routes/meeting.routes.ts`
`/decision-records`, `/follow-up-records`):

- 2 decisions: one left `Zapisana` (recorded), one toggled to `Zastąpiona`
  (superseded) — proves both create and the status-toggle control persist and
  read back.
- 2 follow-ups: one left `Otwarte` (open, with owner + due date), one toggled
  to `Zrobione` (done) — proves create + status toggle for this resource too.

Mock content is realistic Polish consulting copy (PL locale active), not
placeholder Latin text. No crimson outside semantic tones; focus ring is
`c-focus` blue; StatusChip tones follow canon (`success`/`neutral`/`warning`).

## How they were produced

1. Disposable tmpfs Postgres, full `server/scripts/migrate.postgres.ts` replay
   (fresh schema, not a shortcut subset).
2. Backend (`tsx src/index.ts`) + frontend (`vite --port 4552`) against that
   DB, `ENABLE_TEST_SUPPORT=true` — same recipe as
   `docs/program/evidence/closure/a/ASM-UI-CANON-001/BROWSER_HARNESS.md`.
3. A real ADMIN session minted via `POST /api/test-support/bootstrap`,
   injected into `localStorage` (same keys `tests/e2e/m06/_m06.ts`
   `injectSession` uses) — no login form, no Piotr-facing credential.
4. A meeting created through the real "Nowe spotkanie" UI form, decisions/
   follow-ups added through the real controls built in this task (interactive
   review pass, `Claude_Browser` MCP), then a scripted Playwright pass
   (`chromium`, real click on the header's theme control — "Motyw" → "Jasny")
   captured the two PNGs above at 1280×900.
5. Harness torn down after capture: backend/frontend processes killed, tmpfs
   Postgres container removed, throwaway scripts deleted. Nothing was pushed;
   `MODULE_MEETING` stays `closed` in `src/utils/betaAccess.ts` — this
   evidence does not change that gate.

## Self-review before handoff

Both screenshots reviewed at full resolution: section header/back button/kebab
render (Menu 1), left section nav highlights the active tab, right panel
accordion shows Akcje/Właściwości, center shows the two record lists with
working create forms above each. No dev-only banners, no broken images, no
untranslated fallback strings. `MeetingHub.tsx`'s "Follow-ups" column and
"Wymaga follow-upu" chip were independently confirmed (list screenshot, not
saved here) to read `1` after this exact data was created — the same
`meeting_follow_ups` table this resource writes to, no separate aggregate
needed (see the parent task's final report for that screenshot's numbers).
