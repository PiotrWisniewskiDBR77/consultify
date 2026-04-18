# Feedback Artifacts — Railway Volume Setup

Status: V2.1 (2026-04-17). Required step before enabling screenshots on production.

## Why this exists

`POST /api/feedback` (V2) accepts optional screenshot attachments. The API
writes them as files under `FEEDBACK_ARTIFACTS_DIR` and serves them via
`GET /api/feedback/:id/artifacts/screenshot` (SuperAdmin only).

Without a persistent Railway volume, every redeploy wipes the directory and
historical screenshots are lost. Once you attach the volume described below,
screenshots survive rebuilds.

A retention pruner (daily, 30-day default — `FEEDBACK_ARTIFACTS_RETENTION_DAYS`)
runs on boot and deletes files older than the retention window. It is safe to
run on both ephemeral dirs (dev) and mounted volumes (prod).

## One-time setup (per environment)

### 1. Create the volume

```bash
# Log into the right project/environment first
railway login
railway link                 # select project + environment (staging | production)

# Create a volume named "feedback-artifacts" (or any name you like)
railway volume create feedback-artifacts
```

### 2. Mount it on the API service

Attach the volume to the API service (the one running `server/dist/index.js`)
with the mount path **`/app/server/.feedback-artifacts`**.

Using the Railway dashboard:

1. Project → **Service: consultify-api** → **Variables & Volumes** tab.
2. **Volumes** → **Attach existing volume** → pick `feedback-artifacts`.
3. Mount path: `/app/server/.feedback-artifacts`.
4. Save, the service will redeploy automatically.

Using the CLI (once your CLI version supports it):

```bash
railway volume attach feedback-artifacts \
  --service consultify-api \
  --mount /app/server/.feedback-artifacts
```

### 3. Confirm env var

```bash
railway variables --service consultify-api | grep FEEDBACK_ARTIFACTS_DIR
```

Should print `FEEDBACK_ARTIFACTS_DIR=/app/server/.feedback-artifacts`.

If missing:

```bash
railway variables --service consultify-api set \
  FEEDBACK_ARTIFACTS_DIR=/app/server/.feedback-artifacts \
  FEEDBACK_ARTIFACTS_RETENTION_DAYS=30
railway redeploy --service consultify-api
```

### 4. Smoke check

```bash
railway ssh --service consultify-api
# Inside the container:
ls -la /app/server/.feedback-artifacts
df -h /app/server/.feedback-artifacts
```

Submit a test feedback with a screenshot from the Superadmin UI and confirm
the file appears in the listing.

## Why `/app/server/...` not `/app/...`

The Node.js process runs as user `nodejs` which **does not** own `/app/`.
Attempting `mkdir /app/.feedback-artifacts` returns `EACCES`. The `/app/server/`
subtree is writable, so we mount there.

## Rollback

Removing the volume does not break the API — screenshots just won't persist
across redeploys. Existing ticket metadata (JSON dossier, breadcrumbs,
console/network logs) continue to work without the volume.

## Cost note

Railway volumes are cheap (< $0.25/month per GB). At ~400 KB avg per
screenshot and ~50 attached tickets/month, 5 GB buys ~10k screenshots —
more than enough headroom for a year of feedback at current volume.
