#!/bin/sh
# P0 follow-up (2026-07-22): Railway Volumes are mounted root-owned by
# default; this image runs the app as non-root (nodejs:1001, see Dockerfile).
# Without this step, the FIRST mkdir under a freshly-attached volume throws
# EACCES — storagePaths.ts's fail-soft catches it and falls back to ephemeral
# storage, so the app stays up, but the volume never actually gets used.
#
# This script runs as root (the image no longer sets USER before it), chowns
# the mounted volume (if any) to nodejs:nodejs, then drops to nodejs via
# su-exec for the real process — the app itself NEVER runs as root.
#
# Safe no-op when there is no volume: STORAGE_DIR/RAILWAY_VOLUME_MOUNT_PATH
# unset, or the path doesn't exist yet (chown -R on a missing dir is a no-op
# here, guarded by -d). Idempotent: chown on an already-correct owner is a
# harmless no-op.
set -e

TARGET_DIR="${STORAGE_DIR:-$RAILWAY_VOLUME_MOUNT_PATH}"
if [ -n "$TARGET_DIR" ] && [ -d "$TARGET_DIR" ]; then
  chown -R nodejs:nodejs "$TARGET_DIR" 2>/dev/null || true
fi

exec su-exec nodejs dumb-init -- node dist/src/index.js
