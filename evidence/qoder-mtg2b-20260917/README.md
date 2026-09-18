# MTG-2b — evidence (DEC-607, 2026-09-17/18)

Scope: decisions/actions as one source + "something leaves the meeting" —
action → Realizacja task via the fixed `meetingNoteTaskFunnelService`
(deadline + owner preserved), return status read from `tasks.status` on the
protocol, decision → "Promote to register" (P2), plus the 7 mutating route
groups authz matrix and D-98.

## Harness

dev-render harness (CLAUDE.md #7), vite dev server from the repo root:

```
npx vite --config dev-render/vite.config.ts --port 5430 --strictPort
```

Entries (real screens, mock data, app CSS; theme via the app store + `.dark`
class on `documentElement`, NOT `emulateMedia`):

- `/meeting-mtg2b.html?lang=en&theme=light|dark` — real `MeetingObjectPage`
  on `/meetings/:meetingId/decisions` (screen `dev-render/screens/meeting-mtg2b.tsx`).
  Shows the new write controls: Flag "Promote to register" on the decision row,
  ArrowRight "Convert to task" on the follow-up with `taskId=null`, and its
  correct ABSENCE on the follow-up already linked to a task.
- `/meeting-protocol.html?lang=en&theme=light|dark&case=draft` — MTG-2a protocol
  document (screen `dev-render/screens/meeting-protocol.tsx`), scrolled to the
  Actions block. Shows the return status: `in_progress` pill on the action whose
  `task_id` points at a live task, `open` on the unlinked one; Decisions block
  renders the W109c columns (OWNER / TYPE / IMPACT / DECIDED BY / REJECTED
  ALTERNATIVE).

Captures: `dev-render/shot.mjs <out.png> <url> --w 1440 --h 900 …`
(1440×900, EN, light + dark).

## Shots

| file | what it proves |
| --- | --- |
| `mtg2b-object-en-light.png` | object page, light: promote + convert buttons present, convert hidden on task-linked follow-up |
| `mtg2b-object-en-dark.png` | same, dark tokens |
| `mtg2b-protocol-return-status-en-light.png` | protocol, light: `in_progress` return-status pill on the task-linked action vs `open`; W109c decision fields |
| `mtg2b-protocol-return-status-en-dark.png` | same, dark tokens |

## Console / network

`shot-*.log` are the raw `shot.mjs` outputs. The harness prints
`KONSOLA-BLEDY` / `SIEC-4XX5XX` sections only when non-empty; none of the four
logs contain them → **bledyKonsoli=0** for all four captures.
