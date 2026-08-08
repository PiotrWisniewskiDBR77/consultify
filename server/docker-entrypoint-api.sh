#!/bin/sh
# P0 follow-up (2026-07-22) — see server/docker-entrypoint.sh (the other
# Dockerfile) for the full incident writeup. This is the SAME fix, targeted
# at Dockerfile.api (the file Railway actually builds — railway.json
# dockerfilePath). The first attempt only patched the root Dockerfile, which
# docker-compose.yml uses locally but Railway does not.
#
# Runs as root (Dockerfile.api's final USER is `root`, overriding the earlier
# `USER nodejs` set before start.sh generation), chowns the mounted volume
# (if any) to nodejs:nodejs, then drops to nodejs via su-exec before running
# the SAME command the previous ENTRYPOINT+CMD combo ran:
# `dumb-init -- sh /app/server/start.sh`. Safe no-op without a volume.
set -e

TARGET_DIR="${STORAGE_DIR:-$RAILWAY_VOLUME_MOUNT_PATH}"
if [ -n "$TARGET_DIR" ] && [ -d "$TARGET_DIR" ]; then
  chown -R nodejs:nodejs "$TARGET_DIR" 2>/dev/null || true
fi

if [ "$#" -gt 0 ]; then
  exec su-exec nodejs dumb-init -- "$@"
fi

exec su-exec nodejs dumb-init -- sh /app/server/start.sh
