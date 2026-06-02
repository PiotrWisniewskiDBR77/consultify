# Agent Snapshot Protocol

Pre-flight defense against Google Drive Desktop reverts during agent work in `consultify/`.

## Purpose

Drive Desktop sync silently reverts files in this workspace, especially newly-created ones under `consultify/`. The agent often fans out across many files in a single task, so reverts can land mid-flight and only surface after the next read. This protocol installs a **pre-flight snapshot hook** that runs before every agent task, giving us a verifiable rollback point on disk.

The snapshot itself is the existing `drive-sync-snapshot.ts` script. This document describes the Cursor hook wiring, the operating contract, and how to verify and disable it.

See also:

- `DRD/consultify/docs/operations/DRIVE_SYNC_RESILIENCE.md` — full snapshot/restore operational detail
- `.cursor/rules/drive-sync-resilience.mdc` — agent-side rule for snapshot/restore hygiene
- `.cursor/rules/agent-snapshot-protocol.mdc` — agent-side rule for the pre-flight hook

## Background

- Hook configuration is per-project at `.cursor/hooks.json`.
- The hook script lives at `.cursor/hooks/agent-snapshot-pre-flight.sh`.
- The snapshot script is `DRD/consultify/server/scripts/drive-sync-snapshot.ts`.
- Snapshots are written under `<project-root>/.drive-sync-backup/<ISO_TS>/` and are git-ignored.
- The hook fires on the Cursor `beforeSubmitPrompt` event — once per user prompt, before the agent starts working on the task.

## Architecture

```
+----------------------------+
| User submits prompt        |
+--------------+-------------+
               |
               v
+----------------------------+        Cursor "beforeSubmitPrompt" event
| Cursor agent runtime       |  --->  reads .cursor/hooks.json
+--------------+-------------+
               |
               v
+----------------------------+        timeout 90s (best effort)
| agent-snapshot-pre-flight  |  --->  npx tsx drive-sync-snapshot.ts
|   .sh                      |        --paths <consultify subtrees>
+--------------+-------------+        --max-snapshots 20
               |
               v
+----------------------------+
| .drive-sync-backup/        |        verbatim copy + manifest.json
|   <ISO_TS>/...             |        machine-local, git-ignored
+--------------+-------------+
               |
               v
+----------------------------+
| Agent task proceeds        |
+----------------------------+
```

Why `beforeSubmitPrompt`? It is the narrowest event in the Cursor hook schema that fires once per agent task, before any tool call runs. Tool-level events (`preToolUse`, `afterFileEdit`) fire per-file and would either over- or under-snapshot.

## Hook contract

- **Never blocks the agent.** The script always exits 0, even when the snapshot fails or the snapshot script is missing.
- **Safety gate.** If the resolved project root path does not contain `Antygracity`, the script exits 0 immediately. Prevents surprises when the script is copied elsewhere.
- **Best-effort runtime.** If `npx`, `tsx`, or the snapshot script is unavailable, exits 0 silently rather than spamming errors.
- **Bounded latency.** Wraps the snapshot in `timeout 90` (or `gtimeout 90`) when available; the hook config also sets a 120s ceiling.
- **Honest logging.** One timestamped line goes to stderr at start, plus one line if the snapshot fails. No hidden behavior.

## Verifying the hook is firing

1. **Check the Cursor Hooks output channel.** In Cursor: View → Output → choose "Hooks". Each agent task should produce a line like:

   ```
   [2026-05-07T07:11:42+0200] Pre-flight: snapshotting DRD/consultify/ before agent task
   ```

2. **Check `.drive-sync-backup/` mtime.** From the project root:

   ```
   ls -1t .drive-sync-backup/ | head -3
   stat -f '%Sm  %N' .drive-sync-backup/*/ 2>/dev/null | head -3
   ```

   The most recent directory should be within seconds/minutes of your last prompt submission.

3. **Tail snapshot manifest.** Each snapshot writes a `manifest.json` listing files and SHA-256s:

   ```
   cat .drive-sync-backup/$(ls -1t .drive-sync-backup | head -1)/manifest.json | head -40
   ```

## How to disable temporarily

Edit `.cursor/hooks.json` and remove or comment out the `beforeSubmitPrompt` entry. Cursor watches `hooks.json` and reloads on save; no restart needed.

```json
{
  "version": 1,
  "hooks": {}
}
```

Do **not** delete `.cursor/hooks/agent-snapshot-pre-flight.sh` — leave it in place so re-enabling is a one-line change.

## Failure modes

| Symptom | Likely cause | Action |
|---|---|---|
| Hook log shows no "Pre-flight" line | `hooks.json` not loaded; matcher/path issue | Restart Cursor; check Hooks output channel |
| `Pre-flight snapshot failed (continuing) status=124` | 90s timeout exceeded | Snapshot run ballooned; check `.drive-sync-backup/` for partial output, tighten `--paths` if needed |
| `Pre-flight snapshot failed (continuing) status=127` | `npx` or `tsx` missing on PATH | Ensure Node/npm are installed and on the agent's PATH |
| Hook fires but `.drive-sync-backup/` is empty | Snapshot script exited early; safety gate triggered | Inspect stderr; the script logs a reason |
| Slow projects: every prompt waits ~10s on snapshot | Snapshot tree grew | Lower `--max-snapshots`, prune `.drive-sync-backup/` manually, or narrow `--paths` |

The hook never returns a non-zero exit code, so even in the worst case the agent proceeds normally.

## Related documents

- `DRD/consultify/docs/operations/DRIVE_SYNC_RESILIENCE.md` — full snapshot/restore runbook, watch mode, escalation
- `.cursor/rules/drive-sync-resilience.mdc` — when to snapshot, when to restore
- `.cursor/rules/agent-snapshot-protocol.mdc` — agent-side discipline for multi-file work
- `.cursor/hooks.json` — hook configuration
- `.cursor/hooks/agent-snapshot-pre-flight.sh` — hook implementation
