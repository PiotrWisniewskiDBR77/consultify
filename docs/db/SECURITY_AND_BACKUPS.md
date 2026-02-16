# Security + Backups (SQLite → Railway Postgres migration)

## Why this exists

During the migration work we used `DATABASE_URL` values in local commands and (temporarily) in repo scripts. **Treat any previously used DB credentials as compromised** and rotate them before continuing.

## 1) Rotate secrets (mandatory)

### Railway Postgres credentials

- **Rotate the database password** (or create a fresh Postgres instance and delete the old one).
- Update Railway Variables:
  - `DATABASE_URL`
  - (optional) `DB_SSL=true`, `DB_SSL_REJECT_UNAUTHORIZED=false` if the proxy requires it

### API keys

If real keys were ever committed/printed/shared:

- Rotate `OPENAI_API_KEY`
- Rotate `GOOGLE_API_KEY` / `GEMINI_API_KEY`
- Rotate any other provider keys

## 2) Back up SQLite (source of truth)

### File-level snapshot

Copy the DB file and its WAL/SHM if present:

- `data/dev/consultinity.db`
- `data/dev/consultinity.db-wal`
- `data/dev/consultinity.db-shm`

Store snapshots under `data/dev/_backup/` (gitignored).

## 3) Back up Railway Postgres

Preferred: use Railway’s built-in backup / snapshot features.

If you have `pg_dump` available locally, you can also dump:

- schema-only
- data-only
- or full dump

Keep dumps outside the repo or in a gitignored folder (e.g. `_backup/`).

## 4) Repo hygiene rules

- Never commit `.env` or `.env.local` (repo already ignores them via `.gitignore`).
- Keep `.env.example` committed with placeholders only.
- Never hardcode `DATABASE_URL` with passwords inside `package.json` scripts or JS/TS files.
