# Drive Sync Resilience

**Version:** 1.0.0
**Last Updated:** 2026-05-07

## Purpose

Defend the workspace under `~/Documents/Antygracity` against Google Drive Desktop sync occasionally:

- reverting recently-edited files to an older state, and
- deleting files that were just created (especially under `consultify/`).

The pattern is intermittent and silent: the IDE may show your edits, but a sync round-trip rewrites the file on disk a few seconds later. The mitigation is a verbatim per-file snapshot taken before destructive sweeps and a controlled restore that never overwrites without a `--force` opt-in.

This document is the operational counterpart to:

- `.cursor/rules/drive-sync-resilience.mdc` — agent-facing rule (when to snapshot, when to restore, verification).
- `DRD/consultify/server/scripts/drive-sync-snapshot.ts` — snapshot script.
- `DRD/consultify/server/scripts/drive-sync-restore.ts` — restore script.

## Background

Google Drive Desktop syncs the entire `~/Documents/Antygracity` tree. Symptoms observed:

- Newly-created files vanish within seconds of being written (Drive removes the local file because the sync engine hasn't observed it yet, or because a remote tombstone wins a race).
- Edits to existing files are reverted to the previous content (a stale remote version is pulled down on top of the local edit).
- The IDE buffer still shows the new content but `Read` / `Grep` against the on-disk file shows the reverted version.

The pattern is workspace-wide but concentrated under `consultify/` because that subtree changes most often during agent sessions. See also the Sprint 5 rollout incident notes in `DRD/consultify/docs/operations/PRESENTATION_RUNTIME_AND_CONFIDENTIALITY_ROLLOUT_RUNBOOK.md` for related guidance on guarding multi-file workflows.

## npm shortcuts (zero-config developer entry points)

The most common operations are wired into `consultify/package.json`:

```bash
# Take a one-shot snapshot of the eight standard paths (uses 20-deep rotation):
npm run drive:snapshot

# Continuously snapshot in the background while you work:
npm run drive:snapshot:watch

# Restore the latest snapshot (asks before overwriting modified files):
npm run drive:restore

# Restore ONLY files that disappeared (safe even mid-session):
npm run drive:restore:missing

# Dry-run a diff-only restore to preview what would change:
npm run drive:restore:diff
```

Use `npm run drive:restore:missing` immediately if you suspect Drive Sync ate
freshly created files — it will not touch anything you have edited locally.

For more advanced flags (custom `--paths`, `--snapshot <ISO_TS>`, `--report-file`,
`--allow-any-root`), invoke the underlying scripts directly using the CLI
reference below.

## CLI reference

### drive-sync-snapshot.ts

Walks configured paths, hashes each tracked file with SHA-256, and writes a verbatim copy under `<root>/<out>/<ISO_TS>/...` plus a `manifest.json`.

```
npx tsx server/scripts/drive-sync-snapshot.ts \
  [--root <path>] \
  [--paths "consultify/src,consultify/server/src,consultify/server/scripts,consultify/docs/testing,consultify/docs/product"] \
  [--out .drive-sync-backup] \
  [--watch] \
  [--interval-ms 60000] \
  [--max-snapshots 10] \
  [--report-file out/snapshot-<date>.json] \
  [--allow-any-root]
```

Flags:

- `--root` — workspace root. Defaults to `process.cwd()`. Must resolve under `~/Documents/Antygracity` unless `--allow-any-root` is set.
- `--paths` — comma-separated list of relative paths to walk. Defaults to the volatile set: `consultify/src`, `consultify/server/src`, `consultify/server/scripts`, `consultify/server/migrations`, `consultify/docs/testing`, `consultify/docs/product`, `consultify/tests/e2e`.
- `--out` — output directory under `<root>`. Defaults to `.drive-sync-backup`.
- `--watch` — run on a `setInterval` loop until `SIGINT`. Per-tick exceptions are caught and logged; the loop never exits on a single failure.
- `--interval-ms` — watch interval in milliseconds. Default `60000`. Minimum `1000`.
- `--max-snapshots` — rotation target. Default `10`. The three most recent snapshots are always preserved regardless of this value.
- `--report-file` — JSON summary of the run (non-watch mode only).
- `--allow-any-root` — escape hatch for running outside `~/Documents/Antygracity`. Use sparingly.

Exclusions (hard-coded, do not weaken):

- Directories: `node_modules`, `.git`, `dist`, `build`, `.drive-sync-backup`, `coverage`, `out`, `exports`.
- Binary extensions: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.pdf`, `.pptx`, `.xlsx`, `.zip`, `.tgz`, `.gz`, `.ico`, `.woff`, `.woff2`, `.ttf`, `.svg`.
- Secrets: `.env*`, `*.key`.
- Symlinks: skipped (recorded under `skipped` with reason `symlink_skipped`).
- Files larger than 5 MiB: skipped with reason `too_large`.

### drive-sync-restore.ts

Restores files from the latest (or specified) snapshot. Never overwrites a present file unless `--force` is set.

```
npx tsx server/scripts/drive-sync-restore.ts \
  [--root <path>] \
  [--snapshot <path>] \
  [--missing-only] \
  [--diff-only] \
  [--paths "consultify/src,..."] \
  [--force] \
  [--dry-run] \
  [--report-file out/restore-<date>.json] \
  [--allow-any-root]
```

Flags:

- `--root` — workspace root. Same boundary check as the snapshot script.
- `--snapshot` — explicit snapshot directory. If omitted, the most recent directory under `<root>/.drive-sync-backup/` (sorted lexicographically, which is also chronologically thanks to the ISO timestamp dir name) is used.
- `--missing-only` — only restore files that are absent in the working tree. Present-but-modified files are added to `conflicts` and skipped. Cannot be combined with `--force`.
- `--diff-only` — only restore files that are missing or whose SHA differs from the manifest. Conflict handling identical to default mode.
- `--paths` — comma-separated relative-path filter. Manifest entries that do not start with one of these are skipped with reason `path_filter`.
- `--force` — overwrite present-but-modified files. Use only after reviewing the `conflicts` array of a previous report.
- `--dry-run` — compute the plan and emit the report without writing files.
- `--report-file` — JSON report of the run.
- `--allow-any-root` — escape hatch.

## Recommended workflow

1. **Before any multi-file change** in `consultify/`, take a one-shot snapshot from the `consultify/` directory:

   ```
   cd ~/Documents/Antygracity/DRD/consultify
   npx tsx server/scripts/drive-sync-snapshot.ts \
     --report-file out/snapshot-pre-change.json
   ```

2. **For long agent sessions**, run watch mode in a separate terminal:

   ```
   npx tsx server/scripts/drive-sync-snapshot.ts --watch --interval-ms 60000
   ```

   The first stdout line is `watch_started=true`; subsequent lines are `snapshot=<dir> files=<n> bytes=<b>` per tick.

3. **If you suspect a Drive revert** (a file you just created is gone, or an edit reverted), run the safe restore first:

   ```
   npx tsx server/scripts/drive-sync-restore.ts --missing-only \
     --report-file out/restore-missing.json
   ```

   Inspect `restored`, `skipped`, `conflicts` in the JSON report.

4. **If a present file actually was reverted by Drive** and the local content is the wrong version, escalate to `--force` after reviewing `conflicts`:

   ```
   npx tsx server/scripts/drive-sync-restore.ts --diff-only --force \
     --paths "consultify/src/components/Foo" \
     --report-file out/restore-force.json
   ```

   Always scope `--force` with `--paths` to the smallest set you have evidence for.

5. **Verify** after restore by re-running the original `Grep`/`Read` that exposed the regression. Repeat the full cycle if Drive re-reverts within 60 seconds.

## Failure modes & exit codes

Snapshot exit codes:

- `0` — snapshot succeeded (or, in watch mode, the first tick succeeded and the loop is running).
- `1` — runtime error (file system, hash, copy, report write).
- `2` — argument error (bad flag value, root outside `~/Documents/Antygracity` without `--allow-any-root`, root not a directory).

Restore exit codes:

- `0` — completed. **Note:** a non-empty `conflicts` array is still exit code `0`. The caller must inspect the report and decide whether to rerun with `--force`.
- `1` — runtime error (manifest unreadable, copy failed for an entry that should have restored).
- `2` — argument error or no snapshots available.

Last stdout line of every non-watch run is `Exit code: N` for grep-friendly orchestration. In watch mode the loop only emits `watch_started=true`, the per-tick `snapshot=...` line, and (on `SIGINT`/`SIGTERM`) `watch_stopped=true`.

Common failure categories:

| Symptom | Likely cause | Action |
|---|---|---|
| `Argument error: Refusing to snapshot outside ~/Documents/Antygracity` | Root resolved outside the workspace | Pass `--root <path>` correctly or `--allow-any-root` for ad-hoc runs |
| `Argument error: --missing-only cannot be combined with --force` | Mutually exclusive flags | Drop one |
| `Runtime error: Manifest is missing the "files" array` | Snapshot dir corrupted | Pick another snapshot via `--snapshot` |
| `tick_error: ...` (watch mode only) | Per-tick failure (e.g., transient FS error) | Logged, loop continues; investigate after the session if persistent |
| Many `path_missing:` warnings | `--paths` lists directories that do not exist | Update `--paths` or accept that those subtrees are absent |

## Storage layout

```
<root>/.drive-sync-backup/
  2026-05-07T06-27-00.000Z/
    manifest.json
    consultify/
      src/
        components/
          Foo.tsx.snapshot
        utils/
          bar.ts.snapshot
      docs/
        product/
          some-doc.md.snapshot
  2026-05-07T06-28-00.000Z/
    manifest.json
    consultify/...
```

`manifest.json` shape:

```json
{
  "generatedAt": "2026-05-07T06:27:00.000Z",
  "root": "/Users/piotrwisniewski/Documents/Antygracity",
  "paths": ["consultify/src", "..."],
  "totals": { "files": 1234, "bytes": 5678901, "skipped": 7 },
  "files": [
    {
      "relPath": "consultify/src/components/Foo.tsx",
      "sha256": "<hex>",
      "size": 1234,
      "mtimeMs": 1714987620000
    }
  ],
  "skipped": [
    { "relPath": "consultify/src/legacy/big.json", "reason": "too_large", "size": 7340032 }
  ]
}
```

The `.snapshot` suffix on the mirrored files makes it visually obvious that a file inside `.drive-sync-backup/` is a backup copy and not a live source. The restore script strips the suffix when copying back.

`.drive-sync-backup/` should remain in the workspace `.gitignore`. It is machine-local: do not commit it, and do not rely on it across machines.

## Trade-offs

- **Disk usage**: each snapshot duplicates the tracked tree. With the default volatile paths and the 10-snapshot rotation, expect tens to a few hundred MiB depending on the workspace state. Lower `--max-snapshots` if disk pressure is real (always keeps at least 3).
- **Coverage**: binary assets are intentionally excluded. The script is a defense for source code and documentation, not for assets — those should rely on Drive's own version history or a dedicated asset workflow.
- **5 MiB cap**: oversized files (often generated JSON or fixture dumps) are skipped to keep snapshots fast. They appear in the `skipped` array of the manifest with `reason: "too_large"`.
- **Watch interval**: 60 s is a balance between catching reverts quickly and avoiding I/O storms. Drop to `--interval-ms 30000` during high-risk sessions; raise it for low-touch work.
- **Hash, then copy**: each tracked file is read twice per snapshot (once for SHA-256, once for the copy). For text trees this is negligible; the 5 MiB cap keeps the worst case bounded.
- **No external dependencies**: scripts use only `fs`, `path`, `crypto`, and `process` so the recovery tool itself cannot be broken by a sync revert of `node_modules`.

## Related

- `.cursor/rules/drive-sync-resilience.mdc` — the agent-facing rule that points at this document.
- `DRD/consultify/docs/operations/PRESENTATION_RUNTIME_AND_CONFIDENTIALITY_ROLLOUT_RUNBOOK.md` — Sprint 5 incident note covering related multi-file workflow risks.
- `DRD/consultify/docs/operations/INCIDENT_RESPONSE_PLAYBOOK.md` — general incident response procedures (escalation, severity).
- `DRD/consultify/docs/operations/DISASTER_RECOVERY.md` — broader DR posture; the snapshot tool is a developer-machine safety net, not a substitute for backups.
