# System Context & Architecture Sources

## 🚨 CRITICAL: Source of Truth for LLM Configuration

**DO NOT USE** old configuration scripts found in `server/scripts/` or `server/seed/`. They are deprecated and contain stale keys.

**The ONLY valid configuration sources are:**

1.  **Environment**: `.env` (contains the actual API keys: `OPENAI_API_KEY`, `GEMINI_API_KEY`, etc.)
2.  **Database**: `llm_providers` table in SQLite (runtime authority)
3.  **Backup**: `secure_backups/working_keys.json` (backup of working keys)

## 🛠️ LLM Management Scripts (Use These!)

| Script                           | Purpose                    | Command                               |
| -------------------------------- | -------------------------- | ------------------------------------- |
| `scripts/validate_llm_keys.cjs`  | Verify all LLM connections | `node scripts/validate_llm_keys.cjs`  |
| `scripts/test_all_llm.cjs`       | Comprehensive API tests    | `node scripts/test_all_llm.cjs`       |
| `scripts/auto_repair_llm.cjs`    | Auto-fix LLM config issues | `node scripts/auto_repair_llm.cjs`    |
| `scripts/seed_llm_providers.cjs` | Sync .env → database       | `node scripts/seed_llm_providers.cjs` |

**Troubleshooting Flow:**

```
1. node scripts/test_all_llm.cjs       # Diagnose issues
2. node scripts/auto_repair_llm.cjs    # Auto-fix
3. node scripts/validate_llm_keys.cjs  # Verify fix
```

**Ignored/Deprecated Files (DELETED):**

- `server/scripts/seed-llm-config.js.bak`
- `server/scripts/seed_llm.js.bak`
- `server/seed_models.js`
- Any script with hardcoded API keys or `glm-4` (without plus)

## Active LLM Configuration (Verified 2025-12-31)

- **OpenAI**: `gpt-4o`
- **Google**: `gemini-1.5-pro` (Key ends in `...m6aA`)
- **DeepSeek**: `deepseek-chat`
- **Qwen**: `qwen-turbo`
- **Z.AI (Zhipu)**: `glm-4-plus` (NOT `glm-4` or `glm-4-flash`)
- **Cohere**: `command-r-plus`
- **NVIDIA**: `llama-3.1-405b`

## Project Structure Highlights

- **Backend Entry**: `server/index.js`
- **Database**: `server/database.sqlite` (SQLite)
- **Frontend Entry**: `App.tsx`
- **SuperAdmin View**: `views/superadmin/SuperAdminView.tsx`

## AI Implementation Details

- **Pipeline**: `server/services/ai/aiPipeline.js` (Central orchestration)
- **Permissions**: `server/services/permissionService.js` (Role & DB-backed PBAC)
- **Audit Logs**: `ai_audit_logs` table in SQLite.
