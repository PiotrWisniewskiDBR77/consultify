# LLM & Database Connection Guide

## Overview
This document provides quick reference instructions for connecting to the various Large Language Model (LLM) providers and databases used by the **consultify** application. Keep it handy when you need to troubleshoot authentication or configure new environments.

---
### 1. Environment Variables
All credentials are read from environment variables (see `.env`). The most common ones are:

| Variable | Purpose | Example |
|----------|---------|---------|
| `OPENAI_API_KEY` | OpenAI API key | `sk-xxxxxxxxxxxxxxxxxxxx` |
| `ANTHROPIC_API_KEY` | Anthropic API key | `sk-ant-xxxxxxxxxxxx` |
| `GEMINI_API_KEY` | Google Gemini key | `AIzaSy...` |
| `POSTGRES_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/dbname` |
| `SQLITE_PATH` | Path to SQLite file (default `consultify.db`) | `./consultify.db` |
| `LLM_PROVIDER` | Default provider identifier (`openai`, `anthropic`, `gemini`, `ollama`, etc.) |

> **Tip:** Use a `.env.local` file for local development and `.env.production` for production. The `dotenv` package automatically loads them.

---
### 2. LLM Provider Connections
The service `server/services/aiService.js` routes requests based on the provider configuration stored in the `llm_providers` table.

#### 2.1 OpenAI
```bash
# Ensure the API key is set
export OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx
```
- Endpoint: `https://api.openai.com/v1/chat/completions`
- Model IDs: `gpt-4`, `gpt-3.5-turbo`, etc.
- Authentication: Bearer token in `Authorization` header.

#### 2.2 Anthropic
```bash
export ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx
```
- Endpoint: `https://api.anthropic.com/v1/messages`
- Model IDs: `claude-3-sonnet-20240229`, `claude-3-opus-20240229`
- Header: `x-api-key` and `anthropic-version: 2023-06-01`.

#### 2.3 Google Gemini
```bash
export GEMINI_API_KEY=AIzaSy...
```
- Uses the `@google/generative-ai` SDK.
- Model IDs: `gemini-pro`, `gemini-1.5-flash` (vision capable).
- No explicit HTTP request; the SDK handles auth via the API key.

#### 2.4 Ollama (local)
```bash
# No API key required, just ensure Ollama is running on localhost
export OLLAMA_ENDPOINT=http://localhost:11434
```
- Endpoint: `http://localhost:11434/api/chat`
- Model IDs: e.g., `llama2`, `phi3`.

#### 2.5 Adding a New Provider
1. Insert a row into `llm_providers`:
   ```sql
   INSERT INTO llm_providers (provider, api_key, model_id, endpoint, is_active)
   VALUES ('myprovider', 'my-key', 'my-model', 'https://api.myprovider.com/v1', 1);
   ```
2. Restart the server (or reload the config) so `ModelRouter` picks up the new entry.

---
### 3. Database Connections
The app can run against **PostgreSQL** or **SQLite** based on `process.env.DATABASE_URL`.

#### 3.1 PostgreSQL
```bash
export DATABASE_URL=postgresql://user:pass@host:5432/consultify
```
- The `pg` package is used.
- Ensure the database user has `CREATE`, `SELECT`, `INSERT`, `UPDATE`, `DELETE` privileges.

#### 3.2 SQLite (default for local dev)
```bash
export SQLITE_PATH=./consultify.db
```
- The `sqlite3` package creates the file if it does not exist.
- No network connection required.

---
### 4. Testing Connections
You can run the built‑in health check endpoint:
```bash
curl http://localhost:3000/api/health
```
It will attempt to:
1. Verify the database connection.
2. Ping the default LLM provider (using a tiny prompt like "Say OK").
3. Return a JSON payload with status.

---
### 5. Common Issues & Fixes
| Symptom | Cause | Fix |
|---------|-------|-----|
| `401 Unauthorized` from OpenAI | Wrong or missing `OPENAI_API_KEY` | Re‑export the key, restart the server |
| `Connection refused` to Ollama | Ollama not running or wrong port | Start Ollama (`ollama serve`) or set `OLLAMA_ENDPOINT` correctly |
| SQLite file not found | `SQLITE_PATH` points to non‑existent directory | Create the directory or adjust the path |
| Missing tables after DB switch | Migration not run | Run `node server/scripts/migrate_dumper.js` or the appropriate seed script |

---
### 6. Quick Reference Commands
```bash
# Reload env variables (if using direnv or similar)
source .env

# Test OpenAI connection
node -e "require('./server/services/aiService.js').testProviderConnection({provider:'openai',api_key:process.env.OPENAI_API_KEY,model_id:'gpt-4'}).then(console.log)"

# Verify DB connection
node -e "require('./server/database.js').get(() => console.log('DB OK'))"
```

Keep this file updated whenever you add new providers or change credential handling.
